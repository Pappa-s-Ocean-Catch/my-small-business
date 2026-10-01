package com.pappas.posmirror.network

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.pappas.posmirror.data.model.CustomerQueueEntry
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import com.pappas.posmirror.data.model.RegisterOption
import com.pappas.posmirror.util.Constants
import com.pappas.posmirror.util.CustomerQueueHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class SupabaseApiClient(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson()
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun signIn(email: String, pass: String): Pair<String, String> = withContext(Dispatchers.IO) {
        val payload = JsonObject().apply {
            addProperty("email", email.trim())
            addProperty("password", pass)
        }

        val request = Request.Builder()
            .url("${Constants.SUPABASE_URL}/auth/v1/token?grant_type=password")
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .post(payload.toString().toRequestBody(jsonMedia))
            .build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val errorMsg = try {
                    val errJson = JsonParser.parseString(body).asJsonObject
                    errJson.get("error_description")?.asString
                        ?: errJson.get("msg")?.asString
                        ?: errJson.get("message")?.asString
                        ?: "Authentication failed"
                } catch (e: Exception) {
                    "Authentication failed (${response.code})"
                }
                throw Exception(errorMsg)
            }

            val json = JsonParser.parseString(body).asJsonObject
            val token = json.get("access_token")?.asString
                ?: throw Exception("No access token in response")
            val userId = json.getAsJsonObject("user")?.get("id")?.asString
                ?: throw Exception("No user ID in response")

            Pair(token, userId)
        }
    }

    suspend fun canAccessPosMirror(token: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${Constants.SUPABASE_URL}/rest/v1/profiles?select=role_slug&id=eq.$userId")
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                return@withContext false
            }
            val body = response.body?.string() ?: ""
            val array = JsonParser.parseString(body).asJsonArray
            if (array.size() == 0) return@withContext false
            val roleSlug = array[0].asJsonObject.get("role_slug")?.asString ?: ""
            roleSlug == "admin" || roleSlug == "staff"
        }
    }

    suspend fun listRegisters(token: String): List<RegisterOption> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${Constants.SUPABASE_URL}/rest/v1/pos_mirror_state?select=register_id,register_name&order=register_id.asc")
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw Exception("Failed to load registers (${response.code})")
            }
            val body = response.body?.string() ?: ""
            val array = JsonParser.parseString(body).asJsonArray
            val map = linkedMapOf<String, String>()

            for (elem in array) {
                if (!elem.isJsonObject) continue
                val obj = elem.asJsonObject
                val regId = obj.get("register_id")?.takeIf { !it.isJsonNull }?.asString?.trim() ?: continue
                if (regId.isEmpty()) continue
                val regName = obj.get("register_name")?.takeIf { !it.isJsonNull }?.asString?.trim()
                map[regId] = if (!regName.isNullOrEmpty()) regName else "Unknown Register"
            }

            map.map { RegisterOption(it.key, it.value) }.sortedBy { it.id }
        }
    }

    suspend fun fetchCurrentOrder(token: String, registerId: String): MirrorOrderSnapshot = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${Constants.SUPABASE_URL}/rest/v1/pos_mirror_state?select=register_id,current_order&register_id=eq.$registerId")
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                return@withContext MirrorOrderSnapshot()
            }
            val body = response.body?.string() ?: ""
            val array = JsonParser.parseString(body).asJsonArray
            if (array.size() == 0) return@withContext MirrorOrderSnapshot()

            val row = array[0].asJsonObject
            val currentOrder = row.get("current_order")
            if (currentOrder != null && currentOrder.isJsonObject) {
                gson.fromJson(currentOrder, MirrorOrderSnapshot::class.java)
            } else {
                MirrorOrderSnapshot()
            }
        }
    }

    suspend fun fetchCustomerQueue(token: String): List<CustomerQueueEntry> = withContext(Dispatchers.IO) {
        val lookbackMs = System.currentTimeMillis() - (14L * 24 * 60 * 60 * 1000)
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val lookbackIso = isoFormat.format(Date(lookbackMs))

        val select = "id,order_number,created_at,scheduled_pickup_at,order_status,payment_status,customer_name,total,order_items(id,product_name,quantity,subtotal,order_item_addons(id,addon_item_name,addon_item_price))"
        val url = "${Constants.SUPABASE_URL}/rest/v1/orders?select=$select" +
                "&created_at=gte.$lookbackIso" +
                "&order_status=neq.completed" +
                "&order_status=neq.cancelled" +
                "&order_status=neq.refunded" +
                "&order_status=neq.pending_online_payment" +
                "&payment_status=neq.refunded" +
                "&order=created_at.asc"

        val request = Request.Builder()
            .url(url)
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw Exception("Failed to load queue (${response.code})")
            }
            val body = response.body?.string() ?: ""
            val array = JsonParser.parseString(body).asJsonArray
            CustomerQueueHelper.parseAndBuildQueue(array)
        }
    }

    suspend fun fetchQueueCount(token: String): Int = withContext(Dispatchers.IO) {
        val today = SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val url = "${Constants.SUPABASE_URL}/rest/v1/orders?select=id&created_at=gte.$today&order_status=in.(pending,preparing)"

        val request = Request.Builder()
            .url(url)
            .header("apikey", Constants.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Prefer", "count=exact")
            .header("Range", "0-0")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful && response.code != 206) {
                return@withContext 0
            }
            val contentRange = response.header("Content-Range")
            if (contentRange != null && contentRange.contains("/")) {
                val totalStr = contentRange.substringAfter("/")
                totalStr.toIntOrNull() ?: 0
            } else {
                0
            }
        }
    }
}
