package com.bor_devs.shoplist.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwitchColors
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.bor_devs.shoplist.domain.ThemeMode

// ===== Haul brand palette — Light + Dark only =====
private val BrandGreen = Color(0xFF10B981)      // accent / primary
private val MintInk = Color(0xFF06231A)         // text/icon on accent
private val Amber = Color(0xFFF5B700)           // auto-clean accent

private val LightColors = lightColorScheme(
    primary = BrandGreen,
    onPrimary = Color.White,
    secondary = Color(0xFF3B82F6),
    tertiary = Amber,
    background = Color(0xFFECEFEA),
    onBackground = Color(0xFF0E1B16),
    surface = Color.White,
    onSurface = Color(0xFF0E1B16),
    surfaceVariant = Color(0xFFE6EAE3),
    onSurfaceVariant = Color(0xFF5C6B62),
    outline = Color(0xFFC2CBBF),
)

private val DarkColors = darkColorScheme(
    primary = BrandGreen,
    onPrimary = MintInk,
    secondary = Color(0xFF60A5FA),
    tertiary = Amber,
    background = Color(0xFF0A1512),
    onBackground = Color(0xFFEAF2EC),
    surface = Color(0xFF18352A),
    onSurface = Color(0xFFEAF2EC),
    surfaceVariant = Color(0xFF12271F),
    onSurfaceVariant = Color(0xFF93A99F),
    outline = Color(0x2EFFFFFF),
)

@Composable
fun ShoppingListTheme(
    themeMode: ThemeMode,
    content: @Composable () -> Unit,
) {
    // Haul ships Light + Dark only. Any legacy AMOLED/AUTO value falls back to
    // the system preference; AMOLED and Material-You dynamic color are removed.
    val systemDark = isSystemInDarkTheme()
    val dark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        else -> systemDark
    }

    val colorScheme = if (dark) DarkColors else LightColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }

    MaterialTheme(colorScheme = colorScheme, typography = AppTypography, content = content)
}

/** High-contrast Switch colors so the on/off state is clearly visible in both themes. */
@Composable
fun haulSwitchColors(): SwitchColors = SwitchDefaults.colors(
    checkedThumbColor = Color.White,
    checkedTrackColor = MaterialTheme.colorScheme.primary,
    checkedBorderColor = MaterialTheme.colorScheme.primary,
    uncheckedThumbColor = MaterialTheme.colorScheme.onSurfaceVariant,
    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
    uncheckedBorderColor = MaterialTheme.colorScheme.outline,
)
