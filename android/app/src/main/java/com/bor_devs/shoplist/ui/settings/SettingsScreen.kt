package com.bor_devs.shoplist.ui.settings

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bor_devs.shoplist.BuildConfig
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.LaunchedEffect
import com.bor_devs.shoplist.domain.ThemeMode
import com.bor_devs.shoplist.ui.MainViewModel
import com.bor_devs.shoplist.util.AppUpdater
import com.bor_devs.shoplist.util.ReleaseInfo
import com.bor_devs.shoplist.ui.components.AddCategoryDialog
import com.bor_devs.shoplist.ui.components.CreateListDialog
import com.bor_devs.shoplist.ui.components.JoinDialog
import com.bor_devs.shoplist.ui.components.MergeReplaceDialog
import com.bor_devs.shoplist.data.repo.ShopRepository
import com.bor_devs.shoplist.ui.components.canonKey
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.systemLang
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.style.TextDecoration
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
    var showShare by remember { mutableStateOf(false) }
    var pendingJoin by remember { mutableStateOf<ShopRepository.JoinInfo?>(null) }
    val registrationOpen by vm.registrationOpen.collectAsState()
    val hasServer = settings.serverUrl.isNotBlank()
    var serverUrlInput by remember(settings.serverUrl) { mutableStateOf(settings.serverUrl) }

    Section(t.server) {
        OutlinedTextField(value = serverUrlInput, onValueChange = { serverUrlInput = it }, label = { Text(t.serverUrl) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { scope.launch { toast(context, if (vm.testServer(serverUrlInput.trim())) "OK" else "Error") } }) { Text(t.testConnection) }
            Button(onClick = { vm.applyServer(serverUrlInput.trim()); toast(context, "OK") }) { Text(t.save) }
        }
        Text(if (settings.serverUrl.isBlank()) t.localMode else settings.serverUrl, style = MaterialTheme.typography.bodySmall)
    }

    if (hasServer) {
    Section(t.sync) {
        if (sync.connected) {
            Text("${t.connected}: ${sync.code ?: "-"}", fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { sync.code?.let { shareText(context, t.shareTitle, t.shareBody + joinLink(it)) } }) { Text(t.shareCode) }
                OutlinedButton(onClick = { vm.rotateCode() }) { Text(t.rotateCode) }
            }
            OutlinedButton(onClick = { showShare = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.Link, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text(t.publicLink)
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
    } // end if (hasServer)

    Section(t.tabAccount) {
        if (settings.auth.isLoggedIn) {
            Text("${t.loggedAs}: ${settings.auth.email ?: ""}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { scope.launch { val n = vm.recoverLists(); toast(context, "$n") } }) { Text(t.recoverLists) }
                OutlinedButton(onClick = { vm.logout(true) }) { Text(t.logout) }
            }
        } else {
            AuthForm(
                registrationOpen = registrationOpen,
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
    if (showShare) ShareLinkDialog(vm, onDismiss = { showShare = false })
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
private fun ShareLinkDialog(vm: MainViewModel, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    var mode by remember { mutableStateOf("") }
    var token by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        vm.getShare()?.let { mode = it.mode; token = it.token }
    }

    val link = if (token.isNotBlank()) "${vm.serverBaseUrl()}/s/$token" else ""

    fun choose(m: String, rotate: Boolean = false) {
        busy = true
        scope.launch {
            vm.setShare(m, rotate)?.let { mode = it.mode; token = it.token }
            busy = false
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(t.confirm) } },
        title = { Text(t.publicLink) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(t.publicLinkSub, style = MaterialTheme.typography.bodySmall)
                Text(t.chooseAccess, style = MaterialTheme.typography.labelMedium)
                ShareModeRow(t.shareModeReadL, t.shareModeReadSub, mode == "read", busy) { choose("read") }
                ShareModeRow(t.shareModeShopL, t.shareModeShopSub, mode == "shop", busy) { choose("shop") }
                ShareModeRow(t.shareModePlanL, t.shareModePlanSub, mode == "plan", busy) { choose("plan") }

                if (link.isNotBlank() && mode.isNotBlank()) {
                    Divider()
                    Text(link, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { clipboard.setText(AnnotatedString(link)); toast(context, t.linkCopied) }) { Text(t.copyLink) }
                        OutlinedButton(onClick = { shareText(context, t.publicLink, link) }) { Text(t.shareCode) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(enabled = !busy, onClick = { choose(mode, rotate = true) }) { Text(t.regenerateLink) }
                        TextButton(enabled = !busy, onClick = {
                            busy = true
                            scope.launch { vm.revokeShare(); mode = ""; token = ""; busy = false }
                        }) { Text(t.stopSharing) }
                    }
                }
            }
        },
    )
}

@Composable
private fun ShareModeRow(label: String, sub: String, selected: Boolean, busy: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = !busy,
        modifier = Modifier.fillMaxWidth(),
        colors = if (selected) androidx.compose.material3.ButtonDefaults.buttonColors() else androidx.compose.material3.ButtonDefaults.outlinedButtonColors(),
    ) {
        Column(Modifier.fillMaxWidth()) {
            Text(label + if (selected) "  ✓" else "", fontWeight = FontWeight.Bold)
            Text(sub, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun AuthForm(registrationOpen: Boolean, onClaim: (String, String) -> Unit, onLogin: (String, String) -> Unit) {
    val t = LocalStrings.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text(t.email) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text(t.password) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (registrationOpen) Button(onClick = { if (email.isNotBlank() && password.isNotBlank()) onClaim(email.trim(), password) }) { Text(t.claimAccount) }
        OutlinedButton(onClick = { if (email.isNotBlank() && password.isNotBlank()) onLogin(email.trim(), password) }) { Text(t.login) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CatalogTab(vm: MainViewModel) {
    val t = LocalStrings.current
    val lang = com.bor_devs.shoplist.ui.i18n.LocalAppLang.current
    val categories by vm.categories.collectAsState()
    val disabled by vm.disabledProducts.collectAsState()
    val lists by vm.lists.collectAsState()
    val activeListId by vm.activeListId.collectAsState()
    var showAddCat by remember { mutableStateOf(false) }
    var addItemFor by remember { mutableStateOf<String?>(null) }

    // Which list are you managing? (switches the active list)
    Section(t.manageList) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            lists.forEach { l ->
                FilterChip(
                    selected = l.id == activeListId,
                    onClick = { if (l.id != activeListId) vm.switchList(l.id) },
                    label = { Text("${l.emoji} ${l.name ?: t.myList}", style = MaterialTheme.typography.labelMedium) },
                )
            }
        }
        val fromServer = categories.values.any { it.color != null }
        Text(
            if (fromServer) t.catalogServer else t.catalogLocal,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
    }

    Section(t.manageCatalog) {
        Text(t.tapHint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 6.dp))
        Button(onClick = { showAddCat = true }) { Text(t.newCategory) }
    }
    categories.values.forEach { cat ->
        Section("${cat.icon} ${t.cats[cat.key] ?: cat.key}") {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                cat.items.forEach { item ->
                    val off = disabled.contains(canonKey(item))
                    FilterChip(
                        selected = !off,
                        onClick = { if (off) vm.reactivateProduct(item) else vm.deactivateProduct(item) },
                        label = {
                            Text(
                                item.forLang(lang),
                                style = MaterialTheme.typography.labelMedium,
                                textDecoration = if (off) TextDecoration.LineThrough else null,
                            )
                        },
                        modifier = Modifier.alpha(if (off) 0.45f else 1f),
                    )
                }
                AssistChip(
                    onClick = { addItemFor = cat.key },
                    label = { Text(t.add, style = MaterialTheme.typography.labelMedium) },
                    leadingIcon = { Icon(Icons.Filled.Add, contentDescription = t.add, modifier = Modifier.size(16.dp)) },
                )
            }
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
    Section(t.language) {
        LangDropdown(selected = settings.appLang, onSelect = { vm.setAppLang(it) })
    }
    Section(t.viewOptions) {
        ToggleRow(t.inlineComp, settings.showCompletedInline) { vm.setShowCompletedInline(it) }
        ToggleRow(t.autoCleanup, settings.autoClearEnabled) { vm.setAutoClearEnabled(it) }
    }
    Section(t.alerts) {
        ToggleRow(t.notifyAdd, settings.notifyOnAdd) { v -> if (v) requestNotifPerm(); vm.setNotifyOnAdd(v) }
        ToggleRow(t.notifyCheck, settings.notifyOnCheck) { v -> if (v) requestNotifPerm(); vm.setNotifyOnCheck(v) }
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
    val scope = rememberCoroutineScope()
    val serverName by vm.serverName.collectAsState()

    var release by remember { mutableStateOf<ReleaseInfo?>(null) }
    var showChangelog by remember { mutableStateOf(false) }
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        release = AppUpdater.fetchLatestIfNewer(BuildConfig.VERSION_NAME)
    }

    release?.let { r ->
        Section(t.updateAvailable) {
            Text(r.version, fontWeight = FontWeight.Bold)
            TextButton(onClick = { showChangelog = !showChangelog }) { Text(t.whatsNew) }
            if (showChangelog && r.body.isNotBlank()) {
                Text(r.body, style = MaterialTheme.typography.bodySmall)
            }
            if (downloading) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text("${t.downloading} $progress%")
                }
            } else {
                Button(onClick = {
                    val url = r.apkUrl
                    if (url == null) {
                        shareText(context, "GitHub", "https://github.com/borborborja/haul/releases/latest")
                    } else {
                        scope.launch {
                            downloading = true
                            progress = 0
                            try {
                                val file = AppUpdater.downloadApk(context, url) { progress = it }
                                AppUpdater.installApk(context, file)
                            } catch (e: Exception) {
                                toast(context, "Error")
                            } finally {
                                downloading = false
                            }
                        }
                    }
                }) { Text(t.updateNow) }
            }
        }
    }

    Section(t.tabAbout) {
        Text(serverName, fontWeight = FontWeight.Bold)
        Text("v${BuildConfig.VERSION_NAME}")
        Text(t.aboutDev)
        TextButton(onClick = { shareText(context, "GitHub", "https://github.com/borborborja/haul") }) { Text(t.aboutProject) }
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
        Switch(checked = checked, onCheckedChange = onChange, colors = com.bor_devs.shoplist.ui.theme.haulSwitchColors())
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

// Language picker: a dropdown with "Auto" (follow system, appLang = null) + one
// entry per language.
@Composable
private fun LangDropdown(selected: String?, onSelect: (String?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val current = selected?.let { code -> com.bor_devs.shoplist.domain.Lang.entries.firstOrNull { it.code == code } }
    val label = if (current == null) "🌐 Auto" else "${current.flag} ${current.label}"
    Box {
        OutlinedButton(onClick = { expanded = true }) {
            Text(label)
            Spacer(Modifier.size(8.dp))
            Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("🌐 Auto") }, onClick = { onSelect(null); expanded = false })
            com.bor_devs.shoplist.domain.Lang.entries.forEach { l ->
                DropdownMenuItem(text = { Text("${l.flag} ${l.label}") }, onClick = { onSelect(l.code); expanded = false })
            }
        }
    }
}

private fun toast(context: android.content.Context, msg: String) {
    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
}
