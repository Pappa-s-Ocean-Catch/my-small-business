package com.pappas.posmirror.data

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession

/** Keeps the app's legacy credential fields in sync with the SDK's authoritative session storage. */
class MirrorSessionManager(
    private val storage: SessionManager,
    private val onSaved: (UserSession) -> Unit,
    private val onDeleted: () -> Unit
) : SessionManager {
    override suspend fun saveSession(session: UserSession) {
        storage.saveSession(session)
        onSaved(session)
    }

    override suspend fun loadSession(): UserSession? = storage.loadSession()

    override suspend fun deleteSession() {
        storage.deleteSession()
        onDeleted()
    }
}
