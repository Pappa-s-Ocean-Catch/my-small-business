package com.pappas.quickhub

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class LauncherRedirectService : AccessibilityService() {
    private val guard = RedirectGuard()
    private fun record(message: String) {
        val prefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val previous = prefs.getString("diagnostics", "") ?: ""
        val time = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
        prefs.edit().putString("diagnostics", (previous.lines().filter { it.isNotBlank() } + "$time $message")
            .takeLast(20).joinToString("\n")).apply()
    }
    override fun onServiceConnected() {
        super.onServiceConnected()
        record("Service connected")
    }
    override fun onUnbind(intent: Intent?): Boolean {
        record("Service disconnected")
        return super.onUnbind(intent)
    }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val foreground = event.packageName?.toString() ?: return
        val prefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val eventAge = (SystemClock.uptimeMillis() - event.eventTime).coerceAtLeast(0)
        val signature = "$foreground / ${event.className ?: "unknown"}"
        if (prefs.getString("last_window", "") != signature) {
            prefs.edit().putString("last_window", signature).apply()
            record("Window: $signature (event age ${eventAge}ms)")
        }
        if (foreground != packageName && foreground != "com.android.systemui" &&
            foreground != "android" && foreground != "com.android.settings") {
            val recent = (prefs.getString("recent_packages", "") ?: "").lines()
                .filter { it.isNotBlank() && it != foreground }
            prefs.edit().putString("recent_packages", (recent + foreground).takeLast(10).joinToString("\n")).apply()
        }
        if (!guard.allow(prefs.getBoolean("enabled", false), prefs.getString("target", "") ?: "",
                foreground, packageName, SystemClock.elapsedRealtime())) return
        record("Matched selected launcher: $foreground")
        try {
            prefs.edit().putLong("launch_requested_at", SystemClock.elapsedRealtime()).apply()
            startActivity(Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            })
            record("Pappa’s launch requested (display not confirmed)")
        } catch (e: RuntimeException) {
            record("Launch error: ${e.javaClass.simpleName}: ${e.message}")
            Log.w("LauncherRedirect", "Device refused launcher redirect", e)
        }
    }
    override fun onInterrupt() { record("Service interrupted") }
}
