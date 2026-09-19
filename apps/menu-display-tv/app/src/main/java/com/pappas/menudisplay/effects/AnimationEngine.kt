package com.pappas.menudisplay.effects

import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView

interface TransitionEffect {
    val name: String
    fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit)
}

interface CinematicEffect {
    val name: String
    fun play(view: View, duration: Long)
}

object AnimationEngine {
    private val transitions = mutableMapOf<String, TransitionEffect>()
    private val cinematics = mutableMapOf<String, CinematicEffect>()

    fun registerTransition(effect: TransitionEffect) {
        transitions[effect.name] = effect
    }

    fun registerCinematic(effect: CinematicEffect) {
        cinematics[effect.name] = effect
    }

    fun getTransitions(): List<String> = transitions.keys.toList()
    fun getCinematics(): List<String> = cinematics.keys.toList()

    fun playTransition(name: String, container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val effect = transitions[name]
        if (effect != null) {
            effect.play(container, oldView, newView, duration, onComplete)
        } else {
            // Fallback for missing or unknown transitions (e.g., just remove old view)
            container.removeView(oldView)
            onComplete()
        }
    }

    fun playCinematic(name: String, view: View, duration: Long) {
        cinematics[name]?.play(view, duration)
    }
}
