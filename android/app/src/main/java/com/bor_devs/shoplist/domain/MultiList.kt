package com.bor_devs.shoplist.domain

import kotlinx.serialization.Serializable

/**
 * v2 multi-list ("Les meves llistes"). Each saved list is local-only until it
 * gains a sync [code]/[recordId]. Categories/catalog stay global, so only the
 * per-list item slice is cached (see [CachedItem]). The active list's items live
 * in the Room `items` table; switching swaps them through the DataStore cache.
 */
@Serializable
data class SavedList(
    val id: String,
    val name: String? = null,
    val emoji: String = "🛒", // 🛒
    val code: String? = null,
    val recordId: String? = null,
    val isLocal: Boolean = true,
)

/** Snapshot of a non-active list's item, persisted in DataStore. */
@Serializable
data class CachedItem(
    val id: String,
    val name: String,
    val checked: Boolean,
    val note: String,
    val category: String,
    val inList: Boolean,
    val serverUpdated: Long,
    val updatedAt: Long,
    val dirty: Boolean,
)
