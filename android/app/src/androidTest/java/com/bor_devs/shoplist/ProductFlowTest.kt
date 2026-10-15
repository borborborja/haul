package com.bor_devs.shoplist

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.bor_devs.shoplist.domain.*
import com.bor_devs.shoplist.ui.components.CatalogPanel
import com.bor_devs.shoplist.ui.components.ProductEditorSheet
import com.bor_devs.shoplist.ui.i18n.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ProductFlowTest {
    @get:Rule val compose = createComposeRule()
    private val categories = mapOf("dairy" to Category("dairy", "🥛", listOf(LocalizedItem("Café", "Cafè", "Coffee"))))

    @Composable private fun English(content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalAppLang provides Lang.EN, LocalStrings provides stringsFor(Lang.EN)) { MaterialTheme { content() } }
    }

    @Test fun consecutiveCreationKeepsCategoryAndClearsNameAfterSuccess() {
        val calls = mutableListOf<Pair<String, String>>()
        compose.setContent { English {
            ProductEditorSheet(categories, null, "Milk", "dairy", true, null, true, true, {},
                onCreate = { name, category, _, _, _ -> calls.add(name to category); ProductCommandResult(CommandStatus.SAVED_LOCAL) },
                onEdit = { _, _, _, _, _, _ -> error("not editing") }, onSaved = {}, onDismiss = {})
        } }
        compose.onNodeWithText("Save and add another").performScrollTo().performClick()
        compose.waitUntil { calls.size == 1 }
        compose.onNodeWithText("Product name").assertTextContains("Product name")
        compose.onNodeWithText("Product name").performTextReplacement("Yogurt")
        compose.onNodeWithText("Save and add another").performScrollTo().performClick()
        compose.waitUntil { calls.size == 2 }
        assertEquals(listOf("Milk" to "dairy", "Yogurt" to "dairy"), calls)
    }

    @Test fun pastedProductsAreCreatedIndividuallyAndFailuresRemainVisible() {
        val calls = mutableListOf<String>()
        compose.setContent { English {
            ProductEditorSheet(categories, null, "Milk\nBread\nMilk", "dairy", true, null, true, true, {},
                onCreate = { name, _, _, _, _ -> calls.add(name); ProductCommandResult(CommandStatus.SAVED_LOCAL) },
                onEdit = { _, _, _, _, _, _ -> error("not editing") }, onSaved = {}, onDismiss = {})
        } }
        compose.onNodeWithText("Create products").performScrollTo().performClick()
        compose.waitUntil { calls.size == 2 }
        assertEquals(listOf("Milk", "Bread"), calls)
        compose.onNodeWithText("Repeated in pasted text", substring = true).assertExists()
    }

    @Test fun editingDoesNotUpdateCatalogUnlessRequested() {
        var saved: List<String>? = null
        var updateCatalog: Boolean? = null
        val item = ShopItem("one", "Milk", category = "dairy", sourceKind = "custom", quantity = "2", note = "Cold")
        compose.setContent { English {
            ProductEditorSheet(categories, item, item.name, item.category, true, null, true, true, {},
                onCreate = { _, _, _, _, _ -> error("not creating") },
                onEdit = { _, name, category, quantity, note, catalog -> saved = listOf(name, category, quantity, note); updateCatalog = catalog; ProductCommandResult(CommandStatus.SAVED_LOCAL) },
                onSaved = {}, onDismiss = {})
        } }
        compose.onNodeWithText("Save").performScrollTo().performClick()
        compose.waitUntil { saved != null }
        assertEquals(listOf("Milk", "dairy", "2", "Cold"), saved)
        assertFalse(updateCatalog!!)
    }

    @Test fun accentedSearchAndRepeatedTapsOnlyRequestAddition() {
        var additions = 0
        var creations = 0
        compose.setContent {
            CompositionLocalProvider(LocalAppLang provides Lang.CA, LocalStrings provides stringsFor(Lang.CA)) {
                MaterialTheme {
                    CatalogPanel(categories, setOf("cafe"), query = "  CAFE  ", activeCategory = "dairy", onQueryChange = {}, onCategoryChange = {},
                        onAddItem = { _, _ -> additions++ }, onNewProduct = { _, _ -> creations++ }, onNewCategory = null)
                }
            }
        }
        compose.onAllNodesWithText("Cafè")[0].performClick().performClick()
        assertEquals(2, additions)
        assertEquals(0, creations)
    }
}
