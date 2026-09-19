package com.pappas.menudisplay.effects

import android.view.View
import android.widget.FrameLayout

class CubeTransition(override val name: String, private val leftToRight: Boolean) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val width = container.width.toFloat()
        val distance = 12000f // enhance perspective
        oldView.cameraDistance = distance
        newView.cameraDistance = distance
        
        oldView.pivotX = if (leftToRight) width else 0f
        oldView.pivotY = container.height / 2f
        
        newView.pivotX = if (leftToRight) 0f else width
        newView.pivotY = container.height / 2f
        newView.rotationY = if (leftToRight) -90f else 90f
        newView.alpha = 1f
        
        oldView.animate().rotationY(if (leftToRight) 90f else -90f).setDuration(duration).withEndAction {
            container.removeView(oldView)
            onComplete()
        }.start()
        
        newView.animate().rotationY(0f).setDuration(duration).start()
    }
}

class CardFlipTransition(override val name: String) : TransitionEffect {
    override fun play(container: FrameLayout, oldView: View, newView: View, duration: Long, onComplete: () -> Unit) {
        val distance = 12000f
        oldView.cameraDistance = distance
        newView.cameraDistance = distance
        
        newView.rotationY = -90f
        newView.alpha = 0f
        
        val halfDuration = duration / 2
        oldView.animate().rotationY(90f).setDuration(halfDuration).withEndAction {
            container.removeView(oldView)
            newView.alpha = 1f
            newView.animate().rotationY(0f).setDuration(halfDuration).withEndAction {
                onComplete()
            }.start()
        }.start()
    }
}

fun register3DTransitions() {
    AnimationEngine.registerTransition(CubeTransition("Cube Left", true))
    AnimationEngine.registerTransition(CubeTransition("Cube Right", false))
    AnimationEngine.registerTransition(CardFlipTransition("Card Flip"))
}
