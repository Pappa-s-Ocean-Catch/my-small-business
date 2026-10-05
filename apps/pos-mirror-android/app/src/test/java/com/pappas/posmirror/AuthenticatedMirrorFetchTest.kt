package com.pappas.posmirror

import com.pappas.posmirror.data.authenticatedMirrorFetch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AuthenticatedMirrorFetchTest {
    @Test fun refreshFailureCannotTurnAnonymousEmptyRowsIntoAClearedCart() = runBlocking {
        var displayedRows = listOf("active-cart")
        try {
            displayedRows = authenticatedMirrorFetch({ null }) { emptyList<String>() }
            fail("Unauthenticated result must be rejected")
        } catch (_: IllegalStateException) { }
        assertEquals(listOf("active-cart"), displayedRows)
    }

    @Test fun tokenRotationDuringFetchRejectsTheResultAndAllowsANewFetch() = runBlocking {
        var token: String? = "old-token"
        var displayedRows = listOf("active-cart")
        try {
            displayedRows = authenticatedMirrorFetch({ token }) {
                token = "rotated-token"
                emptyList<String>()
            }
            fail("Result spanning token changes must be rejected")
        } catch (_: IllegalStateException) { }
        assertEquals(listOf("active-cart"), displayedRows)
        displayedRows = authenticatedMirrorFetch({ token }) { listOf("updated-cart") }
        assertEquals(listOf("updated-cart"), displayedRows)
    }
}
