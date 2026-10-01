package com.pappas.quickhub

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class LauncherAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        // Activation as a legacy admin is not Device Owner provisioning.
        LauncherManager(context).restoreProtectedHome()
    }
}
