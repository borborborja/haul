package com.bor_devs.shoplist

import com.bor_devs.shoplist.data.remote.PocketBaseClient
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PocketBaseClientTest {
    @Test fun readsEveryPageEvenWithUnknownTotals() = runTest {
        val requested = mutableListOf<Int>()
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            val page = chain.request().url.queryParameter("page")!!.toInt()
            requested.add(page)
            val count = if (page == 1) 500 else if (page == 2) 2 else 0
            val items = (0 until count).joinToString(",") { "{\"id\":\"${page}_$it\",\"name\":\"Product $it\"}" }
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK")
                .body("{\"page\":$page,\"perPage\":500,\"totalItems\":-1,\"totalPages\":-1,\"items\":[$items]}".toResponseBody("application/json".toMediaType())).build()
        }.build()
        val client = PocketBaseClient(http, Json { ignoreUnknownKeys = true })
        client.setBaseUrl("https://example.test")
        val items = client.getItems("testlist")
        assertEquals(listOf(1, 2), requested)
        assertEquals(502, items.size)
        assertTrue(items.any { it.id == "2_1" })
    }

    @Test fun exactFullPageFetchesOneEmptyPageAndStops() = runTest {
        var calls = 0
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            calls++
            val items = if (calls == 1) (0 until 500).joinToString(",") { "{\"id\":\"$it\"}" } else ""
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK").body("{\"items\":[$items]}".toResponseBody("application/json".toMediaType())).build()
        }.build()
        val client = PocketBaseClient(http, Json { ignoreUnknownKeys = true })
        client.setBaseUrl("https://example.test")
        assertEquals(500, client.getItems("list").size)
        assertEquals(2, calls)
    }
}
