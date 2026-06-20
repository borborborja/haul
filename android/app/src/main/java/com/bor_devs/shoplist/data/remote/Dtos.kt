package com.bor_devs.shoplist.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class AuthResponse(
    val token: String,
    val record: UserRecord,
)

@Serializable
data class UserRecord(
    val id: String,
    val email: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("account_type") val accountType: String? = null,
    @SerialName("current_list") val currentList: String? = null,
    val collectionName: String? = null,
)

/** Response of the custom /api/shoplist/lists and /lists/join routes (camelCase). */
@Serializable
data class ListApiResponse(
    val id: String,
    val name: String = "",
    val inviteCode: String = "",
)

@Serializable
data class RotateCodeResponse(val inviteCode: String)

@Serializable
data class HealthResponse(val status: String = "")

@Serializable
data class PresenceDto(
    val id: String,
    val username: String = "",
    val lastActiveAt: String = "",
)

@Serializable
data class ItemRecord(
    val id: String,
    val name: String = "",
    val category: String = "other",
    val checked: Boolean = false,
    @SerialName("in_list") val inList: Boolean = true,
    val note: String = "",
    @SerialName("external_id") val externalId: String = "",
    val list: String = "",
    val updated: String = "",
    val created: String = "",
    val collectionName: String? = null,
)

@Serializable
data class ListRecord(
    val id: String,
    val name: String = "",
    @SerialName("invite_code") val inviteCode: String = "",
    val data: JsonObject? = null,
    val updated: String = "",
)

@Serializable
data class CategoryRecord(
    val id: String,
    val key: String = "",
    val icon: String = "",
    val name: String = "",
    val list: String = "",
)

@Serializable
data class ListItemRecord(
    val id: String,
    @SerialName("category_key") val categoryKey: String = "",
    val name: String = "",
    val list: String = "",
)

@Serializable
data class DisabledProductRecord(
    val id: String,
    val name: String = "",
    val list: String = "",
)

@Serializable
data class CatalogCategoryRecord(
    val id: String,
    val key: String = "",
    val icon: String = "",
    val color: String = "",
    @SerialName("name_es") val nameEs: String = "",
    @SerialName("name_ca") val nameCa: String = "",
    @SerialName("name_en") val nameEn: String = "",
    val order: Int = 0,
    val hidden: Boolean = false,
)

@Serializable
data class CatalogItemRecord(
    val id: String,
    val category: String = "",
    @SerialName("name_es") val nameEs: String = "",
    @SerialName("name_ca") val nameCa: String = "",
    @SerialName("name_en") val nameEn: String = "",
    val hidden: Boolean = false,
    val expand: CatalogItemExpand? = null,
)

@Serializable
data class CatalogItemExpand(val category: CatalogCategoryRecord? = null)

@Serializable
data class AppConfigRecord(
    val id: String,
    val key: String = "",
    val value: JsonElement? = null,
)

@Serializable
data class ListMemberRecord(
    val id: String,
    val list: String = "",
    val user: String = "",
    val role: String = "editor",
    val expand: ListMemberExpand? = null,
)

@Serializable
data class ListMemberExpand(val list: ListRecord? = null)

/** A realtime SSE message payload: `{action, record}`. */
@Serializable
data class RealtimeMessage(
    val action: String = "",
    val record: JsonObject? = null,
)

@Serializable
data class PageResult<T>(
    val page: Int = 1,
    val perPage: Int = 0,
    val totalItems: Int = 0,
    val totalPages: Int = 0,
    val items: List<T> = emptyList(),
)
