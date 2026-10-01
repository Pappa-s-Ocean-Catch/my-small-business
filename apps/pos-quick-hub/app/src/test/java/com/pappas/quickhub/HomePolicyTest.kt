package com.pappas.quickhub

import org.junit.Assert.*
import org.junit.Test

class HomePolicyTest {
    @Test fun ordinaryAppNeverEnforcesHome() {
        assertFalse(HomePolicy.shouldEnforce(isDeviceOwner = false, enabled = true))
    }
    @Test fun ownerRequiresExplicitOptIn() {
        assertFalse(HomePolicy.shouldEnforce(isDeviceOwner = true, enabled = false))
    }
    @Test fun optedInOwnerEnforcesHome() {
        assertTrue(HomePolicy.shouldEnforce(isDeviceOwner = true, enabled = true))
    }
    @Test fun lossOfPreviouslySelectedHomeIsReported() {
        assertEquals(HomeState.REPLACED, HomePolicy.state("com.sunmi.launcher", "com.pappas.quickhub", true))
    }
    @Test fun noDefaultIsNotReportedAsSunmiTakeover() {
        assertEquals(HomeState.UNSELECTED, HomePolicy.state(null, "com.pappas.quickhub", true))
    }
    @Test fun selectedHomeIsActive() {
        assertEquals(HomeState.ACTIVE, HomePolicy.state("com.pappas.quickhub", "com.pappas.quickhub", false))
    }
    @Test fun firstRunDoesNotClaimTakeover() {
        assertEquals(HomeState.UNSELECTED, HomePolicy.state("com.sunmi.launcher", "com.pappas.quickhub", false))
    }
}
