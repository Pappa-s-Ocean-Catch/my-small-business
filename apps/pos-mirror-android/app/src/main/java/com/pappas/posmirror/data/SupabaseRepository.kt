package com.pappas.posmirror.data

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.pappas.posmirror.data.model.CustomerQueueEntry
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import com.pappas.posmirror.data.model.RegisterOption
import com.pappas.posmirror.util.CustomerQueueHelper
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperation
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Serializable
data class ProfileRole(val role_slug: String = "")

@Serializable
data class RegisterRow(val register_id: String? = null, val register_name: String? = null)

@Serializable
data class PosMirrorStateRow(val register_id: String = "", val current_order: MirrorOrderSnapshot = MirrorOrderSnapshot())

class SupabaseRepository(
    private val client: SupabaseClientProvider = SupabaseClientProvider,
    private val gson: Gson = Gson()
) {
    companion object {
        private const val TAG = "SupabaseRepository"
    }

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    suspend fun signIn(email: String, pass: String): io.github.jan.supabase.auth.user.UserSession = withContext(Dispatchers.IO) {
        client.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = pass
        }
        val session = client.auth.currentSessionOrNull() ?: throw Exception("Login succeeded but session is null")
        session
    }

    suspend fun restoreSession(accessToken: String, refreshToken: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client.auth.importAuthToken(accessToken = accessToken, refreshToken = refreshToken)
            val user = client.auth.currentUserOrNull()
            Log.d(TAG, "restoreSession: restored user = ${user?.email}")
            user != null
        } catch (e: Exception) {
            Log.w(TAG, "restoreSession failed", e)
            false
        }
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        try {
            client.auth.signOut()
        } catch (e: Exception) {
            Log.w(TAG, "Sign out exception", e)
        }
    }

    suspend fun canAccessPosMirror(userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val list = client.postgrest["profiles"]
                .select(columns = Columns.list("role_slug")) {
                    filter {
                        eq("id", userId)
                    }
                }
                .decodeList<ProfileRole>()

            if (list.isEmpty()) return@withContext false
            val roleSlug = list.first().role_slug
            roleSlug == "admin" || roleSlug == "staff"
        } catch (e: Exception) {
            Log.e(TAG, "Error checking role permissions", e)
            false
        }
    }

    suspend fun listRegisters(): List<RegisterOption> = withContext(Dispatchers.IO) {
        val user = client.auth.currentUserOrNull()
        Log.d(TAG, "listRegisters: authenticated user = ${user?.email} (${user?.id})")
        val rows = client.postgrest["pos_mirror_state"]
            .select(columns = Columns.list("register_id", "register_name")) {
                order(column = "register_id", order = Order.ASCENDING)
            }
            .decodeList<RegisterRow>()
        Log.d(TAG, "listRegisters: received ${rows.size} rows from pos_mirror_state")

        val map = linkedMapOf<String, String>()
        for (row in rows) {
            val regId = row.register_id?.trim() ?: continue
            if (regId.isEmpty()) continue
            val regName = row.register_name?.trim()
            map[regId] = if (!regName.isNullOrEmpty()) regName else "Unknown Register"
        }

        map.map { RegisterOption(it.key, it.value) }.sortedBy { it.id }
    }

    suspend fun fetchCurrentOrder(registerId: String): MirrorOrderSnapshot = withContext(Dispatchers.IO) {
        val cleanId = registerId.trim()
        val rows = client.postgrest["pos_mirror_state"]
            .select(columns = Columns.list("register_id", "current_order")) {
                filter {
                    eq("register_id", cleanId)
                }
            }
            .decodeList<PosMirrorStateRow>()

        if (rows.isEmpty()) MirrorOrderSnapshot() else rows.first().current_order
    }

    suspend fun fetchCustomerQueue(): List<CustomerQueueEntry> = withContext(Dispatchers.IO) {
        val lookbackMs = System.currentTimeMillis() - (14L * 24 * 60 * 60 * 1000)
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val lookbackIso = isoFormat.format(Date(lookbackMs))

        val select = "id,order_number,created_at,scheduled_pickup_at,order_status,payment_status,customer_name,total,order_items(id,product_name,quantity,subtotal,order_item_addons(id,addon_item_name,addon_item_price))"

        val response = client.postgrest["orders"]
            .select(columns = Columns.raw(select)) {
                filter {
                    gte("created_at", lookbackIso)
                    neq("order_status", "completed")
                    neq("order_status", "cancelled")
                    neq("order_status", "refunded")
                    neq("order_status", "pending_online_payment")
                    neq("payment_status", "refunded")
                }
                order("created_at", Order.ASCENDING)
            }

        val rawJson = response.data
        val array = JsonParser.parseString(rawJson).asJsonArray
        CustomerQueueHelper.parseAndBuildQueue(array)
    }

    suspend fun fetchQueueCount(): Int = withContext(Dispatchers.IO) {
        try {
            val today = SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())

            val response = client.postgrest["orders"]
                .select(columns = Columns.list("id")) {
                    filter {
                        gte("created_at", today)
                        isIn("order_status", listOf("pending", "preparing"))
                    }
                }
            val rawJson = response.data
            val array = JsonParser.parseString(rawJson).asJsonArray
            array.size()
        } catch (e: Exception) {
            Log.w(TAG, "fetchQueueCount failed", e)
            0
        }
    }

    fun subscribeMirrorState(
        scope: CoroutineScope,
        registerId: String,
        onSnapshot: (MirrorOrderSnapshot) -> Unit
    ): RealtimeChannel {
        val cleanId = registerId.trim()
        val channel = client.realtime.channel("pos-mirror-state-$cleanId")

        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "pos_mirror_state"
            filter(FilterOperation("register_id", FilterOperator.EQ, cleanId))
        }

        changeFlow.onEach { action ->
            when (action) {
                is PostgresAction.Insert -> parseRecordAndEmit(action.record, onSnapshot)
                is PostgresAction.Update -> parseRecordAndEmit(action.record, onSnapshot)
                is PostgresAction.Select -> parseRecordAndEmit(action.record, onSnapshot)
                else -> {}
            }
        }.launchIn(scope)

        return channel
    }

    fun subscribeOrderSync(
        scope: CoroutineScope,
        onSync: () -> Unit
    ): RealtimeChannel {
        val channel = client.realtime.channel("pos-mirror-order-sync")

        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "order_sync_state"
        }

        changeFlow.onEach {
            onSync()
        }.launchIn(scope)

        return channel
    }

    private fun parseRecordAndEmit(
        record: kotlinx.serialization.json.JsonObject,
        onSnapshot: (MirrorOrderSnapshot) -> Unit
    ) {
        try {
            val currentOrderElem = record["current_order"]
            if (currentOrderElem != null) {
                val snapshot = json.decodeFromJsonElement<MirrorOrderSnapshot>(currentOrderElem)
                onSnapshot(snapshot)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error decoding realtime order snapshot", e)
        }
    }
}
