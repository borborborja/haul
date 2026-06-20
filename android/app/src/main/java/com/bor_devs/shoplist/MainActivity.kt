package com.bor_devs.shoplist

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.bor_devs.shoplist.ui.AppRoot
import com.bor_devs.shoplist.ui.MainViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)

        setContent { AppRoot(vm) }

        // Re-check auto-clear whenever the app returns to the foreground.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) { vm.onResume() }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        // A widget can ask the app to open a specific list.
        intent?.getStringExtra(EXTRA_OPEN_LIST)?.takeIf { it.isNotBlank() }?.let { vm.switchList(it) }
        val data = intent?.data?.toString() ?: return
        vm.onDeepLink(data)
    }

    companion object {
        const val EXTRA_OPEN_LIST = "open_list"
    }
}
