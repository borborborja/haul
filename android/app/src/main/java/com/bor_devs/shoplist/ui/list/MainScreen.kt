package com.bor_devs.shoplist.ui.list

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.DensitySmall
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.SortByAlpha
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import com.bor_devs.shoplist.ui.components.AddBar
import com.bor_devs.shoplist.ui.components.GridItemCard
import com.bor_devs.shoplist.ui.components.ItemRow
import com.bor_devs.shoplist.ui.components.SegmentOption
import com.bor_devs.shoplist.ui.components.SegmentedIconSwitch
import com.bor_devs.shoplist.ui.components.ProductEditDialog
import com.bor_devs.shoplist.ui.components.RenameListDialog
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.Strings
import com.bor_devs.shoplist.ui.planner.CategoryList
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(vm: MainViewModel, onOpenSettings: () -> Unit) {
    val t = LocalStrings.current
    val settings by vm.settings.collectAsState()
    val items by vm.items.collectAsState()
    val categories by vm.categories.collectAsState()
    val sync by vm.sync.collectAsState()
    val listName by vm.listName.collectAsState()
    val activeUsers by vm.activeUsers.collectAsState()
    val lists by vm.lists.collectAsState()
    val activeListId by vm.activeListId.collectAsState()
    val listCounts by vm.listCounts.collectAsState()

    val mode = settings.appMode
    fun catIcon(key: String) = categories[key]?.icon ?: ""

    var noteFor by remember { mutableStateOf<ShopItem?>(null) }
    var renaming by remember { mutableStateOf(false) }
    var completedExpanded by remember { mutableStateOf(true) }
    var showSwitcher by remember { mutableStateOf(false) }

    // Auto-clear countdown
    var autoClearTimeLeft by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(settings.autoClearScheduled, settings.autoClearMinutes) {
        if (settings.autoClearScheduled <= 0L) {
            autoClearTimeLeft = null
            return@LaunchedEffect
        }
        while (true) {
            val elapsed = System.currentTimeMillis() - settings.autoClearScheduled
            val totalMs = settings.autoClearMinutes * 60_000L
            val remaining = maxOf(0L, totalMs - elapsed)
            if (remaining <= 0) {
                vm.clearCompleted()
                vm.cancelAutoClear()
                autoClearTimeLeft = null
                return@LaunchedEffect
            }
            autoClearTimeLeft = (remaining / 1000).toInt()
            delay(1000)
        }
    }

    Scaffold(
        topBar = {
            EnhancedTopBar(
                listName = listName,
                defaultTitle = t.appTitle,
                connected = sync.connected,
                mode = mode,
                onToggleMode = { vm.setAppMode(if (mode == AppMode.PLANNING) AppMode.SHOPPING else AppMode.PLANNING) },
                onRename = { renaming = true },
                onOpenLists = { showSwitcher = true },
                t = t,
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            val inList = items.filter { it.inList }
            val total = inList.size
            val checkedCount = inList.count { it.checked }

            val shopping = mode == AppMode.SHOPPING
            val activeItems: List<ShopItem>
            val completedItems: List<ShopItem>
            val previouslyUsed: List<ShopItem>
            if (shopping) {
                if (settings.showCompletedInline) {
                    activeItems = inList; completedItems = emptyList()
                } else {
                    activeItems = inList.filter { !it.checked }; completedItems = inList.filter { it.checked }
                }
                previouslyUsed = emptyList()
            } else {
                activeItems = inList
                completedItems = emptyList()
                previouslyUsed = items.filter { !it.inList }
            }

            // Planning mode: AddBar + CategoryList at top
            if (!shopping) {
                AddBar(
                    categories = categories,
                    onAdd = { name, cat -> vm.addItem(name, cat) },
                    onAddToCatalog = { cat, name -> vm.addCategoryItem(cat, name) },
                    onOpenSettings = onOpenSettings,
                )
                CategoryList(
                    categories = categories,
                    onAddItem = { name, cat -> vm.addItem(name, cat) },
                    onAddCategoryItem = { cat, name -> vm.addCategoryItem(cat, name) },
                    onRemoveCategoryItem = { cat, name -> vm.removeCategoryItem(cat, name) },
                    onAddCategory = { key, icon -> vm.addCategory(key, icon) },
                )
            }

            // Shopping mode: progress bar at top
            if (shopping) {
                ShoppingProgressBar(total = total, checkedCount = checkedCount, t = t)
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Active users
                if (sync.connected && activeUsers.isNotEmpty()) {
                    item {
                        Text(
                            "${t.activeNow}: ${activeUsers.joinToString(", ") { it.username.ifBlank { "?" } }}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 4.dp),
                        )
                    }
                }

                // View mode + sort toggle
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(bottom = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // View mode switch (icons). Grid is shopping-only.
                        val viewOptions = buildList {
                            add(SegmentOption(ViewMode.LIST, Icons.AutoMirrored.Filled.ViewList, "List"))
                            add(SegmentOption(ViewMode.COMPACT, Icons.Filled.DensitySmall, "Compact"))
                            if (shopping) add(SegmentOption(ViewMode.GRID, Icons.Filled.GridView, "Grid"))
                        }
                        SegmentedIconSwitch(
                            options = viewOptions,
                            selected = settings.viewMode,
                            onSelect = { vm.setViewMode(it) },
                        )
                        // Sort switch (icons): by category vs by name.
                        SegmentedIconSwitch(
                            options = listOf(
                                SegmentOption(SortOrder.CATEGORY, Icons.Filled.Category, t.sortCat),
                                SegmentOption(SortOrder.ALPHA, Icons.Filled.SortByAlpha, t.sortAlpha),
                            ),
                            selected = settings.sortOrder,
                            onSelect = { vm.setSortOrder(it) },
                        )
                    }
                }

                if (total == 0 && previouslyUsed.isEmpty()) {
                    item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(t.empty, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                }

                // Items
                if (shopping && settings.viewMode == ViewMode.GRID) {
                    items(activeItems.sortedBy { it.name.lowercase() }.chunked(3)) { rowItems ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            rowItems.forEach { item ->
                                Box(Modifier.weight(1f)) {
                                    GridItemCard(item, catIcon(item.category)) { vm.toggleCheck(item.id) }
                                }
                            }
                            repeat(3 - rowItems.size) { Spacer(Modifier.weight(1f)) }
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
                                    modifier = Modifier.padding(top = 6.dp, bottom = 2.dp),
                                )
                            }
                        }
                        items(groupItems, key = { it.id }) { item ->
                            ItemRow(
                                item = item, mode = mode,
                                // In category view the group header already shows the
                                // emoji, so don't repeat it on every row.
                                categoryIcon = if (settings.sortOrder == SortOrder.CATEGORY) "" else catIcon(item.category),
                                compact = settings.viewMode == ViewMode.COMPACT,
                                // Planning: tapping an item "uses it up" -> moves to
                                // "previously used" (like the web), it is not completed.
                                // Shopping: tapping toggles the checked/cart state.
                                onToggle = { if (shopping) vm.toggleCheck(item.id) else vm.removeFromList(item.id) },
                                onDelete = { vm.deleteItem(item.id) },
                                onEditNote = { noteFor = item },
                                onRemoveFromList = { vm.removeFromList(item.id) },
                                onAddBack = { vm.addBackToList(item.id) },
                            )
                        }
                    }
                }

                // Completed section (shopping)
                if (shopping && completedItems.isNotEmpty()) {
                    item {
                        CompletedSectionHeader(
                            title = "${t.completed} (${completedItems.size})",
                            clearLabel = t.clearComp,
                            onClear = { vm.clearCompleted() },
                            expanded = completedExpanded,
                            onToggleExpand = { completedExpanded = !completedExpanded },
                            autoClearEnabled = settings.autoClearEnabled,
                            onToggleAutoClear = { vm.setAutoClearEnabled(!settings.autoClearEnabled) },
                            autoClearTimeLeft = autoClearTimeLeft,
                            onScheduleAutoClear = { vm.scheduleAutoClear() },
                            onCancelAutoClear = { vm.cancelAutoClear() },
                            t = t,
                        )
                    }
                    if (completedExpanded) {
                        items(completedItems.sortedBy { it.name.lowercase() }, key = { it.id }) { item ->
                            ItemRow(
                                item = item, mode = mode, categoryIcon = "",
                                compact = true,
                                onToggle = { vm.toggleCheck(item.id) },
                                onDelete = { vm.deleteItem(item.id) },
                                onEditNote = { noteFor = item },
                                onRemoveFromList = { vm.removeFromList(item.id) },
                                onAddBack = { vm.addBackToList(item.id) },
                            )
                        }
                    }
                }

                // Previously used (planning)
                if (!shopping && previouslyUsed.isNotEmpty()) {
                    item {
                        SectionHeader(
                            title = "${t.previouslyUsed} (${previouslyUsed.size})",
                            actionLabel = t.clearComp,
                            onAction = { vm.clearPreviouslyUsed(true) },
                            expanded = true, onToggleExpand = null,
                        )
                    }
                    items(previouslyUsed.sortedBy { it.name.lowercase() }, key = { "p_${it.id}" }) { item ->
                        ItemRow(
                            item = item, mode = mode, categoryIcon = "",
                            compact = true,
                            onToggle = { vm.addBackToList(item.id) },
                            onDelete = { vm.deleteItem(item.id) },
                            onEditNote = { noteFor = item },
                            onRemoveFromList = { vm.removeFromList(item.id) },
                            onAddBack = { vm.addBackToList(item.id) },
                        )
                    }
                }
            }
        }
    }

    noteFor?.let { item ->
        ProductEditDialog(
            item = item,
            categories = categories,
            onSave = { vm.updateNote(item.id, it); noteFor = null },
            onDismiss = { noteFor = null },
        )
    }
    if (renaming) {
        RenameListDialog(current = listName, onSave = { vm.setListName(it.ifBlank { null }); renaming = false }, onDismiss = { renaming = false })
    }
    if (showSwitcher) {
        com.bor_devs.shoplist.ui.components.ListSwitcherSheet(
            lists = lists,
            activeListId = activeListId,
            counts = listCounts,
            onSwitch = { vm.switchList(it) },
            onCreate = { name, emoji -> vm.createLocalList(name, emoji) },
            onDelete = { vm.deleteList(it) },
            onJoinByCode = onOpenSettings,
            onDismiss = { showSwitcher = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EnhancedTopBar(
    listName: String?,
    defaultTitle: String,
    connected: Boolean,
    mode: AppMode,
    onToggleMode: () -> Unit,
    onRename: () -> Unit,
    onOpenLists: () -> Unit,
    t: Strings,
) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Tapping the title opens the "Les meves llistes" switcher.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable { onOpenLists() }.padding(end = 4.dp),
                ) {
                    Text(
                        listName ?: defaultTitle,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                    )
                    Icon(
                        Icons.Filled.KeyboardArrowDown,
                        contentDescription = "Les meves llistes",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (connected) {
                        Spacer(Modifier.width(4.dp))
                        Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF10B981)))
                    }
                }
                if (mode == AppMode.PLANNING) {
                    IconButton(onClick = onRename) {
                        Icon(
                            Icons.Filled.Edit,
                            contentDescription = t.renameList,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        },
        actions = {
            // Segmented Plan/Shop toggle
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                tonalElevation = 1.dp,
            ) {
                Row {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (mode == AppMode.PLANNING) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f),
                        tonalElevation = if (mode == AppMode.PLANNING) 2.dp else 0.dp,
                        modifier = Modifier.clickable { if (mode != AppMode.PLANNING) onToggleMode() },
                    ) {
                        Text(
                            t.modePlan,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (mode == AppMode.PLANNING) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (mode == AppMode.SHOPPING) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f),
                        tonalElevation = if (mode == AppMode.SHOPPING) 2.dp else 0.dp,
                        modifier = Modifier.clickable { if (mode != AppMode.SHOPPING) onToggleMode() },
                    ) {
                        Text(
                            t.modeShop,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (mode == AppMode.SHOPPING) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        },
    )
}

@Composable
private fun ShoppingProgressBar(total: Int, checkedCount: Int, t: Strings) {
    val mint = Color(0xFF10B981)
    val cream = Color(0xFFEAF2EC)
    val creamMute = Color(0xFFA9BBB1)
    val percent = if (total == 0) 0 else (checkedCount * 100 / total)
    val remaining = total - checkedCount
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color(0xFF13352A),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Row(
            Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(88.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(88.dp)) {
                    val stroke = 9.dp.toPx()
                    drawArc(
                        color = Color.White.copy(alpha = 0.09f),
                        startAngle = 0f, sweepAngle = 360f, useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                    drawArc(
                        color = mint,
                        startAngle = -90f, sweepAngle = 360f * percent / 100f, useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                }
                Text("$percent%", style = MaterialTheme.typography.headlineSmall, color = cream)
            }
            Spacer(Modifier.width(20.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("$checkedCount", style = MaterialTheme.typography.headlineMedium, color = cream)
                    Text(" / $total", style = MaterialTheme.typography.titleMedium, color = creamMute)
                }
                Spacer(Modifier.size(4.dp))
                Text(
                    if (remaining > 0) "${t.progress} · $remaining" else "✓",
                    style = MaterialTheme.typography.bodySmall,
                    color = creamMute,
                )
            }
        }
    }
}

@Composable
private fun CompletedSectionHeader(
    title: String,
    clearLabel: String,
    onClear: () -> Unit,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    autoClearEnabled: Boolean,
    onToggleAutoClear: () -> Unit,
    autoClearTimeLeft: Int?,
    onScheduleAutoClear: () -> Unit,
    onCancelAutoClear: () -> Unit,
    t: Strings,
) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.clickable { onToggleExpand() },
            )
            TextButton(onClick = onClear) {
                Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(clearLabel)
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Auto-cleanup checkbox
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onToggleAutoClear() }.padding(vertical = 4.dp),
            ) {
                Checkbox(
                    checked = autoClearEnabled,
                    onCheckedChange = { onToggleAutoClear() },
                )
                Text(t.autoCleanup, style = MaterialTheme.typography.bodySmall)
            }
            // Schedule / countdown
            if (autoClearTimeLeft != null) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.tertiaryContainer,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(
                            "${t.autoClearIn} ${formatTime(autoClearTimeLeft)}",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        IconButton(onClick = onCancelAutoClear, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            } else {
                TextButton(onClick = onScheduleAutoClear) {
                    Text("${t.autoClear} 1h", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionLabel: String,
    onAction: () -> Unit,
    expanded: Boolean,
    onToggleExpand: (() -> Unit)?,
) {
    Row(
        Modifier.fillMaxWidth().padding(top = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            modifier = if (onToggleExpand != null) Modifier.clickable { onToggleExpand() } else Modifier,
        )
        TextButton(onClick = onAction) {
            Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(4.dp))
            Text(actionLabel)
        }
    }
}

private fun formatTime(seconds: Int): String {
    val mins = seconds / 60
    val secs = seconds % 60
    return "${mins}:${secs.toString().padStart(2, '0')}"
}

private fun grouped(list: List<ShopItem>, sortOrder: SortOrder): List<Pair<String?, List<ShopItem>>> {
    if (sortOrder == SortOrder.ALPHA) return listOf(null to list.sortedBy { it.name.lowercase() })
    val order = DefaultCatalog.keys
    val byCat = list.groupBy { it.category }
    val keys = byCat.keys.sortedBy { val i = order.indexOf(it); if (i < 0) Int.MAX_VALUE else i }
    return keys.map { it to byCat.getValue(it).sortedBy { x -> x.name.lowercase() } }
}
