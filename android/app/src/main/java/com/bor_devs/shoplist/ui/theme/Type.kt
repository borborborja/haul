@file:OptIn(ExperimentalTextApi::class)

package com.bor_devs.shoplist.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.bor_devs.shoplist.R

// ===== v2 "innovador" type system =====
// Bricolage Grotesque (display) + DM Sans (body) + DM Mono (labels/eyebrows).
// DM Sans and Bricolage are variable fonts; weight axis applies on API 26+,
// gracefully falling back to the default instance on API 24-25.

private fun bricolage(weight: Int) = Font(
    R.font.bricolage_variable,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

private fun dmsans(weight: Int) = Font(
    R.font.dmsans_variable,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val DisplayFamily = FontFamily(
    bricolage(400), bricolage(500), bricolage(600), bricolage(700), bricolage(800),
)

val SansFamily = FontFamily(
    dmsans(400), dmsans(500), dmsans(600), dmsans(700),
)

val MonoFamily = FontFamily(
    Font(R.font.dmmono_regular, FontWeight.Normal),
    Font(R.font.dmmono_medium, FontWeight.Medium),
)

val AppTypography = Typography(
    // Display — Bricolage Grotesque, tight tracking
    displayLarge = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.ExtraBold, fontSize = 46.sp, letterSpacing = (-1).sp),
    displayMedium = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.ExtraBold, fontSize = 38.sp, letterSpacing = (-1).sp),
    headlineLarge = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp, letterSpacing = (-0.6).sp),
    headlineMedium = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp, letterSpacing = (-0.5).sp),
    headlineSmall = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.ExtraBold, fontSize = 23.sp, letterSpacing = (-0.4).sp),
    titleLarge = TextStyle(fontFamily = DisplayFamily, fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = (-0.3).sp),

    // Body — DM Sans
    titleMedium = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    titleSmall = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp),
    bodyLarge = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    labelLarge = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp),

    // Eyebrows / metadata — DM Mono, wide tracking, set per-call to uppercase
    labelMedium = TextStyle(fontFamily = MonoFamily, fontWeight = FontWeight.Medium, fontSize = 11.sp, letterSpacing = 1.sp),
    labelSmall = TextStyle(fontFamily = MonoFamily, fontWeight = FontWeight.Normal, fontSize = 10.sp, letterSpacing = 1.sp),
)
