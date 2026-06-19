package com.bor_devs.shoplist.data.sync

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class WriteKind { UPDATE, DELETE }

data class WriteOp(
    val collection: String,
    val recordId: String,
    val kind: WriteKind,
    val body: Map<String, Any?>? = null,
    val attempts: Int = 0,
)

/**
 * Generic per-record write queue with coalescing and retry/backoff, ported 1:1
 * from web/src/lib/writeQueue.ts. A later enqueue for the same record merges
 * with the pending op (a delete supersedes updates); transient failures retry
 * with backoff; a permanently rejected write invokes [onGaveUp].
 */
class WriteQueue(
    private val scope: CoroutineScope,
    private val retryDelaysMs: List<Long> = listOf(1000, 3000, 9000),
    private val isOnline: () -> Boolean,
    private val execute: suspend (WriteOp) -> Any?,
    private val onApplied: (WriteOp, Any?) -> Unit = { _, _ -> },
    private val onGaveUp: (WriteOp, Throwable) -> Unit = { _, _ -> },
    private val shouldRetry: (Throwable, WriteOp) -> Boolean = { _, _ -> true },
) {
    private val lock = Mutex()
    private val ops = LinkedHashMap<String, WriteOp>()
    private val timers = HashMap<String, Job>()
    private val running = HashSet<String>()

    private fun keyOf(collection: String, recordId: String) = "$collection:$recordId"

    fun enqueueUpdate(collection: String, recordId: String, body: Map<String, Any?>) {
        scope.launch {
            lock.withLock {
                val key = keyOf(collection, recordId)
                val existing = ops[key]
                if (existing?.kind == WriteKind.DELETE) return@withLock // delete supersedes
                ops[key] = WriteOp(
                    collection, recordId, WriteKind.UPDATE,
                    body = (existing?.body ?: emptyMap()) + body,
                    attempts = 0,
                )
                schedule(key, 0)
            }
        }
    }

    fun enqueueDelete(collection: String, recordId: String) {
        scope.launch {
            lock.withLock {
                val key = keyOf(collection, recordId)
                ops[key] = WriteOp(collection, recordId, WriteKind.DELETE, attempts = 0)
                schedule(key, 0)
            }
        }
    }

    fun flush() {
        scope.launch {
            lock.withLock {
                for ((key, op) in ops) {
                    ops[key] = op.copy(attempts = 0)
                    schedule(key, 0)
                }
            }
        }
    }

    suspend fun size(): Int = lock.withLock { ops.size }

    // must be called holding [lock]
    private fun schedule(key: String, delayMs: Long) {
        timers[key]?.cancel()
        timers[key] = scope.launch {
            if (delayMs > 0) delay(delayMs)
            lock.withLock { timers.remove(key) }
            run(key)
        }
    }

    private suspend fun run(key: String) {
        val op: WriteOp = lock.withLock {
            if (running.contains(key)) return
            val current = ops[key] ?: return
            if (!isOnline()) return // flush() re-schedules on reconnect
            running.add(key)
            ops.remove(key) // claim
            current
        }

        try {
            val result = execute(op)
            onApplied(op, result)
        } catch (error: Throwable) {
            val retriable = shouldRetry(error, op)
            lock.withLock {
                if (retriable && op.attempts < retryDelaysMs.size) {
                    val requeued = ops[key]
                    if (requeued != null) {
                        // Newer intent queued meanwhile; keep its fields on top.
                        if (op.kind == WriteKind.UPDATE && requeued.kind == WriteKind.UPDATE) {
                            ops[key] = requeued.copy(body = (op.body ?: emptyMap()) + (requeued.body ?: emptyMap()))
                        }
                    } else {
                        ops[key] = op.copy(attempts = op.attempts + 1)
                    }
                    schedule(key, retryDelaysMs[minOf(op.attempts, retryDelaysMs.size - 1)])
                } else if (!ops.containsKey(key)) {
                    onGaveUp(op, error)
                }
            }
        } finally {
            lock.withLock {
                running.remove(key)
                if (ops.containsKey(key) && !timers.containsKey(key)) schedule(key, 0)
            }
        }
    }
}
