package com.pappas.posmirror.ui.display

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.pappas.posmirror.R
import com.pappas.posmirror.data.SupabaseRepository
import com.pappas.posmirror.data.model.CustomerQueueEntry
import com.pappas.posmirror.data.model.MirrorOrderLine
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import com.pappas.posmirror.data.model.MirrorSettings
import com.pappas.posmirror.data.repository.SettingsRepository
import com.pappas.posmirror.databinding.ActivityDisplayBinding
import com.pappas.posmirror.ui.login.LoginActivity
import com.pappas.posmirror.ui.settings.SettingsActivity
import io.github.jan.supabase.realtime.RealtimeChannel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DisplayActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDisplayBinding
    private lateinit var settingsRepo: SettingsRepository
    private val supabaseRepo = SupabaseRepository()

    private var settings: MirrorSettings = MirrorSettings()
    private var currentSnapshot: MirrorOrderSnapshot = MirrorOrderSnapshot()
    private var currentQueueItems: List<CustomerQueueEntry> = emptyList()

    private var mirrorChannel: RealtimeChannel? = null
    private var orderSyncChannel: RealtimeChannel? = null
    private var queueCountJob: Job? = null
    private var clockBlinkJob: Job? = null

    private lateinit var orderLineAdapter: OrderLineAdapter
    private lateinit var preparingAdapter: QueueOrderAdapter
    private lateinit var readyAdapter: QueueOrderAdapter
    private lateinit var modalDetailAdapter: OrderDetailItemAdapter

    private val mainHandler = Handler(Looper.getMainLooper())
    private var tapCount = 0
    private var lastTapTime = 0L

    private val hideFabRunnable = Runnable {
        binding.fabSettings.visibility = View.GONE
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on for POS customer display
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding = ActivityDisplayBinding.inflate(layoutInflater)
        setContentView(binding.root)

        enableImmersiveMode()

        settingsRepo = SettingsRepository(this)
        if (settingsRepo.getUserId().isNullOrEmpty()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        settings = settingsRepo.getSettings()

        if (settings.registerId.isEmpty()) {
            startActivity(Intent(this, SettingsActivity::class.java))
            finish()
            return
        }

        setupRecyclerViews()
        setupInteractions()
        setupClockOverlay()
        renderIdleDisplay()
        loadInitialState()
        startRealtimeSubscriptions()
        startQueueCountPolling()

        // Auto-hide settings button after 30 seconds
        mainHandler.postDelayed(hideFabRunnable, 30000)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    private fun enableImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
    }

    private fun setupRecyclerViews() {
        orderLineAdapter = OrderLineAdapter { item ->
            showCustomizationsDialog(item)
        }
        binding.rvOrderLines.apply {
            layoutManager = LinearLayoutManager(this@DisplayActivity)
            adapter = orderLineAdapter
        }

        preparingAdapter = QueueOrderAdapter { order ->
            showOrderDetailsModal(order)
        }
        binding.rvPreparingQueue.apply {
            layoutManager = LinearLayoutManager(this@DisplayActivity)
            adapter = preparingAdapter
        }

        readyAdapter = QueueOrderAdapter { order ->
            showOrderDetailsModal(order)
        }
        binding.rvReadyQueue.apply {
            layoutManager = LinearLayoutManager(this@DisplayActivity)
            adapter = readyAdapter
        }

        modalDetailAdapter = OrderDetailItemAdapter()
        binding.rvModalOrderItems.apply {
            layoutManager = LinearLayoutManager(this@DisplayActivity)
            adapter = modalDetailAdapter
        }
    }

    private fun setupInteractions() {
        binding.fabSettings.setOnClickListener {
            openSettings()
        }

        binding.btnModalClose.setOnClickListener {
            hideOrderDetailsModal()
        }

        binding.btnModalCloseIcon.setOnClickListener {
            hideOrderDetailsModal()
        }

        binding.layoutOrderDetailsOverlay.setOnClickListener {
            hideOrderDetailsModal()
        }

        // Secret 5-tap on price reveals settings
        binding.layoutPriceSecretTap.setOnClickListener {
            val now = System.currentTimeMillis()
            if (now - lastTapTime > 1000) {
                tapCount = 1
            } else {
                tapCount++
                if (tapCount >= 5) {
                    binding.fabSettings.visibility = View.VISIBLE
                    mainHandler.removeCallbacks(hideFabRunnable)
                    mainHandler.postDelayed(hideFabRunnable, 30000)
                    tapCount = 0
                }
            }
            lastTapTime = now
        }

        // Long press on welcome image opens settings
        binding.layoutIdleImageView.setOnLongClickListener {
            openSettings()
            true
        }

        // Long press on queue view opens settings
        binding.layoutIdleQueueView.setOnLongClickListener {
            openSettings()
            true
        }

        // Long press on clock overlay opens settings
        binding.layoutClockOverlay.setOnLongClickListener {
            openSettings()
            true
        }
    }

    private fun setupClockOverlay() {
        if (settings.showClock) {
            binding.layoutClockOverlay.visibility = View.VISIBLE
            startClockTicker()
        } else {
            binding.layoutClockOverlay.visibility = View.GONE
            clockBlinkJob?.cancel()
        }
    }

    private fun startClockTicker() {
        clockBlinkJob?.cancel()
        clockBlinkJob = lifecycleScope.launch {
            val hourFormat = SimpleDateFormat("HH", Locale.getDefault())
            val minFormat = SimpleDateFormat("mm", Locale.getDefault())
            while (isActive) {
                val nowMs = System.currentTimeMillis()
                val now = Date(nowMs)
                binding.tvClockHours.text = hourFormat.format(now)
                binding.tvClockMinutes.text = minFormat.format(now)

                // 1Hz blink: 500ms visible, 500ms invisible
                val msIntoSecond = nowMs % 1000
                val colonVisible = msIntoSecond < 500
                binding.tvClockColon.visibility = if (colonVisible) View.VISIBLE else View.INVISIBLE

                val delayMs = if (colonVisible) {
                    500 - msIntoSecond
                } else {
                    1000 - msIntoSecond
                }
                delay(delayMs.coerceIn(50, 500))
            }
        }
    }

    private fun updateClockTheme(screenMode: String) {
        if (!settings.showClock) return
        if (binding.layoutOrderDetailsOverlay.visibility == View.VISIBLE) {
            binding.layoutClockOverlay.visibility = View.GONE
            return
        }
        binding.layoutClockOverlay.visibility = View.VISIBLE
    }

    private fun openSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
        finish()
    }

    private fun loadInitialState() {
        binding.tvWaitingMessage.text = "Waiting for register ${settings.registerId}..."
        binding.tvWaitingMessage.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val snapshot = supabaseRepo.fetchCurrentOrder(settings.registerId)
                binding.tvWaitingMessage.visibility = View.GONE
                updateSnapshot(snapshot)

                if (settings.idleMode == "queue") {
                    refreshCustomerQueue()
                }
            } catch (e: Exception) {
                binding.tvWaitingMessage.visibility = View.GONE
                showConnectionWarning("Could not fetch current order. Connecting live...")
            }
        }
    }

    private fun startRealtimeSubscriptions() {
        lifecycleScope.launch {
            try {
                mirrorChannel = supabaseRepo.subscribeMirrorState(lifecycleScope, settings.registerId) { snapshot ->
                    runOnUiThread {
                        hideConnectionWarning()
                        updateSnapshot(snapshot)
                    }
                }
                mirrorChannel?.subscribe()

                if (settings.idleMode == "queue") {
                    orderSyncChannel = supabaseRepo.subscribeOrderSync(lifecycleScope) {
                        runOnUiThread {
                            refreshCustomerQueue()
                        }
                    }
                    orderSyncChannel?.subscribe()
                }
            } catch (e: Exception) {
                showConnectionWarning("Realtime connection error: ${e.message}")
            }
        }
    }

    private fun startQueueCountPolling() {
        queueCountJob?.cancel()
        queueCountJob = lifecycleScope.launch {
            while (isActive) {
                try {
                    val count = supabaseRepo.fetchQueueCount()
                    binding.tvQueueCount.text = count.toString()

                    if (settings.idleMode == "queue") {
                        refreshCustomerQueue()
                    }
                } catch (e: Exception) {
                    // Ignore polling errors
                }
                delay(10000)
            }
        }
    }

    private fun refreshCustomerQueue() {
        lifecycleScope.launch {
            try {
                val queue = supabaseRepo.fetchCustomerQueue()
                currentQueueItems = queue
                val preparingList = queue.filter { it.status == "Preparing" || it.status == "Confirmed" || it.status == "Pending" }
                val readyList = queue.filter { it.status == "Ready" }

                binding.tvPreparingCount.text = preparingList.size.toString()
                binding.tvReadyCount.text = readyList.size.toString()

                preparingAdapter.submitList(preparingList)
                readyAdapter.submitList(readyList)

                // If currently idle (no active cart order), adapt presentation based on queue occupancy
                if (currentSnapshot.isEmpty) {
                    renderIdleDisplay()
                }
            } catch (e: Exception) {
                // Ignore queue refresh failure, keep old list
            }
        }
    }

    private fun renderIdleDisplay() {
        val hasQueueOrders = currentQueueItems.isNotEmpty()

        if (settings.idleMode == "queue" && hasQueueOrders) {
            // Queue mode with active orders: show customer queue board
            binding.layoutIdleImageView.visibility = View.GONE
            binding.layoutIdleQueueView.visibility = View.VISIBLE
            updateClockTheme("queue")
        } else {
            // Either idleMode == "image" OR queue has 0 orders:
            // Gracefully fallback to the beautiful welcome artwork!
            binding.layoutIdleQueueView.visibility = View.GONE
            binding.layoutIdleImageView.visibility = View.VISIBLE
            updateClockTheme("image")
            loadWelcomeArtwork()
        }
    }

    private fun updateSnapshot(snapshot: MirrorOrderSnapshot) {
        currentSnapshot = snapshot
        if (!snapshot.isEmpty) {
            // Cart view active
            binding.layoutCartView.visibility = View.VISIBLE
            binding.layoutIdleImageView.visibility = View.GONE
            binding.layoutIdleQueueView.visibility = View.GONE
            updateClockTheme("cart")

            val count = snapshot.itemCount
            binding.tvItemCount.text = "$count item${if (count == 1) "" else "s"}"
            orderLineAdapter.submitList(snapshot.items)

            binding.tvTotalToPay.text = String.format(Locale.US, "$%.2f", snapshot.total)

            if (snapshot.discount > 0.0) {
                binding.tvDiscountHint.text = String.format(Locale.US, "Includes $%.2f discount", snapshot.discount)
                binding.tvDiscountHint.visibility = View.VISIBLE
            } else {
                binding.tvDiscountHint.visibility = View.GONE
            }
        } else {
            // Idle Mode
            binding.layoutCartView.visibility = View.GONE
            renderIdleDisplay()

            if (settings.idleMode == "queue") {
                refreshCustomerQueue()
            }
        }
    }

    private fun loadWelcomeArtwork() {
        val uri = settings.idleImageUri
        if (!uri.isNullOrEmpty()) {
            val file = File(uri)
            if (file.exists()) {
                binding.ivIdleArtwork.load(file)
                return
            }
        }
        binding.ivIdleArtwork.load(R.drawable.idle_artwork)
    }

    private fun showCustomizationsDialog(item: MirrorOrderLine) {
        val customText = item.customizations?.joinToString("\n") { "• ${it.label}" } ?: "No options"
        AlertDialog.Builder(this)
            .setTitle("${item.name} Customizations")
            .setMessage(customText)
            .setPositiveButton("Close", null)
            .show()
    }

    private fun showOrderDetailsModal(order: CustomerQueueEntry) {
        val title = if (!order.customerName.isNullOrEmpty()) {
            "Order #${order.orderNumber} • ${order.customerName}"
        } else {
            "Order #${order.orderNumber}"
        }
        binding.tvModalOrderNumber.text = title

        val isReady = order.status == "Ready"
        if (isReady) {
            binding.tvModalStatusBadge.text = "READY FOR PICKUP"
            binding.tvModalStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.brand_ready))
            binding.tvModalStatusBadge.setBackgroundResource(R.drawable.bg_badge_ready)
        } else {
            binding.tvModalStatusBadge.text = "PREPARING"
            binding.tvModalStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.brand_preparing))
            binding.tvModalStatusBadge.setBackgroundResource(R.drawable.bg_badge_preparing)
        }

        modalDetailAdapter.submitList(order.items)
        binding.tvModalOrderTotal.text = String.format(Locale.US, "$%.2f", order.total)

        // Hide clock overlay while modal is visible so it never overlaps
        binding.layoutClockOverlay.visibility = View.GONE

        binding.layoutOrderDetailsOverlay.visibility = View.VISIBLE
    }

    private fun hideOrderDetailsModal() {
        binding.layoutOrderDetailsOverlay.visibility = View.GONE

        // Restore clock overlay if enabled in settings
        if (settings.showClock) {
            binding.layoutClockOverlay.visibility = View.VISIBLE
        }

        enableImmersiveMode()
    }

    override fun onBackPressed() {
        if (binding.layoutOrderDetailsOverlay.visibility == View.VISIBLE) {
            hideOrderDetailsModal()
        } else {
            super.onBackPressed()
        }
    }

    private fun showConnectionWarning(msg: String) {
        binding.tvConnectionBanner.text = msg
        binding.tvConnectionBanner.visibility = View.VISIBLE
    }

    private fun hideConnectionWarning() {
        binding.tvConnectionBanner.visibility = View.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        queueCountJob?.cancel()
        clockBlinkJob?.cancel()
        mainHandler.removeCallbacks(hideFabRunnable)
        lifecycleScope.launch {
            try {
                mirrorChannel?.let { com.pappas.posmirror.data.SupabaseClientProvider.realtime.removeChannel(it) }
                orderSyncChannel?.let { com.pappas.posmirror.data.SupabaseClientProvider.realtime.removeChannel(it) }
            } catch (e: Exception) {
                // Ignore cleanup error
            }
        }
    }
}
