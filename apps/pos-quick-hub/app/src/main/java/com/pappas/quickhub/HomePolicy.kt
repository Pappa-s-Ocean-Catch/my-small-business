package com.pappas.quickhub

enum class HomeState { ACTIVE, REPLACED, UNSELECTED }

object HomePolicy {
    fun shouldEnforce(isDeviceOwner: Boolean, enabled: Boolean): Boolean = isDeviceOwner && enabled

    fun state(currentHome: String?, ownPackage: String, wasSelected: Boolean): HomeState = when {
        currentHome == ownPackage -> HomeState.ACTIVE
        currentHome != null && wasSelected -> HomeState.REPLACED
        else -> HomeState.UNSELECTED
    }
}
