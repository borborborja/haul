package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.local.CustomCategoryEntity
import com.bor_devs.shoplist.data.local.CustomItemEntity
import com.bor_devs.shoplist.data.local.DisabledProductEntity
import com.bor_devs.shoplist.data.prefs.CachedListExtras
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class CachedListExtrasTest {
    @Test fun persistedExtrasKeepEachListsCustomAndDisabledDataSeparate() {
        val first = CachedListExtras(
            categories = listOf(CustomCategoryEntity("pets", "🐈")),
            items = listOf(CustomItemEntity(7, "pets", "Cat food")),
            disabledProducts = listOf(DisabledProductEntity("milk")),
            disabledCategories = setOf("drinks"),
        )
        val caches = mapOf("list_a" to first, "list_b" to CachedListExtras())
        val restored = Json.decodeFromString<Map<String, CachedListExtras>>(Json.encodeToString(caches))
        assertEquals(first, restored["list_a"])
        assertEquals(CachedListExtras(), restored["list_b"])
        assertTrue(restored.getValue("list_b").categories.isEmpty())
        assertTrue(restored.getValue("list_b").disabledProducts.isEmpty())
    }

    @Test fun olderEmptyCacheRetainsCompatibleDefaults() {
        assertEquals(CachedListExtras(), Json.decodeFromString<CachedListExtras>("{}"))
    }
}
