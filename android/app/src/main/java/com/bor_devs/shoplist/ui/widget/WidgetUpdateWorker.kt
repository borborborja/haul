package com.bor_devs.shoplist.ui.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Periodic worker that refreshes all widget instances every 15 minutes.
 * This is a fallback for when the main app hasn't been opened recently.
 * Primary widget updates are triggered from ShopRepository after mutations.
 *
 * Plain CoroutineWorker (no Hilt injection needed): the app does not register a
 * HiltWorkerFactory, so the default WorkerFactory instantiates it by reflection.
 */
class WidgetUpdateWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return runCatching {
            WidgetUpdater.updateAllNow(applicationContext)
            Result.success()
        }.getOrDefault(Result.retry())
    }

    companion object {
        private const val NAME = "widget_update"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(
                15, TimeUnit.MINUTES
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
