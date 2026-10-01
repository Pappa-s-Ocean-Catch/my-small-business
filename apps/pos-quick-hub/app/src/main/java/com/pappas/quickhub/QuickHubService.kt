package com.pappas.quickhub

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat

class QuickHubService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var isFloatingViewShowing = false

    companion object {
        const val CHANNEL_ID = "pappas_quick_hub"
        const val NOTIFICATION_ID = 9001
        const val ACTION_TOGGLE_BUBBLE = "com.pappas.quickhub.ACTION_TOGGLE_BUBBLE"
        const val EXTRA_ENABLE_BUBBLE = "extra_enable_bubble"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val enableBubble = intent?.getBooleanExtra(EXTRA_ENABLE_BUBBLE, true) ?: true
        if (enableBubble) {
            showFloatingBubble()
        } else {
            hideFloatingBubble()
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pappa's POS Controls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Quick notification controls to open POS Mirror & Order Management"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        val openHubIntent = Intent(this, MainActivity::class.java)
        val pendingOpenHub = PendingIntent.getActivity(
            this, 0, openHubIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Action 1: POS Mirror
        val posMirrorIntent = packageManager.getLaunchIntentForPackage("com.pappas.posmirror") ?: openHubIntent
        val pendingPosMirror = PendingIntent.getActivity(
            this, 1, posMirrorIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Action 2: Order Management
        val orderIntent = packageManager.getLaunchIntentForPackage("com.pappas.ordermanagement") ?: openHubIntent
        val pendingOrder = PendingIntent.getActivity(
            this, 2, orderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Action 3: Browser
        val browserIntent = packageManager.getLaunchIntentForPackage("acr.browser.lightning")
            ?: Intent(Intent.ACTION_VIEW, Uri.parse("http://192.168.4.67:8080"))
        val pendingBrowser = PendingIntent.getActivity(
            this, 3, browserIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Action 4: Settings
        val settingsIntent = Intent(Settings.ACTION_SETTINGS)
        val pendingSettings = PendingIntent.getActivity(
            this, 4, settingsIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_hub_launcher)
            .setContentTitle("Pappa's POS Control Hub")
            .setContentText("Tap to open: POS Mirror | Order Management | Web")
            .setContentIntent(pendingOpenHub)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_hub_launcher, "📺 POS Mirror", pendingPosMirror)
            .addAction(R.drawable.ic_hub_launcher, "📦 Order POS", pendingOrder)
            .addAction(R.drawable.ic_hub_launcher, "🌐 Web", pendingBrowser)
            .addAction(R.drawable.ic_hub_launcher, "⚙️ Settings", pendingSettings)
            .build()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showFloatingBubble() {
        if (isFloatingViewShowing) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return
        }

        try {
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            floatingView = LayoutInflater.from(this).inflate(R.layout.overlay_floating_hub, null)
            floatingView?.alpha = 0.85f

            val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            val prefs = getSharedPreferences("quick_hub_prefs", Context.MODE_PRIVATE)
            val savedX = prefs.getInt("bubble_x", 16)
            val savedY = prefs.getInt("bubble_y", 16)

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = savedX
                y = savedY
            }

            var initialX = 0
            var initialY = 0
            var initialTouchX = 0f
            var initialTouchY = 0f
            var isClick = true

            floatingView?.setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        floatingView?.alpha = 1.0f
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isClick = true
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                            isClick = false
                        }
                        params.x = initialX + dx
                        params.y = initialY + dy
                        windowManager?.updateViewLayout(floatingView, params)
                        true
                    }
                    MotionEvent.ACTION_UP -> {
                        floatingView?.alpha = 0.85f
                        prefs.edit().putInt("bubble_x", params.x).putInt("bubble_y", params.y).apply()
                        if (isClick) {
                            val intent = Intent(this@QuickHubService, MainActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            }
                            startActivity(intent)
                        }
                        true
                    }
                    else -> false
                }
            }

            windowManager?.addView(floatingView, params)
            isFloatingViewShowing = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun hideFloatingBubble() {
        if (isFloatingViewShowing && floatingView != null) {
            try {
                windowManager?.removeView(floatingView)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            floatingView = null
            isFloatingViewShowing = false
        }
    }

    override fun onDestroy() {
        hideFloatingBubble()
        super.onDestroy()
    }
}
