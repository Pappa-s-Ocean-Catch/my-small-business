package com.pappas.posmirror.data

import com.pappas.posmirror.util.Constants
import com.pappas.posmirror.App
import com.pappas.posmirror.data.repository.SettingsRepository
import io.github.jan.supabase.auth.SettingsSessionManager
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.realtime

object SupabaseClientProvider {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = Constants.SUPABASE_URL,
            supabaseKey = Constants.SUPABASE_ANON_KEY
        ) {
            install(Auth) {
                alwaysAutoRefresh = true
                autoLoadFromStorage = true
                autoSaveToStorage = true
                // A kiosk must keep refreshing through activity transitions and focus loss.
                enableLifecycleCallbacks = false
                val prefs = SettingsRepository(App.instance)
                // Match the SDK's existing per-project storage key so upgrades preserve sessions.
                val storageKey = mirrorSessionStorageKey(Constants.SUPABASE_URL)
                sessionManager = MirrorSessionManager(
                    SettingsSessionManager(key = storageKey),
                    { session -> session.user?.id?.let { prefs.saveAuth(session.accessToken, session.refreshToken, it) } },
                    { prefs.clearAuth() }
                )
            }
            install(Postgrest)
            install(Realtime)
        }
    }

    val auth get() = client.auth
    val postgrest get() = client.postgrest
    val realtime get() = client.realtime
}
