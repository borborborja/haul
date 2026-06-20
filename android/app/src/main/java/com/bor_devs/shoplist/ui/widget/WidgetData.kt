package com.bor_devs.shoplist.ui.widget

import android.content.ComponentName
import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidgetManager
import com.bor_devs.shoplist.MainActivity
import com.bor_devs.shoplist.domain.ShopItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Glance delivers ActionParameters to the launched Activity as intent extras
// keyed by the Key name — matches MainActivity.EXTRA_OPEN_LIST ("open_list").
internal val OpenListKey = ActionParameters.Key<String>(MainActivity.EXTRA_OPEN_LIST)

/** A Glance action that opens the app on a specific list (used by widget taps). */
internal fun openListAction(context: Context, listId: String): Action =
    actionStartActivity(
        ComponentName(context, MainActivity::class.java),
        actionParametersOf(OpenListKey to listId),
    )

/** Resolved data for one widget instance: which list and its items. */
data class WidgetList(
    val listId: String,
    val name: String,
    val emoji: String,
    val items: List<ShopItem>,
)

object WidgetData {

    /** Map a Glance id to its appWidgetId (needed to read the per-widget list). */
    suspend fun appWidgetId(context: Context, glanceId: GlanceId): Int =
        runCatching { GlanceAppWidgetManager(context).getAppWidgetId(glanceId) }.getOrDefault(-1)

    /**
     * Items + name/emoji for the list this widget is configured to show. The
     * active list reads live from Room; other lists read their last-synced
     * snapshot from the DataStore cache.
     */
    suspend fun forWidget(context: Context, appWidgetId: Int): WidgetList = withContext(Dispatchers.IO) {
        val snap = WidgetDatabase.settings(context).snapshot()
        val configured = if (appWidgetId >= 0) WidgetPrefs.getListId(context, appWidgetId) else WidgetPrefs.ACTIVE
        val listId = if (configured == WidgetPrefs.ACTIVE) snap.activeListId else configured
        val saved = snap.lists.firstOrNull { it.id == listId }

        val name = saved?.name?.ifBlank { null } ?: snap.listName?.ifBlank { null } ?: "Haul"
        val emoji = saved?.emoji ?: "🛒"

        val items: List<ShopItem> = if (listId == snap.activeListId) {
            WidgetDatabase.get(context).itemDao().getAll().map { it.toDomain() }
        } else {
            snap.listCaches[listId].orEmpty().map {
                ShopItem(
                    id = it.id, name = it.name, checked = it.checked, note = it.note,
                    category = it.category, inList = it.inList, serverUpdated = it.serverUpdated,
                    updatedAt = it.updatedAt, dirty = it.dirty,
                )
            }
        }
        WidgetList(listId, name, emoji, items)
    }
}
