package com.bor_devs.shoplist.ui.widget

import android.content.Context

/**
 * Per-widget list selection: maps an appWidgetId to a list id. The sentinel
 * [ACTIVE] means "always follow the app's active list" (the default for widgets
 * added before this feature).
 */
object WidgetPrefs {
    const val ACTIVE = "__active__"
    private const val FILE = "haul_widgets"
    private fun key(appWidgetId: Int) = "list_$appWidgetId"

    fun setListId(context: Context, appWidgetId: Int, listId: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(key(appWidgetId), listId).apply()
    }

    fun getListId(context: Context, appWidgetId: Int): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(key(appWidgetId), ACTIVE) ?: ACTIVE

    fun remove(context: Context, appWidgetId: Int) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().remove(key(appWidgetId)).apply()
    }
}
