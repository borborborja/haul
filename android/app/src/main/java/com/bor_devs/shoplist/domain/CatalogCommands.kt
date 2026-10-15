package com.bor_devs.shoplist.domain

/** A successful command is durably saved; remote confirmation may still be pending. */
enum class CommandStatus { SAVED_LOCAL, PENDING_SYNC, SYNCED, DUPLICATE, VALIDATION_ERROR, FAILED }

data class ProductCommandResult(
    val status: CommandStatus,
    val itemId: String? = null,
    val categoryKey: String? = null,
    val error: String? = null,
) {
    val success: Boolean get() = status == CommandStatus.SAVED_LOCAL || status == CommandStatus.PENDING_SYNC || status == CommandStatus.SYNCED
}

data class CategoryCommandResult(val status: CommandStatus, val key: String? = null, val error: String? = null) {
    val success: Boolean get() = status == CommandStatus.SAVED_LOCAL || status == CommandStatus.PENDING_SYNC || status == CommandStatus.SYNCED
}

internal fun validateProduct(name: String, category: String, quantity: String, note: String): String? = when {
    name.isBlank() -> "NAME_REQUIRED"
    name.codePointCount(0, name.length) > 200 -> "NAME_TOO_LONG"
    category.isBlank() -> "CATEGORY_REQUIRED"
    quantity.codePointCount(0, quantity.length) > 80 -> "QUANTITY_TOO_LONG"
    note.codePointCount(0, note.length) > 1000 -> "NOTE_TOO_LONG"
    else -> null
}

/** Identity keys distinguish a hidden global suggestion from its per-list variant. */
fun catalogVisibilityKey(item: LocalizedItem): String =
    if (item.sourceId.isNotBlank()) "source:${item.sourceKind}:${item.sourceId}"
    else item.en.ifBlank { item.es.ifBlank { item.ca } }.trim().lowercase()

/** Shared search/duplicate normalization; punctuation remains meaningful. */
fun normalizeProductName(name: String): String = java.text.Normalizer.normalize(name.trim(), java.text.Normalizer.Form.NFD)
    .replace("\\p{M}".toRegex(), "").lowercase().replace("\\s+".toRegex(), " ")
