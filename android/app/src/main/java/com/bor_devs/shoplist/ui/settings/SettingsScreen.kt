package com.bor_devs.shoplist.ui.settings

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.BuildConfig
import com.bor_devs.shoplist.domain.ThemeMode
import com.bor_devs.shoplist.ui.MainViewModel
import com.bor_devs.shoplist.ui.components.AddCategoryDialog
import com.bor_devs.shoplist.ui.components.CreateListDialog
import com.bor_devs.shoplist.ui.components.JoinDialog
import com.bor_devs.shoplist.ui.components.MergeReplaceDialog
import com.bor_devs.shoplist.data.repo.ShopRepository
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.util.joinLink
import com.bor_devs.shoplist.util.shareText
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: MainViewModel, onBack: () -> Unit) {
    val t = LocalStrings.current
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf(t.tabAccount, t.tabCatalog, t.tabOther, t.tabAbout)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(t.settings) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab) {
                tabs.forEachIndexed { i, title ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(title, maxLines = 1) })
                }
            }
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                when (tab) {
                    0 -> AccountTab(vm)
                    1 -> CatalogTab(vm)
                    2 -> OtherTab(vm)
                    else -> AboutTab(vm)
                }
            }
        }
    }
}

@Composable
private fun AccountTab(vm: MainViewModel) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sync by vm.sync.collectAsState()
    val settings by vm.settings.collectAsState()
    val enableUsernames by vm.enableUsernames.collectAsState()

    var showCreate by remember { mutableStateOf(false) }
    var showJoin by remember { mutableStateOf(false) }
    var pendingJoin by remember { mutableStateOf<ShopRepository.JoinInfo?>(null) }

    Section(t.sync) {
        if (sync.connected) {
            Text("${t.connected}: ${sync.code ?: "-"}", fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { sync.code?.let { shareText(context, t.shareTitle, t.shareBody + joinLink(it)) } }) { Text(t.shareCode) }
                OutlinedButton(onClick = { vm.rotateCode() }) { Text(t.rotateCode) }
            }
            OutlinedButton(onClick = { vm.disconnect() }) { Text(t.disconnect) }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { showCreate = true }) { Text(t.createList) }
                OutlinedButton(onClick = { showJoin = true }) { Text(t.join) }
            }
        }
    }

    if (sync.syncHistory.isNotEmpty()) {
        Section(t.syncHistory) {
            sync.syncHistory.forEach { h ->
                TextButton(onClick = {
                    scope.launch { vm.beginJoin(h.code)?.let { pendingJoin = it } }
                }) { Text("${h.title ?: h.code} (${h.code})") }
            }
        }
    }

    Section(t.tabAccount) {
        if (settings.auth.isLoggedIn) {
            Text("${t.loggedAs}: ${settings.auth.email ?: ""}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { scope.launch { val n = vm.recoverLists(); toast(context, "$n") } }) { Text(t.recoverLists) }
                OutlinedButton(onClick = { vm.logout(true) }) { Text(t.logout) }
            }
        } else {
            AuthForm(
                onClaim = { e, p -> scope.launch { toast(context, if (vm.claimAccount(e, p)) "OK" else "Error") } },
                onLogin = { e, p -> scope.launch { toast(context, if (vm.login(e, p)) "OK" else "Error") } },
            )
        }
        if (enableUsernames) {
            var name by remember { mutableStateOf(settings.auth.username ?: "") }
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(t.username) }, modifier = Modifier.fillMaxWidth())
            TextButton(onClick = { vm.setUsername(name.trim()) }) { Text(t.save) }
        }
    }

    if (showCreate) CreateListDialog(onCreate = { vm.createList(it); showCreate = false }, onDismiss = { showCreate = false })
    if (showJoin) JoinDialog(onJoin = { code -> showJoin = false; scope.launch { vm.beginJoin(code)?.let { pendingJoin = it } ?: toast(context, "Error") } }, onDismiss = { showJoin = false })
    pendingJoin?.let { info ->
        if (info.hasLocalItems) {
            MergeReplaceDialog(
                listName = info.name,
                onMerge = { vm.finishJoin(info, false); pendingJoin = null },
                onReplace = { vm.finishJoin(info, true); pendingJoin = null },
                onDismiss = { pendingJoin = null },
            )
        } else {
            vm.finishJoin(info, false); pendingJoin = null
        }
    }
}

@Composable
private fun AuthForm(onClaim: (String, String) -> Unit, onLogin: (String, String) -> Unit) {
    val t = LocalStrings.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text(t.email) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text(t.password) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { if (email.isNotBlank() && password.isNotBlank()) onClaim(email.trim(), password) }) { Text(t.claimAccount) }
        OutlinedButton(onClick = { if (email.isNotBlank() && password.isNotBlank()) onLogin(email.trim(), password) }) { Text(t.login) }
    }
}

@Composable
private fun CatalogTab(vm: MainViewModel) {
    val t = LocalStrings.current
    val categories by vm.categories.collectAsState()
    val sync by vm.sync.collectAsState()
    var showAddCat by remember { mutableStateOf(false) }
    var addItemFor by remember { mutableStateOf<String?>(null) }

    // Sync status
    Section(t.sync) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = true,
                onClick = {},
                label = {
                    Text(
                        if (sync.connected) t.connected else t.localMode,
                        style = MaterialTheme.typography.labelSmall,
                    )
                },
            )
        }
    }

    Section(t.manageCatalog) {
        Button(onClick = { showAddCat = true }) { Text(t.newCategory) }
    }
    categories.values.forEach { cat ->
        Section("${cat.icon} ${t.cats[cat.key] ?: cat.key}") {
            // Source indicator
            val isFromServer = cat.color != null
            Text(
                if (isFromServer) "☁ Server" else "📱 Local",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            CatalogChips(
                names = cat.items.map { it.forLang(systemLang()) },
                onRemove = { name -> vm.removeCategoryItem(cat.key, name) },
                onAdd = { addItemFor = cat.key },
            )
        }
    }

    if (showAddCat) AddCategoryDialog(onAdd = { key, icon -> vm.addCategory(key, icon); showAddCat = false }, onDismiss = { showAddCat = false })
    addItemFor?.let { key ->
        var name by remember { mutableStateOf("") }
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { addItemFor = null },
            title = { Text(t.add) },
            text = { OutlinedTextField(value = name, onValueChange = { name = it }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = { if (name.isNotBlank()) vm.addCategoryItem(key, name.trim()); addItemFor = null }) { Text(t.add) } },
            dismissButton = { TextButton(onClick = { addItemFor = null }) { Text(t.cancel) } },
        )
    }
}

@Composable
private fun OtherTab(vm: MainViewModel) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settings by vm.settings.collectAsState()

    val notifPermLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    fun requestNotifPerm() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            val json = vm.exportJson()
            context.contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
            toast(context, "OK")
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) scope.launch {
            val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: return@launch
            toast(context, if (vm.importJson(text)) "OK" else "Error")
        }
    }

    Section(t.theme) {
        ChipRow(
            options = listOf(ThemeMode.LIGHT to t.themeLight, ThemeMode.DARK to t.themeDark),
            selected = settings.theme,
            onSelect = { vm.setTheme(it) },
        )
    }
    Section(t.viewOptions) {
        ToggleRow(t.inlineComp, settings.showCompletedInline) { vm.setShowCompletedInline(it) }
        ToggleRow(t.autoCleanup, settings.autoClearEnabled) { vm.setAutoClearEnabled(it) }
    }
    Section(t.alerts) {
        ToggleRow(t.notifyAdd, settings.notifyOnAdd) { v -> if (v) requestNotifPerm(); vm.setNotifyOnAdd(v) }
        ToggleRow(t.notifyCheck, settings.notifyOnCheck) { v -> if (v) requestNotifPerm(); vm.setNotifyOnCheck(v) }
    }
    Section(t.server) {
        var url by remember(settings.serverUrl) { mutableStateOf(settings.serverUrl) }
        OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text(t.serverUrl) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { scope.launch { toast(context, if (vm.testServer(url.trim())) "OK" else "Error") } }) { Text(t.testConnection) }
            Button(onClick = { vm.applyServer(url.trim()); toast(context, "OK") }) { Text(t.save) }
        }
        Text(if (settings.serverUrl.isBlank()) t.localMode else settings.serverUrl, style = MaterialTheme.typography.bodySmall)
    }
    Section("Backup") {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { exportLauncher.launch("shoppinglist_backup.json") }) { Text(t.export) }
            OutlinedButton(onClick = { importLauncher.launch("application/json") }) { Text(t.import) }
        }
        OutlinedButton(onClick = { vm.resetLocal() }) { Text(t.resetBtn) }
    }
}

@Composable
private fun AboutTab(vm: MainViewModel) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val serverName by vm.serverName.collectAsState()
    Section(t.tabAbout) {
        Text(serverName, fontWeight = FontWeight.Bold)
        Text("v${BuildConfig.VERSION_NAME}")
        Text(t.aboutDev)
        TextButton(onClick = { shareText(context, "GitHub", "https://github.com/bor_devs/shoppinglist") }) { Text(t.aboutProject) }
    }
}

// ---- small reusable pieces ----

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 16.dp, bottom = 6.dp))
    content()
    Divider(modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label)
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CatalogChips(names: List<String>, onRemove: (String) -> Unit, onAdd: () -> Unit) {
    val t = LocalStrings.current
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        names.forEach { name ->
            InputChip(
                selected = false,
                onClick = { onRemove(name) },
                label = { Text(name, style = MaterialTheme.typography.labelMedium) },
                trailingIcon = {
                    Icon(Icons.Filled.Close, contentDescription = t.delete, modifier = Modifier.size(14.dp))
                },
            )
        }
        AssistChip(
            onClick = onAdd,
            label = { Text(t.add, style = MaterialTheme.typography.labelMedium) },
            leadingIcon = { Icon(Icons.Filled.Add, contentDescription = t.add, modifier = Modifier.size(16.dp)) },
        )
    }
}

@Composable
private fun <T> ChipRow(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
            FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) })
        }
    }
}

private fun toast(context: android.content.Context, msg: String) {
    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
}
