package com.pappas.posmirror

import com.pappas.posmirror.data.mirrorSessionStorageKey
import com.pappas.posmirror.data.restoreMirrorSession
import io.github.jan.supabase.auth.MemorySessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class SessionRestorationTest {
    private fun session(token: String) = UserSession(
        accessToken = "access-$token", refreshToken = "refresh-$token",
        providerRefreshToken = "", providerToken = "", expiresIn = 3600, tokenType = "bearer"
    )

    @Test fun storageKeyPreservesExistingSdkSessions() {
        assertEquals("sb-example-supabase-co-session", mirrorSessionStorageKey("https://example.supabase.co/"))
        assertEquals("sb-localhost:54321-session", mirrorSessionStorageKey("http://localhost:54321"))
    }

    @Test fun restoresRotatedSdkSessionInsteadOfStaleLoginTokens() = runBlocking {
        val rotated = session("rotated")
        val stored = MemorySessionManager(rotated)
        val restored = restoreMirrorSession(stored, { rotated }, { _, _ -> error("Must not import stale tokens") }, "access-login", "refresh-login")
        assertEquals("refresh-rotated", restored?.refreshToken)
    }

    @Test fun migratesLegacyCredentialsOnlyWhenSdkStorageIsEmpty() = runBlocking {
        val stored = MemorySessionManager()
        val restored = restoreMirrorSession(stored, { null }, { access, refresh ->
            assertEquals("access-login", access)
            assertEquals("refresh-login", refresh)
            session("migrated").also { stored.saveSession(it) }
        }, "access-login", "refresh-login")
        assertEquals("refresh-migrated", restored?.refreshToken)
        assertEquals("access-migrated", stored.loadSession()?.accessToken)
    }

    @Test fun revokedSdkSessionCannotFallBackToStaleLoginTokens() = runBlocking {
        val stored = MemorySessionManager(session("revoked"))
        val restored = restoreMirrorSession(stored, { stored.deleteSession(); null }, { _, _ -> error("Revoked session must not be revived") }, "access-login", "refresh-login")
        assertNull(restored)
    }

    @Test fun emptyCredentialsDoNotAttemptLegacyImport() = runBlocking {
        val restored = restoreMirrorSession(MemorySessionManager(), { null }, { _, _ -> error("No credentials") }, null, null)
        assertNull(restored)
    }
}
