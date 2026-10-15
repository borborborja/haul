package com.bor_devs.shoplist.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.ShopItem

@Entity(tableName = "items")
data class ItemEntity(
    @PrimaryKey val id: String,
    val name: String,
    val checked: Boolean,
    val note: String,
    val category: String,
    val inList: Boolean,
    val serverUpdated: Long,
    val updatedAt: Long,
    val dirty: Boolean,
    val addedBy: String = "",
    val checkedBy: String = "",
) {
    fun toDomain() = ShopItem(
        id = id, name = name, checked = checked, note = note, category = category,
        inList = inList, serverUpdated = serverUpdated, updatedAt = updatedAt, dirty = dirty,
        addedBy = addedBy, checkedBy = checkedBy,
    )

    companion object {
        fun from(i: ShopItem) = ItemEntity(
            id = i.id, name = i.name, checked = i.checked, note = i.note, category = i.category,
            inList = i.inList, serverUpdated = i.serverUpdated, updatedAt = i.updatedAt, dirty = i.dirty,
            addedBy = i.addedBy, checkedBy = i.checkedBy,
        )
    }
}

/** Per-list custom category (icon). Default catalog categories live in code. */
@Entity(tableName = "custom_categories")
@kotlinx.serialization.Serializable
data class CustomCategoryEntity(
    @PrimaryKey val key: String,
    val icon: String,
)

/** A custom suggestion item the user added to a category. */
@Entity(tableName = "custom_items")
@kotlinx.serialization.Serializable
data class CustomItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryKey: String,
    val name: String,
)

/** A catalog product deactivated for the active list (canonical lowercase key). */
@Entity(tableName = "disabled_products")
@kotlinx.serialization.Serializable
data class DisabledProductEntity(
    @PrimaryKey val name: String,
)

/** Durable tombstone: an offline deletion must survive process death/list switches. */
@Entity(tableName = "pending_item_deletes")
data class PendingItemDeleteEntity(
    @PrimaryKey val id: String,
    val listId: String,
)
