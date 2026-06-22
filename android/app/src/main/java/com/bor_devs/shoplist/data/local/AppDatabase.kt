package com.bor_devs.shoplist.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [ItemEntity::class, CustomCategoryEntity::class, CustomItemEntity::class, DisabledProductEntity::class],
    version = 3,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun itemDao(): ItemDao
    abstract fun categoryDao(): CategoryDao
    abstract fun disabledDao(): DisabledDao
}
