package com.bor_devs.shoplist.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.domain.*
import com.bor_devs.shoplist.ui.MainViewModel
import com.bor_devs.shoplist.ui.normalizedProductName
import com.bor_devs.shoplist.ui.productNames
import com.bor_devs.shoplist.ui.i18n.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException

class ProductActions(
    val createProduct: (categoryKey: String, name: String, addToList: Boolean) -> Unit,
    val createCategory: () -> Unit,
    val editProduct: (ShopItem) -> Unit,
    val hideProduct: (LocalizedItem, Boolean) -> Unit,
    val addProduct: (LocalizedItem, String) -> Unit,
)

/** One coordinator keeps editors and actionable feedback alive across settings. */
@Composable
fun ProductFlowHost(vm: MainViewModel, content: @Composable (ProductActions) -> Unit) {
    val t = LocalStrings.current
    val p = productStrings()
    val language = LocalAppLang.current
    val categories by vm.categories.collectAsState()
    val items by vm.items.collectAsState()
    val listId by vm.activeListId.collectAsState()
    val guest by vm.isGuest.collectAsState()
    val shareMode by vm.shareMode.collectAsState()
    val quantitySupported by vm.quantitySupported.collectAsState()
    val syncError by vm.catalogSyncError.collectAsState()
    val settings by vm.settings.collectAsState()
    val currentScope = "${settings.serverUrl}|${settings.auth.userId.orEmpty()}|$listId"
    val canAdd = !guest || shareMode == "plan"
    val canManage = !guest
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var editorVisible by rememberSaveable { mutableStateOf(false) }
    var editorList by rememberSaveable { mutableStateOf("") }
    var editorScope by rememberSaveable { mutableStateOf("") }
    var initialCategory by rememberSaveable { mutableStateOf("") }
    var initialName by rememberSaveable { mutableStateOf("") }
    var initialAdd by rememberSaveable { mutableStateOf(true) }
    var editedId by rememberSaveable { mutableStateOf<String?>(null) }
    var showCategory by rememberSaveable { mutableStateOf(false) }
    var createdCategory by remember { mutableStateOf<String?>(null) }

    fun openProduct(category: String, name: String, add: Boolean, item: ShopItem? = null) {
        if (!canAdd) return
        editorList = listId
        editorScope = currentScope
        initialCategory = category
        initialName = name
        initialAdd = add
        editedId = item?.id
        createdCategory = null
        editorVisible = true
    }
    suspend fun feedback(result: ProductCommandResult, retryAction: (suspend () -> ProductCommandResult)? = null) {
        val message = when (result.status) {
            CommandStatus.SAVED_LOCAL -> p.savedLocal
            CommandStatus.SYNCED -> p.synced
            CommandStatus.PENDING_SYNC -> p.pending
            CommandStatus.DUPLICATE -> if (result.error == "DUPLICATE_LIST") p.alreadyInList else p.alreadyExists
            else -> p.commandError(result.error)
        }
        snackbar.currentSnackbarData?.dismiss()
        val retry = result.status == CommandStatus.PENDING_SYNC || (result.status == CommandStatus.FAILED && retryAction != null)
        if (snackbar.showSnackbar(message, actionLabel = if (retry) p.retry else null) == SnackbarResult.ActionPerformed) {
            if (vm.activeListId.value == listId) {
                val retried = retryAction?.invoke() ?: vm.retryPendingCatalog()
                snackbar.showSnackbar(if (retried.success) {
                    when (retried.status) {
                        CommandStatus.PENDING_SYNC -> p.pending
                        CommandStatus.SAVED_LOCAL -> p.savedLocal
                        else -> p.synced
                    }
                } else p.commandError(retried.error))
            }
        }
    }

    LaunchedEffect(listId, settings.serverUrl, settings.auth.userId) {
        snackbar.currentSnackbarData?.dismiss()
        if (editorVisible && editorScope != currentScope) editorVisible = false
        showCategory = false
    }
    LaunchedEffect(syncError, currentScope) {
        if (syncError != null) feedback(ProductCommandResult(CommandStatus.FAILED, error = syncError)) { vm.retryPendingCatalog() }
    }
    val actions = ProductActions(
        createProduct = { category, name, add -> openProduct(category, name, add) },
        createCategory = { if (canManage) { editorList = listId; editorScope = currentScope; showCategory = true } },
        editProduct = { item -> if (canManage) openProduct(item.category, item.name, item.inList, item) },
        addProduct = { product, category -> if (canAdd) {
            val origin = listId
            scope.launch {
                val result = vm.addCatalogProduct(product, category, product.forLang(language), origin)
                if (vm.activeListId.value == origin) feedback(result) { vm.addCatalogProduct(product, category, product.forLang(language), origin) }
            }
        } },
        hideProduct = { product, hidden -> if (canManage) {
            val origin = listId
            scope.launch {
                val result = vm.setProductHidden(product, hidden, origin)
                if (vm.activeListId.value != origin) return@launch
                if (!result.success) { feedback(result) { vm.setProductHidden(product, hidden, origin) }; return@launch }
                snackbar.currentSnackbarData?.dismiss()
                val message = (if (hidden) p.hidden else p.shown) +
                    if (result.status == CommandStatus.PENDING_SYNC) " · ${p.pending}" else ""
                if (snackbar.showSnackbar(message, actionLabel = p.undo, duration = SnackbarDuration.Long) == SnackbarResult.ActionPerformed && vm.activeListId.value == origin) {
                    feedback(vm.setProductHidden(product, !hidden, origin)) { vm.setProductHidden(product, !hidden, origin) }
                }
            }
        } },
    )

    Box(Modifier.fillMaxSize()) {
        content(actions)
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(12.dp))
    }
    if (editorVisible && editorList == listId) {
        ProductEditorSheet(
            categories = categories,
            item = editedId?.let { id -> items.firstOrNull { it.id == id } },
            initialName = initialName, initialCategory = initialCategory, initialAddToList = initialAdd,
            createdCategory = createdCategory, canManage = canManage, quantitySupported = quantitySupported,
            onNewCategory = { showCategory = true },
            onCreate = { name, category, quantity, note, add ->
                if (vm.activeListId.value != editorList) ProductCommandResult(CommandStatus.FAILED, error = "LIST_CHANGED")
                else vm.createProduct(name, category, quantity, note, add, editorList)
            },
            onEdit = { itemId, name, category, quantity, note, catalog ->
                if (vm.activeListId.value != editorList) ProductCommandResult(CommandStatus.FAILED, error = "LIST_CHANGED")
                else vm.editProduct(itemId, name, category, quantity, note, catalog, editorList)
            },
            onAddExisting = { product, category ->
                if (vm.activeListId.value != editorList) ProductCommandResult(CommandStatus.FAILED, error = "LIST_CHANGED")
                else vm.addCatalogProduct(product, category, product.forLang(language), editorList)
            },
            onSaved = { result -> scope.launch { feedback(result) } },
            onDismiss = { editorVisible = false },
            syncIssue = syncError,
            onRetrySync = { scope.launch { feedback(vm.retryPendingCatalog()) { vm.retryPendingCatalog() } } },
        )
    }
    if (showCategory && canManage) {
        CategoryEditorDialog(categories = categories, onSave = { name, icon ->
            if (vm.activeListId.value != editorList) CategoryCommandResult(CommandStatus.FAILED, error = "LIST_CHANGED")
            else vm.createCategory(name, icon, editorList)
        }, onCreated = { result ->
            createdCategory = result.key
            result.key?.let { key -> vm.setCatalogContext { it.copy(categoryKey = key) } }
            showCategory = false
            scope.launch { feedback(ProductCommandResult(result.status, categoryKey = result.key, error = result.error)) }
        }, onDismiss = { showCategory = false })
    }
}

private data class ProductLineResult(val name: String, val message: String, val success: Boolean, val retryable: Boolean = !success)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductEditorSheet(
    categories: Map<String, Category>, item: ShopItem?, initialName: String, initialCategory: String,
    initialAddToList: Boolean, createdCategory: String?, canManage: Boolean, quantitySupported: Boolean,
    onNewCategory: () -> Unit,
    onCreate: suspend (String, String, String, String, Boolean) -> ProductCommandResult,
    onEdit: suspend (String, String, String, String, String, Boolean) -> ProductCommandResult,
    onSaved: (ProductCommandResult) -> Unit, onDismiss: () -> Unit,
    onAddExisting: (suspend (LocalizedItem, String) -> ProductCommandResult)? = null,
    syncIssue: String? = null,
    onRetrySync: (() -> Unit)? = null,
) {
    val t = LocalStrings.current
    val p = productStrings()
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = remember { FocusRequester() }
    var name by rememberSaveable { mutableStateOf(initialName) }
    var category by rememberSaveable { mutableStateOf(initialCategory) }
    var quantity by rememberSaveable { mutableStateOf(item?.quantity.orEmpty()) }
    var note by rememberSaveable { mutableStateOf(item?.note.orEmpty()) }
    var addToList by rememberSaveable { mutableStateOf(initialAddToList) }
    var updateCatalog by rememberSaveable { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var results by remember { mutableStateOf<List<ProductLineResult>>(emptyList()) }
    var focusVersion by remember { mutableIntStateOf(0) }
    var duplicate by remember { mutableStateOf(false) }
    var confirmation by remember { mutableStateOf<String?>(null) }
    val names = productNames(name)
    val multiple = item == null && names.size > 1
    val validation = when {
        names.isEmpty() -> p.required
        item != null && names.size != 1 -> p.required
        names.size > 100 -> p.batchLimit
        names.any { it.length > 200 } -> p.nameTooLong
        category !in categories -> p.categoryRequired
        quantity.length > 80 -> p.quantityTooLong
        note.length > 1000 -> p.noteTooLong
        else -> null
    }
    LaunchedEffect(focusVersion) { focus.requestFocus(); keyboard?.show() }
    LaunchedEffect(createdCategory) { createdCategory?.let { category = it; focusVersion++ } }

    fun submit(next: Boolean, catalogOnly: Boolean = false) {
        if (saving || validation != null) return
        saving = true
        error = null
        duplicate = false
        scope.launch {
            try {
                if (item != null) {
                    val result = onEdit(item.id, names.single(), category, quantity.trim(), note.trim(), updateCatalog)
                    if (result.success) { onSaved(result); onDismiss() }
                    else error = p.commandError(result.error)
                } else {
                    val seen = mutableSetOf<String>()
                    val lineResults = mutableListOf<ProductLineResult>()
                    var last: ProductCommandResult? = null
                    for (productName in names) {
                        if (!seen.add(normalizedProductName(productName))) {
                            lineResults.add(ProductLineResult(productName, p.batchDuplicate, false, retryable = false))
                            continue
                        }
                        var result = onCreate(productName, category, quantity.trim(), note.trim(), if (catalogOnly) false else addToList)
                        if (multiple && result.status == CommandStatus.DUPLICATE && addToList && !catalogOnly && onAddExisting != null) {
                            val existing = categories[category]?.items?.firstOrNull { product ->
                                listOf(product.ca, product.es, product.en).any { normalizedProductName(it) == normalizedProductName(productName) }
                            }
                            if (existing != null) result = onAddExisting(existing, category)
                        }
                        last = result
                        val message = when (result.status) {
                            CommandStatus.SAVED_LOCAL -> p.savedLocal
                            CommandStatus.PENDING_SYNC -> p.pending
                            CommandStatus.SYNCED -> p.synced
                            CommandStatus.DUPLICATE -> p.commandError(result.error)
                            else -> p.commandError(result.error)
                        }
                        val satisfied = result.success || result.error == "DUPLICATE_LIST" ||
                            (result.status == CommandStatus.DUPLICATE && (catalogOnly || !addToList))
                        lineResults.add(ProductLineResult(productName, message, satisfied))
                    }
                    if (multiple) {
                        results = lineResults
                        // Keep failed lines available for correction/retry without resubmitting successes.
                        name = lineResults.filter { it.retryable }.joinToString("\n") { it.name }
                        if (name.isBlank()) name = ""
                    } else if (last?.success == true) {
                        onSaved(last)
                        if (next) {
                            confirmation = when (last.status) {
                                CommandStatus.SAVED_LOCAL -> p.savedLocal
                                CommandStatus.PENDING_SYNC -> p.pending
                                else -> p.synced
                            }
                            name = ""; quantity = ""; note = ""; results = emptyList(); focusVersion++
                        }
                        else onDismiss()
                    } else { error = p.commandError(last?.error); duplicate = last?.status == CommandStatus.DUPLICATE }
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { error = p.failed }
            finally { saving = false }
        }
    }

    ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (item == null) p.newProduct else p.editProduct, style = MaterialTheme.typography.headlineSmall)
            OutlinedTextField(value = name, onValueChange = { name = it; error = null; duplicate = false; confirmation = null }, enabled = !saving,
                label = { Text(p.productName) }, modifier = Modifier.fillMaxWidth().focusRequester(focus),
                singleLine = item != null, maxLines = if (item == null) 5 else 1,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                isError = name.isNotBlank() && names.any { it.length > 200 },
                supportingText = if (item == null && canManage) ({ Text(p.pasteHint) }) else null)
            if (multiple) Text(p.bulkCount.replace("{count}", names.size.toString()), style = MaterialTheme.typography.labelLarge)
            CategoryDropdown(categories, category, !saving, onSelect = { category = it }, onNewCategory = if (canManage) onNewCategory else null)
            if (quantitySupported || quantity.isNotBlank()) OutlinedTextField(value = quantity, onValueChange = { quantity = it }, enabled = !saving && quantitySupported,
                label = { Text(p.quantity) }, placeholder = { Text(p.quantityHint) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = note, onValueChange = { note = it }, enabled = !saving, label = { Text(p.notes) }, maxLines = 4, modifier = Modifier.fillMaxWidth())
            if (item == null && canManage) Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = addToList, onCheckedChange = { addToList = it }, enabled = !saving)
                Text(p.addToList)
            }
            if (item != null && canManage) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = updateCatalog, onCheckedChange = { updateCatalog = it }, enabled = !saving)
                    Text(if (item.sourceKind == "custom") p.editCatalog else p.saveToCatalog)
                }
                Text(p.editCatalogHint, style = MaterialTheme.typography.bodySmall)
            }
            (error ?: validation?.takeIf { name.isNotBlank() })?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            confirmation?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            if (syncIssue != null) {
                Text(p.commandError(syncIssue), color = MaterialTheme.colorScheme.error)
                if (onRetrySync != null) TextButton(onClick = onRetrySync, enabled = !saving) { Text(p.retry) }
            }
            if (duplicate && item == null && addToList && onAddExisting != null) {
                val existing = categories.values.flatMap { cat -> cat.items.map { it to cat.key } }.firstOrNull { (product, _) ->
                    listOf(product.ca, product.es, product.en).any { normalizedProductName(it) == normalizedProductName(name) }
                }
                if (existing != null) TextButton(enabled = !saving, onClick = {
                    saving = true
                    scope.launch {
                        try {
                            val result = onAddExisting(existing.first, existing.second)
                            if (result.success || result.status == CommandStatus.DUPLICATE) { onSaved(result); onDismiss() }
                            else error = p.commandError(result.error)
                        } finally { saving = false }
                    }
                }) { Text(p.useExisting) }
            }
            if (results.isNotEmpty()) {
                Text(p.results, fontWeight = FontWeight.Bold)
                results.forEach { row -> Text("${if (row.success) "✓" else "•"} ${row.name} · ${row.message}", color = if (row.success) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error) }
            }
            if (saving) LinearProgressIndicator(Modifier.fillMaxWidth())
            Button(onClick = { submit(false) }, enabled = validation == null && !saving, modifier = Modifier.fillMaxWidth()) {
                Text(if (item != null) t.save else if (multiple) p.createMany else if (addToList) p.createAndAdd else p.saveToCatalog)
            }
            if (item == null && !multiple) {
                OutlinedButton(onClick = { submit(true) }, enabled = validation == null && !saving, modifier = Modifier.fillMaxWidth()) { Text(p.saveNext) }
                if (addToList && canManage) TextButton(onClick = { submit(false, catalogOnly = true) }, enabled = validation == null && !saving, modifier = Modifier.fillMaxWidth()) { Text(p.saveToCatalog) }
            }
            TextButton(onClick = onDismiss, enabled = !saving, modifier = Modifier.fillMaxWidth()) { Text(if (results.isNotEmpty()) p.done else t.cancel) }
        }
    }
}

@Composable
private fun CategoryDropdown(categories: Map<String, Category>, selected: String, enabled: Boolean, onSelect: (String) -> Unit, onNewCategory: (() -> Unit)?) {
    val t = LocalStrings.current
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text(categories[selected]?.let { "${it.icon} ${t.categoryName(it)}" } ?: t.selectCategory)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            categories.values.forEach { cat -> DropdownMenuItem(text = { Text("${cat.icon} ${t.categoryName(cat)}") }, onClick = { expanded = false; onSelect(cat.key) }) }
            if (onNewCategory != null) DropdownMenuItem(text = { Text(t.newCategory) }, leadingIcon = { Icon(Icons.Default.Add, null) }, onClick = { expanded = false; onNewCategory() })
        }
    }
}

@Composable
private fun CategoryEditorDialog(categories: Map<String, Category>, onSave: suspend (String, String) -> CategoryCommandResult, onCreated: (CategoryCommandResult) -> Unit, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    val p = productStrings()
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = remember { FocusRequester() }
    var name by rememberSaveable { mutableStateOf("") }
    var icon by rememberSaveable { mutableStateOf("📦") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val duplicate = categories.values.any { normalizedProductName(t.categoryName(it)) == normalizedProductName(name) || normalizedProductName(it.key) == normalizedProductName(name) }
    LaunchedEffect(Unit) { focus.requestFocus(); keyboard?.show() }
    AlertDialog(onDismissRequest = { if (!saving) onDismiss() }, title = { Text(t.newCategory) }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(value = name, onValueChange = { name = it; error = null }, enabled = !saving, label = { Text(t.categoryName) }, singleLine = true,
                isError = name.isNotBlank() && duplicate, modifier = Modifier.focusRequester(focus),
                supportingText = if (name.isNotBlank() && duplicate) ({ Text(p.categoryExists) }) else null)
            OutlinedTextField(value = icon, onValueChange = { icon = it }, enabled = !saving, label = { Text(t.categoryIcon) }, singleLine = true)
            (error ?: p.categoryNameTooLong.takeIf { name.length > 80 })?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (saving) LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    }, confirmButton = {
        TextButton(enabled = name.isNotBlank() && name.trim().length <= 80 && icon.codePointCount(0, icon.length) <= 20 && !duplicate && !saving, onClick = {
            saving = true
            scope.launch {
                try {
                    val result = onSave(name.trim(), icon.ifBlank { "📦" })
                    if (result.success) onCreated(result) else error = if (result.status == CommandStatus.DUPLICATE) p.categoryExists else p.commandError(result.error)
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { error = p.failed }
                finally { saving = false }
            }
        }) { Text(t.add) }
    }, dismissButton = { TextButton(onClick = onDismiss, enabled = !saving) { Text(t.cancel) } })
}
