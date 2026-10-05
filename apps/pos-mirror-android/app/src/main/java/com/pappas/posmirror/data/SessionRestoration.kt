package com.pappas.posmirror.data

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession

/** supabase-kt strips the URL scheme before deriving its per-project storage key. */
fun mirrorSessionStorageKey(url: String): String =
    "sb-${url.substringAfterLast("//").removeSuffix("/").replace('/', '-').replace('.', '-')}-session"

/** Never replace an SDK-managed session with the tokens captured at the original login. */
suspend fun restoreMirrorSession(
    storage: SessionManager,
    awaitSession: suspend () -> UserSession?,
    importLegacy: suspend (String, String) -> UserSession?,
    accessToken: String?,
    refreshToken: String?
): UserSession? {
    val hadStoredSession = storage.loadSession() != null
    val current = awaitSession()
    if (current != null || hadStoredSession || accessToken.isNullOrBlank() || refreshToken.isNullOrBlank()) return current
    return importLegacy(accessToken, refreshToken)
}

/** A temporary refresh failure must never be interpreted as an anonymous, empty register list. */
suspend fun <T> authenticatedMirrorFetch(accessToken: () -> String?, fetch: suspend () -> T): T {
    val token = accessToken()?.takeIf { it.isNotBlank() } ?: error("Authentication is refreshing")
    val result = fetch()
    check(accessToken() == token) { "Authentication changed during mirror refresh; retry with the current session" }
    return result
}
