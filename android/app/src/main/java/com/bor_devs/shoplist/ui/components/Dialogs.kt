package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.DefaultCatalog
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.ui.theme.categoryColor

@Composable
fun NoteDialog(initial: String, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.notes) },
        text = {
            OutlinedTextField(value = text, onValueChange = { text = it }, modifier = Modifier.fillMaxWidth())
        },
        confirmButton = { TextButton(onClick = { onSave(text) }) { Text(t.saveNote) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun ProductEditDialog(
    item: ShopItem,
    categories: Map<String, Category>,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val t = LocalStrings.current
    val lang = com.bor_devs.shoplist.ui.i18n.LocalAppLang.current
    var note by remember { mutableStateOf(item.note) }
    val cat = categories[item.category]
    val catName = t.cats[item.category] ?: item.category
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(item.name, style = androidx.compose.material3.MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    color = categoryColor(item.category).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        "${cat?.icon ?: ""} $catName".trim(),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                        color = categoryColor(item.category),
                    )
                }
            }
        },
        text = {
            Column {
                Text(t.notes, style = androidx.compose.material3.MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 6.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                    maxLines = 5,
                )
            }
        },
        confirmButton = { TextButton(onClick = { onSave(note) }) { Text(t.saveNote) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun RenameListDialog(current: String?, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    var text by remember { mutableStateOf(current ?: "") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.renameList) },
        text = { OutlinedTextField(value = text, onValueChange = { text = it }, label = { Text(t.enterListName) }, modifier = Modifier.fillMaxWidth()) },
        confirmButton = { TextButton(onClick = { onSave(text.trim()) }) { Text(t.save) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun JoinDialog(onJoin: (String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    var code by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.join) },
        text = {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.uppercase() },
                label = { Text(t.enterCode) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = { TextButton(onClick = { if (code.isNotBlank()) onJoin(code.trim()) }) { Text(t.join) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun MergeReplaceDialog(listName: String, onMerge: () -> Unit, onReplace: () -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.syncMergeTitle) },
        text = { Text("\"$listName\"") },
        confirmButton = { TextButton(onClick = onMerge) { Text(t.syncMerge) } },
        dismissButton = { TextButton(onClick = onReplace) { Text(t.syncReplace) } },
    )
}

@Composable
fun CreateListDialog(onCreate: (String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.createList) },
        text = { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(t.enterListName) }, modifier = Modifier.fillMaxWidth()) },
        confirmButton = { TextButton(onClick = { onCreate(name.trim().ifBlank { "Shopping list" }) }) { Text(t.createList) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun CategoryPickerDialog(
    categories: Map<String, Category>,
    onConfirm: (category: String, addToCatalog: Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    val t = LocalStrings.current
    val lang = com.bor_devs.shoplist.ui.i18n.LocalAppLang.current
    var selected by remember { mutableStateOf<String?>(null) }
    var addToCatalog by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.selectCategory) },
        text = {
            Column {
                LazyVerticalGrid(columns = GridCells.Fixed(2), modifier = Modifier.heightIn(max = 360.dp)) {
                    items(categories.values.toList()) { cat ->
                        val isSel = selected == cat.key
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            tonalElevation = if (isSel) 3.dp else 1.dp,
                            color = if (isSel) categoryColor(cat.key).copy(alpha = 0.15f) else androidx.compose.material3.MaterialTheme.colorScheme.surface,
                            modifier = Modifier
                                .padding(4.dp)
                                .fillMaxWidth()
                                .clickable { selected = cat.key },
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
                                Text(cat.icon)
                                Text("  " + (t.cats[cat.key] ?: cat.key), maxLines = 1)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().clickable { addToCatalog = !addToCatalog }.padding(vertical = 4.dp),
                ) {
                    androidx.compose.material3.Checkbox(checked = addToCatalog, onCheckedChange = { addToCatalog = it })
                    Text(t.addToCatalog, style = androidx.compose.material3.MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { selected?.let { onConfirm(it, addToCatalog) } }) { Text(t.add) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}

@Composable
fun AddCategoryDialog(onAdd: (key: String, icon: String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    var name by remember { mutableStateOf("") }
    var icon by remember { mutableStateOf("📦") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t.newCategory) },
        text = {
            Column {
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text(t.categoryName) },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(t.categoryIcon, modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
                Surface(tonalElevation = 1.dp, shape = RoundedCornerShape(12.dp)) {
                    LazyVerticalGrid(columns = GridCells.Adaptive(40.dp), modifier = Modifier.height(180.dp)) {
                        items(DefaultCatalog.emojiList) { e ->
                            Box(
                                Modifier.size(40.dp).clickable { icon = e },
                                contentAlignment = Alignment.Center,
                            ) { Text(e) }
                        }
                    }
                }
                Text("→ $icon", modifier = Modifier.padding(top = 6.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val key = name.trim()
                if (key.isNotBlank()) onAdd(key, icon)
            }) { Text(t.add) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t.cancel) } },
    )
}
