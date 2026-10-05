package com.pappas.quickhub
import org.junit.Assert.*
import org.junit.Test
class RedirectGuardTest {
    @Test fun redirectsOnlyTheSelectedLauncher() {
        val guard = RedirectGuard()
        assertFalse(guard.allow(false, "stock", "stock", "hub", 1000))
        assertFalse(guard.allow(true, "stock", "pos", "hub", 1000))
        assertFalse(guard.allow(true, "hub", "hub", "hub", 1000))
        assertFalse(guard.allow(true, "", "", "hub", 1000))
        assertTrue(guard.allow(true, "stock", "stock", "hub", 1000))
    }
    @Test fun repeatedEventsAreThrottled() {
        val guard = RedirectGuard()
        assertTrue(guard.allow(true, "stock", "stock", "hub", 1000))
        assertFalse(guard.allow(true, "stock", "stock", "hub", 1001))
        assertFalse(guard.allow(true, "stock", "stock", "hub", 1499))
        assertTrue(guard.allow(true, "stock", "stock", "hub", 1500))
    }
}
