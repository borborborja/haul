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
) {
    fun toDomain() = ShopItem(
        id = id, name = name, checked = checked, note = note, category = category,
        inList = inList, serverUpdated = serverUpdated, updatedAt = updatedAt, dirty = dirty,
    )

    companion object {
        fun from(i: ShopItem) = ItemEntity(
            id = i.id, name = i.name, checked = i.checked, note = i.note, category = i.category,
            inList = i.inList, serverUpdated = i.serverUpdated, updatedAt = i.updatedAt, dirty = i.dirty,
        )
    }
}

/** Per-list custom category (icon). Default catalog categories live in code. */
@Entity(tableName = "custom_categories")
data class CustomCategoryEntity(
    @PrimaryKey val key: String,
    val icon: String,
)

/** A custom suggestion item the user added to a category. */
@Entity(tableName = "custom_items")
data class CustomItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryKey: String,
    val name: String,
)

/** A catalog product deactivated for the active list (canonical lowercase key). */
@Entity(tableName = "disabled_products")
data class DisabledProductEntity(
    @PrimaryKey val name: String,
)
