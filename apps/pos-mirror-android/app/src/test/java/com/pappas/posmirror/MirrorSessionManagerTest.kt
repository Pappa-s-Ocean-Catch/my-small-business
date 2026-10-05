package com.pappas.posmirror

import com.pappas.posmirror.data.MirrorSessionManager
import io.github.jan.supabase.auth.MemorySessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class MirrorSessionManagerTest {
    private fun session(token: String) = UserSession(
        accessToken = "access-$token", refreshToken = "refresh-$token",
        providerRefreshToken = "", providerToken = "", expiresIn = 3600, tokenType = "bearer"
    )

    @Test fun rotatedTokensArePersistedAndRestoredByANewManager() = runBlocking {
        val storage = MemorySessionManager()
        var mirrored: UserSession? = null
        val manager = MirrorSessionManager(storage, { mirrored = it }, { mirrored = null })
        manager.saveSession(session("login")); manager.saveSession(session("rotated"))
        assertEquals("refresh-rotated", mirrored?.refreshToken)
        val restarted = MirrorSessionManager(storage, { mirrored = it }, { mirrored = null })
        assertEquals("access-rotated", restarted.loadSession()?.accessToken)
    }

    @Test fun signOutDeletesStoredAndMirroredSession() = runBlocking {
        val storage = MemorySessionManager()
        var mirrored: UserSession? = null
        val manager = MirrorSessionManager(storage, { mirrored = it }, { mirrored = null })
        manager.saveSession(session("login")); manager.deleteSession()
        assertNull(manager.loadSession()); assertNull(mirrored)
    }
}
