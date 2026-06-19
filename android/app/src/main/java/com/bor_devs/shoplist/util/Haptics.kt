package com.bor_devs.shoplist.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Light haptic feedback, ported from web/src/utils/haptics.ts (native path). */
fun triggerHaptic(context: Context, durationMs: Long = 20) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    } ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val amplitude = if (durationMs > 50) VibrationEffect.DEFAULT_AMPLITUDE else 80
        vibrator.vibrate(VibrationEffect.createOneShot(durationMs, amplitude))
    } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(durationMs)
    }
}
