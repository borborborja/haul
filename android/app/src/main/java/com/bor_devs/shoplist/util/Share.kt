package com.bor_devs.shoplist.util

import android.content.Context
import android.content.Intent

/** Opens the Android share sheet with a join link/code. */
fun shareText(context: Context, subject: String, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, subject).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
}

/** Builds the deep-link URL for a sync code (matches the web app links). */
fun joinLink(code: String): String = "https://shoppinglist.bor-devs.app/?c=$code"

/** Parses a sync code from a deep-link URI (shoppinglist://...?c= or https://.../?c=). */
fun parseSyncCode(uriString: String?): String? {
    if (uriString.isNullOrBlank()) return null
    return runCatching {
        val uri = android.net.Uri.parse(uriString)
        (uri.getQueryParameter("c") ?: uri.getQueryParameter("code"))?.trim()?.uppercase()
    }.getOrNull()
}

/** Parses an optional custom server override from a deep link. */
fun parseServerOverride(uriString: String?): String? {
    if (uriString.isNullOrBlank()) return null
    return runCatching { android.net.Uri.parse(uriString).getQueryParameter("server")?.trim() }.getOrNull()
}
