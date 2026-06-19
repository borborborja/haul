package com.bor_devs.shoplist.ui.theme

import androidx.compose.ui.graphics.Color

/** Category accent colors, ported from web/src/data/constants.ts categoryStyles. */
private val categoryColors: Map<String, Color> = mapOf(
    "fruit" to Color(0xFFEF4444),
    "veg" to Color(0xFF22C55E),
    "meat" to Color(0xFFB45309),
    "dairy" to Color(0xFF60A5FA),
    "pantry" to Color(0xFFFB923C),
    "cleaning" to Color(0xFFC084FC),
    "home" to Color(0xFF64748B),
    "snacks" to Color(0xFFF472B6),
    "frozen" to Color(0xFF06B6D4),
    "processed" to Color(0xFFFB7185),
    "drinks" to Color(0xFF6366F1),
    "spices" to Color(0xFFF59E0B),
    "other" to Color(0xFF94A3B8),
)

fun categoryColor(key: String): Color = categoryColors[key] ?: Color(0xFF94A3B8)
