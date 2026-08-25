package com.mysmallbusiness.appmemory

import android.app.ActivityManager
import android.content.Context
import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppMemoryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppMemory")

    AsyncFunction("getCurrentMemoryAsync") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is unavailable")
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        ?: throw IllegalStateException("Activity manager is unavailable")
      val processMemory = activityManager.getProcessMemoryInfo(intArrayOf(Process.myPid())).firstOrNull()
        ?: throw IllegalStateException("Process memory is unavailable")
      val systemMemory = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)

      mapOf(
        "totalBytes" to systemMemory.totalMem.toLong(),
        "appFootprintBytes" to processMemory.totalPss.toLong() * 1024L,
        "availableBytes" to systemMemory.availMem.toLong(),
      )
    }
  }
}
