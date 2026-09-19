package com.pappas.menudisplay

import com.pappas.menudisplay.effects.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AnimationEngineTest {
    @Test fun verifyEngineRegistersAndResolvesEffects() {
        registerBasicTransitions()
        registerCinematicMotions()
        registerMaskTransitions()
        register3DTransitions()
        registerShaderTransitions()
        
        val transitions = AnimationEngine.getTransitions()
        assertTrue(transitions.contains("Fade"))
        assertTrue(transitions.contains("Slide Left"))
        assertTrue(transitions.contains("Circle Reveal"))
        assertTrue(transitions.contains("Cube Left"))
        assertTrue(transitions.contains("Card Flip"))
        assertTrue(transitions.contains("Glitch"))
        assertTrue(transitions.contains("Pixel Dissolve"))
        assertTrue(transitions.contains("Burn Away"))
        
        val cinematics = AnimationEngine.getCinematics()
        assertTrue(cinematics.contains("Ken Burns Zoom In"))
        assertTrue(cinematics.contains("Floating Image"))
    }
}
