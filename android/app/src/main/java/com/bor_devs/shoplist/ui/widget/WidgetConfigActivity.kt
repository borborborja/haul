package com.bor_devs.shoplist.ui.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.bor_devs.shoplist.data.prefs.Settings
import com.bor_devs.shoplist.domain.ThemeMode
import com.bor_devs.shoplist.ui.theme.ShoppingListTheme
import kotlinx.coroutines.launch

/**
 * Per-widget configuration: pick which shopping list the widget shows. Launched
 * by the system when a widget is added (declared via android:configure).
 */
class WidgetConfigActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // Pressing back without choosing leaves the widget un-added.
        setResult(RESULT_CANCELED)

        setContent {
            var snap by remember { mutableStateOf<Settings?>(null) }
            LaunchedEffect(Unit) { snap = WidgetDatabase.settings(this@WidgetConfigActivity).snapshot() }

            ShoppingListTheme(themeMode = snap?.theme ?: ThemeMode.LIGHT) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
                        Text(
                            "Haul",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            "Elige la lista para este widget",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp, bottom = 16.dp),
                        )
                        ChoiceCard("🟢 Lista activa", "Sigue la lista que uses en la app") { pick(appWidgetId, WidgetPrefs.ACTIVE) }
                        snap?.lists?.forEach { l ->
                            ChoiceCard("${l.emoji} ${l.name ?: "Lista"}", if (l.isLocal) "Local" else "Sincronizada") { pick(appWidgetId, l.id) }
                        }
                    }
                }
            }
        }
    }

    private fun pick(appWidgetId: Int, listId: String) {
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
        WidgetPrefs.setListId(this, appWidgetId, listId)
        lifecycleScope.launch {
            WidgetUpdater.updateAllNow(applicationContext)
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }
    }
}

@Composable
private fun ChoiceCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clickable { onClick() },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(title, fontWeight = FontWeight.Bold)
                Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("›", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
        }
    }
}
