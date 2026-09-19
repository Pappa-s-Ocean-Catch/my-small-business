package com.pappas.menudisplay.effects

import android.graphics.Color
import android.graphics.PorterDuff
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import java.util.Random

class GlitchTransition(override val name: String) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        newView.alpha = 0f
        
        val random = Random()
        val glitchCount = 15
        val interval = duration / glitchCount
        
        var step = 0
        val runnable = object : Runnable {
            override fun run() {
                step++
                if (step >= glitchCount) {
                    oldView.translationX = 0f
                    oldView.translationY = 0f
                    oldView.scaleX = 1f
                    oldView.scaleY = 1f
                    oldView.alpha = 0f
                    (oldView as? ImageView)?.clearColorFilter()
                    
                    newView.alpha = 1f
                    newView.translationX = 0f
                    newView.translationY = 0f
                    newView.scaleX = 1f
                    newView.scaleY = 1f
                    (newView as? ImageView)?.clearColorFilter()
                    
                    container.removeView(oldView)
                    onComplete()
                } else {
                    val mixNew = random.nextFloat() > 0.5f
                    if (mixNew) {
                        newView.alpha = 1f
                        oldView.alpha = 0.5f
                    } else {
                        newView.alpha = 0.5f
                        oldView.alpha = 1f
                    }
                    
                    val active = if (mixNew) newView else oldView
                    active.translationX = (random.nextFloat() - 0.5f) * 150f
                    active.translationY = (random.nextFloat() - 0.5f) * 50f
                    
                    if (active is ImageView) {
                        val r = random.nextInt(4)
                        when (r) {
                            0 -> active.setColorFilter(Color.argb(120, 255, 0, 0), PorterDuff.Mode.SCREEN)
                            1 -> active.setColorFilter(Color.argb(120, 0, 255, 0), PorterDuff.Mode.SCREEN)
                            2 -> active.setColorFilter(Color.argb(120, 0, 0, 255), PorterDuff.Mode.SCREEN)
                            else -> active.clearColorFilter()
                        }
                    }
                    
                    container.postDelayed(this, interval)
                }
            }
        }
        container.post(runnable)
    }
}

class PixelDissolveTransition(override val name: String) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        newView.alpha = 0f
        newView.animate().alpha(1f).setDuration(duration).start()
        
        if (oldView.width > 0 && oldView.height > 0) {
            val bmp = android.graphics.Bitmap.createBitmap(oldView.width, oldView.height, android.graphics.Bitmap.Config.ARGB_8888)
            oldView.draw(android.graphics.Canvas(bmp))
            
            val pixelView = object : View(container.context) {
                val gridSize = 16
                val randoms = FloatArray(gridSize * gridSize) { Math.random().toFloat() }
                var progress = 0f
                val paint = android.graphics.Paint()
                
                override fun onDraw(canvas: android.graphics.Canvas) {
                    super.onDraw(canvas)
                    val w = width.toFloat() / gridSize
                    val h = height.toFloat() / gridSize
                    
                    for (r in 0 until gridSize) {
                        for (c in 0 until gridSize) {
                            val idx = r * gridSize + c
                            val startP = randoms[idx] * 0.5f 
                            
                            val blockAlpha = 1f - ((progress - startP) / 0.5f).coerceIn(0f, 1f)
                            if (blockAlpha > 0f) {
                                paint.alpha = (blockAlpha * 255).toInt()
                                val src = android.graphics.Rect((c * bmp.width / gridSize), (r * bmp.height / gridSize), ((c + 1) * bmp.width / gridSize), ((r + 1) * bmp.height / gridSize))
                                val dst = android.graphics.RectF(c * w, r * h, (c + 1) * w, (r + 1) * h)
                                canvas.drawBitmap(bmp, src, dst, paint)
                            }
                        }
                    }
                }
            }
            container.addView(pixelView, FrameLayout.LayoutParams(-1, -1))
            container.removeView(oldView)
            
            val anim = android.animation.ValueAnimator.ofFloat(0f, 1f)
            anim.duration = duration
            anim.addUpdateListener { 
                pixelView.progress = it.animatedValue as Float
                pixelView.invalidate()
            }
            anim.addListener(object: android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    container.removeView(pixelView)
                    bmp.recycle()
                    onComplete()
                }
            })
            anim.start()
        } else {
            oldView.animate().alpha(0f).setDuration(duration).withEndAction {
                container.removeView(oldView)
                onComplete()
            }.start()
        }
    }
}

class BurnAwayTransition(override val name: String) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        newView.alpha = 0f
        newView.animate().alpha(1f).setDuration(duration).start()
        
        if (oldView.width > 0 && oldView.height > 0) {
            val bmp = android.graphics.Bitmap.createBitmap(oldView.width, oldView.height, android.graphics.Bitmap.Config.ARGB_8888)
            oldView.draw(android.graphics.Canvas(bmp))
            
            val burnView = object : View(container.context) {
                var progress = 0f
                val paint = android.graphics.Paint()
                val glowPaint = android.graphics.Paint().apply {
                    color = android.graphics.Color.rgb(255, 69, 0) // Orange Red
                    style = android.graphics.Paint.Style.STROKE
                    strokeWidth = 15f
                    maskFilter = android.graphics.BlurMaskFilter(20f, android.graphics.BlurMaskFilter.Blur.NORMAL)
                }
                val path = android.graphics.Path()
                val random = java.util.Random(42)
                val noise = FloatArray(40) { random.nextFloat() }
                
                init {
                    setLayerType(LAYER_TYPE_SOFTWARE, null)
                }
                
                override fun onDraw(canvas: android.graphics.Canvas) {
                    super.onDraw(canvas)
                    val w = width.toFloat()
                    val h = height.toFloat()
                    
                    val currentY = h - (h * progress * 1.5f) // sweep fully off top
                    
                    path.reset()
                    path.moveTo(0f, h)
                    path.lineTo(0f, currentY + noise[0] * 150f)
                    
                    for (i in 1..20) {
                        val x = w * (i / 20f)
                        val yOffset = noise[i] * 200f * (if (i % 2 == 0) 1 else -1)
                        path.lineTo(x, currentY + yOffset)
                    }
                    path.lineTo(w, h)
                    path.close()
                    
                    canvas.save()
                    canvas.clipPath(path)
                    canvas.drawBitmap(bmp, null, android.graphics.RectF(0f, 0f, w, h), paint)
                    canvas.restore()
                    
                    // Fire edge
                    canvas.drawPath(path, glowPaint)
                    val tempColor = glowPaint.color
                    val tempWidth = glowPaint.strokeWidth
                    glowPaint.color = android.graphics.Color.YELLOW
                    glowPaint.strokeWidth = 5f
                    canvas.drawPath(path, glowPaint)
                    glowPaint.color = tempColor
                    glowPaint.strokeWidth = tempWidth
                }
            }
            container.addView(burnView, FrameLayout.LayoutParams(-1, -1))
            container.removeView(oldView)
            
            val anim = android.animation.ValueAnimator.ofFloat(0f, 1f)
            anim.duration = duration
            anim.addUpdateListener { 
                burnView.progress = it.animatedValue as Float
                burnView.invalidate()
            }
            anim.addListener(object: android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    container.removeView(burnView)
                    bmp.recycle()
                    onComplete()
                }
            })
            anim.start()
        } else {
            oldView.animate().alpha(0f).setDuration(duration).withEndAction {
                container.removeView(oldView)
                onComplete()
            }.start()
        }
    }
}

fun registerShaderTransitions() {
    AnimationEngine.registerTransition(GlitchTransition("Glitch"))
    AnimationEngine.registerTransition(PixelDissolveTransition("Pixel Dissolve"))
    AnimationEngine.registerTransition(BurnAwayTransition("Burn Away"))
}