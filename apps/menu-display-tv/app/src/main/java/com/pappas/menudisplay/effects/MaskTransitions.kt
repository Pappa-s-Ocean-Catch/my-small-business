package com.pappas.menudisplay.effects

import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.view.View
import android.widget.FrameLayout
import kotlin.math.hypot

abstract class MaskTransitionEffect(override val name: String) : TransitionEffect {
    
    // We create a custom view that wraps the new image and clips its drawing canvas
    class MaskedWrapper(context: android.content.Context, val contentView: View) : FrameLayout(context) {
        var maskProgress: Float = 0f
            set(value) {
                field = value
                invalidate()
            }
        
        var clipPathProvider: ((Canvas, Float, Int, Int) -> Unit)? = null

        init {
            addView(contentView, LayoutParams(-1, -1))
            setWillNotDraw(false)
        }

        override fun dispatchDraw(canvas: Canvas) {
            val provider = clipPathProvider
            if (provider != null && maskProgress < 1f) {
                canvas.save()
                provider(canvas, maskProgress, width, height)
                super.dispatchDraw(canvas)
                canvas.restore()
            } else {
                super.dispatchDraw(canvas)
            }
        }
    }

    abstract fun drawMask(canvas: Canvas, progress: Float, width: Int, height: Int)

    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val wrapper = MaskedWrapper(container.context, newView)
        wrapper.clipPathProvider = { canvas, progress, w, h -> drawMask(canvas, progress, w, h) }
        
        container.addView(wrapper, FrameLayout.LayoutParams(-1, -1))
        
        val animator = ValueAnimator.ofFloat(0f, 1f)
        animator.duration = duration
        animator.addUpdateListener { 
            wrapper.maskProgress = it.animatedValue as Float
        }
        animator.addListener(object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) {
                // Unwrap: remove newView from wrapper, add back to container
                wrapper.removeView(newView)
                container.addView(newView, container.indexOfChild(wrapper), FrameLayout.LayoutParams(-1, -1))
                container.removeView(wrapper)
                
                container.removeView(oldView)
                onComplete()
            }
        })
        animator.start()
    }
}

class CircleReveal : MaskTransitionEffect("Circle Reveal") {
    private val path = Path()
    override fun drawMask(canvas: Canvas, progress: Float, width: Int, height: Int) {
        val cx = width / 2f
        val cy = height / 2f
        val maxRadius = hypot(cx.toDouble(), cy.toDouble()).toFloat()
        path.reset()
        path.addCircle(cx, cy, maxRadius * progress, Path.Direction.CW)
        canvas.clipPath(path)
    }
}

class RectangleWipe(name: String, val horizontal: Boolean) : MaskTransitionEffect(name) {
    override fun drawMask(canvas: Canvas, progress: Float, width: Int, height: Int) {
        if (horizontal) {
            canvas.clipRect(0f, 0f, width * progress, height.toFloat())
        } else {
            canvas.clipRect(0f, 0f, width.toFloat(), height * progress)
        }
    }
}

class VenetianBlinds : MaskTransitionEffect("Venetian Blinds") {
    private val path = Path()
    override fun drawMask(canvas: Canvas, progress: Float, width: Int, height: Int) {
        val blindsCount = 10
        val blindHeight = height.toFloat() / blindsCount
        path.reset()
        for (i in 0 until blindsCount) {
            val top = i * blindHeight
            val bottom = top + (blindHeight * progress)
            path.addRect(0f, top, width.toFloat(), bottom, Path.Direction.CW)
        }
        canvas.clipPath(path)
    }
}

fun registerMaskTransitions() {
    AnimationEngine.registerTransition(CircleReveal())
    AnimationEngine.registerTransition(RectangleWipe("Wipe Horizontal", true))
    AnimationEngine.registerTransition(RectangleWipe("Wipe Vertical", false))
    AnimationEngine.registerTransition(VenetianBlinds())
}