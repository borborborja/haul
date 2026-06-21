package com.bor_devs.shoplist.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

class PbException(val status: Int, message: String, val bodyText: String = "") : Exception(message) {
    val isNotFound get() = status == 404
    val isConflict get() = status == 409
}

/**
 * A thin PocketBase REST client. The base URL and auth token are mutable at
 * runtime (server wizard / login / guest session), mirroring the JS SDK's
 * `reinitializePocketBase` + `authStore`.
 */
@Singleton
class PocketBaseClient @Inject constructor(
    private val http: OkHttpClient,
    val json: Json,
) {
    @Volatile var baseUrl: String = ""
        private set

    @Volatile var token: String? = null
        private set

    val hasServer: Boolean get() = baseUrl.isNotBlank()

    fun setBaseUrl(url: String) { baseUrl = url.trim().trimEnd('/') }
    fun setToken(t: String?) { token = t }

    private val jsonMedia = "application/json".toMediaType()

    // ---- Custom /api/shoplist routes ----

    suspend fun health(serverOverride: String? = null): Boolean = try {
        val base = (serverOverride ?: baseUrl).trim().trimEnd('/')
        rawGet("$base/api/shoplist/health", auth = false)
        true
    } catch (_: Exception) {
        false
    }

    suspend fun createGuest(): AuthResponse =
        decode(request("POST", "/api/shoplist/guests", auth = false))

    suspend fun authRefresh(collection: String): AuthResponse =
        decode(request("POST", "/api/collections/$collection/auth-refresh"))

    suspend fun authWithPassword(identity: String, password: String): AuthResponse =
        decode(request("POST", "/api/collections/users/auth-with-password", buildJsonObject {
            put("identity", identity); put("password", password)
        }, auth = false))

    // Create a real account directly (used by the require_account wall) then sign in.
    suspend fun register(email: String, password: String): AuthResponse {
        request("POST", "/api/collections/users/records", buildJsonObject {
            put("email", email); put("password", password); put("passwordConfirm", password)
            put("account_type", "account"); put("display_name", email.substringBefore("@"))
        }, auth = false)
        return authWithPassword(email, password)
    }

    suspend fun claimAccount(email: String, password: String): AuthResponse =
        decode(request("POST", "/api/shoplist/account/claim", buildJsonObject {
            put("email", email); put("password", password)
        }))

    suspend fun createList(name: String): ListApiResponse =
        decode(request("POST", "/api/shoplist/lists", buildJsonObject { put("name", name) }))

    suspend fun joinList(code: String): ListApiResponse =
        decode(request("POST", "/api/shoplist/lists/join", buildJsonObject { put("code", code) }))

    suspend fun rotateCode(listId: String): RotateCodeResponse =
        decode(request("POST", "/api/shoplist/lists/$listId/rotate-code", JsonObject(emptyMap())))

    suspend fun presence(listId: String): List<PresenceDto> =
        decode(request("GET", "/api/shoplist/lists/$listId/presence"))

    // ---- Public link sharing (owner-only management) ----

    suspend fun getShare(listId: String): ShareResponse =
        decode(request("GET", "/api/shoplist/lists/$listId/share"))

    suspend fun setShare(listId: String, mode: String, rotate: Boolean = false): ShareResponse =
        decode(request("POST", "/api/shoplist/lists/$listId/share", buildJsonObject {
            put("mode", mode); put("rotate", rotate)
        }))

    suspend fun revokeShare(listId: String) {
        request("POST", "/api/shoplist/lists/$listId/share/revoke", JsonObject(emptyMap()))
    }

    // ---- Collection CRUD ----

    suspend fun getItems(listId: String): List<ItemRecord> =
        listRecords<ItemRecord>("shopping_items", filter = "list = \"$listId\"", sort = "-created").items

    suspend fun getList(listId: String): ListRecord =
        decode(request("GET", "/api/collections/shopping_lists/records/$listId"))

    suspend fun updateListData(listId: String, data: JsonObject): ListRecord =
        decode(request("PATCH", "/api/collections/shopping_lists/records/$listId", buildJsonObject {
            put("data", data)
        }))

    suspend fun getListCategories(listId: String): List<CategoryRecord> =
        listRecords<CategoryRecord>("list_categories", filter = "list = \"$listId\"").items

    suspend fun getListItems(listId: String): List<ListItemRecord> =
        listRecords<ListItemRecord>("list_items", filter = "list = \"$listId\"").items

    suspend fun getCatalogCategories(): List<CatalogCategoryRecord> =
        listRecords<CatalogCategoryRecord>("catalog_categories", filter = "hidden = false", sort = "order").items

    suspend fun getCatalogItems(): List<CatalogItemRecord> =
        listRecords<CatalogItemRecord>("catalog_items", filter = "hidden = false", expand = "category").items

    suspend fun getAppConfig(): List<AppConfigRecord> =
        listRecords<AppConfigRecord>("app_config").items

    suspend fun getMyListMemberships(userId: String): List<ListMemberRecord> =
        listRecords<ListMemberRecord>("list_members", filter = "user = \"$userId\"", expand = "list").items

    suspend fun createItem(body: JsonObject): ItemRecord =
        decode(request("POST", "/api/collections/shopping_items/records", body))

    suspend fun updateItem(id: String, body: JsonObject): ItemRecord =
        decode(request("PATCH", "/api/collections/shopping_items/records/$id", body))

    suspend fun deleteItem(id: String) {
        request("DELETE", "/api/collections/shopping_items/records/$id")
    }

    suspend fun createListCategory(listId: String, key: String, icon: String): CategoryRecord =
        decode(request("POST", "/api/collections/list_categories/records", buildJsonObject {
            put("list", listId); put("key", key); put("icon", icon); put("name", key)
        }))

    suspend fun deleteListCategory(id: String) {
        request("DELETE", "/api/collections/list_categories/records/$id")
    }

    suspend fun createListItem(listId: String, categoryKey: String, name: String): ListItemRecord =
        decode(request("POST", "/api/collections/list_items/records", buildJsonObject {
            put("list", listId); put("category_key", categoryKey); put("name", name)
        }))

    suspend fun deleteListItem(id: String) {
        request("DELETE", "/api/collections/list_items/records/$id")
    }

    suspend fun getListDisabledProducts(listId: String): List<DisabledProductRecord> =
        listRecords<DisabledProductRecord>("list_disabled_products", filter = "list = \"$listId\"").items

    suspend fun createDisabledProduct(listId: String, name: String): DisabledProductRecord =
        decode(request("POST", "/api/collections/list_disabled_products/records", buildJsonObject {
            put("list", listId); put("name", name)
        }))

    suspend fun deleteDisabledProduct(id: String) {
        request("DELETE", "/api/collections/list_disabled_products/records/$id")
    }

    /** Batch PATCH multiple items with the same body. Returns false if batch unsupported. */
    suspend fun batchUpdateItems(ids: List<String>, body: JsonObject): Boolean =
        batch(ids.map { "PATCH" to "/api/collections/shopping_items/records/$it" }, body)

    suspend fun batchDeleteItems(ids: List<String>): Boolean =
        batch(ids.map { "DELETE" to "/api/collections/shopping_items/records/$it" }, null)

    suspend fun batchCreateItems(bodies: List<JsonObject>): List<ItemRecord> {
        val payload = buildJsonObject {
            put("requests", buildJsonArray {
                bodies.forEach { b ->
                    add(buildJsonObject {
                        put("method", "POST")
                        put("url", "/api/collections/shopping_items/records")
                        put("body", b)
                    })
                }
            })
        }
        val resp = request("POST", "/api/batch", payload)
        val arr = json.parseToJsonElement(resp) as? JsonArray ?: return emptyList()
        return arr.mapNotNull { el ->
            val obj = el as? JsonObject ?: return@mapNotNull null
            val bodyEl = obj["body"] ?: return@mapNotNull null
            runCatching { json.decodeFromJsonElement(ItemRecord.serializer(), bodyEl) }.getOrNull()
        }
    }

    private suspend fun batch(reqs: List<Pair<String, String>>, body: JsonObject?): Boolean {
        val payload = buildJsonObject {
            put("requests", buildJsonArray {
                reqs.forEach { (method, url) ->
                    add(buildJsonObject {
                        put("method", method)
                        put("url", url)
                        if (body != null) put("body", body)
                    })
                }
            })
        }
        return try {
            request("POST", "/api/batch", payload)
            true
        } catch (e: PbException) {
            if (e.status == 404 || e.status == 400) false else throw e
        }
    }

    // ---- Generic list ----

    private suspend inline fun <reified T> listRecords(
        collection: String,
        filter: String? = null,
        sort: String? = null,
        expand: String? = null,
        perPage: Int = 500,
    ): PageResult<T> {
        val params = buildList {
            add("perPage=$perPage")
            add("skipTotal=true")
            filter?.let { add("filter=" + enc(it)) }
            sort?.let { add("sort=" + enc(it)) }
            expand?.let { add("expand=" + enc(it)) }
        }.joinToString("&")
        val body = request("GET", "/api/collections/$collection/records?$params")
        return json.decodeFromString(body)
    }

    // ---- HTTP plumbing ----

    private inline fun <reified T> decode(body: String): T = json.decodeFromString(body)

    suspend fun request(
        method: String,
        path: String,
        body: JsonElement? = null,
        auth: Boolean = true,
    ): String = withContext(Dispatchers.IO) {
        if (baseUrl.isBlank()) throw PbException(0, "No server configured")
        val url = if (path.startsWith("http")) path else baseUrl + path
        execute(method, url, body, auth)
    }

    private suspend fun rawGet(url: String, auth: Boolean): String =
        withContext(Dispatchers.IO) { execute("GET", url, null, auth) }

    private fun execute(method: String, url: String, body: JsonElement?, auth: Boolean): String {
        val httpUrl = url.toHttpUrlOrNull() ?: throw PbException(0, "Invalid URL: $url")
        val reqBody = body?.let { json.encodeToString(JsonElement.serializer(), it).toRequestBody(jsonMedia) }
        val builder = Request.Builder().url(httpUrl)
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete(reqBody)
            "POST" -> builder.post(reqBody ?: emptyBody())
            "PATCH" -> builder.patch(reqBody ?: emptyBody())
            else -> builder.method(method, reqBody)
        }
        if (auth) token?.let { builder.header("Authorization", it) }
        http.newCall(builder.build()).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw PbException(resp.code, "HTTP ${resp.code} for $url", text)
            return text
        }
    }

    private fun emptyBody() = "".toRequestBody(jsonMedia)

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
}
