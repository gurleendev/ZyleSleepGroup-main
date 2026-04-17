package com.zylesleep.app


import android.app.*
import android.content.*
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class AlarmSoundService : Service() {

    companion object {
        const val ACTION_START = "ACTION_START_ALARM"
        const val ACTION_STOP  = "ACTION_STOP_ALARM"
        const val ACTION_SNOOZE = "ACTION_SNOOZE_ALARM"
        const val CHANNEL_ID = "alarm_channel"
        private const val NOTIF_ID = 424242
        private const val SNOOZE_MINUTES = 10
    }

    private var player: MediaPlayer? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startInForeground(intent.getStringExtra("label") ?: "Alarm")
                startRingtone()
            }
            ACTION_STOP -> {
                stopRingtone()
                stopSelf()
            }
            ACTION_SNOOZE -> {
                // Reschedule
                scheduleSnooze(this, SNOOZE_MINUTES, intent.getStringExtra("label") ?: "Alarm")
                // Stop current ring
                stopRingtone()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopRingtone()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startInForeground(label: String) {
        val stopPi = PendingIntent.getService(
            this, 1,
            Intent(this, AlarmSoundService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val snoozePi = PendingIntent.getService(
            this, 2,
            Intent(this, AlarmSoundService::class.java).setAction(ACTION_SNOOZE)
                .putExtra("label", label),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val fullScreenIntent = PendingIntent.getActivity(
            this, 3,
            Intent(this, AlarmActivity::class.java).putExtra("label", label),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("ZyleSleep Alarm")
            .setContentText(label)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .addAction(0, "Snooze", snoozePi)
            .addAction(0, "Stop", stopPi)
            .setFullScreenIntent(fullScreenIntent, true)
            .build()

        startForeground(NOTIF_ID, notif)
    }

    private fun startRingtone() {
        // Use default alarm tone (fallback to notification tone if needed)
        val uri: Uri = android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI
            ?: android.provider.Settings.System.DEFAULT_NOTIFICATION_URI

        player = MediaPlayer().apply {
            setDataSource(this@AlarmSoundService, uri)
            isLooping = true
            setVolume(1.0f, 1.0f)
            prepare()
            start()
        }
    }

    private fun stopRingtone() {
        try {
            player?.stop()
        } catch (_: Exception) { }
        player?.release()
        player = null
    }

    private fun scheduleSnooze(ctx: Context, minutes: Int, label: String) {
        val mgr = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val i = Intent(ctx, AlarmReceiver::class.java).apply {
            putExtra("label", "$label (snoozed)")
        }
        val pi = PendingIntent.getBroadcast(
            ctx, 1001, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = System.currentTimeMillis() + minutes * 60_000L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
            mgr.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }
}
