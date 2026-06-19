package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Triggers widget updates from the main app process after data mutations.
 * Called from ShopRepository after addItem, toggleCheck, deleteItem, etc.
 */
object WidgetUpdater {
    private val scope = CoroutineScope(Dispatchers.IO)

    /** Fire-and-forget update from the app process (e.g. after a repo mutation). */
    fun updateAll(context: Context) {
        scope.launch { updateAllNow(context) }
    }

    /** Suspending variant for callers already on a coroutine (e.g. widget actions). */
    suspend fun updateAllNow(context: Context) {
        runCatching {
            val manager = GlanceAppWidgetManager(context)
            manager.getGlanceIds(ShoppingListWidget::class.java).forEach { glanceId ->
                ShoppingListWidget().update(context, glanceId)
            }
            manager.getGlanceIds(ShoppingProgressWidget::class.java).forEach { glanceId ->
                ShoppingProgressWidget().update(context, glanceId)
            }
        }
    }
}
