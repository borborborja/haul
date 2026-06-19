package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.sync.SyncMeta
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncMetaTest {

    @Test
    fun parsePbDate_parsesPocketBaseFormat() {
        val millis = SyncMeta.parsePbDate("2024-01-15 14:30:00.123Z")
        assertTrue(millis > 0)
        // Same instant in ISO-T form must parse identically.
        assertEquals(millis, SyncMeta.parsePbDate("2024-01-15T14:30:00.123Z"))
    }

    @Test
    fun parsePbDate_blankIsZero() {
        assertEquals(0, SyncMeta.parsePbDate(null))
        assertEquals(0, SyncMeta.parsePbDate(""))
    }

    @Test
    fun shouldSkip_whenWriteInFlight() {
        val meta = SyncMeta()
        meta.beginWrite("a")
        assertTrue(meta.shouldSkipRemoteUpdate("a", "2024-01-15 14:30:00.000Z", 0))
        meta.endWrite("a")
        assertFalse(meta.hasPendingWrite("a"))
    }

    @Test
    fun shouldSkip_whenIncomingNotNewer() {
        val meta = SyncMeta()
        val known = SyncMeta.parsePbDate("2024-01-15 14:30:00.000Z")
        // Older / equal incoming -> skip
        assertTrue(meta.shouldSkipRemoteUpdate("a", "2024-01-15 14:30:00.000Z", known))
        assertTrue(meta.shouldSkipRemoteUpdate("a", "2024-01-15 14:29:00.000Z", known))
        // Newer incoming -> apply
        assertFalse(meta.shouldSkipRemoteUpdate("a", "2024-01-15 14:31:00.000Z", known))
    }

    @Test
    fun nestedWrites_balanceCorrectly() {
        val meta = SyncMeta()
        meta.beginWrite("x"); meta.beginWrite("x")
        assertTrue(meta.hasPendingWrite("x"))
        meta.endWrite("x")
        assertTrue(meta.hasPendingWrite("x"))
        meta.endWrite("x")
        assertFalse(meta.hasPendingWrite("x"))
    }
}
