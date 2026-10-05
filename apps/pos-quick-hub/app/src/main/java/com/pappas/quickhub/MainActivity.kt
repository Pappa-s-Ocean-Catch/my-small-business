package com.pappas.quickhub

import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.pappas.quickhub.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val overlayRequestCode = 1234
    private val launcher by lazy { LauncherManager(this) }
    private var protectionError: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Start Foreground Notification Service
        startHubService()

        setupCards()
        setupToggles()
        setupAllApps()
        binding.btnLauncherSetup.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Launcher setup")
                .setItems(arrayOf("Default Home settings", "SUNMI Home redirect", "Redirect diagnostics")) { _, which ->
                    when (which) {
                        0 -> showLauncherSetup()
                        1 -> showRedirectSetup()
                        else -> showRedirectDiagnostics()
                    }
                }.setNegativeButton("Close", null).show()
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
            val prefs = getSharedPreferences("quick_hub_prefs", MODE_PRIVATE)
            if (!prefs.getBoolean("notification_requested", false)) {
                prefs.edit().putBoolean("notification_requested", true).apply()
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1235)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val redirectPrefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val requested = redirectPrefs.getLong("launch_requested_at", 0)
        if (requested > 0) {
            val elapsed = android.os.SystemClock.elapsedRealtime() - requested
            val previous = redirectPrefs.getString("diagnostics", "") ?: ""
            val time = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
            redirectPrefs.edit().remove("launch_requested_at").putString("diagnostics",
                (previous.lines().filter { it.isNotBlank() } + "$time Pappa’s resumed ${elapsed}ms after launch request (may include manual return)")
                    .takeLast(20).joinToString("\n")).apply()
        }
        updateFloatingToggleState()
        protectionError = launcher.restoreProtectedHome()
        updateHomeStatus()
    }

    private fun startHubService() {
        val intent = Intent(this, QuickHubService::class.java).apply {
            putExtra(QuickHubService.EXTRA_ENABLE_BUBBLE, hasOverlayPermission())
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (e: RuntimeException) {
            Toast.makeText(this, "Quick shortcuts unavailable: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun setupCards() {
        // Card 1: POS Mirror
        val openPosMirror = {
            launchApp("com.pappas.posmirror", "POS Mirror is not installed!")
        }
        binding.cardPosMirror.setOnClickListener { openPosMirror() }
        binding.btnOpenPosMirror.setOnClickListener { openPosMirror() }

        // Card 2: Order Management
        val openOrder = {
            launchApp("com.pappas.ordermanagement", "Pappas Order Management is not installed!")
        }
        binding.cardOrderManagement.setOnClickListener { openOrder() }
        binding.btnOpenOrderManagement.setOnClickListener { openOrder() }

        // Card 3: Browser
        val openBrowser = {
            val intent = packageManager.getLaunchIntentForPackage("acr.browser.lightning")
                ?: Intent(Intent.ACTION_VIEW, Uri.parse("http://192.168.4.67:8080"))
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "Cannot open browser: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
        binding.cardBrowser.setOnClickListener { openBrowser() }
        binding.btnOpenBrowser.setOnClickListener { openBrowser() }

        // Card 4: Settings
        val openSettings = {
            try {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            } catch (e: Exception) {
                Toast.makeText(this, "Cannot open Android Settings", Toast.LENGTH_SHORT).show()
            }
        }
        binding.cardSettings.setOnClickListener { openSettings() }
        binding.btnOpenSettings.setOnClickListener { openSettings() }
    }

    private fun setupToggles() {
        binding.switchFloatingButton.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                if (!hasOverlayPermission()) {
                    requestOverlayPermission()
                } else {
                    val intent = Intent(this, QuickHubService::class.java).apply {
                        putExtra(QuickHubService.EXTRA_ENABLE_BUBBLE, true)
                    }
                    startService(intent)
                }
            } else {
                val intent = Intent(this, QuickHubService::class.java).apply {
                    putExtra(QuickHubService.EXTRA_ENABLE_BUBBLE, false)
                }
                startService(intent)
            }
        }
    }

    private fun updateFloatingToggleState() {
        val hasPermission = hasOverlayPermission()
        binding.switchFloatingButton.isChecked = hasPermission
        if (hasPermission) {
            val intent = Intent(this, QuickHubService::class.java).apply {
                putExtra(QuickHubService.EXTRA_ENABLE_BUBBLE, true)
            }
            try { startService(intent) } catch (e: RuntimeException) {
                android.util.Log.w("QuickHub", "Overlay service unavailable", e)
            }
        }
    }

    private fun setupAllApps() {
        binding.btnAllApps.setOnClickListener {
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps = packageManager.queryIntentActivities(mainIntent, 0)
                .sortedBy { it.loadLabel(packageManager).toString() }

            val appNames = apps.map { it.loadLabel(packageManager).toString() }
            val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, appNames)

            AlertDialog.Builder(this)
                .setTitle("All Installed Applications (${apps.size})")
                .setAdapter(adapter) { _, which ->
                    val selected = apps[which]
                    val launchIntent = packageManager.getLaunchIntentForPackage(selected.activityInfo.packageName)
                    if (launchIntent != null) {
                        startActivity(launchIntent)
                    } else {
                        Toast.makeText(this, "Unable to launch selected application", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Close", null)
                .show()
        }
    }


    private fun updateHomeStatus() {
        binding.textHomeStatus.text = when (launcher.homeState()) {
            HomeState.ACTIVE -> if (launcher.protectionEnabled && launcher.isDeviceOwner && protectionError == null)
                "Pappa’s is the default Home app • Managed protection enabled"
            else "Pappa’s is the default Home app"
            HomeState.REPLACED -> "Default Home changed to ${launcher.currentHomePackage()} • Open Launcher setup"
            HomeState.UNSELECTED -> "Pappa’s is not the default Home app • Open Launcher setup"
        }
        if (protectionError != null) binding.textHomeStatus.append(" • Protection failed")
    }

    private fun showLauncherSetup() {
        updateHomeStatus()
        val currentHome = launcher.currentHomePackage() ?: "No selected Home app"
        val managed = if (launcher.isDeviceOwner) {
            "Device Owner access available. Home protection is ${if (launcher.protectionEnabled) "enabled" else "disabled"}."
        } else {
            "Standard app access. SUNMI or your device manager may override your Home selection. " +
                "Permanent protection requires Device Owner provisioning or a SUNMI management policy. " +
                "Installing this APK or enabling legacy Device Admin does not grant Device Owner access."
        }
        val message = "Current Home: $currentHome\n\n$managed\n\n" +
            "Choose Pappa’s Launcher as Home, press Home, then return here to check the status. " +
            "Your floating button and notification shortcuts remain available if Home is overridden.\n\n" +
            "Device: ${Build.MANUFACTURER} ${Build.MODEL}\nAndroid: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})" +
            (protectionError?.let { "\n\nProtection error: $it" } ?: "")
        val dialog = AlertDialog.Builder(this)
            .setTitle("Launcher setup")
            .setMessage(message)
            .setPositiveButton("Choose Home") { _, _ -> chooseHome() }
            .setNegativeButton("Close", null)
        if (launcher.isDeviceOwner) {
            dialog.setNeutralButton(if (launcher.protectionEnabled) "Disable protection" else "Protect Home") { _, _ ->
                val enable = !launcher.protectionEnabled
                AlertDialog.Builder(this)
                    .setTitle(if (enable) "Protect Pappa’s Home?" else "Disable Home protection?")
                    .setMessage(if (enable) "Keep Pappa’s as the preferred Home app using Device Owner policy. You can disable this here later."
                        else "Clear Pappa’s persistent Home preference so another launcher can be selected.")
                    .setPositiveButton("Apply") { _, _ ->
                        try {
                            launcher.setProtection(enable)
                            protectionError = null
                        } catch (e: RuntimeException) {
                            protectionError = e.message ?: "The device refused the policy."
                            Toast.makeText(this, protectionError, Toast.LENGTH_LONG).show()
                        }
                        updateHomeStatus()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
        }
        dialog.show().findViewById<android.widget.TextView>(android.R.id.message)?.setTextIsSelectable(true)
    }

    private fun showRedirectSetup() {
        val prefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val target = prefs.getString("target", "") ?: ""
        val enabled = prefs.getBoolean("enabled", false)
        val manager = getSystemService(ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
        val serviceEnabled = manager.getEnabledAccessibilityServiceList(
            android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName &&
            it.resolveInfo.serviceInfo.name == LauncherRedirectService::class.java.name }
        AlertDialog.Builder(this)
            .setTitle("SUNMI Home redirect")
            .setMessage("Redirect: ${if (enabled) "ON" else "OFF"}\n" +
                "Stock launcher: ${target.ifBlank { "Not selected" }}\n" +
                "Accessibility service: ${if (serviceEnabled) "enabled" else "disabled"}\n\n" +
                "Select the stock launcher opened by Home. When that app appears, return to Pappa’s. " +
                "This also redirects if you open that launcher manually. Other apps are unaffected. " +
                "A brief flash of the stock launcher may occur.\n\n" +
                "Enable Pappa’s Home redirect in Accessibility settings. It observes app window changes, " +
                "without reading screen content. No USB or ADB is needed.")
            .setPositiveButton("Select stock launcher") { _, _ -> selectRedirectLauncher() }
            .setNeutralButton("Accessibility settings") { _, _ ->
                try { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
                catch (e: RuntimeException) {
                    Toast.makeText(this, "Accessibility settings unavailable", Toast.LENGTH_LONG).show()
                }
            }
            .setNegativeButton(if (enabled) "Turn off" else "Turn on") { _, _ ->
                if (!enabled && target.isBlank()) selectRedirectLauncher()
                else {
                    prefs.edit().putBoolean("enabled", !enabled).apply()
                    showRedirectSetup()
                }
            }.show()
    }

    private fun showRedirectDiagnostics() {
        val prefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val manager = getSystemService(ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
        val active = manager.getEnabledAccessibilityServiceList(
            android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName &&
            it.resolveInfo.serviceInfo.name == LauncherRedirectService::class.java.name }
        val message = "Version: ${packageManager.getPackageInfo(packageName, 0).versionName}\n" +
            "Redirect: ${if (prefs.getBoolean("enabled", false)) "ON" else "OFF"}\n" +
            "Target: ${prefs.getString("target", "")?.ifBlank { "Not selected" }}\n" +
            "Accessibility enabled: $active\n\n" +
            "Clear log, open a POS app, wait 3 seconds, press Home, then return through the floating button or notification and open this log.\n\n" +
            (prefs.getString("diagnostics", "")?.ifBlank { "No events recorded yet. Toggle the accessibility service off and on." })
        AlertDialog.Builder(this).setTitle("Redirect diagnostics").setMessage(message)
            .setPositiveButton("Refresh") { _, _ -> showRedirectDiagnostics() }
            .setNeutralButton("Choose observed app") { _, _ -> selectObservedRedirectTarget() }
            .setNegativeButton("Clear log") { _, _ ->
                prefs.edit().remove("diagnostics").remove("last_window").remove("recent_packages").apply()
                Toast.makeText(this, "Log cleared. Open a POS app and press Home.", Toast.LENGTH_LONG).show()
            }.show().findViewById<android.widget.TextView>(android.R.id.message)?.setTextIsSelectable(true)
    }

    private fun selectObservedRedirectTarget() {
        val prefs = getSharedPreferences("launcher_redirect", MODE_PRIVATE)
        val packages = (prefs.getString("recent_packages", "") ?: "").lines().filter { it.isNotBlank() }.reversed()
        if (packages.isEmpty()) {
            Toast.makeText(this, "No apps observed. Enable the service, then open a POS app and press Home.", Toast.LENGTH_LONG).show()
            return
        }
        AlertDialog.Builder(this).setTitle("Select the observed SUNMI launcher")
            .setItems(packages.toTypedArray()) { _, which ->
                val selected = packages[which]
                AlertDialog.Builder(this).setTitle("Redirect $selected?")
                    .setMessage("Select only the stock launcher shown after Home. Every time this app appears, Pappa’s will open instead. Check its Window entry in the log first.")
                    .setPositiveButton("Use this launcher") { _, _ ->
                        prefs.edit().putString("target", selected).putBoolean("enabled", true).apply()
                        showRedirectSetup()
                    }.setNegativeButton("Cancel", null).show()
            }.setNegativeButton("Close", null).show()
    }

    private fun selectRedirectLauncher() {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val apps = packageManager.queryIntentActivities(home, 0)
            .filter { it.activityInfo.packageName != packageName }
            .distinctBy { it.activityInfo.packageName }
            .sortedBy { it.loadLabel(packageManager).toString() }
        if (apps.isEmpty()) {
            Toast.makeText(this, "No other Home apps found", Toast.LENGTH_LONG).show()
            return
        }
        val labels = apps.map { "${it.loadLabel(packageManager)}\n${it.activityInfo.packageName}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Select the stock launcher opened by Home")
            .setItems(labels) { _, which ->
                getSharedPreferences("launcher_redirect", MODE_PRIVATE).edit()
                    .putString("target", apps[which].activityInfo.packageName)
                    .putBoolean("enabled", true).apply()
                showRedirectSetup()
            }.setNegativeButton("Cancel", null).show()
    }

    private fun chooseHome() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roles = getSystemService(RoleManager::class.java)
            if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_HOME) && !roles.isRoleHeld(RoleManager.ROLE_HOME)) {
                try {
                    startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), 1236)
                    return
                } catch (e: RuntimeException) {
                    android.util.Log.w("QuickHub", "Home role request unavailable", e)
                }
            }
        }
        for (action in listOf(Settings.ACTION_HOME_SETTINGS, Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS, Settings.ACTION_SETTINGS)) {
            try {
                startActivity(Intent(action))
                return
            } catch (e: RuntimeException) {
                android.util.Log.w("QuickHub", "Settings action unavailable: $action", e)
            }
        }
        Toast.makeText(this, "Home settings are blocked. Configure Home through your device manager.", Toast.LENGTH_LONG).show()
    }

    private fun launchApp(packageName: String, notFoundMsg: String) {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            startActivity(intent)
        } else {
            Toast.makeText(this, notFoundMsg, Toast.LENGTH_LONG).show()
        }
    }

    private fun hasOverlayPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else {
            true
        }
    }

    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Toast.makeText(this, "Please enable 'Draw over other apps' for Pappa's Hub", Toast.LENGTH_LONG).show()
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, overlayRequestCode)
        }
    }
}
