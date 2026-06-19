package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.ui.theme.categoryColor

private data class Suggestion(val name: String, val category: String, val icon: String)

@Composable
fun AddBar(
    categories: Map<String, Category>,
    onAdd: (name: String, category: String) -> Unit,
    onAddToCatalog: (category: String, name: String) -> Unit,
    onOpenSettings: (() -> Unit)? = null,
) {
    val t = LocalStrings.current
    val lang = systemLang()
    var text by remember { mutableStateOf("") }
    var showSuggestions by remember { mutableStateOf(false) }
    var showCategoryPicker by remember { mutableStateOf(false) }

    val allItems = remember(categories, lang) {
        categories.values.flatMap { cat ->
            cat.items.map { Suggestion(it.forLang(lang), cat.key, cat.icon) }
        }
    }

    val suggestions = remember(text, allItems) {
        val q = text.trim().lowercase()
        if (q.length < 2) emptyList()
        else allItems
            .filter { it.name.lowercase().contains(q) }
            .distinctBy { it.name.lowercase() }
            .take(8)
    }

    val exactMatch = remember(text, suggestions) {
        val q = text.trim().lowercase()
        suggestions.find { it.name.lowercase() == q }
    }

    fun submit() {
        val name = text.trim()
        if (name.isEmpty()) return

        if (exactMatch != null) {
            onAdd(exactMatch.name, exactMatch.category)
            text = ""
            showSuggestions = false
            return
        }

        // No exact match — show category picker for custom product
        showSuggestions = false
        showCategoryPicker = true
    }

    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = text,
                    onValueChange = {
                        text = it
                        showSuggestions = it.length >= 2
                    },
                    placeholder = { Text(t.placeholder) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                    trailingIcon = {
                        IconButton(onClick = { submit() }) {
                            Icon(Icons.Default.Add, contentDescription = t.add, tint = MaterialTheme.colorScheme.primary)
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                )
                if (onOpenSettings != null) {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = t.settings)
                    }
                }
            }

            // Suggestions overlay (non-focus-taking Surface instead of DropdownMenu)
            if (showSuggestions && suggestions.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    tonalElevation = 3.dp,
                    shadowElevation = 4.dp,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column {
                        suggestions.forEach { s ->
                            val col = categoryColor(s.category)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onAdd(s.name, s.category)
                                        text = ""
                                        showSuggestions = false
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Text(s.icon, style = MaterialTheme.typography.bodyLarge)
                                Spacer(Modifier.width(8.dp))
                                Text(s.name, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = col.copy(alpha = 0.12f),
                                ) {
                                    Text(
                                        t.cats[s.category] ?: s.category,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = col,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // No matches hint
            if (showSuggestions && text.length >= 2 && suggestions.isEmpty()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    tonalElevation = 3.dp,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "${t.noMatches} — Enter ${t.add.lowercase()}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
    }

    if (showCategoryPicker) {
        CategoryPickerDialog(
            categories = categories,
            onConfirm = { category, addToCatalog ->
                val name = text.trim()
                onAdd(name, category)
                if (addToCatalog) onAddToCatalog(category, name)
                text = ""
                showCategoryPicker = false
            },
            onDismiss = {
                showCategoryPicker = false
            },
        )
    }
}
