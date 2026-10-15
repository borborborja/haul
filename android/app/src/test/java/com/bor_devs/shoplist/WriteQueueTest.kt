package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.remote.PbException
import com.bor_devs.shoplist.data.sync.WriteKind
import com.bor_devs.shoplist.data.sync.WriteOp
import com.bor_devs.shoplist.data.sync.WriteQueue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WriteQueueTest {

    @Test
    fun clearingQueueDiscardsOfflineWritesFromPreviousServer() = runTest {
        val executed = mutableListOf<WriteOp>()
        var online = false
        val q = WriteQueue(scope = this, isOnline = { online }, execute = { executed.add(it) })
        q.enqueueUpdate("shopping_items", "old", mapOf("checked" to true))
        runCurrent()
        q.clear()
        online = true
        q.flush()
        advanceUntilIdle()
        assertEquals(0, q.size())
        assertTrue(executed.isEmpty())
    }

    @Test
    fun clearingQueueCancelsInFlightWorkAndAllowsNewWrites() = runTest {
        val started = CompletableDeferred<Unit>()
        var calls = 0
        var applied = 0
        var gaveUp = 0
        val q = WriteQueue(scope = this, isOnline = { true }, execute = {
            calls++
            if (calls == 1) { started.complete(Unit); awaitCancellation() }
            null
        }, onApplied = { _, _ -> applied++ }, onGaveUp = { _, _ -> gaveUp++ })
        q.enqueueUpdate("shopping_items", "same", mapOf("checked" to true))
        started.await()
        q.clear()
        q.enqueueUpdate("shopping_items", "same", mapOf("checked" to false))
        advanceUntilIdle()
        assertEquals(2, calls)
        assertEquals(1, applied)
        assertEquals(0, gaveUp)
    }

    @Test
    fun coalescesUpdatesForSameRecord() = runTest {
        val executed = mutableListOf<WriteOp>()
        val q = WriteQueue(
            scope = this,
            retryDelaysMs = listOf(10, 20, 30),
            isOnline = { true },
            execute = { op -> executed.add(op); null },
        )
        q.enqueueUpdate("shopping_items", "1", mapOf("checked" to true))
        q.enqueueUpdate("shopping_items", "1", mapOf("note" to "hi"))
        advanceUntilIdle()

        assertEquals(1, executed.size)
        assertEquals(true, executed[0].body?.get("checked"))
        assertEquals("hi", executed[0].body?.get("note"))
    }

    @Test
    fun deleteSupersedesUpdate() = runTest {
        val executed = mutableListOf<WriteOp>()
        val q = WriteQueue(
            scope = this, retryDelaysMs = listOf(10), isOnline = { true },
            execute = { op -> executed.add(op); null },
        )
        q.enqueueUpdate("shopping_items", "1", mapOf("checked" to true))
        q.enqueueDelete("shopping_items", "1")
        advanceUntilIdle()

        assertEquals(1, executed.size)
        assertEquals(WriteKind.DELETE, executed[0].kind)
    }

    @Test
    fun retriesTransientThenGivesUp() = runTest {
        var calls = 0
        var gaveUp = false
        val q = WriteQueue(
            scope = this, retryDelaysMs = listOf(10, 20, 30), isOnline = { true },
            execute = { calls++; throw PbException(500, "server") },
            onGaveUp = { _, _ -> gaveUp = true },
            shouldRetry = { e, _ -> ((e as? PbException)?.status ?: 0).let { it == 0 || it >= 500 } },
        )
        q.enqueueUpdate("shopping_items", "1", mapOf("checked" to true))
        advanceUntilIdle()

        assertEquals(4, calls) // initial + 3 retries
        assertTrue(gaveUp)
    }

    @Test
    fun clientErrorGivesUpImmediately() = runTest {
        var calls = 0
        var gaveUp = false
        val q = WriteQueue(
            scope = this, retryDelaysMs = listOf(10, 20, 30), isOnline = { true },
            execute = { calls++; throw PbException(400, "bad request") },
            onGaveUp = { _, _ -> gaveUp = true },
            shouldRetry = { e, _ -> ((e as? PbException)?.status ?: 0).let { it == 0 || it >= 500 } },
        )
        q.enqueueUpdate("shopping_items", "1", mapOf("name" to "x"))
        advanceUntilIdle()

        assertEquals(1, calls)
        assertTrue(gaveUp)
    }
}
