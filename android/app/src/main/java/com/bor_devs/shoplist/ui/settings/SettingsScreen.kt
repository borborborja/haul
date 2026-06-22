package com.bor_devs.shoplist.ui.settings

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.People
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
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
import com.bor_devs.shoplist.ui.components.canonKey
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.style.TextDecoration
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
    val isGuest by vm.isGuest.collectAsState()
    val listName by vm.listName.collectAsState()
    val registrationOpen by vm.registrationOpen.collectAsState()
    val hasServer = settings.serverUrl.isNotBlank()

    var showShare by remember { mutableStateOf(false) }
    var showMembers by remember { mutableStateOf(false) }
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
        if (isGuest) {
            // A guest list opened from a share link: read-only / not administered.
            Section(t.sync) {
                Text(listName ?: t.myList, fontWeight = FontWeight.Bold)
                Text(t.guestBanner, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else if (sync.connected) {
            Section(t.sync) {
                Text(listName ?: t.myList, fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = { showShare = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Link, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(8.dp)); Text(t.publicLink)
                }
                OutlinedButton(onClick = { showMembers = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.People, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(8.dp)); Text(t.members)
                }
                OutlinedButton(onClick = { vm.disconnect() }) { Text(t.disconnect) }
            }
        }
    }

    Section(t.tabAccount) {
        if (hasServer) AvatarRow(vm)
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

    if (showShare) ShareLinkDialog(vm, onDismiss = { showShare = false })
    if (showMembers) MembersDialog(vm, onDismiss = { showMembers = false })
}

@Composable
private fun AvatarRow(vm: MainViewModel) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val avatarUrl by vm.avatarUrl.collectAsState()
    val avatarColor by vm.avatarColor.collectAsState()
    val settings by vm.settings.collectAsState()
    val initial = (settings.auth.username ?: settings.auth.email ?: "H").firstOrNull()?.uppercase() ?: "H"

    // Camera + gallery + circular 1:1 crop in one flow (vanniktech image cropper).
    val cropper = rememberLauncherForActivityResult(com.canhub.cropper.CropImageContract()) { result ->
        val uri = if (result.isSuccessful) result.uriContent else null
        if (uri != null) scope.launch {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
            vm.uploadAvatar(bytes, "avatar.jpg", "image/jpeg")
        }
    }
    fun pickAvatar() = cropper.launch(
        com.canhub.cropper.CropImageContractOptions(
            uri = null,
            cropImageOptions = com.canhub.cropper.CropImageOptions(
                imageSourceIncludeCamera = true,
                imageSourceIncludeGallery = true,
                cropShape = com.canhub.cropper.CropImageView.CropShape.OVAL,
                aspectRatioX = 1,
                aspectRatioY = 1,
                fixAspectRatio = true,
                outputCompressFormat = android.graphics.Bitmap.CompressFormat.JPEG,
                outputCompressQuality = 85,
            ),
        ),
    )

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(bottom = 8.dp)) {
        AvatarCircle(avatarUrl, avatarColor, initial, 56.dp)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { pickAvatar() }) { Text(t.choosePhoto) }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AVATAR_COLORS.forEach { c ->
                    Box(
                        Modifier.size(24.dp).clip(CircleShape)
                            .background(Color(android.graphics.Color.parseColor(c)))
                            .clickable { scope.launch { vm.setAvatarColor(c) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun AvatarCircle(url: String?, color: String?, initial: String, size: androidx.compose.ui.unit.Dp) {
    if (!url.isNullOrBlank()) {
        coil.compose.AsyncImage(
            model = url, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(CircleShape),
        )
    } else {
        val bg = parseColorOr(color, MaterialTheme.colorScheme.primary)
        Box(Modifier.size(size).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
            Text(initial, color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MembersDialog(vm: MainViewModel, onDismiss: () -> Unit) {
    val t = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var members by remember { mutableStateOf<List<com.bor_devs.shoplist.data.remote.MemberDto>>(emptyList()) }
    var email by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    fun reload() { scope.launch { members = vm.listMembers() } }
    LaunchedEffect(Unit) { members = vm.listMembers() }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(t.confirm) } },
        title = { Text(t.members) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                members.forEach { m ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        MemberAvatar(m)
                        Column(Modifier.weight(1f)) {
                            Text(m.name.ifBlank { "—" }, fontWeight = FontWeight.Bold)
                            Text("${roleLabel(t, m.role)} · ${relTime(m.lastActiveAt, t.neverActive)}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (m.role != "owner") TextButton(onClick = { scope.launch { vm.removeMember(m.userId); reload() } }) { Text(t.remove) }
                    }
                }
                Divider()
                Text(t.addAdmin, style = MaterialTheme.typography.labelMedium)
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text(t.email) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = !busy, onClick = {
                        busy = true
                        scope.launch {
                            val r = vm.addAdmin(email.trim())
                            msg = when (r) { null -> t.emailNoAccount; true -> t.adminAdded; else -> "Error" }
                            if (r == true) { email = ""; reload() }
                            busy = false
                        }
                    }) { Text(t.adminByEmail) }
                    OutlinedButton(onClick = {
                        scope.launch {
                            val link = vm.adminLink()
                            if (link != null) { clipboard.setText(AnnotatedString(link)); toast(context, t.linkCopied) }
                        }
                    }) { Text(t.copyAdminLink) }
                }
                if (msg.isNotBlank()) Text(msg, style = MaterialTheme.typography.bodySmall)
            }
        },
    )
}

@Composable
private fun MemberAvatar(m: com.bor_devs.shoplist.data.remote.MemberDto) {
    if (m.avatarUrl.isNotBlank()) {
        coil.compose.AsyncImage(
            model = m.avatarUrl, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.size(36.dp).clip(CircleShape),
        )
    } else {
        val bg = parseColorOr(m.color, MaterialTheme.colorScheme.primary)
        Box(Modifier.size(36.dp).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
            Text(m.name.firstOrNull()?.uppercase() ?: "?", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

private val AVATAR_COLORS = listOf("#10B981", "#0EA5E9", "#6366F1", "#EC4899", "#F59E0B", "#EF4444", "#14B8A6", "#8B5CF6")

private fun roleLabel(t: com.bor_devs.shoplist.ui.i18n.Strings, role: String): String = when (role) {
    "owner" -> t.roleOwner
    "admin" -> t.roleAdmin
    else -> t.roleGuest
}

private fun parseColorOr(hex: String?, fallback: Color): Color =
    if (hex.isNullOrBlank()) fallback else runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(fallback)

private fun relTime(iso: String, never: String): String {
    if (iso.isBlank()) return never
    val norm = iso.trim().replace(" ", "T").let { if (it.endsWith("Z")) it else "${it}Z" }
    val inst = runCatching { java.time.Instant.parse(norm) }.getOrNull() ?: return never
    val secs = System.currentTimeMillis() / 1000 - inst.epochSecond
    return when {
        secs < 90 -> "·"
        secs < 3600 -> "${secs / 60}m"
        secs < 86400 -> "${secs / 3600}h"
        else -> "${secs / 86400}d"
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
    val disabledCats by vm.disabledCategories.collectAsState()
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
        val catOff = disabledCats.contains(cat.key)
        Section("${cat.icon} ${t.cats[cat.key] ?: cat.key}") {
            TextButton(onClick = { if (catOff) vm.reactivateCategory(cat.key) else vm.deactivateCategory(cat.key) }) {
                Text(if (catOff) t.reactivate else t.deactivate, style = MaterialTheme.typography.labelMedium)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.alpha(if (catOff) 0.45f else 1f)) {
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
