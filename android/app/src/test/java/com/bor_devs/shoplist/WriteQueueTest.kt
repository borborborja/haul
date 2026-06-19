package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.remote.PbException
import com.bor_devs.shoplist.data.sync.WriteKind
import com.bor_devs.shoplist.data.sync.WriteOp
import com.bor_devs.shoplist.data.sync.WriteQueue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WriteQueueTest {

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
