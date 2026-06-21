package com.bor_devs.shoplist.ui.planner

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.LocalizedItem
import com.bor_devs.shoplist.ui.components.AddCategoryDialog
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.ui.theme.categoryColor

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategoryList(
    categories: Map<String, Category>,
    onAddItem: (name: String, category: String) -> Unit,
    onAddCategoryItem: (category: String, name: String) -> Unit,
    onRemoveCategoryItem: (category: String, name: String) -> Unit,
    onAddCategory: (key: String, icon: String) -> Unit,
) {
    val t = LocalStrings.current
    val lang = com.bor_devs.shoplist.ui.i18n.LocalAppLang.current
    var activeCategory by remember { mutableStateOf<String?>(null) }
    var editMode by remember { mutableStateOf(false) }
    var showQuickAdd by remember { mutableStateOf(false) }
    var showAddCategory by remember { mutableStateOf(false) }
    var quickAddText by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Text(
            t.quickAdd,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 4.dp, bottom = 6.dp),
        )

        // Horizontal scrollable category chips
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            categories.values.forEach { cat ->
                val isActive = activeCategory == cat.key
                FilterChip(
                    selected = isActive,
                    onClick = {
                        if (isActive) { activeCategory = null; editMode = false }
                        else { activeCategory = cat.key; editMode = false }
                    },
                    label = { Text("${cat.icon} ${t.cats[cat.key] ?: cat.key}") },
                )
            }
            // Add category button
            FilterChip(
                selected = false,
                onClick = { showAddCategory = true },
                label = { Icon(Icons.Filled.Add, contentDescription = t.add, modifier = Modifier.size(16.dp)) },
            )
        }

        // Expansion panel
        AnimatedVisibility(
            visible = activeCategory != null,
            enter = expandVertically(),
            exit = shrinkVertically(),
        ) {
            activeCategory?.let { key ->
                val cat = categories[key] ?: return@let
                Surface(
                    tonalElevation = 2.dp,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        // Header row
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(cat.icon, style = MaterialTheme.typography.titleLarge)
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    t.cats[key] ?: key,
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Row {
                                IconButton(onClick = { showQuickAdd = true }) {
                                    Icon(Icons.Filled.Add, contentDescription = t.add, tint = MaterialTheme.colorScheme.primary)
                                }
                                IconButton(onClick = { editMode = !editMode }) {
                                    Icon(
                                        if (editMode) Icons.Filled.Check else Icons.Filled.Edit,
                                        contentDescription = null,
                                        tint = if (editMode) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }

                        // Items grid
                        FlowRow(
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            cat.items.forEach { item ->
                                val name = item.forLang(lang)
                                val col = categoryColor(key)
                                Box {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = col.copy(alpha = 0.12f),
                                        modifier = Modifier.clickable {
                                            if (editMode) onRemoveCategoryItem(key, name)
                                            else onAddItem(name, key)
                                        },
                                    ) {
                                        Text(
                                            name,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.SemiBold,
                                            color = col,
                                        )
                                    }
                                    if (editMode) {
                                        IconButton(
                                            onClick = { onRemoveCategoryItem(key, name) },
                                            modifier = Modifier.size(18.dp).align(Alignment.TopEnd).padding(top = -4.dp, end = -4.dp),
                                        ) {
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.error,
                                                modifier = Modifier.size(12.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Quick add dialog
    if (showQuickAdd && activeCategory != null) {
        val catKey = activeCategory!!
        AlertDialog(
            onDismissRequest = { showQuickAdd = false },
            title = { Text("${t.add} → ${t.cats[catKey] ?: catKey}") },
            text = {
                OutlinedTextField(
                    value = quickAddText,
                    onValueChange = { quickAddText = it },
                    placeholder = { Text("...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val name = quickAddText.trim()
                    if (name.isNotBlank()) {
                        onAddCategoryItem(catKey, name)
                        showQuickAdd = false
                        quickAddText = ""
                    }
                }) { Text(t.add) }
            },
            dismissButton = { TextButton(onClick = { showQuickAdd = false; quickAddText = "" }) { Text(t.cancel) } },
        )
    }

    if (showAddCategory) {
        AddCategoryDialog(
            onAdd = { key, icon -> onAddCategory(key, icon); showAddCategory = false },
            onDismiss = { showAddCategory = false },
        )
    }
}
