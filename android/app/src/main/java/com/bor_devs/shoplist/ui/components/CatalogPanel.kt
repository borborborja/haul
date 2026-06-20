package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.DefaultCatalog
import com.bor_devs.shoplist.domain.LocalizedItem
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.ui.theme.categoryColor

private val Mint = Color(0xFF10B981)
private val MintInk = Color(0xFF06231A)

/**
 * The catalog "deploy panel" shown in planning mode when the header FAB is open.
 * Mirrors the mobile web prototype: search + suggestions, a "choose a category"
 * pill box, and chips of the active category's products.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CatalogPanel(
    categories: Map<String, Category>,
    inListNames: Set<String>,
    disabled: Set<String> = emptySet(),
    onToggleItem: (name: String, category: String) -> Unit,
    onAddCustom: (name: String) -> Unit,
    onManage: () -> Unit,
) {
    val t = LocalStrings.current
    val lang = systemLang()
    var draft by remember { mutableStateOf("") }
    val orderedKeys = remember(categories) {
        categories.keys.sortedBy { val i = DefaultCatalog.keys.indexOf(it); if (i < 0) Int.MAX_VALUE else i }
    }
    var activeBand by remember(orderedKeys) { mutableStateOf(orderedKeys.firstOrNull() ?: "other") }

    val q = draft.trim().lowercase()
    val suggestions = remember(q, categories, lang, disabled) {
        if (q.length < 2) emptyList()
        else categories.values.flatMap { c -> c.items.filter { !disabled.contains(canonKey(it)) }.map { Triple(it.forLang(lang), c.key, categoryColor(c.key)) } }
            .filter { it.first.lowercase().contains(q) }
            .distinctBy { it.first.lowercase() }
            .take(8)
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        // Search
        OutlinedTextField(
            value = draft,
            onValueChange = { draft = it },
            placeholder = { Text(t.placeholder) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = Mint) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = {
                val name = draft.trim(); if (name.isNotEmpty()) { onAddCustom(name); draft = "" }
            }),
            modifier = Modifier.fillMaxWidth(),
        )

        if (suggestions.isNotEmpty()) {
            Spacer(Modifier.size(6.dp))
            Surface(shape = RoundedCornerShape(13.dp), tonalElevation = 3.dp, shadowElevation = 4.dp, modifier = Modifier.fillMaxWidth()) {
                Column {
                    suggestions.forEach { (name, cat, col) ->
                        val inList = inListNames.contains(name.lowercase())
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().clickable { onToggleItem(name, cat); draft = "" }.padding(horizontal = 14.dp, vertical = 10.dp),
                        ) {
                            Box(Modifier.size(8.dp).clip(CircleShape).background(col))
                            Spacer(Modifier.width(10.dp))
                            Text(name, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(t.cats[cat] ?: cat, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (inList) { Spacer(Modifier.width(8.dp)); Icon(Icons.Filled.Check, contentDescription = null, tint = Mint, modifier = Modifier.size(14.dp)) }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.size(11.dp))
        // Category picker box
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(9.dp)) {
                Text(t.selectCategory, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.size(7.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    orderedKeys.forEach { key ->
                        val on = key == activeBand
                        val col = categoryColor(key)
                        Box(
                            Modifier.clip(RoundedCornerShape(999.dp))
                                .background(if (on) col else Color.Transparent)
                                .then(if (on) Modifier else Modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(999.dp)))
                                .clickable { activeBand = key }
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                        ) {
                            Text(
                                "${categories[key]?.icon ?: ""} ${t.cats[key] ?: key}".trim(),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = if (on) MintInk else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    DashedChip(t.add) { onManage() }
                }
            }
        }

        Spacer(Modifier.size(9.dp))
        // Products of active category
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            val col = categoryColor(activeBand)
            categories[activeBand]?.items?.filter { !disabled.contains(canonKey(it)) }?.forEach { item ->
                val name = item.forLang(lang)
                val inList = inListNames.contains(name.lowercase())
                Box(
                    Modifier.clip(RoundedCornerShape(10.dp))
                        .background(if (inList) col else Color.Transparent)
                        .then(if (inList) Modifier else Modifier.border(1.5.dp, col.copy(alpha = 0.5f), RoundedCornerShape(10.dp)))
                        .clickable { onToggleItem(name, activeBand) }
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (inList) { Icon(Icons.Filled.Check, contentDescription = null, tint = MintInk, modifier = Modifier.size(12.dp)); Spacer(Modifier.width(5.dp)) }
                        Text(name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = if (inList) MintInk else MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
            DashedChip(t.newCategory) { onManage() }
        }
    }
}

// Canonical lowercase product key — must match ShopRepository.canonicalKey + web.
internal fun canonKey(item: LocalizedItem): String =
    item.en.ifBlank { item.es.ifBlank { item.ca } }.trim().lowercase()

@Composable
private fun DashedChip(label: String, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(10.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 11.dp, vertical = 6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Add, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
