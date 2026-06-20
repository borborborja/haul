package com.bor_devs.shoplist.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

private const val GITHUB_REPO = "borborborja/haul"

@Serializable
private data class GhAsset(val name: String = "", val browser_download_url: String = "")

@Serializable
private data class GhRelease(
    val tag_name: String = "",
    val name: String = "",
    val body: String = "",
    val assets: List<GhAsset> = emptyList(),
)

data class ReleaseInfo(val version: String, val name: String, val body: String, val apkUrl: String?)

/**
 * In-app updater: checks the latest GitHub release and — unlike the web — can
 * actually download the signed APK and launch the system installer. Updates
 * install in place because every release is signed with the same key.
 */
object AppUpdater {
    private val http = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    /** Returns the latest release only if it is newer than [currentVersion]. */
    suspend fun fetchLatestIfNewer(currentVersion: String): ReleaseInfo? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("https://api.github.com/repos/$GITHUB_REPO/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .build()
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext null
                val body = resp.body?.string() ?: return@withContext null
                val rel = json.decodeFromString(GhRelease.serializer(), body)
                if (rel.tag_name.isBlank() || !isNewer(rel.tag_name, currentVersion)) return@withContext null
                val apk = rel.assets.firstOrNull { it.name.endsWith(".apk", ignoreCase = true) }?.browser_download_url
                ReleaseInfo(rel.tag_name, rel.name.ifBlank { rel.tag_name }, rel.body, apk)
            }
        } catch (e: Exception) {
            null
        }
    }

    /** Downloads the APK to the cache dir, reporting 0..100 progress. */
    suspend fun downloadApk(context: Context, url: String, onProgress: (Int) -> Unit): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        val out = File(dir, "haul-update.apk")
        val req = Request.Builder().url(url).build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw Exception("HTTP ${resp.code}")
            val stream = resp.body?.byteStream() ?: throw Exception("empty body")
            val total = resp.body?.contentLength() ?: -1L
            out.outputStream().use { fileOut ->
                val buf = ByteArray(64 * 1024)
                var read: Int
                var downloaded = 0L
                while (stream.read(buf).also { read = it } != -1) {
                    fileOut.write(buf, 0, read)
                    downloaded += read
                    if (total > 0) onProgress(((downloaded * 100) / total).toInt())
                }
            }
        }
        out
    }

    /** Launches the system installer for [file] (routes through the unknown-sources prompt if needed). */
    fun installApk(context: Context, file: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            return
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun isNewer(latest: String, current: String): Boolean {
        fun parts(s: String) = s.trim().removePrefix("v").removePrefix("V")
            .split(".", "-").mapNotNull { it.toIntOrNull() }
        val a = parts(latest)
        val b = parts(current)
        for (i in 0 until maxOf(a.size, b.size)) {
            val d = a.getOrElse(i) { 0 } - b.getOrElse(i) { 0 }
            if (d != 0) return d > 0
        }
        return false
    }
}
