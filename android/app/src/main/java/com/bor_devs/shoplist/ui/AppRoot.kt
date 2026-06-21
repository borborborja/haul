package com.bor_devs.shoplist.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.bor_devs.shoplist.data.repo.ShopRepository
import com.bor_devs.shoplist.ui.components.MergeReplaceDialog
import com.bor_devs.shoplist.ui.i18n.LocalStrings
import com.bor_devs.shoplist.ui.i18n.stringsFor
import com.bor_devs.shoplist.ui.i18n.systemLang
import com.bor_devs.shoplist.ui.list.MainScreen
import com.bor_devs.shoplist.ui.settings.SettingsScreen
import androidx.compose.ui.graphics.Color
import com.bor_devs.shoplist.ui.theme.ShoppingListTheme
import com.bor_devs.shoplist.ui.theme.haulBackgroundBrush
import com.bor_devs.shoplist.ui.wizard.ServerWizardScreen
import kotlinx.coroutines.launch

@Composable
fun AppRoot(vm: MainViewModel) {
    val settings by vm.settings.collectAsState()
    val pendingCode by vm.pendingJoinCode.collectAsState()
    val requireAccount by vm.requireAccount.collectAsState()
    val registrationOpen by vm.registrationOpen.collectAsState()
    val scope = rememberCoroutineScope()

    var showSettings by remember { mutableStateOf(false) }
    var pendingJoin by remember { mutableStateOf<ShopRepository.JoinInfo?>(null) }

    // Deep-link sync code -> join flow
    LaunchedEffect(pendingCode) {
        val code = pendingCode ?: return@LaunchedEffect
        vm.consumePendingCode()
        val info = vm.beginJoin(code)
        if (info != null) {
            if (info.hasLocalItems) pendingJoin = info else vm.finishJoin(info, false)
        }
    }

    ShoppingListTheme(themeMode = settings.theme) {
        CompositionLocalProvider(LocalStrings provides stringsFor(systemLang())) {
            Box(Modifier.fillMaxSize().background(haulBackgroundBrush())) {
                Surface(
                    color = Color.Transparent,
                    contentColor = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    val needsAccount = requireAccount && settings.serverUrl.isNotBlank() && !settings.auth.isLoggedIn
                    when {
                        !settings.wizardDone -> ServerWizardScreen(vm) {}
                        needsAccount -> AuthGateScreen(vm, registrationOpen)
                        showSettings -> SettingsScreen(vm) { showSettings = false }
                        else -> MainScreen(vm) { showSettings = true }
                    }
                }
            }
            pendingJoin?.let { info ->
                MergeReplaceDialog(
                    listName = info.name,
                    onMerge = { vm.finishJoin(info, false); pendingJoin = null },
                    onReplace = { vm.finishJoin(info, true); pendingJoin = null },
                    onDismiss = { pendingJoin = null },
                )
            }
        }
    }
}
