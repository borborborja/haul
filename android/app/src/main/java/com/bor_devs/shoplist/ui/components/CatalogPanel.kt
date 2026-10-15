package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.DefaultCatalog
import com.bor_devs.shoplist.domain.LocalizedItem
import com.bor_devs.shoplist.domain.catalogVisibilityKey
import com.bor_devs.shoplist.ui.i18n.*
import com.bor_devs.shoplist.ui.normalizedProductName
import com.bor_devs.shoplist.ui.theme.categoryColor

/** The same contextual catalog is available while planning and shopping. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CatalogPanel(
    categories: Map<String, Category>, inListNames: Set<String>, disabled: Set<String> = emptySet(),
    query: String, activeCategory: String, onQueryChange: (String) -> Unit, onCategoryChange: (String) -> Unit,
    onAddItem: (LocalizedItem, String) -> Unit, onNewProduct: (String, String) -> Unit,
    onNewCategory: (() -> Unit)?,
) {
    val t = LocalStrings.current
    val p = productStrings()
    val lang = LocalAppLang.current
    val orderedKeys = remember(categories) {
        categories.keys.sortedBy { DefaultCatalog.keys.indexOf(it).let { index -> if (index < 0) Int.MAX_VALUE else index } }
    }
    val activeBand = activeCategory.takeIf { it in categories } ?: orderedKeys.firstOrNull().orEmpty()
    val q = normalizedProductName(query)
    val suggestions = remember(q, categories, lang, disabled) {
        if (q.isBlank()) emptyList() else categories.values.flatMap { c ->
            c.items.filter { !isProductHidden(it, disabled) && normalizedProductName(it.forLang(lang)).contains(q) }.map { it to c.key }
        }.distinctBy { (item, cat) -> cat to normalizedProductName(item.forLang(lang)) }.take(12)
    }
    val exact = suggestions.firstOrNull { normalizedProductName(it.first.forLang(lang)) == q }
    fun submit() {
        if (q.isBlank()) return
        if (exact != null) onAddItem(exact.first, exact.second) else onNewProduct(activeBand, query.trim())
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        OutlinedTextField(value = query, onValueChange = onQueryChange,
            placeholder = { Text(p.search) }, leadingIcon = { Icon(Icons.Filled.Search, null) },
            trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { onQueryChange("") }) { Icon(Icons.Filled.Close, p.clearSearch) } },
            singleLine = true, shape = RoundedCornerShape(14.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { submit() }), modifier = Modifier.fillMaxWidth())

        if (q.isNotBlank()) {
            Column(Modifier.fillMaxWidth().heightIn(max = 200.dp).verticalScroll(rememberScrollState())) {
                suggestions.forEach { (product, cat) ->
                    val name = product.forLang(lang)
                    val selected = normalizedProductName(name) in inListNames
                    Row(Modifier.fillMaxWidth().clickable { onAddItem(product, cat) }.padding(horizontal = 8.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(categoryColor(cat)))
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(name, fontWeight = FontWeight.SemiBold)
                            Text(categories[cat]?.let { t.categoryName(it) } ?: cat, style = MaterialTheme.typography.labelSmall)
                        }
                        if (selected) Icon(Icons.Filled.Check, p.alreadyInList, tint = MaterialTheme.colorScheme.primary)
                        else Icon(Icons.Filled.Add, t.add)
                    }
                }
                if (suggestions.isEmpty()) Text(p.noMatches, modifier = Modifier.padding(8.dp), style = MaterialTheme.typography.bodySmall)
                if (exact == null) TextButton(onClick = { onNewProduct(activeBand, query.trim()) }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Add, null)
                    Text(p.createNamed.replace("{name}", query.trim()))
                }
            }
        }
        Text(t.selectCategory, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 8.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            items(orderedKeys, key = { it }) { key ->
                val cat = categories.getValue(key)
                FilterChip(selected = key == activeBand, onClick = { onCategoryChange(key) }, label = { Text("${cat.icon} ${t.categoryName(cat)}") })
            }
            if (onNewCategory != null) item { AssistChip(onClick = onNewCategory, label = { Text(t.newCategory) }, leadingIcon = { Icon(Icons.Filled.Add, null) }) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth().heightIn(max = 175.dp).verticalScroll(rememberScrollState())) {
            categories[activeBand]?.items?.filter { !isProductHidden(it, disabled) }?.forEach { product ->
                val name = product.forLang(lang)
                val selected = normalizedProductName(name) in inListNames
                FilterChip(selected = selected, onClick = { onAddItem(product, activeBand) },
                    label = { Text(name) }, leadingIcon = if (selected) ({ Icon(Icons.Filled.Check, p.alreadyInList, modifier = Modifier.size(16.dp)) }) else null)
            }
            AssistChip(onClick = { onNewProduct(activeBand, "") }, label = { Text(p.newProduct) }, leadingIcon = { Icon(Icons.Filled.Add, null) })
        }
    }
}

internal fun canonKey(item: LocalizedItem): String =
    item.en.ifBlank { item.es.ifBlank { item.ca } }.trim().lowercase()

internal fun isProductHidden(item: LocalizedItem, disabled: Set<String>): Boolean =
    catalogVisibilityKey(item) in disabled || canonKey(item) in disabled
