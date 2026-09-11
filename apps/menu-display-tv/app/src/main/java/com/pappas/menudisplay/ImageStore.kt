package com.pappas.menudisplay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.*
import java.util.UUID

data class MenuImage(val id: String, val name: String, val bytes: Long)
data class DisplayState(val ids: List<String>, val seconds: Int = 10, val slideshow: Boolean = false)

class ImageStore(context: Context) {
    private val dir = File(context.filesDir, "menus").apply { mkdirs() }
    private val catalog = AtomicFile(File(dir, "catalog.json"))
    private var images = mutableListOf<MenuImage>()
    private var display = DisplayState(emptyList())
    var recoveryMessage: String? = null
        private set

    init {
        if (catalog.baseFile.exists() || File(dir, "catalog.json.bak").exists()) {
            try {
                val json = JSONObject(catalog.openRead().bufferedReader().use { it.readText() })
                val items = json.getJSONArray("images")
                for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i)
                    val id = item.getString("id")
                    if (validId(id) && file(id).exists()) images.add(MenuImage(id, item.getString("name"), file(id).length()))
                }
                val state = json.optJSONObject("display")
                val ids = state?.optJSONArray("ids") ?: JSONArray()
                display = DisplayState(Playlist.reconcile((0 until ids.length()).map { ids.getString(it) }, images.map { it.id }.toSet()),
                    (state?.optInt("seconds", 10) ?: 10).coerceIn(5, 60), state?.optBoolean("slideshow") ?: false)
            } catch (_: Exception) {
                // Recover files without overwriting or discarding the user's images.
                images = dir.listFiles().orEmpty().filter { validId(it.name) }.map { MenuImage(it.name, "Recovered menu", it.length()) }.toMutableList()
                recoveryMessage = "Library metadata was recovered. Please review image names and slideshow."
            }
        }
        dir.listFiles()?.filter { it.name.endsWith(".upload") }?.forEach { it.delete() }
    }
    private fun validId(id: String) = runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false)
    fun file(id: String): File { require(validId(id)); return File(dir, id) }
    @Synchronized fun list(): List<MenuImage> = images.toList()
    @Synchronized fun state(): DisplayState = display.copy(ids = display.ids.toList())
    @Synchronized fun saveState(state: DisplayState) {
        val next = state.copy(ids = Playlist.reconcile(state.ids, images.map { it.id }.toSet()), seconds = state.seconds.coerceIn(5, 60))
        persist(images, next)
        display = next
    }
    @Synchronized fun rename(id: String, name: String) {
        val clean = name.trim().take(100)
        require(clean.isNotBlank()) { "Enter an image name" }
        val next = images.map { if (it.id == id) it.copy(name = clean) else it }
        persist(next, display)
        images = next.toMutableList()
    }
    @Synchronized fun delete(id: String) {
        val next = images.filter { it.id != id }
        val state = display.copy(ids = display.ids.filter { it != id })
        persist(next, state)
        images = next.toMutableList()
        display = state
        file(id).delete()
    }
    private val uploadLock = Any()
    fun upload(input: InputStream, length: Long, name: String, cloudId: String? = null): String = synchronized(uploadLock) {
        val snapshot = list()
        require(length <= LocalHttpServer.MAX_UPLOAD) { "Image must be at most 20 MiB" }
        val estimatedLength = if (length > 0) length else 5L * 1024 * 1024 // Assume 5MB if unknown
        require(snapshot.size < 200) { "Library is full (200 images). Delete an image first." }
        require(snapshot.sumOf { it.bytes } + estimatedLength <= 500L * 1024 * 1024 && dir.usableSpace > estimatedLength + 10L * 1024 * 1024) { "Not enough storage. Delete images and retry." }
        val id = cloudId ?: UUID.randomUUID().toString()
        val temp = File(dir, "$id.upload")
        var actualLength = 0L
        try {
            temp.outputStream().use { out ->
                val buffer = ByteArray(64 * 1024)
                var totalRead = 0L
                while (true) {
                    val toRead = if (length > 0) minOf(buffer.size.toLong(), length - totalRead).toInt() else buffer.size
                    if (toRead <= 0) break
                    val count = input.read(buffer, 0, toRead)
                    if (count < 0) break
                    out.write(buffer, 0, count)
                    totalRead += count
                }
                if (length > 0) require(totalRead == length) { "Upload was interrupted" }
                out.fd.sync()
                actualLength = totalRead
            }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(temp.path, bounds)
            require(bounds.outMimeType in setOf("image/jpeg", "image/png", "image/webp") && bounds.outWidth > 0 && bounds.outHeight > 0) { "Choose a valid JPG, PNG or WebP image" }
            require(bounds.outWidth.toLong() * bounds.outHeight <= 50_000_000L) { "Image exceeds 50 megapixels" }
            val verified = decodeFile(temp, 512, 512)
            require(verified != null) { "Image could not be decoded" }
            verified.recycle()
            check(temp.renameTo(file(id))) { "Could not save image" }
            val clean = name.substringAfterLast('/').substringAfterLast('\\').filter { !it.isISOControl() }.trim().take(100).ifBlank { "Menu image" }
            synchronized(this) {
                val next = images.filter { it.id != id } + MenuImage(id, clean, actualLength)
                try { persist(next, display) } catch (e: Exception) { file(id).delete(); throw e }
                images = next.toMutableList()
            }
            return "Uploaded $clean. Select it in the TV library."
        } finally { temp.delete() }
    }
    fun decode(id: String, width: Int, height: Int): Bitmap? = runCatching { decodeFile(file(id), width, height) }.getOrNull()
    private fun decodeFile(file: File, width: Int, height: Int): Bitmap? {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, options)
        if (options.outWidth <= 0 || options.outHeight <= 0) return null
        var sample = 1
        while (options.outWidth / sample > width.coerceAtLeast(1) * 2 || options.outHeight / sample > height.coerceAtLeast(1) * 2 ||
            (options.outWidth.toLong() / sample) * (options.outHeight / sample) > 8_300_000) sample *= 2
        options.inJustDecodeBounds = false
        options.inSampleSize = sample
        return try {
            val decoded = BitmapFactory.decodeFile(file.path, options) ?: return null
            val orientation = runCatching { ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
                ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
                ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.setRotate(270f); matrix.postScale(-1f, 1f) }
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(270f)
                else -> return decoded
            }
            val oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
            if (oriented !== decoded) decoded.recycle()
            oriented
        } catch (_: OutOfMemoryError) { null }
    }
    private fun persist(items: List<MenuImage>, state: DisplayState) {
        val json = JSONObject().put("images", JSONArray().apply { items.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("bytes", it.bytes)) } })
            .put("display", JSONObject().put("ids", JSONArray(state.ids)).put("seconds", state.seconds).put("slideshow", state.slideshow))
        val stream = catalog.startWrite()
        try { stream.write(json.toString().toByteArray()); catalog.finishWrite(stream) }
        catch (e: Exception) { catalog.failWrite(stream); throw e }
    }
}
