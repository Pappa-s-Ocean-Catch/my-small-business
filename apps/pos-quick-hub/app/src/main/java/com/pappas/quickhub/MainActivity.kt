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
        binding.btnLauncherSetup.setOnClickListener { showLauncherSetup() }
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
