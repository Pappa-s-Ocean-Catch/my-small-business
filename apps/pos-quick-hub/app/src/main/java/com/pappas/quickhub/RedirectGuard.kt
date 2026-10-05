package com.pappas.quickhub

/** Bounds redirects to one explicitly selected package and prevents event storms. */
class RedirectGuard {
    private var lastRedirect: Long? = null
    fun allow(enabled: Boolean, target: String, foreground: String, ownPackage: String, now: Long): Boolean {
        if (!enabled || target.isBlank() || target == ownPackage || foreground != target) return false
        if (lastRedirect?.let { now - it < 500 } == true) return false
        lastRedirect = now
        return true
    }
}
