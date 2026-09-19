package com.pappas.menudisplay

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.view.*
import android.widget.*
import org.json.JSONObject
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.pappas.menudisplay.effects.AnimationEngine
import com.pappas.menudisplay.effects.registerBasicTransitions
import com.pappas.menudisplay.effects.registerCinematicMotions
import com.pappas.menudisplay.effects.registerMaskTransitions
import com.pappas.menudisplay.effects.register3DTransitions
import com.pappas.menudisplay.effects.registerShaderTransitions
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.SecureRandom
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var store: ImageStore
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private val uploadWorker = Executors.newSingleThreadExecutor()
    private var server: LocalHttpServer? = null
    private var serverError: String? = null
    private var pairing = ""
    private var screen = "library"
    @Volatile private var generation = 0
    private var libraryPage = 0
    private var active = false
    private var playback = DisplayState(emptyList<PlaylistItem>())
    private var index = 0
    private var paused = false
    private var playbackView: ImageView? = null
    private var playbackBitmap: Bitmap? = null
    private val thumbnails = mutableListOf<Bitmap>()
    private var editorItems = mutableListOf<PlaylistItem>()
    private var uploadStatus: TextView? = null
    private var queueOverlayView: LinearLayout? = null
    private var queueData = JSONObject()
    private val tick = Runnable { step(1) }
    private val bg = Color.rgb(16, 26, 35)
    private val panel = Color.rgb(28, 43, 55)
    private val mint = Color.rgb(141, 223, 190)
    private val muted = Color.rgb(184, 197, 209)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { navigateBack() }
        }
        store = ImageStore(this)
        playback = store.state()
        if (playback.ids.isNotEmpty()) showPlayback(playback, persist = false) else library()
        store.recoveryMessage?.let { toast(it) }

        registerBasicTransitions()
        registerCinematicMotions()
        registerMaskTransitions()
        register3DTransitions()
        registerShaderTransitions()
    }
    override fun onStart() {
        super.onStart()
        active = true
        startServer()
        if (screen == "playback") { loadSlide() }
        else if (screen == "library") library()
    }
    override fun onStop() {
        active = false
        generation++
        main.removeCallbacks(tick)
        server?.close(); server = null
        super.onStop()
    }
    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        io.shutdownNow()
        uploadWorker.shutdownNow()
        super.onDestroy()
    }
    private fun startServer() {
        pairing = (100000 + SecureRandom().nextInt(900000)).toString()
        try {
            server = LocalHttpServer(pairing, assets.open("upload.html").use { it.readBytes() }, store::upload, {
                main.post {
                    if (active) {
                        if (screen == "library") library()
                        if (screen == "upload") uploadStatus?.text = "Upload received. Open the library to display your new menu."
                    }
                }
            }) { json ->
                main.post {
                    try {
                        queueData = JSONObject(json)
                        updateQueueUI()
                    } catch (e: Exception) {}
                }
            }.apply { start() }
            serverError = null
        } catch (_: Exception) { server?.close(); server = null; serverError = "Upload server could not start. Return to the app to retry." }
        if (screen == "upload") uploads()
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    @Suppress("DEPRECATION")
    private fun immersive() {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
    private fun shape(color: Int, border: Int = color) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(8).toFloat(); setStroke(dp(2), border)
    }
    private fun focusBackground() = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), shape(Color.rgb(42, 75, 71), mint))
        addState(intArrayOf(android.R.attr.state_pressed), shape(Color.rgb(42, 75, 71), mint))
        addState(intArrayOf(), shape(panel))
    }
    private fun text(value: String, size: Float = 18f, color: Int = Color.WHITE) = TextView(this).apply {
        this.text = value; textSize = size; setTextColor(color); setPadding(0, dp(4), 0, dp(8))
    }
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label; textSize = 16f; isAllCaps = false; setTextColor(Color.WHITE)
        background = focusBackground(); isFocusable = true; minHeight = dp(48)
        setPadding(dp(16), dp(8), dp(16), dp(8))
        layoutParams = LinearLayout.LayoutParams(-2, -2).apply { setMargins(0, dp(4), dp(12), dp(8)) }
        setOnClickListener { action() }
    }
    private fun page(title: String, subtitle: String, name: String): LinearLayout {
        generation++; screen = name; main.removeCallbacks(tick); immersive()
        playbackView = null; playbackBitmap = null; queueOverlayView = null
        thumbnails.clear() // ImageViews detach below; let Android safely release their bitmaps.
        val content = column().apply { setPadding(dp(40), dp(24), dp(40), dp(24)); setBackgroundColor(bg) }
        content.addView(text("PAPPAS OCEAN CATCH MENU", 13f, mint))
        content.addView(text(title, 30f).apply { typeface = Typeface.DEFAULT_BOLD })
        content.addView(text(subtitle, 16f, muted))
        val scroll = ScrollView(this).apply { isFillViewport = true; addView(content) }
        setContentView(scroll)
        return content
    }
    private fun library() {
        val items = store.list()
        val total = items.sumOf { it.bytes } / (1024.0 * 1024.0)
        val content = page("Your menu library", "${items.size} images · ${"%.1f".format(total)} / 500 MiB · Saved on this TV", "library")
        val actions = row()
        actions.addView(button("Upload images") { uploads() })
        actions.addView(button("Sync from Cloud") { syncCloud() })
        actions.addView(button("Display settings") { displaySettings() })
        actions.addView(button("Create slideshow") {
            val saved = store.state()
            editorItems = saved.items.toMutableList(); editor()
        })
        val saved = store.state()
        if (saved.ids.isNotEmpty()) actions.addView(button("Resume display") { showPlayback(saved) })
        content.addView(actions)
        if (items.isEmpty()) {
            content.addView(text("Give your menu the whole screen.", 25f))
            content.addView(text("Choose Upload images, then scan the QR code with your phone.\nYour menu images will appear here, ready to display.", 18f, muted))
        }
        val lastPage = ((items.size - 1) / 12).coerceAtLeast(0)
        libraryPage = libraryPage.coerceIn(0, lastPage)
        if (lastPage > 0) {
            val pagination = row()
            pagination.addView(button("Previous page") { libraryPage--; library() }.apply { isEnabled = libraryPage > 0 })
            pagination.addView(text("${libraryPage + 1} / ${lastPage + 1}", 16f, muted))
            pagination.addView(button("Next page") { libraryPage++; library() }.apply { isEnabled = libraryPage < lastPage })
            content.addView(pagination)
        }
        items.drop(libraryPage * 12).take(12).chunked(3).forEach { group ->
            val cards = row().apply { gravity = Gravity.TOP }
            group.forEach { item ->
                val card = column().apply {
                    background = focusBackground(); isFocusable = true; isClickable = true
                    contentDescription = "${item.name}. Open image actions"
                    setPadding(dp(10), dp(10), dp(10), dp(6))
                    layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(0, dp(6), dp(12), dp(6)) }
                    setOnClickListener { imageActions(item) }
                }
                val image = ImageView(this).apply { scaleType = ImageView.ScaleType.FIT_CENTER; setBackgroundColor(Color.BLACK) }
                card.addView(image, LinearLayout.LayoutParams(-1, dp(125)))
                card.addView(text(item.name, 16f).apply { maxLines = 2; ellipsize = android.text.TextUtils.TruncateAt.END })
                cards.addView(card)
                loadThumbnail(item.id, image)
            }
            repeat(3 - group.size) { cards.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f)) }
            content.addView(cards)
        }
        actions.getChildAt(0).requestFocus()
    }
    private fun syncCloud() {
        toast("Syncing cloud menu...")
        val apiUrl = BuildConfig.MENU_DISCOVERY_API_URL
        if (apiUrl.isBlank()) {
            toast("Cloud menu API not configured")
            return
        }
        io.execute {
            try {
                val url = java.net.URL(apiUrl)
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                if (conn.responseCode != 200) throw Exception("Server returned ${conn.responseCode}")
                val jsonText = conn.inputStream.bufferedReader().use { it.readText() }
                val json = org.json.JSONObject(jsonText)
                if (!json.optBoolean("success", false)) throw Exception("API error")
                val menus = json.getJSONArray("menus")
                val cloudIds = mutableListOf<String>()
                
                for (i in 0 until menus.length()) {
                    val m = menus.getJSONObject(i)
                    val id = m.getString("id")
                    val name = m.getString("name")
                    val imageUrl = m.getString("url")
                    cloudIds.add(id)
                    
                    val existing = store.list().find { it.id == id }
                    if (existing == null) {
                        main.post { toast("Downloading: $name") }
                        val imgUrl = java.net.URL(imageUrl)
                        val imgConn = imgUrl.openConnection() as java.net.HttpURLConnection
                        imgConn.requestMethod = "GET"
                        val length = imgConn.contentLengthLong
                        store.upload(imgConn.inputStream, length, name, id)
                    } else if (existing.name != name) {
                        store.rename(id, name)
                    }
                }
                
                val currentIds = store.list().map { it.id }.toSet()
                for (id in currentIds) {
                    if (!cloudIds.contains(id)) {
                        store.delete(id)
                    }
                }
                
                store.saveState(DisplayState(cloudIds, 10, true))
                
                main.post {
                    toast("Cloud sync complete")
                    library()
                }
            } catch (e: Exception) {
                main.post { toast("Cloud sync failed: ${e.message}") }
            }
        }
    }

    private fun loadThumbnail(id: String, view: ImageView) {
        val token = generation
        io.execute {
            if (token != generation) return@execute
            val bitmap = store.decode(id, 480, 270)
            main.post { if (token == generation && !isDestroyed) { view.setImageBitmap(bitmap); bitmap?.let { thumbnails.add(it) } } else bitmap?.recycle() }
        }
    }
    private fun imageActions(item: MenuImage) {
        AlertDialog.Builder(this).setTitle(item.name).setItems(arrayOf("Display fullscreen", "Set as wallpaper", "Rename", "Delete")) { _, choice ->
            when (choice) {
                0 -> showPlayback(DisplayState(listOf(item.id)))
                1 -> setAsWallpaper(item)
                2 -> {
                    val input = EditText(this).apply { setText(item.name); setSingleLine(); filters = arrayOf(android.text.InputFilter.LengthFilter(100)) }
                    val dialog = AlertDialog.Builder(this).setTitle("Rename image").setView(input).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create()
                    dialog.setOnShowListener {
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                            if (input.text.toString().isBlank()) input.error = "Enter a name"
                            else mutate({ store.rename(item.id, input.text.toString()) }) { dialog.dismiss(); library() }
                        }
                    }
                    dialog.show()
                }
                3 -> AlertDialog.Builder(this).setTitle("Delete ${item.name}?").setMessage("This removes the image from this TV and any saved slideshow.")
                    .setNegativeButton("Cancel", null).setPositiveButton("Delete") { _, _ -> mutate({ store.delete(item.id) }) { library() } }.show()
            }
        }.show()
    }
    
    private fun setAsWallpaper(item: MenuImage) {
        toast("Setting wallpaper...")
        io.execute {
            try {
                val metrics = resources.displayMetrics
                val bitmap = store.decode(item.id, metrics.widthPixels, metrics.heightPixels)
                if (bitmap != null) {
                    android.app.WallpaperManager.getInstance(this@MainActivity).setBitmap(bitmap)
                    main.post { toast("Wallpaper set successfully") }
                } else {
                    main.post { toast("Could not decode image for wallpaper") }
                }
            } catch (e: Exception) {
                main.post { toast("Failed to set wallpaper: ${e.message}") }
            }
        }
    }
    private fun mutate(work: () -> Unit, done: () -> Unit) {
        io.execute {
            try { work(); main.post { if (!isDestroyed) done() } }
            catch (e: Exception) { main.post { toast(e.message ?: "Could not save changes") } }
        }
    }
    private fun addresses(): List<String> = try {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }
            .flatMap { it.inetAddresses.toList() }.filterIsInstance<Inet4Address>()
            .filter { it.isSiteLocalAddress }.mapNotNull { it.hostAddress }.distinct()
    } catch (_: Exception) { emptyList() }
    private fun uploads() {
        val content = page("Upload from your phone or computer", "Connect both devices to the same Wi-Fi or wired local network.", "upload")
        val actions = row()
        actions.addView(button("Back to library") { library() })
        actions.addView(button("Refresh address") { uploads() })
        content.addView(actions)
        val details = column()
        details.addView(text("Preparing upload connection…", 20f, muted))
        content.addView(details)
        uploadStatus = text("JPG / PNG / WebP · 20 MiB per image · No internet required", 16f, muted)
        content.addView(uploadStatus)
        actions.getChildAt(0).requestFocus()

        val token = generation
        val listener = server
        val code = pairing
        val error = serverError
        uploadWorker.execute {
            if (token != generation) return@execute
            val addresses = if (listener != null) addresses() else emptyList()
            val port = listener?.port ?: 0
            val bitmap = if (addresses.isNotEmpty()) runCatching {
                val matrix = MultiFormatWriter().encode("http://${addresses.first()}:$port/", BarcodeFormat.QR_CODE, 384, 384)
                Bitmap.createBitmap(384, 384, Bitmap.Config.RGB_565).apply {
                    val pixels = IntArray(384 * 384) { n -> if (matrix[n % 384, n / 384]) Color.BLACK else Color.WHITE }
                    setPixels(pixels, 0, 384, 0, 0, 384, 384)
                }
            }.getOrNull() else null
            main.post {
                if (token != generation || screen != "upload" || isDestroyed) {
                    bitmap?.recycle()
                    return@post
                }
                details.removeAllViews()
                if (listener == null || addresses.isEmpty()) {
                    details.addView(text(error ?: "No local network found. Connect this TV to your network, then refresh.", 20f))
                } else {
                    renderUploadDetails(details, addresses, port, code, bitmap)
                }
            }
        }
    }
    private fun renderUploadDetails(content: LinearLayout, addresses: List<String>, port: Int, code: String, bitmap: Bitmap?) {
        val body = row().apply { gravity = Gravity.TOP }
        if (bitmap != null) {
            val qr = ImageView(this).apply {
                contentDescription = "QR code to open http://${addresses.first()}:$port/"
                setPadding(dp(8), dp(8), dp(8), dp(8)); setBackgroundColor(Color.WHITE)
                setImageBitmap(bitmap)
            }
            body.addView(qr, LinearLayout.LayoutParams(dp(200), dp(200)).apply { rightMargin = dp(28) })
        }
        val steps = column()
        steps.addView(text(if (bitmap != null) "1. Scan the QR code or open" else "1. Open this address in your browser", 18f, muted))
        addresses.forEach { steps.addView(text("http://$it:$port/", 22f)) }
        steps.addView(text("2. Enter this code and choose Pair with TV", 18f, muted))
        steps.addView(text(code, 36f, mint).apply { letterSpacing = .2f })
        steps.addView(text("3. After pairing succeeds, upload your images", 18f, muted))
        body.addView(steps, LinearLayout.LayoutParams(0, -2, 1f))
        content.addView(body)
    }

    private fun previewSlide(position: Int) {
        val item = editorItems[position]
        val prevItem = if (position > 0) editorItems[position - 1] else (if (editorItems.size > 1) editorItems.last() else item)
        
        val metrics = resources.displayMetrics
        io.execute {
            val bmpNew = store.decode(item.id, metrics.widthPixels, metrics.heightPixels)
            val bmpOld = if (prevItem.id != item.id) store.decode(prevItem.id, metrics.widthPixels, metrics.heightPixels) else null
            
            main.post {
                if (isDestroyed) { bmpNew?.recycle(); bmpOld?.recycle(); return@post }
                
                val overlay = FrameLayout(this@MainActivity).apply { setBackgroundColor(Color.BLACK) }
                val oldView = ImageView(this@MainActivity).apply { 
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    if (bmpOld != null) setImageBitmap(bmpOld) else setBackgroundColor(Color.DKGRAY)
                }
                val newView = ImageView(this@MainActivity).apply { 
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    if (bmpNew != null) setImageBitmap(bmpNew) else setBackgroundColor(Color.GRAY)
                }
                
                overlay.addView(oldView, FrameLayout.LayoutParams(-1, -1))
                addContentView(overlay, ViewGroup.LayoutParams(-1, -1))
                
                val duration = 1000L
                AnimationEngine.playTransition(item.animation, overlay, oldView, newView, duration) {
                    if (item.cinematic != "None") {
                        AnimationEngine.playCinematic(item.cinematic, newView, 3000L)
                    }
                    main.postDelayed({
                        (overlay.parent as? ViewGroup)?.removeView(overlay)
                        bmpNew?.recycle()
                        bmpOld?.recycle()
                    }, 3000L)
                }
            }
        }
    }

    private fun editor(focusId: String? = null) {
        val items = store.list()
        val validIds = Playlist.reconcile(editorItems.map { it.id }, items.map { it.id }.toSet())
        editorItems = editorItems.filter { it.id in validIds }.toMutableList()
        val content = page("Build your slideshow", "Add images below. Set time and animation for each.", "editor")
        val actions = row()
        actions.addView(button("Play slideshow (${editorItems.size})") {
            if (editorItems.isEmpty()) toast("Add at least one image")
            else showPlayback(DisplayState(editorItems.toList(), true))
        })
        actions.addView(button("Back to library") { library() })
        content.addView(actions)
        var focus: View? = null
        editorItems.toList().forEachIndexed { position, item ->
            val line = row()
            line.addView(text("${position + 1}. ${items.first { it.id == item.id }.name}", 17f).apply { maxLines = 1 }, LinearLayout.LayoutParams(0, -2, 1f))
            line.addView(button("${item.seconds}s") {
                val values = listOf(5, 10, 15, 30, 60)
                AlertDialog.Builder(this).setTitle("Time for this image").setSingleChoiceItems(values.map { "$it seconds" }.toTypedArray(), values.indexOf(item.seconds).coerceAtLeast(0)) { dialog, pos ->
                    editorItems[position] = item.copy(seconds = values[pos])
                    dialog.dismiss(); editor(item.id)
                }.show()
            })
            line.addView(button(item.animation) {
                val anims = AnimationEngine.getTransitions().toTypedArray()
                AlertDialog.Builder(this).setTitle("Transition").setSingleChoiceItems(anims, anims.indexOf(item.animation).coerceAtLeast(0)) { dialog, pos ->
                    editorItems[position] = item.copy(animation = anims[pos])
                    dialog.dismiss(); editor(item.id)
                }.show()
            })
            line.addView(button(if (item.cinematic == "None") "Motion: None" else item.cinematic) {
                val cin = (listOf("None") + AnimationEngine.getCinematics()).toTypedArray()
                AlertDialog.Builder(this).setTitle("Cinematic Motion").setSingleChoiceItems(cin, cin.indexOf(item.cinematic).coerceAtLeast(0)) { dialog, pos ->
                    editorItems[position] = item.copy(cinematic = cin[pos])
                    dialog.dismiss(); editor(item.id)
                }.show()
            })
            line.addView(button("Preview") { previewSlide(position) })
            val up = button("Up") { if (position > 0) { java.util.Collections.swap(editorItems, position, position - 1); editor(item.id) } }
            up.isEnabled = position > 0; line.addView(up)
            val down = button("Down") { if (position < editorItems.lastIndex) { java.util.Collections.swap(editorItems, position, position + 1); editor(item.id) } }
            down.isEnabled = position < editorItems.lastIndex; line.addView(down)
            val remove = button("X") { editorItems.removeAt(position); editor() }; line.addView(remove)
            if (item.id == focusId) focus = if (up.isEnabled) up else remove
            content.addView(line)
        }
        content.addView(text("Available images", 22f))
        items.filter { it.id !in editorItems.map { i -> i.id } }.forEach { item -> content.addView(button("+  ${item.name}") { editorItems.add(PlaylistItem(item.id)); editor(item.id) }) }
        if (items.isEmpty()) content.addView(text("Upload images from the library first.", 18f, muted))
        (focus ?: actions.getChildAt(0)).requestFocus()
    }

    private var imageContainer: FrameLayout? = null

    private fun showPlayback(state: DisplayState, persist: Boolean = true) {
        val validIds = Playlist.reconcile(state.ids, store.list().map { it.id }.toSet())
        val validItems = state.items.filter { it.id in validIds }
        if (validItems.isEmpty()) { library(); return }
        if (persist) {
            val updatedState = state.copy(items = validItems)
            mutate({ store.saveState(updatedState) }) { showPlayback(updatedState, false) }
            return
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        generation++; screen = "playback"; playback = state.copy(items = validItems); index = 0; paused = false
        main.removeCallbacks(tick); thumbnails.clear(); immersive()
        
        val frame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        imageContainer = FrameLayout(this)
        frame.addView(imageContainer, FrameLayout.LayoutParams(-1, -1))
        
        val prefs = getSharedPreferences("prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("clock", false)) {
            val clock = TextClock(this).apply {
                format12Hour = "h:mm a"
                format24Hour = "HH:mm"
                textSize = 48f
                setTextColor(Color.WHITE)
                setShadowLayer(8f, 0f, 4f, Color.BLACK)
                alpha = prefs.getInt("clock_opacity", 100) / 100f
            }
            val lp = FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.END).apply {
                setMargins(dp(32), dp(32), dp(32), dp(32))
            }
            frame.addView(clock, lp)
        }
        
        if (prefs.getBoolean("queue", false)) {
            queueOverlayView = column().apply {
                setBackgroundColor(Color.argb(220, 0, 0, 0))
                alpha = prefs.getInt("queue_opacity", 100) / 100f
                setPadding(dp(24), dp(24), dp(24), dp(24))
            }
            frame.addView(queueOverlayView, FrameLayout.LayoutParams(dp(320), -1, Gravity.START))
            updateQueueUI()
        }
        
        setContentView(frame)
        loadSlide()
        toast(if (state.slideshow) "OK: pause / resume · Left / right: change image · Back: library" else "Back: library")
    }

    private fun updateQueueUI() {
        val qv = queueOverlayView ?: return
        qv.removeAllViews()
        qv.addView(text("ORDER QUEUE", 24f, mint).apply { 
            setTypeface(null, Typeface.BOLD)
            setPadding(0, 0, 0, dp(24))
        })
        
        val ready = queueData.optJSONArray("ready")
        if (ready != null && ready.length() > 0) {
            qv.addView(text("Ready to pick up", 20f, Color.WHITE).apply { setPadding(0, 0, 0, dp(4)) })
            val readyText = (0 until ready.length()).map { ready.getString(it) }.joinToString(", ")
            qv.addView(text(readyText, 48f, Color.GREEN).apply { 
                setTypeface(null, Typeface.BOLD)
                setPadding(0, 0, 0, dp(24))
            })
        }
        
        val prep = queueData.optJSONArray("preparing")
        if (prep != null && prep.length() > 0) {
            qv.addView(text("Preparing", 20f, Color.WHITE).apply { setPadding(0, 0, 0, dp(4)) })
            val prepText = (0 until prep.length()).map { prep.getString(it) }.joinToString(", ")
            qv.addView(text(prepText, 32f, Color.LTGRAY).apply { 
                setTypeface(null, Typeface.BOLD)
            })
        }
    }

    private fun displaySettings() {
        val prefs = getSharedPreferences("prefs", Context.MODE_PRIVATE)
        val content = page("Display Settings", "Configure overlays shown over the menu.", "settings")
        val actions = row()
        actions.addView(button("Back to library") { library() })
        content.addView(actions)
        
        content.addView(text("Clock Overlay", 22f).apply { setPadding(0, dp(24), 0, dp(8)) })
        val clockRow = row()
        val cEnabled = prefs.getBoolean("clock", false)
        clockRow.addView(button(if (cEnabled) "Clock: ON" else "Clock: OFF") {
            prefs.edit().putBoolean("clock", !cEnabled).apply()
            displaySettings()
        })
        val cOpacity = prefs.getInt("clock_opacity", 100)
        clockRow.addView(button("Opacity: $cOpacity%") {
            val next = if (cOpacity <= 25) 100 else cOpacity - 25
            prefs.edit().putInt("clock_opacity", next).apply()
            displaySettings()
        }.apply { isEnabled = cEnabled })
        content.addView(clockRow)
        
        content.addView(text("Queue Overlay", 22f).apply { setPadding(0, dp(24), 0, dp(8)) })
        val queueRow = row()
        val qEnabled = prefs.getBoolean("queue", false)
        queueRow.addView(button(if (qEnabled) "Queue: ON" else "Queue: OFF") {
            prefs.edit().putBoolean("queue", !qEnabled).apply()
            displaySettings()
        })
        val qOpacity = prefs.getInt("queue_opacity", 100)
        queueRow.addView(button("Opacity: $qOpacity%") {
            val next = if (qOpacity <= 25) 100 else qOpacity - 25
            prefs.edit().putInt("queue_opacity", next).apply()
            displaySettings()
        }.apply { isEnabled = qEnabled })
        content.addView(queueRow)
        
        content.addView(text("To update the queue, send a POST request to http://TV_IP:${server?.port ?: 8787}/api/queue", 18f, mint).apply { setPadding(0, dp(32), 0, dp(4)) })
        content.addView(text("Example payload:\n{\"preparing\": [\"20\", \"21\"], \"ready\": [\"22\"]}", 16f, muted))
        
        actions.getChildAt(0).requestFocus()
    }

    private fun loadSlide() {
        if (screen != "playback" || playback.items.isEmpty()) return
        main.removeCallbacks(tick)
        val token = ++generation
        val item = playback.items[index]
        val metrics = resources.displayMetrics
        io.execute {
            val bitmap = store.decode(item.id, metrics.widthPixels, metrics.heightPixels)
            main.post {
                if (token != generation || screen != "playback" || isDestroyed) { bitmap?.recycle(); return@post }
                if (bitmap != null) {
                    val container = imageContainer
                    if (container != null) {
                        val childrenToAnimate = mutableListOf<View>()
                        for (i in 0 until container.childCount) {
                            childrenToAnimate.add(container.getChildAt(i))
                        }
                        
                        val newView = ImageView(this@MainActivity).apply {
                            scaleType = ImageView.ScaleType.FIT_CENTER
                            setImageBitmap(bitmap)
                        }
                        
                        val duration = 750L
                        if (childrenToAnimate.isNotEmpty()) {
                            val oldView = childrenToAnimate.first()
                            for (v in childrenToAnimate) { if (v != oldView) container.removeView(v) }
                            oldView.animate().cancel()
                            
                            AnimationEngine.playTransition(item.animation, container, oldView, newView, duration) {
                                // Transition complete
                            }
                        } else {
                            container.addView(newView, FrameLayout.LayoutParams(-1, -1))
                        }
                        
                        // Start cinematic motion if requested
                        if (item.cinematic != "None") {
                            AnimationEngine.playCinematic(item.cinematic, newView, item.seconds * 1000L)
                        }
                    }
                    playbackBitmap = bitmap
                } else {
                    toast("Cannot display this image. Remove it from the library and upload it again.")
                    if (playbackBitmap == null) { library(); return@post }
                }
                schedule()
            }
        }
    }
    private fun schedule() {
        main.removeCallbacks(tick)
        if (active && screen == "playback" && playback.slideshow && playback.items.size > 1 && !paused) {
            val item = playback.items[index]
            main.postDelayed(tick, item.seconds * 1000L)
        }
    }
    private fun step(direction: Int) {
        if (screen != "playback") return
        index = Playlist.next(index, direction, playback.items.size); loadSlide()
    }
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (screen == "playback") {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                    if (event.repeatCount == 0 && playback.slideshow) { paused = !paused; schedule(); toast(if (paused) "Slideshow paused" else "Slideshow playing") }
                    return true
                }
                KeyEvent.KEYCODE_DPAD_RIGHT -> { if (event.repeatCount == 0) step(1); return true }
                KeyEvent.KEYCODE_DPAD_LEFT -> { if (event.repeatCount == 0) step(-1); return true }
            }
        }
        return super.onKeyDown(keyCode, event)
    }
    @Deprecated("TV remote Back navigation")
    override fun onBackPressed() { navigateBack() }
    private fun navigateBack() { if (screen != "library") { window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); library() } else finish() }
    private fun toast(message: String) { if (!isDestroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
}
