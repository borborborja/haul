package com.bor_devs.shoplist.ui

import java.text.Normalizer
import java.util.Locale

/** Search and duplicate detection share the same accent/whitespace rules. */
internal fun normalizedProductName(value: String): String = Normalizer
    .normalize(value, Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "")
    .trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)

internal fun productNames(value: String): List<String> = value.lineSequence()
    .map { it.trim().replace(Regex("\\s+"), " ") }
    .filter { it.isNotBlank() }.toList()

data class CatalogContext(
    val open: Boolean = false,
    val query: String = "",
    val categoryKey: String = "",
)
