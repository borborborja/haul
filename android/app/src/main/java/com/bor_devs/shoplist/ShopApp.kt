package com.bor_devs.shoplist

import android.app.Application
import com.bor_devs.shoplist.ui.widget.WidgetUpdateWorker
import com.bor_devs.shoplist.util.NotificationHelper
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class ShopApp : Application() {
    @Inject lateinit var notificationHelper: NotificationHelper

    override fun onCreate() {
        super.onCreate()
        notificationHelper.ensureChannel()
        WidgetUpdateWorker.schedule(this)
    }
}
