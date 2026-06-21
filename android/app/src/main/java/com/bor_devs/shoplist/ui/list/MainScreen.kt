package com.bor_devs.shoplist.ui.list

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.DensitySmall
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SortByAlpha
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.AppMode
import com.bor_devs.shoplist.domain.DefaultCatalog
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.domain.SortOrder
import com.bor_devs.shoplist.domain.ViewMode
import com.bor_devs.shoplist.ui.MainViewModel
import com.bor_devs.shoplist.ui.components.CatalogPanel
import com.bor_devs.shoplist.ui.components.GridItemCard
import com.bor_devs.shoplist.ui.components.ItemRow
import com.bor_devs.shoplist.ui.components.SegmentOption
import com.bor_devs.shoplist.ui.components.SegmentedIconSwitch
import com.bor_devs.shoplist.ui.components.ProductEditDialog
import com.bor_devs.shoplist.ui.components.RenameListDialog
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.Strings
import kotlinx.coroutines.delay

private val Mint = Color(0xFF10B981)
private val MintInk = Color(0xFF06231A)
private val Amber = Color(0xFFC99700)
private val SegGradient = Brush.linearGradient(listOf(Color(0xFF13D08F), Color(0xFF0B9A64)))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(vm: MainViewModel, onOpenSettings: () -> Unit) {
    val t = LocalStrings.current
    val settings by vm.settings.collectAsState()
    val items by vm.items.collectAsState()
    val categories by vm.categories.collectAsState()
    val disabledProducts by vm.disabledProducts.collectAsState()
    val sync by vm.sync.collectAsState()
    val listName by vm.listName.collectAsState()
    val lists by vm.lists.collectAsState()
    val activeListId by vm.activeListId.collectAsState()
    val listCounts by vm.listCounts.collectAsState()

    val mode = settings.appMode
    fun catIcon(key: String) = categories[key]?.icon ?: ""

    var noteFor by remember { mutableStateOf<ShopItem?>(null) }
    var renaming by remember { mutableStateOf(false) }
    var completedExpanded by remember { mutableStateOf(true) }
    var showSwitcher by remember { mutableStateOf(false) }
    var catalogOpen by remember { mutableStateOf(false) }

    var autoClearTimeLeft by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(settings.autoClearScheduled, settings.autoClearMinutes) {
        if (settings.autoClearScheduled <= 0L) { autoClearTimeLeft = null; return@LaunchedEffect }
        while (true) {
            val elapsed = System.currentTimeMillis() - settings.autoClearScheduled
            val remaining = maxOf(0L, settings.autoClearMinutes * 60_000L - elapsed)
            if (remaining <= 0) { vm.clearCompleted(); vm.cancelAutoClear(); autoClearTimeLeft = null; return@LaunchedEffect }
            autoClearTimeLeft = (remaining / 1000).toInt(); delay(1000)
        }
    }

    val appLang = com.bor_devs.shoplist.ui.i18n.LocalAppLang.current
    val inListNames = remember(items) { items.filter { it.inList }.map { it.name.lowercase() }.toSet() }
    fun toggleCatalog(name: String, cat: String) {
        val existing = items.find { it.name.equals(name, ignoreCase = true) }
        if (existing != null && existing.inList) vm.removeFromList(existing.id) else vm.addItem(name, cat)
    }
    fun addCustom(name: String) {
        val match = categories.values.firstOrNull { c -> c.items.any { it.forLang(appLang).equals(name, ignoreCase = true) } }
        vm.addItem(name, match?.key ?: "other")
    }

    Scaffold(containerColor = Color.Transparent) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            HaulHeader(
                title = listName ?: t.appTitle,
                connected = sync.connected,
                mode = mode,
                catalogOpen = catalogOpen,
                onToggleMode = { m -> if (m != mode) vm.setAppMode(m) },
                onOpenLists = { showSwitcher = true },
                onOpenSettings = onOpenSettings,
                onToggleCatalog = { catalogOpen = !catalogOpen },
                t = t,
            )

            val inList = items.filter { it.inList }
            val total = inList.size
            val checkedCount = inList.count { it.checked }
            val shopping = mode == AppMode.SHOPPING

            val activeItems: List<ShopItem>
            val completedItems: List<ShopItem>
            val previouslyUsed: List<ShopItem>
            if (shopping) {
                if (settings.showCompletedInline) { activeItems = inList; completedItems = emptyList() }
                else { activeItems = inList.filter { !it.checked }; completedItems = inList.filter { it.checked } }
                previouslyUsed = emptyList()
            } else {
                activeItems = inList; completedItems = emptyList(); previouslyUsed = items.filter { !it.inList }
            }

            if (!shopping && catalogOpen) {
                CatalogPanel(
                    categories = categories,
                    inListNames = inListNames,
                    disabled = disabledProducts,
                    onToggleItem = { name, cat -> toggleCatalog(name, cat) },
                    onAddCustom = { addCustom(it) },
                    onManage = onOpenSettings,
                )
            }

            if (shopping) {
                ShoppingProgressHero(total = total, checkedCount = checkedCount, autoclean = settings.autoClearEnabled, countdown = autoClearTimeLeft, t = t)
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Vista label + view/sort selectors
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(bottom = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(t.viewOptions, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val viewOptions = buildList {
                                add(SegmentOption(ViewMode.LIST, Icons.AutoMirrored.Filled.ViewList, "List"))
                                add(SegmentOption(ViewMode.COMPACT, Icons.Filled.DensitySmall, "Compact"))
                                add(SegmentOption(ViewMode.GRID, Icons.Filled.GridView, "Grid"))
                            }
                            SegmentedIconSwitch(options = viewOptions, selected = settings.viewMode, onSelect = { vm.setViewMode(it) })
                            SegmentedIconSwitch(
                                options = listOf(
                                    SegmentOption(SortOrder.CATEGORY, Icons.Filled.Category, t.sortCat),
                                    SegmentOption(SortOrder.ALPHA, Icons.Filled.SortByAlpha, t.sortAlpha),
                                ),
                                selected = settings.sortOrder, onSelect = { vm.setSortOrder(it) },
                            )
                        }
                    }
                }

                if (total == 0 && previouslyUsed.isEmpty()) {
                    item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(t.empty, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                }

                if (settings.viewMode == ViewMode.GRID) {
                    items(activeItems.sortedBy { it.name.lowercase() }.chunked(2)) { rowItems ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            rowItems.forEach { item ->
                                Box(Modifier.weight(1f)) { GridItemCard(item, catIcon(item.category)) { if (shopping) vm.toggleCheck(item.id) else vm.removeFromList(item.id) } }
                            }
                            repeat(2 - rowItems.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                } else {
                    grouped(activeItems, settings.sortOrder).forEach { (catKey, groupItems) ->
                        if (catKey != null && settings.sortOrder == SortOrder.CATEGORY) {
                            item(key = "h_$catKey") {
                                Text(
                                    "${catIcon(catKey)} ${t.cats[catKey] ?: catKey}".trim(),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(top = 8.dp, bottom = 2.dp),
                                )
                            }
                        }
                        items(groupItems, key = { it.id }) { item ->
                            ItemRow(
                                item = item, mode = mode,
                                categoryIcon = if (settings.sortOrder == SortOrder.CATEGORY) "" else catIcon(item.category),
                                compact = settings.viewMode == ViewMode.COMPACT,
                                onToggle = { if (shopping) vm.toggleCheck(item.id) else vm.removeFromList(item.id) },
                                onDelete = { vm.deleteItem(item.id) },
                                onEditNote = { noteFor = item },
                                onRemoveFromList = { vm.removeFromList(item.id) },
                                onAddBack = { vm.addBackToList(item.id) },
                            )
                        }
                    }
                }

                if (shopping && completedItems.isNotEmpty()) {
                    item {
                        CompletedSectionHeader(
                            title = "${t.completed} (${completedItems.size})", clearLabel = t.clearComp,
                            onClear = { vm.clearCompleted() }, expanded = completedExpanded,
                            onToggleExpand = { completedExpanded = !completedExpanded },
                            autoClearEnabled = settings.autoClearEnabled,
                            onToggleAutoClear = { vm.setAutoClearEnabled(!settings.autoClearEnabled) },
                            autoClearTimeLeft = autoClearTimeLeft,
                            onScheduleAutoClear = { vm.scheduleAutoClear() }, onCancelAutoClear = { vm.cancelAutoClear() }, t = t,
                        )
                    }
                    if (completedExpanded) {
                        items(completedItems.sortedBy { it.name.lowercase() }, key = { it.id }) { item ->
                            ItemRow(item = item, mode = mode, categoryIcon = "", compact = true,
                                onToggle = { vm.toggleCheck(item.id) }, onDelete = { vm.deleteItem(item.id) },
                                onEditNote = { noteFor = item }, onRemoveFromList = { vm.removeFromList(item.id) }, onAddBack = { vm.addBackToList(item.id) })
                        }
                    }
                }

                if (!shopping && previouslyUsed.isNotEmpty()) {
                    item {
                        SectionHeader(title = "${t.previouslyUsed} (${previouslyUsed.size})", actionLabel = t.clearComp, onAction = { vm.clearPreviouslyUsed(true) })
                    }
                    items(previouslyUsed.sortedBy { it.name.lowercase() }, key = { "p_${it.id}" }) { item ->
                        ItemRow(item = item, mode = mode, categoryIcon = "", compact = true,
                            onToggle = { vm.addBackToList(item.id) }, onDelete = { vm.deleteItem(item.id) },
                            onEditNote = { noteFor = item }, onRemoveFromList = { vm.removeFromList(item.id) }, onAddBack = { vm.addBackToList(item.id) })
                    }
                }
            }
        }
    }

    noteFor?.let { item ->
        ProductEditDialog(item = item, categories = categories, onSave = { vm.updateNote(item.id, it); noteFor = null }, onDismiss = { noteFor = null })
    }
    if (renaming) {
        RenameListDialog(current = listName, onSave = { vm.setListName(it.ifBlank { null }); renaming = false }, onDismiss = { renaming = false })
    }
    if (showSwitcher) {
        com.bor_devs.shoplist.ui.components.ListSwitcherSheet(
            lists = lists, activeListId = activeListId, counts = listCounts,
            onSwitch = { vm.switchList(it) }, onCreate = { name, emoji -> vm.createLocalList(name, emoji) },
            onDelete = { vm.deleteList(it) }, onJoinByCode = onOpenSettings, onDismiss = { showSwitcher = false },
        )
    }
}

@Composable
private fun HaulHeader(
    title: String,
    connected: Boolean,
    mode: AppMode,
    catalogOpen: Boolean,
    onToggleMode: (AppMode) -> Unit,
    onOpenLists: () -> Unit,
    onOpenSettings: () -> Unit,
    onToggleCatalog: () -> Unit,
    t: Strings,
) {
    Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).clickable { onOpenLists() }.padding(vertical = 2.dp),
            ) {
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = t.myLists, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                if (connected) { Spacer(Modifier.width(6.dp)); Box(Modifier.size(8.dp).clip(CircleShape).background(Mint)) }
            }
            Surface(
                shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.size(40.dp).clickable { onOpenSettings() },
            ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Filled.Settings, contentDescription = t.settings, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(19.dp)) } }
        }
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Plan/Shop segmented (gradient active)
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(15.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)).padding(5.dp),
            ) {
                SegItem(t.modePlan, mode == AppMode.PLANNING, Modifier.weight(1f)) { onToggleMode(AppMode.PLANNING) }
                Spacer(Modifier.width(5.dp))
                SegItem(t.modeShop, mode == AppMode.SHOPPING, Modifier.weight(1f)) { onToggleMode(AppMode.SHOPPING) }
            }
            if (mode == AppMode.PLANNING) {
                Spacer(Modifier.width(9.dp))
                Surface(
                    shape = RoundedCornerShape(14.dp), color = if (catalogOpen) Color(0xFF0B7A5B) else Mint,
                    modifier = Modifier.size(width = 52.dp, height = 50.dp).clickable { onToggleCatalog() },
                ) { Box(contentAlignment = Alignment.Center) { Icon(if (catalogOpen) Icons.Filled.Close else Icons.Filled.Add, contentDescription = t.add, tint = Color.White, modifier = Modifier.size(22.dp)) } }
            }
        }
    }
}

@Composable
private fun SegItem(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(RoundedCornerShape(11.dp))
            .then(if (selected) Modifier.background(SegGradient) else Modifier)
            .clickable { if (!selected) onClick() }
            .padding(vertical = 11.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ShoppingProgressHero(total: Int, checkedCount: Int, autoclean: Boolean, countdown: Int?, t: Strings) {
    val percent = if (total == 0) 0 else (checkedCount * 100 / total)
    val remaining = total - checkedCount
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Surface(shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(84.dp), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.size(84.dp)) {
                        val stroke = 9.dp.toPx()
                        drawArc(color = Color(0x1A10B981), startAngle = 0f, sweepAngle = 360f, useCenter = false, style = Stroke(width = stroke, cap = StrokeCap.Round))
                        drawArc(color = Mint, startAngle = -90f, sweepAngle = 360f * percent / 100f, useCenter = false, style = Stroke(width = stroke, cap = StrokeCap.Round))
                    }
                    Text("$percent%", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
                }
                Spacer(Modifier.width(18.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text("$checkedCount", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
                        Text(" / $total", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.size(6.dp))
                    Text(if (remaining > 0) "${t.progress} · $remaining" else "✓", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (autoclean && countdown != null) {
            Spacer(Modifier.height(8.dp))
            Surface(shape = RoundedCornerShape(10.dp), color = Color(0x24F5B700)) {
                Row(Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Schedule, contentDescription = null, tint = Amber, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(7.dp))
                    Text("${t.autoCleanup} · ${formatTime(countdown)}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Amber)
                }
            }
        }
    }
}

@Composable
private fun CompletedSectionHeader(
    title: String, clearLabel: String, onClear: () -> Unit, expanded: Boolean, onToggleExpand: () -> Unit,
    autoClearEnabled: Boolean, onToggleAutoClear: () -> Unit, autoClearTimeLeft: Int?,
    onScheduleAutoClear: () -> Unit, onCancelAutoClear: () -> Unit, t: Strings,
) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.clickable { onToggleExpand() })
            TextButton(onClick = onClear) {
                Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(4.dp)); Text(clearLabel)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onToggleAutoClear() }.padding(vertical = 4.dp)) {
                Checkbox(checked = autoClearEnabled, onCheckedChange = { onToggleAutoClear() })
                Text(t.autoCleanup, style = MaterialTheme.typography.bodySmall)
            }
            if (autoClearTimeLeft != null) {
                Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.tertiaryContainer) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Text("${t.autoClearIn} ${formatTime(autoClearTimeLeft)}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        IconButton(onClick = onCancelAutoClear, modifier = Modifier.size(20.dp)) { Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(14.dp)) }
                    }
                }
            } else {
                TextButton(onClick = onScheduleAutoClear) { Text("${t.autoClear} 1h", style = MaterialTheme.typography.labelSmall) }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, actionLabel: String, onAction: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        TextButton(onClick = onAction) { Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(4.dp)); Text(actionLabel) }
    }
}

private fun formatTime(seconds: Int): String {
    val mins = seconds / 60; val secs = seconds % 60
    return "${mins}:${secs.toString().padStart(2, '0')}"
}

private fun grouped(list: List<ShopItem>, sortOrder: SortOrder): List<Pair<String?, List<ShopItem>>> {
    if (sortOrder == SortOrder.ALPHA) return listOf(null to list.sortedBy { it.name.lowercase() })
    val order = DefaultCatalog.keys
    val byCat = list.groupBy { it.category }
    val keys = byCat.keys.sortedBy { val i = order.indexOf(it); if (i < 0) Int.MAX_VALUE else i }
    return keys.map { it to byCat.getValue(it).sortedBy { x -> x.name.lowercase() } }
}
