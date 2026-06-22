package com.bor_devs.shoplist.domain

/** A localized catalog item name (es/ca/en), mirroring the web `LocalizedItem`. */
data class LocalizedItem(
    val es: String,
    val ca: String,
    val en: String,
) {
    // Catalog item names only carry es/ca/en; other UI languages fall back to en.
    fun forLang(lang: Lang): String = when (lang.code) {
        "es" -> es.ifBlank { ca.ifBlank { en } }
        "ca" -> ca.ifBlank { es.ifBlank { en } }
        else -> en.ifBlank { es.ifBlank { ca } }
    }
}

/** A category with its icon and its catalog of suggested items. */
data class Category(
    val key: String,
    val icon: String,
    val items: List<LocalizedItem> = emptyList(),
    val color: String? = null,
)

/**
 * A shopping item. `checked` x `inList` encode the state machine from the web app:
 *  - checked=false, inList=true  -> fresh item in the active list
 *  - checked=true,  inList=true  -> added to the cart (shopping mode)
 *  - checked=false, inList=false -> moved to "previously used" history
 */
data class ShopItem(
    val id: String,
    val name: String,
    val checked: Boolean = false,
    val note: String = "",
    val category: String = "other",
    val inList: Boolean = true,
    /** Last server `updated` timestamp we accepted (epoch millis), 0 if never. */
    val serverUpdated: Long = 0,
    /** Local mutation time, used for auto-clear staleness. */
    val updatedAt: Long = 0,
    /** A write was permanently rejected; resend on next (re)connect. */
    val dirty: Boolean = false,
    /** Name of who added the item / who bought (checked) it. */
    val addedBy: String = "",
    val checkedBy: String = "",
) {
    val isLocal: Boolean get() = id.startsWith("local_")
}

enum class AppMode { PLANNING, SHOPPING }

enum class ViewMode { LIST, COMPACT, GRID }

enum class SortOrder { CATEGORY, ALPHA }

enum class Lang(val code: String, val label: String, val flag: String) {
    EN("en", "English", "🇬🇧"),
    ES("es", "Español", "🇪🇸"),
    CA("ca", "Català", "🏴"),
    ZH("zh", "中文", "🇨🇳"),
    HI("hi", "हिन्दी", "🇮🇳"),
    AR("ar", "العربية", "🇸🇦"),
    PT("pt", "Português", "🇵🇹"),
    BN("bn", "বাংলা", "🇧🇩"),
    RU("ru", "Русский", "🇷🇺"),
    JA("ja", "日本語", "🇯🇵"),
    DE("de", "Deutsch", "🇩🇪"),
    FR("fr", "Français", "🇫🇷"),
    KO("ko", "한국어", "🇰🇷"),
    IT("it", "Italiano", "🇮🇹"),
    TR("tr", "Türkçe", "🇹🇷");

    companion object {
        fun from(code: String?): Lang = entries.firstOrNull { it.code == code } ?: CA
    }
}

enum class ThemeMode { LIGHT, DARK, AMOLED, AUTO }

data class AuthState(
    val isLoggedIn: Boolean = false,
    val email: String? = null,
    val userId: String? = null,
    val username: String? = null,
)

data class PresenceUser(
    val id: String,
    val username: String,
    val lastActiveAt: String,
)

@kotlinx.serialization.Serializable
data class SyncHistoryItem(
    val code: String,
    val title: String? = null,
    val lastUsed: Long = 0,
)

data class SyncState(
    val connected: Boolean = false,
    val code: String? = null,
    val recordId: String? = null,
    val msg: String = "",
    val msgType: MsgType = MsgType.INFO,
    val syncHistory: List<SyncHistoryItem> = emptyList(),
)

enum class MsgType { INFO, SUCCESS, ERROR }
