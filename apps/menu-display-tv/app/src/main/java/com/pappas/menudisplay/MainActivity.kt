package com.pappas.menudisplay

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.view.*
import android.widget.*
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
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
    private var playback = DisplayState(emptyList())
    private var index = 0
    private var paused = false
    private var playbackView: ImageView? = null
    private var playbackBitmap: Bitmap? = null
    private val thumbnails = mutableListOf<Bitmap>()
    private var editorIds = mutableListOf<String>()
    private var editorSeconds = 10
    private var uploadStatus: TextView? = null
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
            server = LocalHttpServer(pairing, assets.open("upload.html").use { it.readBytes() }, store::upload) {
                main.post {
                    if (active) {
                        if (screen == "library") library()
                        if (screen == "upload") uploadStatus?.text = "Upload received. Open the library to display your new menu."
                    }
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
        playbackView = null; playbackBitmap = null
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
        actions.addView(button("Create slideshow") {
            val saved = store.state()
            editorIds = saved.ids.toMutableList(); editorSeconds = saved.seconds; editor()
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
        // Network enumeration and QR encoding must not delay the first screen frame.
        // Separate from image I/O so queued thumbnails cannot delay this screen either.
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
    private fun editor(focusId: String? = null) {
        val items = store.list()
        editorIds = Playlist.reconcile(editorIds, items.map { it.id }.toSet()).toMutableList()
        val content = page("Build your slideshow", "Add images below. Use Move up / down to set the display order.", "editor")
        val actions = row()
        actions.addView(button("Play slideshow (${editorIds.size})") {
            if (editorIds.isEmpty()) toast("Add at least one image")
            else showPlayback(DisplayState(editorIds.toList(), editorSeconds, true))
        })
        actions.addView(button("Interval: ${editorSeconds}s") {
            val values = listOf(5, 10, 15, 30, 60)
            AlertDialog.Builder(this).setTitle("Time per image").setSingleChoiceItems(values.map { "$it seconds" }.toTypedArray(), values.indexOf(editorSeconds)) { dialog, position ->
                editorSeconds = values[position]; dialog.dismiss(); editor()
            }.show()
        })
        actions.addView(button("Back to library") { library() })
        content.addView(actions)
        var focus: View? = null
        editorIds.toList().forEachIndexed { position, id ->
            val line = row()
            line.addView(text("${position + 1}. ${items.first { it.id == id }.name}", 17f).apply { maxLines = 2 }, LinearLayout.LayoutParams(0, -2, 1f))
            val up = button("Move up") { if (position > 0) { java.util.Collections.swap(editorIds, position, position - 1); editor(id) } }
            up.isEnabled = position > 0; line.addView(up)
            line.addView(button("Move down") { if (position < editorIds.lastIndex) { java.util.Collections.swap(editorIds, position, position + 1); editor(id) } }.apply { isEnabled = position < editorIds.lastIndex })
            val remove = button("Remove") { editorIds.remove(id); editor() }; line.addView(remove)
            if (id == focusId) focus = if (up.isEnabled) up else remove
            content.addView(line)
        }
        content.addView(text("Available images", 22f))
        items.filter { it.id !in editorIds }.forEach { item -> content.addView(button("+  ${item.name}") { editorIds.add(item.id); editor(item.id) }) }
        if (items.isEmpty()) content.addView(text("Upload images from the library first.", 18f, muted))
        (focus ?: actions.getChildAt(0)).requestFocus()
    }
    private fun showPlayback(state: DisplayState, persist: Boolean = true) {
        val ids = Playlist.reconcile(state.ids, store.list().map { it.id }.toSet())
        if (ids.isEmpty()) { library(); return }
        if (persist) {
            mutate({ store.saveState(state.copy(ids = ids)) }) { showPlayback(state.copy(ids = ids), false) }
            return
        }
        generation++; screen = "playback"; playback = state.copy(ids = ids); index = 0; paused = false
        main.removeCallbacks(tick); thumbnails.clear(); immersive()
        playbackView = ImageView(this).apply { scaleType = ImageView.ScaleType.FIT_CENTER; setBackgroundColor(Color.BLACK) }
        setContentView(playbackView)
        loadSlide()
        toast(if (state.slideshow) "OK: pause / resume · Left / right: change image · Back: library" else "Back: library")
    }
    private fun loadSlide() {
        if (screen != "playback" || playback.ids.isEmpty()) return
        main.removeCallbacks(tick)
        val token = ++generation
        val id = playback.ids[index]
        val metrics = resources.displayMetrics
        io.execute {
            val bitmap = store.decode(id, metrics.widthPixels, metrics.heightPixels)
            main.post {
                if (token != generation || screen != "playback" || isDestroyed) { bitmap?.recycle(); return@post }
                if (bitmap != null) {
                    playbackView?.setImageBitmap(bitmap)
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
        if (active && screen == "playback" && playback.slideshow && playback.ids.size > 1 && !paused)
            main.postDelayed(tick, playback.seconds * 1000L)
    }
    private fun step(direction: Int) {
        if (screen != "playback") return
        index = Playlist.next(index, direction, playback.ids.size); loadSlide()
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
    private fun navigateBack() { if (screen != "library") library() else finish() }
    private fun toast(message: String) { if (!isDestroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
}
