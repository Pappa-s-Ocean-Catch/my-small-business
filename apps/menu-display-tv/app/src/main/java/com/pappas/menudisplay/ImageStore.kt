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

enum class ImageSource { LOCAL, CLOUD }

data class MenuImage(val id: String, val name: String, val bytes: Long, val source: ImageSource = ImageSource.LOCAL)
data class PlaylistItem(val id: String, val seconds: Int = 10, val animation: String = "Fade", val cinematic: String = "None")
data class SavedPlaylist(val id: String, val name: String, val items: List<PlaylistItem>)
data class DisplayState(val items: List<PlaylistItem>, val slideshow: Boolean = false) {
    constructor(ids: List<String>, seconds: Int = 10, slideshow: Boolean = false) : this(ids.map { PlaylistItem(it, seconds, "Fade", "None") }, slideshow)
    val ids: List<String> get() = items.map { it.id }
    val seconds: Int get() = items.firstOrNull()?.seconds ?: 10
}

class ImageStore(context: Context) {
    private val dir = File(context.filesDir, "menus").apply { mkdirs() }
    private val localDir = File(dir, "local").apply { mkdirs() }
    private val cloudDir = File(dir, "cloud").apply { mkdirs() }
    private val catalog = AtomicFile(File(dir, "catalog.json"))
    private var images = mutableListOf<MenuImage>()
    private var display = DisplayState(emptyList<PlaylistItem>())
    private var playlists = mutableListOf<SavedPlaylist>()
    var recoveryMessage: String? = null
        private set

    init {
        // Migrate any legacy images stored directly under menus/ into menus/local/
        dir.listFiles()?.filter { it.isFile && validId(it.name) }?.forEach { legacy ->
            val dest = File(localDir, legacy.name)
            if (!dest.exists()) legacy.renameTo(dest) else legacy.delete()
        }

        if (catalog.baseFile.exists() || File(dir, "catalog.json.bak").exists()) {
            try {
                val json = JSONObject(catalog.openRead().bufferedReader().use { it.readText() })
                val items = json.getJSONArray("images")
                for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i)
                    val id = item.getString("id")
                    val rawSource = item.optString("source", "local")
                    val source = if (rawSource.equals("cloud", ignoreCase = true)) ImageSource.CLOUD else ImageSource.LOCAL
                    val targetFile = file(id, source)
                    if (validId(id) && targetFile.exists()) {
                        images.add(MenuImage(id, item.getString("name"), targetFile.length(), source))
                    }
                }
                val state = json.optJSONObject("display")
                val itemsArray = state?.optJSONArray("items")
                val itemsList = mutableListOf<PlaylistItem>()
                if (itemsArray != null) {
                    for (j in 0 until itemsArray.length()) {
                        val it = itemsArray.getJSONObject(j)
                        itemsList.add(PlaylistItem(it.getString("id"), it.optInt("seconds", 10), it.optString("animation", "Fade"), it.optString("cinematic", "None")))
                    }
                } else {
                    val ids = state?.optJSONArray("ids") ?: JSONArray()
                    val globalSeconds = state?.optInt("seconds", 10) ?: 10
                    for (j in 0 until ids.length()) {
                        itemsList.add(PlaylistItem(ids.getString(j), globalSeconds, "Fade", "None"))
                    }
                }
                val validIds = Playlist.reconcile(itemsList.map { it.id }, images.map { it.id }.toSet())
                display = DisplayState(itemsList.filter { it.id in validIds }, state?.optBoolean("slideshow") ?: false)
                
                val playlistsArray = json.optJSONArray("playlists")
                if (playlistsArray != null) {
                    for (i in 0 until playlistsArray.length()) {
                        val p = playlistsArray.getJSONObject(i)
                        val pId = p.getString("id")
                        val pName = p.getString("name")
                        val pItemsArray = p.optJSONArray("items") ?: JSONArray()
                        val pItemsList = mutableListOf<PlaylistItem>()
                        for (j in 0 until pItemsArray.length()) {
                            val it = pItemsArray.getJSONObject(j)
                            pItemsList.add(PlaylistItem(it.getString("id"), it.optInt("seconds", 10), it.optString("animation", "Fade"), it.optString("cinematic", "None")))
                        }
                        val validPIds = Playlist.reconcile(pItemsList.map { it.id }, images.map { it.id }.toSet())
                        playlists.add(SavedPlaylist(pId, pName, pItemsList.filter { it.id in validPIds }))
                    }
                }
            } catch (_: Exception) {
                // Recover files without overwriting or discarding the user's images.
                val recoveredLocal = localDir.listFiles().orEmpty().filter { validId(it.name) }.map { MenuImage(it.name, "Recovered menu", it.length(), ImageSource.LOCAL) }
                val recoveredCloud = cloudDir.listFiles().orEmpty().filter { validId(it.name) }.map { MenuImage(it.name, "Recovered menu", it.length(), ImageSource.CLOUD) }
                images = (recoveredLocal + recoveredCloud).toMutableList()
                recoveryMessage = "Library metadata was recovered. Please review image names and slideshow."
            }
        }
        dir.listFiles()?.filter { it.name.endsWith(".upload") }?.forEach { it.delete() }
        localDir.listFiles()?.filter { it.name.endsWith(".upload") }?.forEach { it.delete() }
        cloudDir.listFiles()?.filter { it.name.endsWith(".upload") }?.forEach { it.delete() }
    }
    private fun validId(id: String) = runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false)

    fun file(id: String, source: ImageSource? = null): File {
        require(validId(id))
        if (source != null) return File(if (source == ImageSource.CLOUD) cloudDir else localDir, id)
        val knownSource = images.find { it.id == id }?.source
        if (knownSource != null) return File(if (knownSource == ImageSource.CLOUD) cloudDir else localDir, id)
        val cloudFile = File(cloudDir, id)
        if (cloudFile.exists()) return cloudFile
        val localFile = File(localDir, id)
        if (localFile.exists()) return localFile
        val legacyFile = File(dir, id)
        if (legacyFile.exists()) return legacyFile
        return File(localDir, id)
    }

    @Synchronized fun list(source: ImageSource? = null): List<MenuImage> =
        if (source == null) images.toList() else images.filter { it.source == source }

    @Synchronized fun state(): DisplayState = display.copy(items = display.items.toList())
    
    @Synchronized fun listPlaylists(): List<SavedPlaylist> = playlists.toList()
    @Synchronized fun savePlaylist(playlist: SavedPlaylist) {
        val validIds = Playlist.reconcile(playlist.items.map { it.id }, images.map { it.id }.toSet())
        val validPlaylist = playlist.copy(items = playlist.items.filter { it.id in validIds })
        val existing = playlists.indexOfFirst { it.id == validPlaylist.id }
        if (existing >= 0) playlists[existing] = validPlaylist
        else playlists.add(validPlaylist)
        persist(images, display, playlists)
    }
    @Synchronized fun deletePlaylist(id: String) {
        playlists.removeAll { it.id == id }
        persist(images, display, playlists)
    }

    @Synchronized fun saveState(state: DisplayState) {
        val validIds = Playlist.reconcile(state.ids, images.map { it.id }.toSet())
        val next = state.copy(items = state.items.filter { it.id in validIds })
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
        val target = images.find { it.id == id }
        val next = images.filter { it.id != id }
        val state = display.copy(items = display.items.filter { it.id != id })
        playlists = playlists.map { pl -> pl.copy(items = pl.items.filter { it.id != id }) }.toMutableList()
        persist(next, state)
        images = next.toMutableList()
        display = state
        val targetFile = if (target != null) file(id, target.source) else file(id)
        targetFile.delete()
        File(dir, id).delete()
    }

    private val uploadLock = Any()

    fun upload(input: InputStream, length: Long, name: String): String =
        upload(input, length, name, null, ImageSource.LOCAL)

    fun upload(
        input: InputStream,
        length: Long,
        name: String,
        cloudId: String? = null,
        source: ImageSource = if (cloudId != null) ImageSource.CLOUD else ImageSource.LOCAL
    ): String = synchronized(uploadLock) {
        val snapshot = list()
        require(length <= LocalHttpServer.MAX_UPLOAD) { "Image must be at most 20 MiB" }
        val estimatedLength = if (length > 0) length else 5L * 1024 * 1024 // Assume 5MB if unknown
        require(snapshot.size < 200) { "Library is full (200 images). Delete an image first." }
        require(snapshot.sumOf { it.bytes } + estimatedLength <= 500L * 1024 * 1024 && dir.usableSpace > estimatedLength + 10L * 1024 * 1024) { "Not enough storage. Delete images and retry." }
        val id = cloudId ?: UUID.randomUUID().toString()
        val targetDir = if (source == ImageSource.CLOUD) cloudDir else localDir
        val temp = File(targetDir, "$id.upload")
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
            val destFile = File(targetDir, id)
            check(temp.renameTo(destFile)) { "Could not save image" }
            val clean = name.substringAfterLast('/').substringAfterLast('\\').filter { !it.isISOControl() }.trim().take(100).ifBlank { "Menu image" }
            synchronized(this) {
                val next = images.filter { it.id != id } + MenuImage(id, clean, actualLength, source)
                try { persist(next, display) } catch (e: Exception) { destFile.delete(); throw e }
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
    private fun persist(items: List<MenuImage>, state: DisplayState, savedPlaylists: List<SavedPlaylist> = playlists) {
        val jsonItems = JSONArray().apply { state.items.forEach { put(JSONObject().put("id", it.id).put("seconds", it.seconds).put("animation", it.animation).put("cinematic", it.cinematic)) } }
        val jsonPlaylists = JSONArray().apply {
            savedPlaylists.forEach { pl ->
                val plItems = JSONArray().apply {
                    pl.items.forEach { put(JSONObject().put("id", it.id).put("seconds", it.seconds).put("animation", it.animation).put("cinematic", it.cinematic)) }
                }
                put(JSONObject().put("id", pl.id).put("name", pl.name).put("items", plItems))
            }
        }
        val json = JSONObject().put("images", JSONArray().apply {
            items.forEach {
                put(JSONObject().put("id", it.id).put("name", it.name).put("bytes", it.bytes).put("source", it.source.name.lowercase()))
            }
        })
            .put("display", JSONObject().put("ids", JSONArray(state.ids)).put("seconds", state.seconds).put("items", jsonItems).put("slideshow", state.slideshow))
            .put("playlists", jsonPlaylists)
        val stream = catalog.startWrite()
        try { stream.write(json.toString().toByteArray()); catalog.finishWrite(stream) }
        catch (e: Exception) { catalog.failWrite(stream); throw e }
    }
}
