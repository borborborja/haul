package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.local.CatalogMutationEntity
import com.bor_devs.shoplist.data.remote.PbException
import com.bor_devs.shoplist.data.sync.CatalogMutationSync
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CatalogMutationSyncTest {
    private val pending = CatalogMutationEntity("https://original.test", "local_a", "stablecatalog01", "list_items", """{"category_key":"dairy","name":"Milk"}""")

    @Test fun lostCreateResponseAndRestartUseTheSameIdentity() = runTest {
        var record: JsonObject? = null
        var creates = 0
        val transport: suspend (String, String, JsonObject?, String, String?) -> JsonObject = { method, path, body, origin, token ->
            assertEquals(pending.origin, origin)
            assertEquals("original-token", token)
            when {
                method == "GET" && path.contains('?') -> buildJsonObject { put("items", JsonArray(emptyList())) }
                method == "GET" -> record ?: throw PbException(404, "Missing")
                method == "POST" -> {
                    creates++
                    record = body!!
                    throw PbException(0, "Connection lost after commit")
                }
                method == "PATCH" -> JsonObject(record!! + body!!).also { record = it }
                else -> error("Unexpected request")
            }
        }
        try { CatalogMutationSync(transport).sync(pending, "list_a", "original-token"); fail("Expected lost response") } catch (e: PbException) { assertEquals(0, e.status) }
        // Reconstruct the worker: no transient in-memory creation state survives.
        val id = CatalogMutationSync(transport).sync(pending.copy(payload = """{"category_key":"drinks","name":"Oat milk"}""", revision = 2), "list_a", "original-token")
        assertEquals(pending.entityId, id)
        assertEquals(1, creates)
        assertEquals("Oat milk", record!!["name"]!!.jsonPrimitive.content)
    }

    @Test fun naturalDuplicateAdoptsItsServerIdentityWithoutOverwritingIt() = runTest {
        val existing = buildJsonObject { put("id", "existingrecord1"); put("list", "list_a"); put("name", "Milk"); put("category_key", "dairy") }
        var writes = 0
        val worker = CatalogMutationSync({ method, path, _, _, _ ->
            if (method != "GET") { writes++; error("Duplicate must not write") }
            if (path.contains('?')) buildJsonObject { put("items", JsonArray(listOf(existing))) } else throw PbException(404, "Missing")
        })
        assertEquals("existingrecord1", worker.sync(pending, "list_a", "token"))
        assertEquals(0, writes)
    }

    @Test fun refusesToMutateARecordFromAnotherList() = runTest {
        var writes = 0
        val worker = CatalogMutationSync({ method, _, _, _, _ ->
            if (method != "GET") writes++
            buildJsonObject { put("id", pending.entityId); put("list", "other_list") }
        })
        try { worker.sync(pending, "list_a", "token"); fail("Expected scope rejection") } catch (e: PbException) { assertEquals(403, e.status) }
        assertEquals(0, writes)
    }

    @Test fun visibilityRebindingAdoptsAnExistingIdentityInsteadOfLosingTheHide() = runTest {
        val old = buildJsonObject { put("id", "old-hidden"); put("list", "list_a"); put("name", "old-identity") }
        val existing = buildJsonObject { put("id", "new-hidden"); put("list", "list_a"); put("name", "new-identity") }
        var deletes = 0
        val worker = CatalogMutationSync({ method, path, _, _, _ ->
            when {
                method == "GET" && path.contains('?') -> buildJsonObject { put("items", JsonArray(listOf(existing))) }
                method == "GET" -> old
                method == "PATCH" -> throw PbException(400, "Unique visibility key")
                method == "DELETE" -> { deletes++; JsonObject(emptyMap()) }
                else -> error("Unexpected create")
            }
        })
        val row = pending.copy(collection = "list_disabled_products", remoteId = "old-hidden", payload = """{"name":"new-identity"}""")
        assertEquals("new-hidden", worker.sync(row, "list_a", "token"))
        assertEquals(1, deletes)
    }

    @Test fun deletionOfAlreadyMissingRecordIsAcknowledged() = runTest {
        val worker = CatalogMutationSync({ _, path, _, _, _ ->
            if (path.contains('?')) buildJsonObject { put("items", JsonArray(emptyList())) } else throw PbException(404, "Missing")
        })
        assertEquals(pending.entityId, worker.sync(pending.copy(deleted = true), "list_a", "token"))
    }
}
