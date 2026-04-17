package com.zylesleep.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register your in-app plugin before super.onCreate
        registerPlugin(HealthConnectPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
