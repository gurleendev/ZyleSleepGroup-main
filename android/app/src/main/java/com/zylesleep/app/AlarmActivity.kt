package com.zylesleep.app

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import android.widget.TextView
import android.widget.Button  // ✅ use Button instead of MaterialButton

class AlarmActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = layoutInflater.inflate(R.layout.activity_alarm, null)
        setContentView(root)

        // Make sure alarm screen shows over lock screen and turns display on
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        // Set the alarm label
        val label = intent.getStringExtra("label") ?: "Alarm"
        findViewById<TextView>(R.id.alarm_title).text = label

        // STOP button
        findViewById<Button>(R.id.btn_stop).setOnClickListener {
            val stopIntent = Intent(this, AlarmSoundService::class.java)
                .setAction(AlarmSoundService.ACTION_STOP)
            startService(stopIntent)
            finish()
        }

        // SNOOZE button
        findViewById<Button>(R.id.btn_snooze).setOnClickListener {
            val snoozeIntent = Intent(this, AlarmSoundService::class.java)
                .setAction(AlarmSoundService.ACTION_SNOOZE)
                .putExtra("label", label)
            startService(snoozeIntent)
            finish()
        }
    }
}
