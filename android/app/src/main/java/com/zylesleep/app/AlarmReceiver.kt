package com.zylesleep.app


import android.app.*
import android.content.*
import android.os.Build
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val label = intent.getStringExtra("label") ?: "Alarm"
        val channelId = "alarm_channel"

        // Ensure channel exists
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = context.getSystemService(NotificationManager::class.java)
            val ch = NotificationChannel(
                channelId, "Alarms", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alarm notifications"
                setSound(null, null) // sound from service, not the notification
                enableVibration(true)
            }
            mgr.createNotificationChannel(ch)
        }

        // 1) Start foreground service to play ringtone
        val svc = Intent(context, AlarmSoundService::class.java).apply {
            action = AlarmSoundService.ACTION_START
            putExtra("label", label)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc)
        } else {
            context.startService(svc)
        }

        // 2) Launch full-screen activity
        val fs = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("label", label)
        }
        context.startActivity(fs)

        // 3) (Optional) Post a notification with action buttons (the service also posts one)
        // You can skip this because the service will show an ongoing notification with STOP/SNOOZE.
    }
}



