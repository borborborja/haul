package com.bor_devs.shoplist

import com.bor_devs.shoplist.util.AppUpdater
import org.junit.Assert.*
import org.junit.Test

class AppUpdaterTest {
    @Test fun phoneUpdaterRejectsWatchAndUnsignedBuilds() {
        assertTrue(AppUpdater.isPhoneApk("Haul-v1.12.2.apk"))
        assertFalse(AppUpdater.isPhoneApk("Haul-wear-v1.12.2.apk"))
        assertFalse(AppUpdater.isPhoneApk("app-release-unsigned.apk"))
        assertFalse(AppUpdater.isPhoneApk("source.zip"))
    }
}
