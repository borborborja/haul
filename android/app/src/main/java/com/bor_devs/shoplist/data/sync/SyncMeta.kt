package com.bor_devs.shoplist.data.sync

import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Module-level sync coordination, ported from web/src/lib/syncMeta.ts. Tracks
 * writes in flight per record and decides when an incoming realtime update is
 * a stale echo that must be ignored. Deliberately not persisted.
 */
@Singleton
class SyncMeta @Inject constructor() {
    private val pendingWrites = ConcurrentHashMap<String, Int>()

    /** Temp ("local_") ids whose create request is currently in flight. */
    val pendingCreates: MutableSet<String> = ConcurrentHashMap.newKeySet()

    fun beginWrite(id: String) {
        pendingWrites.merge(id, 1, Int::plus)
    }

    fun endWrite(id: String) {
        pendingWrites.compute(id) { _, count -> if ((count ?: 0) <= 1) null else count!! - 1 }
    }

    fun hasPendingWrite(id: String): Boolean = pendingWrites.containsKey(id)

    /**
     * Ignore a realtime update when we have our own write in flight for the
     * record, or when the event's server timestamp is not newer than the
     * version we already applied (stale / out-of-order).
     */
    fun shouldSkipRemoteUpdate(id: String, recordUpdated: String?, knownServerUpdated: Long): Boolean {
        if (hasPendingWrite(id)) return true
        val incoming = parsePbDate(recordUpdated)
        return incoming > 0 && knownServerUpdated > 0 && incoming <= knownServerUpdated
    }

    companion object {
        fun parsePbDate(s: String?): Long {
            if (s.isNullOrBlank()) return 0
            return try {
                // PocketBase format: "2024-01-15 14:30:00.123Z" -> ISO instant.
                val iso = s.trim().replace(' ', 'T')
                Instant.parse(iso).toEpochMilli()
            } catch (_: Exception) {
                0
            }
        }
    }
}
