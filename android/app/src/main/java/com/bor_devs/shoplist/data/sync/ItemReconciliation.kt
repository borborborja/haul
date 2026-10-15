package com.bor_devs.shoplist.data.sync

import com.bor_devs.shoplist.data.local.ItemEntity
import com.bor_devs.shoplist.data.remote.ItemRecord

/** Compare the editable fields before clearing a durable pending change. */
internal fun ItemEntity.matches(record: ItemRecord): Boolean =
    name == record.name && checked == record.checked && note == record.note &&
        category == record.category.ifBlank { "other" } && inList == record.inList

/** A create response acknowledges its original body, not edits made while waiting. */
internal fun reconcileCreatedItem(local: ItemEntity, record: ItemRecord): ItemEntity =
    local.copy(
        id = record.id,
        serverUpdated = SyncMeta.parsePbDate(record.updated),
        dirty = !local.matches(record),
        addedBy = record.addedBy,
        checkedBy = record.checkedBy,
    )

internal fun reconcileItemSnapshot(
    local: List<ItemEntity>,
    records: List<ItemRecord>,
    deletedIds: Set<String>,
    hasPendingWrite: (String) -> Boolean,
    nowMillis: Long,
): List<ItemEntity> {
    val byId = local.associateBy { it.id }
    val externalIds = records.map { it.externalId }.filter { it.isNotBlank() }.toSet()
    val offline = local.filter { it.id.startsWith("local_") && it.id !in externalIds }
    val merged = records.filterNot { it.id in deletedIds }.map { record ->
        val temp = byId[record.externalId]?.takeIf { it.id.startsWith("local_") }
        val existing = byId[record.id]
        when {
            temp != null -> reconcileCreatedItem(temp, record)
            existing != null && (existing.dirty || hasPendingWrite(record.id)) -> existing
            else -> ItemEntity(
                id = record.id, name = record.name, checked = record.checked, note = record.note,
                category = record.category.ifBlank { "other" }, inList = record.inList,
                serverUpdated = SyncMeta.parsePbDate(record.updated), updatedAt = existing?.updatedAt ?: nowMillis,
                dirty = false, addedBy = record.addedBy, checkedBy = record.checkedBy,
            )
        }
    }
    return offline + merged
}
