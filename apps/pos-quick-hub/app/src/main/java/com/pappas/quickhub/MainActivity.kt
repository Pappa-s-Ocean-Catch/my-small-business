package com.pappas.quickhub

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Start Foreground Notification Service
        startHubService()

        setupCards()
        setupToggles()
        setupAllApps()
    }

    override fun onResume() {
        super.onResume()
        updateFloatingToggleState()
    }

    private fun startHubService() {
        val intent = Intent(this, QuickHubService::class.java).apply {
            putExtra(QuickHubService.EXTRA_ENABLE_BUBBLE, hasOverlayPermission())
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
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
            startService(intent)
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
