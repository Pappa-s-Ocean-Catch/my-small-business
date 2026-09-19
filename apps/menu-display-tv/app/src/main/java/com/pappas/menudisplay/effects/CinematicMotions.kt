package com.pappas.menudisplay.effects

import android.view.View
import android.view.animation.LinearInterpolator

class KenBurnsZoom(override val name: String, private val zoomIn: Boolean) : CinematicEffect {
    override fun play(view: View, duration: Long) {
        val startScale = if (zoomIn) 1.0f else 1.15f
        val endScale = if (zoomIn) 1.15f else 1.0f
        
        view.scaleX = startScale
        view.scaleY = startScale
        
        view.animate()
            .scaleX(endScale)
            .scaleY(endScale)
            .setDuration(duration)
            .setInterpolator(LinearInterpolator())
            .start()
    }
}

class PanMotion(override val name: String, private val dx: Float, private val dy: Float) : CinematicEffect {
    override fun play(view: View, duration: Long) {
        // To pan slightly, we first scale up a bit to avoid showing edges
        view.scaleX = 1.05f
        view.scaleY = 1.05f
        
        // Ensure layout has happened to get width/height, fallback to 1000 if 0
        val w = if (view.width > 0) view.width.toFloat() else 1920f
        val h = if (view.height > 0) view.height.toFloat() else 1080f
        
        // Pan distance is 2.5% of the dimension
        val translateX = dx * (w * 0.025f)
        val translateY = dy * (h * 0.025f)
        
        view.translationX = -translateX
        view.translationY = -translateY
        
        view.animate()
            .translationX(translateX)
            .translationY(translateY)
            .setDuration(duration)
            .setInterpolator(LinearInterpolator())
            .start()
    }
}

fun registerCinematicMotions() {
    AnimationEngine.registerCinematic(KenBurnsZoom("Ken Burns Zoom In", true))
    AnimationEngine.registerCinematic(KenBurnsZoom("Ken Burns Zoom Out", false))
    AnimationEngine.registerCinematic(PanMotion("Pan Left", 1f, 0f))
    AnimationEngine.registerCinematic(PanMotion("Pan Right", -1f, 0f))
    AnimationEngine.registerCinematic(PanMotion("Pan Up", 0f, 1f))
    AnimationEngine.registerCinematic(PanMotion("Pan Down", 0f, -1f))
    AnimationEngine.registerCinematic(FloatingImage("Floating Image"))
    AnimationEngine.registerCinematic(BreathingZoom("Breathing Zoom"))
    AnimationEngine.registerCinematic(AutoCinematicMotion("Auto"))
}

class FloatingImage(override val name: String) : CinematicEffect {
    override fun play(view: View, duration: Long) {
        view.scaleX = 1.08f
        view.scaleY = 1.08f
        
        val w = if (view.width > 0) view.width.toFloat() else 1920f
        val h = if (view.height > 0) view.height.toFloat() else 1080f
        
        val moveX = w * 0.03f
        val moveY = h * 0.03f
        
        view.translationX = -moveX
        view.translationY = -moveY
        
        view.animate()
            .translationX(moveX)
            .translationY(moveY)
            .setDuration(duration)
            .setInterpolator(LinearInterpolator())
            .start()
    }
}

class BreathingZoom(override val name: String) : CinematicEffect {
    override fun play(view: View, duration: Long) {
        view.scaleX = 1.0f
        view.scaleY = 1.0f
        
        view.animate()
            .scaleX(1.05f)
            .scaleY(1.05f)
            .setDuration(duration / 2)
            .setInterpolator(LinearInterpolator())
            .withEndAction {
                view.animate()
                    .scaleX(1.0f)
                    .scaleY(1.0f)
                    .setDuration(duration / 2)
                    .setInterpolator(LinearInterpolator())
                    .start()
            }
            .start()
    }
}

class AutoCinematicMotion(override val name: String) : CinematicEffect {
    override fun play(view: View, duration: Long) {
        // Fallback or random selector for Auto Mode
        val random = java.util.Random()
        val choices = listOf(
            KenBurnsZoom("Ken Burns Auto", true),
            KenBurnsZoom("Ken Burns Auto", false),
            PanMotion("Pan Auto", 1f, 0f),
            PanMotion("Pan Auto", -1f, 0f),
            BreathingZoom("Breathing Auto"),
            FloatingImage("Floating Auto")
        )
        val selected = choices[random.nextInt(choices.size)]
        selected.play(view, duration)
    }
}
