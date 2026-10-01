package com.pappas.posmirror.util

import com.pappas.posmirror.BuildConfig

object Constants {
    val SUPABASE_URL: String = BuildConfig.SUPABASE_URL
    val SUPABASE_ANON_KEY: String = BuildConfig.SUPABASE_ANON_KEY
    
    val REALTIME_WS_URL: String
        get() = "${SUPABASE_URL.replace("https://", "wss://").replace("http://", "ws://")}/realtime/v1/websocket?apikey=$SUPABASE_ANON_KEY&vsn=1.0.0"
}

