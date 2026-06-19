package com.bor_devs.shoplist.util

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.bor_devs.shoplist.R
import com.bor_devs.shoplist.domain.ShopItem
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local notifications for remote changes. Ported from handleNotifications in
 * web/src/hooks/useListSync.ts: fire on items added/unchecked (notifyOnAdd) and
 * on items checked by someone else (notifyOnCheck). Background delivery is
 * best-effort — there is no server push, so these only fire while the realtime
 * connection is alive.
 */
@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val channelId = "shoplist_updates"

    fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = context.getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(channelId) == null) {
                val channel = NotificationChannel(
                    channelId, "List updates", NotificationManager.IMPORTANCE_DEFAULT
                ).apply { description = "Changes synced from other devices" }
                mgr.createNotificationChannel(channel)
            }
        }
    }

    fun hasPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * @param previous snapshot of local items before the change
     * @param changed  the items that just arrived from realtime (create/update)
     */
    @SuppressLint("MissingPermission") // guarded by hasPermission() + runCatching below
    fun notifyChanges(
        previous: List<ShopItem>,
        changed: List<ShopItem>,
        notifyOnAdd: Boolean,
        notifyOnCheck: Boolean,
    ) {
        if (!hasPermission()) return
        val prevById = previous.associateBy { it.id }
        val lines = StringBuilder()

        if (notifyOnAdd) {
            val added = changed.filter { ri ->
                val local = prevById[ri.id]
                (local == null && !ri.checked) || (local != null && local.checked && !ri.checked)
            }
            if (added.isNotEmpty()) lines.append("+ ").append(added.joinToString(", ") { it.name }).append('\n')
        }
        if (notifyOnCheck) {
            val checked = changed.filter { ri ->
                val local = prevById[ri.id]
                local != null && !local.checked && ri.checked
            }
            if (checked.isNotEmpty()) lines.append("✓ ").append(checked.joinToString(", ") { it.name })
        }

        val body = lines.toString().trim()
        if (body.isEmpty()) return

        ensureChannel()
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("ShoppingList")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(1001, notification) }
    }
}
