package com.pappas.posmirror.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.pappas.posmirror.data.model.MirrorSettings

class SettingsRepository(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("pos_mirror_prefs", Context.MODE_PRIVATE)

    fun getSettings(): MirrorSettings {
        return MirrorSettings(
            registerId = prefs.getString("register_id", "") ?: "",
            idleMode = prefs.getString("idle_mode", "image") ?: "image",
            idleImageUri = prefs.getString("idle_image_uri", null),
            showClock = prefs.getBoolean("show_clock", true)
        )
    }

    fun saveSettings(settings: MirrorSettings) {
        prefs.edit()
            .putString("register_id", settings.registerId.trim())
            .putString("idle_mode", settings.idleMode)
            .putString("idle_image_uri", settings.idleImageUri)
            .putBoolean("show_clock", settings.showClock)
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString("access_token", null)

    fun getRefreshToken(): String? = prefs.getString("refresh_token", null)

    fun getUserId(): String? = prefs.getString("user_id", null)

    fun saveAuth(accessToken: String, refreshToken: String, userId: String) {
        prefs.edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken)
            .putString("user_id", userId)
            .apply()
    }

    fun clearAuth() {
        prefs.edit()
            .remove("access_token")
            .remove("refresh_token")
            .remove("user_id")
            .apply()
    }

    fun getSavedEmail(): String? = prefs.getString("saved_email", null)

    fun saveEmail(email: String?) {
        if (email.isNullOrBlank()) {
            prefs.edit().remove("saved_email").apply()
        } else {
            prefs.edit().putString("saved_email", email.trim()).apply()
        }
    }

    fun isRememberEmail(): Boolean = prefs.getBoolean("remember_email", true)

    fun setRememberEmail(remember: Boolean) {
        prefs.edit().putBoolean("remember_email", remember).apply()
    }
}
