package com.pappas.menudisplay

import android.content.Context
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.io.InputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.Executors

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ImageStoreTest {
    private lateinit var context: Context
    private val a = "00000000-0000-0000-0000-000000000001"
    private val b = "00000000-0000-0000-0000-000000000002"
    @Before fun setup() {
        context = RuntimeEnvironment.getApplication()
        File(context.filesDir, "menus").deleteRecursively()
        val dir = File(context.filesDir, "menus").apply { mkdirs() }
        File(dir, a).writeText("fixture")
        File(dir, b).writeText("fixture")
        File(dir, "catalog.json").writeText("""{"images":[{"id":"$a","name":"Lunch"},{"id":"$b","name":"Dinner"}],"display":{"ids":["$b","$a"],"seconds":15,"slideshow":true}}""")
    }
    @Test fun renameAndDeletePersistAndRemoveDeletedImageFromSlideshow() {
        val store = ImageStore(context)
        store.rename(a, "Lunch specials")
        store.delete(b)
        val reopened = ImageStore(context)
        assertEquals("Lunch specials", reopened.list().single().name)
        assertEquals(listOf(a), reopened.state().ids)
        assertEquals(15, reopened.state().seconds)
        assertFalse(File(context.filesDir, "menus/$b").exists())
    }
    @Test fun interruptedUploadLeavesLibraryIntactAndCleansTemporaryFile() {
        val store = ImageStore(context)
        try { store.upload("abc".byteInputStream(), 100, "bad.png"); fail("must reject truncated upload") }
        catch (_: IllegalArgumentException) { }
        assertEquals(2, ImageStore(context).list().size)
        assertFalse(File(context.filesDir, "menus").listFiles()!!.any { it.name.endsWith(".upload") })
    }
    @Test fun libraryReadsDoNotWaitForNetworkUpload() {
        val store = ImageStore(context)
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val upload = pool.submit {
                runCatching { store.upload(object : InputStream() {
                    override fun read(): Int { entered.countDown(); release.await(3, TimeUnit.SECONDS); return -1 }
                }, 10, "slow.png") }
            }
            assertTrue(entered.await(2, TimeUnit.SECONDS))
            val read = pool.submit<List<MenuImage>> { store.list() }
            assertEquals(2, read.get(500, TimeUnit.MILLISECONDS).size)
            release.countDown(); upload.get(3, TimeUnit.SECONDS)
        } finally { release.countDown(); pool.shutdownNow() }
    }
    @Test fun corruptCatalogRecoversImageFilesWithoutDeletingThem() {
        File(context.filesDir, "menus/catalog.json").writeText("broken")
        val store = ImageStore(context)
        assertEquals(setOf(a,b), store.list().map { it.id }.toSet())
        assertNotNull(store.recoveryMessage)
    }
    @Test fun legacyFilesMigrateToLocalDirectory() {
        val store = ImageStore(context)
        val localA = File(context.filesDir, "menus/local/$a")
        val localB = File(context.filesDir, "menus/local/$b")
        assertTrue("Legacy file 'a' should be migrated to menus/local/", localA.exists())
        assertTrue("Legacy file 'b' should be migrated to menus/local/", localB.exists())
        assertFalse("Legacy file 'a' should no longer be in root menus/", File(context.filesDir, "menus/$a").exists())
        assertEquals(ImageSource.LOCAL, store.list().first { it.id == a }.source)
    }
    @Test fun localAndCloudStoredInSeparateFoldersAndSameNameAllowed() {
        val localId = "00000000-0000-0000-0000-000000000010"
        val cloudId = "00000000-0000-0000-0000-000000000020"
        
        val localFile = File(context.filesDir, "menus/local/$localId").apply { parentFile?.mkdirs(); writeText("local-content") }
        val cloudFile = File(context.filesDir, "menus/cloud/$cloudId").apply { parentFile?.mkdirs(); writeText("cloud-content") }
        
        File(context.filesDir, "menus/catalog.json").writeText(
            """{"images":[{"id":"$localId","name":"Specials Menu","source":"local"},{"id":"$cloudId","name":"Specials Menu","source":"cloud"}],"display":{"ids":["$localId","$cloudId"]}}"""
        )
        
        val store = ImageStore(context)
        val localItems = store.list(ImageSource.LOCAL)
        val cloudItems = store.list(ImageSource.CLOUD)
        
        assertEquals(1, localItems.size)
        assertEquals(1, cloudItems.size)
        assertEquals("Specials Menu", localItems.single().name)
        assertEquals("Specials Menu", cloudItems.single().name)
        assertEquals(ImageSource.LOCAL, localItems.single().source)
        assertEquals(ImageSource.CLOUD, cloudItems.single().source)
        
        // Assert file locations
        assertEquals(localFile.canonicalPath, store.file(localId).canonicalPath)
        assertEquals(cloudFile.canonicalPath, store.file(cloudId).canonicalPath)
        
        // Deleting the cloud image leaves the local file intact
        store.delete(cloudId)
        assertFalse("Cloud file should be deleted", cloudFile.exists())
        assertTrue("Local file must still exist", localFile.exists())
        assertTrue(store.list(ImageSource.LOCAL).any { it.id == localId })
        assertTrue(store.list(ImageSource.CLOUD).isEmpty())
        
        // Reopen store to verify persistence
        val reopened = ImageStore(context)
        assertEquals(1, reopened.list().size)
        assertEquals(localId, reopened.list().single().id)
        assertEquals(ImageSource.LOCAL, reopened.list().single().source)
    }
}
