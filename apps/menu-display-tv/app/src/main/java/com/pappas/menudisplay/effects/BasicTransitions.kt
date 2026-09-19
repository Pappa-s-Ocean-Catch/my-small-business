package com.pappas.menudisplay.effects

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import java.util.Random

object FadeTransition : TransitionEffect {
    override val name = "Fade"
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        newView.alpha = 0f
        newView.animate().alpha(1f).setDuration(duration).start()
        oldView.animate().alpha(0f).setDuration(duration).withEndAction {
            container.removeView(oldView)
            onComplete()
        }.start()
    }
}

class SlideTransition(override val name: String, private val dx: Float, private val dy: Float) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val width = container.width.toFloat()
        val height = container.height.toFloat()
        val startX = dx * width
        val startY = dy * height

        newView.translationX = startX
        newView.translationY = startY
        newView.animate().translationX(0f).translationY(0f).setDuration(duration).start()
        oldView.animate().translationX(-startX).translationY(-startY).setDuration(duration).withEndAction {
            container.removeView(oldView)
            onComplete()
        }.start()
    }
}

class ZoomTransition(override val name: String, private val zoomIn: Boolean) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val startScale = if (zoomIn) 0.5f else 1.5f
        newView.scaleX = startScale
        newView.scaleY = startScale
        newView.alpha = 0f

        newView.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(duration).start()
        oldView.animate().alpha(0f).setDuration(duration).withEndAction {
            container.removeView(oldView)
            onComplete()
        }.start()
    }
}

object ShatterTransition : TransitionEffect {
    override val name = "Shatter"
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        newView.alpha = 0f
        newView.animate().alpha(1f).setDuration(duration).start()
        
        if (oldView.width >= 4 && oldView.height >= 4) {
            val snapshot = Bitmap.createBitmap(oldView.width, oldView.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(snapshot)
            oldView.draw(canvas)
            val pieceW = snapshot.width / 4
            val pieceH = snapshot.height / 4
            val random = Random()
            
            for (row in 0 until 4) {
                for (col in 0 until 4) {
                    val pieceBmp = Bitmap.createBitmap(snapshot, col * pieceW, row * pieceH, pieceW, pieceH)
                    val pieceView = ImageView(container.context).apply {
                        setImageBitmap(pieceBmp)
                        scaleType = ImageView.ScaleType.FIT_XY
                    }
                    val lp = FrameLayout.LayoutParams(pieceW, pieceH).apply {
                        leftMargin = col * pieceW
                        topMargin = row * pieceH
                    }
                    container.addView(pieceView, lp)
                    val tx = (random.nextFloat() - 0.5f) * container.width * 1.5f
                    val ty = (random.nextFloat() - 0.5f) * container.height * 1.5f
                    val rot = (random.nextFloat() - 0.5f) * 360f
                    
                    pieceView.animate()
                        .translationX(tx)
                        .translationY(ty)
                        .rotation(rot)
                        .alpha(0f)
                        .setDuration(duration)
                        .withEndAction { 
                            container.removeView(pieceView)
                            pieceBmp.recycle() 
                        }
                        .start()
                }
            }
            container.removeView(oldView)
            container.postDelayed({ 
                snapshot.recycle() 
                onComplete()
            }, duration + 100)
        } else {
            oldView.animate().alpha(0f).setDuration(duration).withEndAction {
                container.removeView(oldView)
                onComplete()
            }.start()
        }
    }
}

fun registerBasicTransitions() {
    AnimationEngine.registerTransition(FadeTransition)
    AnimationEngine.registerTransition(SlideTransition("Slide Left", 1f, 0f))
    AnimationEngine.registerTransition(SlideTransition("Slide Right", -1f, 0f))
    AnimationEngine.registerTransition(SlideTransition("Slide Up", 0f, 1f))
    AnimationEngine.registerTransition(SlideTransition("Slide Down", 0f, -1f))
    AnimationEngine.registerTransition(ZoomTransition("Zoom In", true))
    AnimationEngine.registerTransition(ZoomTransition("Zoom Out", false))
    AnimationEngine.registerTransition(ShatterTransition)
}
