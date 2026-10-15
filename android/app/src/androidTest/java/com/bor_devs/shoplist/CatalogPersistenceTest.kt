package com.bor_devs.shoplist

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.room.withTransaction
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.bor_devs.shoplist.data.local.*
import com.bor_devs.shoplist.di.MIGRATION_4_5
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class CatalogPersistenceTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private fun open(name: String) = Room.databaseBuilder(context, AppDatabase::class.java, name).addMigrations(MIGRATION_4_5).build()
    private val row = CatalogMutationEntity("https://server.test", "list_a", "stablecatalog01", "list_items", """{"category_key":"dairy","name":"Milk"}""")

    @Test fun durableMutationSurvivesReopenAndOldAcknowledgementKeepsNewerRevisionPending() = runBlocking {
        val name = "catalog-test-${UUID.randomUUID()}.db"
        try {
            open(name).also { db ->
                db.withTransaction {
                    db.catalogMutationDao().upsert(row)
                    db.categoryDao().insertItem(CustomItemEntity(categoryKey = "dairy", name = "Milk", sourceId = row.entityId))
                }
                db.close()
            }
            open(name).also { db ->
                val restored = db.catalogMutationDao().forList(row.origin, row.localListId).single()
                assertEquals(row, restored)
                assertTrue(db.catalogMutationDao().forList("https://different.test", row.localListId).isEmpty())
                assertTrue(db.catalogMutationDao().forList(row.origin, "list_b").isEmpty())
                db.catalogMutationDao().upsert(restored.copy(revision = 2, payload = """{"category_key":"drinks","name":"Oat milk"}"""))
                db.catalogMutationDao().acknowledge(row.origin, row.localListId, row.entityId, row.entityId, "remote_list", 1)
                val newer = db.catalogMutationDao().get(row.origin, row.localListId, row.entityId)!!
                assertEquals(2L, newer.revision)
                assertEquals(1L, newer.acknowledgedRevision)
                assertTrue(newer.payload.contains("Oat milk"))
                db.close()
            }
        } finally { context.deleteDatabase(name) }
    }

    @Test fun failedLocalTransactionDoesNotLeaveAPartialRemoteCreation() = runBlocking {
        val name = "catalog-test-${UUID.randomUUID()}.db"
        val db = open(name)
        try {
            try {
                db.withTransaction { db.catalogMutationDao().upsert(row); error("Simulated failed purchase insert") }
            } catch (_: IllegalStateException) { }
            assertTrue(db.catalogMutationDao().forList(row.origin, row.localListId).isEmpty())
        } finally { db.close(); context.deleteDatabase(name) }
    }

    @Test fun migrationFromVersionFourPreservesExistingPurchasesAndCatalog() = runBlocking {
        val name = "catalog-test-${UUID.randomUUID()}.db"
        val path = context.getDatabasePath(name)
        path.parentFile?.mkdirs()
        SQLiteDatabase.openOrCreateDatabase(path, null).use { db ->
            db.execSQL("CREATE TABLE items (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, checked INTEGER NOT NULL, note TEXT NOT NULL, category TEXT NOT NULL, inList INTEGER NOT NULL, serverUpdated INTEGER NOT NULL, updatedAt INTEGER NOT NULL, dirty INTEGER NOT NULL, addedBy TEXT NOT NULL, checkedBy TEXT NOT NULL)")
            db.execSQL("CREATE TABLE custom_categories (`key` TEXT NOT NULL PRIMARY KEY, icon TEXT NOT NULL)")
            db.execSQL("CREATE TABLE custom_items (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, categoryKey TEXT NOT NULL, name TEXT NOT NULL)")
            db.execSQL("CREATE TABLE disabled_products (name TEXT NOT NULL PRIMARY KEY)")
            db.execSQL("CREATE TABLE pending_item_deletes (id TEXT NOT NULL PRIMARY KEY, listId TEXT NOT NULL)")
            db.execSQL("INSERT INTO items VALUES ('old','Milk',0,'Oat','dairy',1,0,1,0,'','')")
            db.execSQL("INSERT INTO custom_categories VALUES ('pets','🐈')")
            db.execSQL("INSERT INTO custom_items(categoryKey,name) VALUES ('pets','Cat food')")
            db.version = 4
        }
        try {
            open(name).also { db ->
                assertEquals("Oat", db.itemDao().getById("old")!!.note)
                assertEquals("", db.itemDao().getById("old")!!.quantity)
                assertEquals("pets", db.categoryDao().getCategories().single().key)
                assertEquals("Cat food", db.categoryDao().getItems().single().name)
                db.catalogMutationDao().upsert(row)
                assertEquals(row, db.catalogMutationDao().get(row.origin, row.localListId, row.entityId))
                db.close()
            }
        } finally { context.deleteDatabase(name) }
    }
}
