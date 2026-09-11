package com.pappas.menudisplay

import android.view.KeyEvent
import android.view.WindowManager
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class PlaybackActivityTest {
    @Test fun savedDisplayKeepsScreenAwakeAndBackReturnsToLibrary() {
        val dir = File(RuntimeEnvironment.getApplication().filesDir, "menus").apply { deleteRecursively(); mkdirs() }
        val id = "00000000-0000-0000-0000-000000000003"
        File(dir, id).writeText("fixture")
        File(dir, "catalog.json").writeText("""{"images":[{"id":"$id","name":"Menu"}],"display":{"ids":["$id"],"seconds":10,"slideshow":false}}""")
        val controller = Robolectric.buildActivity(MainActivity::class.java).create().start().resume()
        try {
            val activity = controller.get()
            assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON != 0)
            activity.onBackPressed()
            assertEquals(0, activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } finally { controller.pause().stop().destroy() }
    }
    @Test fun uploadButtonShowsLoadingImmediatelyAndBackRemainsAvailable() {
        File(RuntimeEnvironment.getApplication().filesDir, "menus").deleteRecursively()
        val controller = Robolectric.buildActivity(MainActivity::class.java).create().start().resume()
        fun labels(view: android.view.View): List<android.widget.TextView> =
            if (view is android.view.ViewGroup) (0 until view.childCount).flatMap { labels(view.getChildAt(it)) }
            else if (view is android.widget.TextView) listOf(view) else emptyList()
        try {
            val activity = controller.get()
            labels(activity.window.decorView).first { it.text.toString() == "Upload images" }.performClick()
            assertTrue(labels(activity.window.decorView).any { it.text.toString() == "Preparing upload connection…" })
            labels(activity.window.decorView).first { it.text.toString() == "Back to library" }.performClick()
            assertTrue(labels(activity.window.decorView).any { it.text.toString() == "Your menu library" })
        } finally { controller.pause().stop().destroy() }
    }

}
