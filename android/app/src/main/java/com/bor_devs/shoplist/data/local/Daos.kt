package com.bor_devs.shoplist.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface ItemDao {
    @Query("SELECT * FROM items")
    fun observeAll(): Flow<List<ItemEntity>>

    @Query("SELECT * FROM items")
    suspend fun getAll(): List<ItemEntity>

    @Query("SELECT * FROM items WHERE id = :id")
    suspend fun getById(id: String): ItemEntity?

    @Upsert
    suspend fun upsert(item: ItemEntity)

    @Upsert
    suspend fun upsertAll(items: List<ItemEntity>)

    @Query("DELETE FROM items WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM items WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM items")
    suspend fun clear()

    /** Atomically replace the entire item set (no empty-list flicker). */
    @Transaction
    suspend fun replaceAll(items: List<ItemEntity>) {
        clear()
        upsertAll(items)
    }

    /** Replace the whole set of server-backed items, preserving local-only ids. */
    @Query("DELETE FROM items WHERE id NOT LIKE 'local_%'")
    suspend fun clearServerItems()
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM custom_categories")
    fun observeCategories(): Flow<List<CustomCategoryEntity>>

    @Query("SELECT * FROM custom_items")
    fun observeItems(): Flow<List<CustomItemEntity>>

    @Query("SELECT * FROM custom_categories")
    suspend fun getCategories(): List<CustomCategoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategory(cat: CustomCategoryEntity)

    @Query("DELETE FROM custom_categories WHERE key = :key")
    suspend fun deleteCategory(key: String)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertItem(item: CustomItemEntity)

    @Query("SELECT * FROM custom_items WHERE categoryKey = :key AND name = :name LIMIT 1")
    suspend fun findItem(key: String, name: String): CustomItemEntity?

    @Delete
    suspend fun deleteItem(item: CustomItemEntity)

    @Query("DELETE FROM custom_items WHERE categoryKey = :key AND name = :name")
    suspend fun deleteItemByName(key: String, name: String)
}
