package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.local.ItemEntity
import com.bor_devs.shoplist.data.remote.ItemRecord
import com.bor_devs.shoplist.data.sync.matches
import com.bor_devs.shoplist.data.sync.reconcileCreatedItem
import com.bor_devs.shoplist.data.sync.reconcileItemSnapshot
import org.junit.Assert.*
import org.junit.Test

class ItemReconciliationTest {
    private val local = ItemEntity("local_a", "Milk", false, "", "dairy", true, 0, 10, false)
    private val record = ItemRecord("server_a", name = "Milk", category = "dairy", updated = "2026-10-15 09:00:00.000Z")

    @Test fun createAcknowledgementPreservesEditsMadeDuringRequest() {
        val edited = local.copy(checked = true, note = "two", inList = false, updatedAt = 20)
        val merged = reconcileCreatedItem(edited, record)
        assertEquals("server_a", merged.id)
        assertTrue(merged.checked)
        assertEquals("two", merged.note)
        assertFalse(merged.inList)
        assertEquals(20L, merged.updatedAt)
        assertTrue(merged.serverUpdated > 0)
        assertTrue(merged.dirty)
    }

    @Test fun unchangedCreateAcknowledgementIsClean() {
        assertFalse(reconcileCreatedItem(local, record).dirty)
    }

    @Test fun staleUpdateAcknowledgementDoesNotClearNewerPendingFields() {
        assertFalse(local.copy(note = "new note").matches(record))
        assertFalse(local.copy(checked = true).matches(record))
        assertFalse(local.copy(inList = false).matches(record))
        assertTrue(local.matches(record))
    }

    @Test fun refreshReconcilesAcceptedOfflineCreationWithoutDuplicatingIt() {
        val edited = local.copy(checked = true, note = "keep this")
        val remote = record.copy(externalId = local.id)
        val merged = reconcileItemSnapshot(listOf(edited), listOf(remote), emptySet(), { false }, 99)
        assertEquals(1, merged.size)
        assertEquals(record.id, merged.single().id)
        assertTrue(merged.single().checked)
        assertEquals("keep this", merged.single().note)
        assertTrue(merged.single().dirty)
    }

    @Test fun refreshDoesNotResurrectDurablyDeletedItems() {
        val merged = reconcileItemSnapshot(emptyList(), listOf(record), setOf(record.id), { false }, 99)
        assertTrue(merged.isEmpty())
    }

    @Test fun refreshPreservesDirtyAndQueuedUpdatesAndUnsentLocalItems() {
        val dirty = local.copy(id = record.id, note = "offline", dirty = true)
        assertEquals(listOf(dirty), reconcileItemSnapshot(listOf(dirty), listOf(record), emptySet(), { false }, 99))
        val pending = dirty.copy(dirty = false)
        assertEquals(listOf(pending), reconcileItemSnapshot(listOf(pending), listOf(record), emptySet(), { true }, 99))
        assertEquals(listOf(local), reconcileItemSnapshot(listOf(local), emptyList(), emptySet(), { false }, 99))
    }
}
