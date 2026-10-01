package com.pappas.quickhub

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager

class LauncherManager(private val context: Context) {
    private val prefs = context.getSharedPreferences("launcher_prefs", Context.MODE_PRIVATE)
    private val policy = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val admin = ComponentName(context, LauncherAdminReceiver::class.java)

    val isDeviceOwner: Boolean get() = policy.isDeviceOwnerApp(context.packageName)
    val protectionEnabled: Boolean get() = prefs.getBoolean("protect_home", false)

    fun currentHomePackage(): String? {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        // Android's resolver is not a selected Home app.
        return resolved?.activityInfo?.packageName?.takeUnless { it == "android" }
    }

    fun homeState(): HomeState {
        val current = currentHomePackage()
        val state = HomePolicy.state(current, context.packageName, prefs.getBoolean("was_home", false))
        if (state == HomeState.ACTIVE) prefs.edit().putBoolean("was_home", true).apply()
        return state
    }

    fun setProtection(enabled: Boolean) {
        check(isDeviceOwner) { "Device Owner provisioning is required to protect Home." }
        if (enabled) {
            setPersistentHome()
        } else {
            policy.clearPackagePersistentPreferredActivities(admin, context.packageName)
        }
        // Save only after the OS accepts the change.
        prefs.edit().putBoolean("protect_home", enabled).apply()
    }

    fun restoreProtectedHome(): String? {
        if (!HomePolicy.shouldEnforce(isDeviceOwner, protectionEnabled)) return null
        return try {
            setPersistentHome()
            null
        } catch (e: RuntimeException) {
            e.message ?: "The device refused Home protection."
        }
    }

    private fun setPersistentHome() {
        val filter = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        policy.addPersistentPreferredActivity(admin, filter, ComponentName(context, MainActivity::class.java))
    }
}
