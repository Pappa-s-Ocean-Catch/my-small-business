package com.pappas.menudisplay

import org.junit.Assert.*
import org.junit.Test

class PlaylistTest {
    @Test fun removesMissingAndDuplicateImagesWithoutChangingOrder() {
        assertEquals(listOf("b", "a"), Playlist.reconcile(listOf("b", "gone", "a", "b"), setOf("a", "b")))
    }
    @Test fun wrapsInBothDirectionsAndHandlesEmptyPlaylist() {
        assertEquals(0, Playlist.next(2, 1, 3))
        assertEquals(2, Playlist.next(0, -1, 3))
        assertEquals(0, Playlist.next(0, 1, 0))
    }
}
