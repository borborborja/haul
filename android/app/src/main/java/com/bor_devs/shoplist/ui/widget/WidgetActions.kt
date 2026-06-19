package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Action callback that toggles the checked state of an item by its ID.
 * Runs in the widget process, accesses Room DB directly.
 *
 * Usage in Glance composable:
 *   actionRunCallback<ToggleCheckAction>(
 *       actionParametersOf(ToggleCheckAction.Key to item.id)
 *   )
 */
class ToggleCheckAction : ActionCallback {
    companion object {
        val Key = ActionParameters.Key<String>("itemId")
    }

    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters,
    ) {
        val itemId = parameters[Key] ?: return
        val db = WidgetDatabase.get(context)
        withContext(Dispatchers.IO) {
            val entity = db.itemDao().getById(itemId) ?: return@withContext
            val updated = entity.copy(
                checked = !entity.checked,
                updatedAt = System.currentTimeMillis()
            )
            db.itemDao().upsert(updated)
        }
        // Refresh every instance of both widget types after the state change.
        // The triggering glanceId only belongs to one widget type, so updating
        // by that id would skip the other type; refresh them all.
        WidgetUpdater.updateAllNow(context)
    }
}
