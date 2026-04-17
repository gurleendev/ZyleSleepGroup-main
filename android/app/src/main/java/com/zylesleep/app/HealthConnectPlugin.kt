package com.zylesleep.app

import android.annotation.SuppressLint
import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectClient.Companion.SDK_AVAILABLE
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId
import java.util.HashMap
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import java.util.Calendar


@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val io = CoroutineScope(Dispatchers.IO)

    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class)
    )

    private fun isHCAvailable(): Boolean =
        HealthConnectClient.getSdkStatus(context) == SDK_AVAILABLE

    private fun hc(): HealthConnectClient? =
        if (isHCAvailable()) HealthConnectClient.getOrCreate(context) else null

    private fun prefs() =
        context.getSharedPreferences("hc_cache", Context.MODE_PRIVATE)

    private fun saveJson(key: String, value: JSONObject) {
        prefs().edit().putString(key, value.toString()).apply()
    }

    private fun readJsonOrNull(key: String): JSONObject? {
        val s = prefs().getString(key, null) ?: return null
        return try {
            JSONObject(s)
        } catch (_: Throwable) {
            null
        }
    }

    // ---------- Availability / Permissions ----------

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        call.resolve(JSObject().put("available", isHCAvailable()))
    }

    // Renamed to avoid clashing with Plugin.requestPermissions(...)
    @PluginMethod
    fun requestHCPermissions(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")
        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(permissions)) {
                    call.resolve(JSObject().put("launched", false).put("alreadyGranted", true))
                    return@launch
                }
                val i =
                    context.packageManager.getLaunchIntentForPackage("com.google.android.apps.healthdata")
                if (i != null) {
                    bridge.activity?.startActivity(i)
                    call.resolve(JSObject().put("launched", true).put("alreadyGranted", false))
                } else {
                    call.reject("Health Connect app not installed")
                }
            } catch (e: Exception) {
                call.reject("Could not open Health Connect: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun hasPermissions(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")
        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("hasAll", granted.containsAll(permissions)))
            } catch (t: Throwable) {
                call.reject("hasPermissions error: ${t.message}")
            }
        }
    }

    // ---------- Sleep: Today + 7-day series ----------

    /**
     * Returns:
     * {
     *   today: { date: "YYYY-MM-DD", totalMinutes: Int, sessionCount: Int },
     *   days:  [ { date, totalMinutes, sessionCount }, ... ] // 7 entries, oldest->newest
     * }
     * Also caches { days: [...] } into SharedPreferences ("sleep_last_7").
     */
    @PluginMethod
    fun readSleepSummary7(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")

        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("Permissions not granted")
                    return@launch
                }

                val zone = ZoneId.systemDefault()
                val today = LocalDate.now(zone)
                val startDay = today.minusDays(6) // inclusive (7 days total)
                val start = startDay.atStartOfDay(zone).toInstant()
                val end = today.plusDays(1).atStartOfDay(zone).toInstant()

                // Bucket map for 7 days
                val buckets = HashMap<LocalDate, Pair<Long, Int>>() // (totalMillis, sessionCount)
                for (i in 0..6) {
                    val d = startDay.plusDays(i.toLong())
                    buckets[d] = 0L to 0
                }

                // Read ALL pages between start..end
                var pageToken: String? = null
                do {
                    val resp = client.readRecords(
                        ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(start, end),
                            pageSize = 500,
                            pageToken = pageToken
                        )
                    )
                    for (s in resp.records) {
                        // startTime / endTime are already java.time.Instant
                        val sStart = s.startTime
                        val sEnd = s.endTime

                        val clampedStart = if (sStart.isBefore(start)) start else sStart
                        val clampedEnd = if (sEnd.isAfter(end)) end else sEnd

                        if (clampedEnd.isAfter(clampedStart)) {
                            // Attribute whole session to the day it STARTED (fast/simple)
                            val localDate = clampedStart.atZone(zone).toLocalDate()
                            if (buckets.containsKey(localDate)) {
                                val durMs = Duration.between(clampedStart, clampedEnd).toMillis()
                                val (acc, cnt) = buckets[localDate]!!
                                buckets[localDate] = (acc + durMs) to (cnt + 1)
                            }
                        }
                    }
                    pageToken = resp.pageToken
                } while (pageToken != null)

                // Build ordered JSON (oldest -> newest)
                val daysArr = JSONArray()
                for (i in 0..6) {
                    val d = startDay.plusDays(i.toLong())
                    val (ms, cnt) = buckets[d] ?: (0L to 0)
                    val minutes = (ms / 1000L / 60L).toInt()
                    daysArr.put(
                        JSONObject()
                            .put("date", d.toString())
                            .put("totalMinutes", minutes)
                            .put("sessionCount", cnt)
                    )
                }

                // Today object (the last bucket)
                val todayPair = buckets[today] ?: (0L to 0)
                val todayMinutes = (todayPair.first / 1000L / 60L).toInt()
                val todayObj = JSObject()
                    .put("date", today.toString())
                    .put("totalMinutes", todayMinutes)
                    .put("sessionCount", todayPair.second)

                // Cache only the 7-day array
                val cacheObj = JSONObject().put("days", daysArr)
                saveJson("sleep_last_7", cacheObj)

                val ret = JSObject()
                ret.put("today", todayObj)
                ret.put("days", daysArr)
                call.resolve(ret)
            } catch (t: Throwable) {
                call.reject("readSleepSummary7 error: ${t.message}")
            }
        }
    }

    /**
     * Quick access to cached 7-day summary (no HC call).
     * Returns {} if nothing cached yet.
     */
    @PluginMethod
    fun getCachedSleep7(call: PluginCall) {
        val cached = readJsonOrNull("sleep_last_7") ?: return call.resolve(JSObject()) // empty
        val ret = JSObject(cached.toString())
        call.resolve(ret)
    }

    // ---------- Today-only helpers ----------

    @PluginMethod
    fun readTodaySleepSummary(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")
        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("Permissions not granted")
                    return@launch
                }
                val zone = ZoneId.systemDefault()
                val day = LocalDate.now(zone)
                val start = day.atStartOfDay(zone).toInstant()
                val end = day.plusDays(1).atStartOfDay(zone).toInstant()

                var totalMillis = 0L
                var count = 0

                var pageToken: String? = null
                do {
                    val resp = client.readRecords(
                        ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(start, end),
                            pageSize = 500,
                            pageToken = pageToken
                        )
                    )
                    for (s in resp.records) {
                        val dur = s.endTime.toEpochMilli() - s.startTime.toEpochMilli()
                        if (dur > 0) totalMillis += dur
                    }
                    count += resp.records.size
                    pageToken = resp.pageToken
                } while (pageToken != null)

                val totalMinutes = (totalMillis / 1000L / 60L).toInt()
                call.resolve(
                    JSObject()
                        .put("sessionCount", count)
                        .put("totalMinutes", totalMinutes)
                )
            } catch (t: Throwable) {
                call.reject("readTodaySleepSummary error: ${t.message}")
            }
        }
    }

    // ---------- Heart rate & steps ----------

    @PluginMethod
    fun readTodayHeartRate(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")
        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("Permissions not granted")
                    return@launch
                }
                val zone = ZoneId.systemDefault()
                val day = LocalDate.now(zone)
                val start = day.atStartOfDay(zone).toInstant()
                val end = day.plusDays(1).atStartOfDay(zone).toInstant()

                val resp = client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                        pageSize = 500
                    )
                )

                var sum = 0.0
                var n = 0
                var min = Long.MAX_VALUE
                var max = Long.MIN_VALUE

                for (r in resp.records) {
                    for (samp in r.samples) {
                        val bpm = samp.beatsPerMinute
                        sum += bpm
                        n += 1
                        if (bpm < min) min = bpm
                        if (bpm > max) max = bpm
                    }
                }

                val avg = if (n > 0) sum / n else 0.0
                call.resolve(
                    JSObject()
                        .put("avgBpm", avg)
                        .put("minBpm", if (n > 0) min.toInt() else 0)
                        .put("maxBpm", if (n > 0) max.toInt() else 0)
                        .put("samples", n)
                )
            } catch (t: Throwable) {
                call.reject("readTodayHeartRate error: ${t.message}")
            }
        }
    }

    @PluginMethod
    fun readTodaySteps(call: PluginCall) {
        val client = hc() ?: return call.reject("Health Connect not available")
        io.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("READ_STEPS not granted")
                    return@launch
                }
                val zone = ZoneId.systemDefault()
                val day = LocalDate.now(zone)
                val start = day.atStartOfDay(zone).toInstant()
                val end = day.plusDays(1).atStartOfDay(zone).toInstant()

                val result = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start, end)
                    )
                )
                val steps = result[StepsRecord.COUNT_TOTAL] ?: 0L
                call.resolve(JSObject().put("steps", steps))
            } catch (t: Throwable) {
                call.reject("readTodaySteps error: ${t.message}")
            }
        }
    }

    @SuppressLint("ScheduleExactAlarm")
    @PluginMethod
    fun scheduleNativeAlarm(call: PluginCall) {
        val ctx = context.applicationContext
        val hour = call.getInt("hour")
        val minute = call.getInt("minute")
        if (hour == null || minute == null) {
            call.reject("hour and minute are required"); return
        }
        // NEW: optional label from JS (defaults to "Alarm")
        val label = call.getString("label") ?: "Alarm"


        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val triggerAt = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }.timeInMillis

        val alarmIntent = Intent(ctx, AlarmReceiver::class.java).apply {
            action = "com.zylesleep.ALARM"
            putExtra("hour", hour)
            putExtra("minute", minute)
            putExtra("label", label)
        }

        val alarmPI = PendingIntent.getBroadcast(
            ctx, 1001, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Content intent = jump back to app if the user taps the clock icon in status bar
        val contentPI = PendingIntent.getActivity(
            ctx, 2002, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Use AlarmClockInfo to avoid exact-alarm permission friction
        val info = AlarmManager.AlarmClockInfo(triggerAt, contentPI)
        am.setAlarmClock(info, alarmPI)

        call.resolve(JSObject().put("scheduledAt", triggerAt))
    }

    @PluginMethod
    fun cancelNativeAlarm(call: PluginCall) {
        val ctx = context.applicationContext
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val alarmPI = PendingIntent.getBroadcast(
            ctx, 1001, Intent(ctx, AlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(alarmPI)
        call.resolve(JSObject().put("cancelled", true))
    }
}

