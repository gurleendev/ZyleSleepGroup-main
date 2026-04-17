// src/components/ActivityScreen.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  checkAvailability,
  requestPermissions,
  readTodaySteps,
  readTodaySleepSummary,
  readTodayHeartRate,
  readSleepSummary7,
  getCachedSleep7,
} from "../capacitor/healthConnect";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ---------- helpers ----------
const hhmm = (min) => ({ h: Math.floor((min || 0) / 60), m: (min || 0) % 60 });
const synthesizeSleep = (todayMin = 0) =>
  [...Array(7)].map((_, i, arr) => {
    const d = new Date();
    d.setDate(d.getDate() - (arr.length - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      totalMinutes: todayMin,
      sessionCount: todayMin > 0 ? 1 : 0,
    };
  });
const toRows = (days) =>
  (days || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    duration: Number(((d.totalMinutes || 0) / 60).toFixed(2)),
    sessions: d.sessionCount || 0,
  }));

export function ActivityScreen({ goBack, openAssistant = () => {} }) {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(null);
  const [granted, setGranted] = useState(null);
  const [error, setError] = useState("");

  const [steps, setSteps] = useState(null);
  const [sleepToday, setSleepToday] = useState(null);
  const [hr, setHr] = useState(null);
  const [sleepDays, setSleepDays] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedSleep7();
        if (cached?.days?.length) setSleepDays(cached.days);
      } catch {}
      await handleSync();
    })();
  }, []);

  useEffect(() => {
    function onApplied(e) {
      const { sleepDurationMin, bedtime, wakeTime } = e.detail || {};
      if (!sleepDurationMin) return;
      setSleepToday((prev) => ({
        totalMinutes: sleepDurationMin,
        sessionCount: bedtime || wakeTime ? 1 : prev?.sessionCount || 0,
      }));
      setSleepDays((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          totalMinutes: sleepDurationMin,
          sessionCount:
            bedtime || wakeTime ? 1 : copy[copy.length - 1]?.sessionCount || 0,
        };
        return copy;
      });
    }
    window.addEventListener("sleep-plan-applied", onApplied);
    return () => window.removeEventListener("sleep-plan-applied", onApplied);
  }, []);

  const handleSync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const a = await checkAvailability();
      const ok = !!a?.available;
      setAvailable(ok);
      if (!ok) {
        setError("Health Connect not available on this device.");
        return;
      }

      try {
        await requestPermissions();
        setGranted(true);
      } catch (e) {
        setGranted(false);
        setError(
          typeof e === "string" ? e : e?.message || "Permission request failed."
        );
        return;
      }

      const s = await readTodaySteps();
      setSteps(Number.isFinite(+s) ? +s : 0);

      const sl = await readTodaySleepSummary();
      const today = {
        totalMinutes: Number(sl?.totalMinutes ?? 0),
        sessionCount: Number(sl?.sessionCount ?? 0),
      };
      setSleepToday(today);

      try {
        const seven = await readSleepSummary7();
        if (seven?.days?.length) setSleepDays(seven.days);
        if (seven?.today) {
          setSleepToday({
            totalMinutes: Number(
              seven.today.totalMinutes ?? today.totalMinutes ?? 0
            ),
            sessionCount: Number(
              seven.today.sessionCount ?? today.sessionCount ?? 0
            ),
          });
        }
      } catch {}

      const hrRes = await readTodayHeartRate();
      setHr({
        avgBpm: Number(hrRes?.avgBpm ?? 0),
        minBpm: Number(hrRes?.minBpm ?? 0),
        maxBpm: Number(hrRes?.maxBpm ?? 0),
        samples: Number(hrRes?.samples ?? 0),
        latestBpm: Number.isFinite(+hrRes?.latestBpm)
          ? +hrRes.latestBpm
          : NaN,
      });
    } catch (e) {
      setError(
        typeof e === "string" ? e : e?.message || "Unexpected Health Connect error."
      );
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const chartRows = useMemo(() => {
    const have = Array.isArray(sleepDays) && sleepDays.length > 0;
    const days = have ? sleepDays : synthesizeSleep(sleepToday?.totalMinutes ?? 0);
    return toRows(days);
  }, [sleepDays, sleepToday]);

  const { h, m } = hhmm(sleepToday?.totalMinutes || 0);
  const nowBpm = useMemo(() => {
    const cand = Number.isFinite(hr?.latestBpm) ? hr.latestBpm : hr?.avgBpm;
    return Number.isFinite(cand) ? Math.round(cand) : 0;
  }, [hr]);

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-screen-md pb-8">
        <main className="relative px-4 pt-0 space-y-6">

          {/* In-page sticky title row (sits right above Steps, aligned with content) */}
          <div
            className="sticky top-0 z-30 -mx-4 px-4 pt-[env(safe-area-inset-top)] pb-3
                       bg-black border-b border-white/10"
          >
            <div className="flex items-center justify-between">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Activity
              </h1>
              <button
                onClick={handleSync}
                disabled={busy}
                className={`px-4 py-1.5 rounded-xl transition whitespace-nowrap shadow-lg ${
                  busy
                    ? "opacity-60 bg-green-700 text-white"
                    : "bg-green-600 hover:bg-green-500 text-white"
                }`}
              >
                {busy ? "Syncing..." : "Sync"}
              </button>
            </div>
          </div>

          {/* steps */}
          <section className="bg-zinc-900/70 p-5 rounded-2xl shadow-lg border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 20a2 2 0 01-2-2c0-1.1.9-2 2-2h1v4H9zm5-6h2a2 2 0 012 2v4h-4v-6zm-3-6h2v12h-2V8zm3-4h2v4h-2V4zM7 10h2v8H7v-8z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-400">Steps (Today)</div>
                <div className="text-4xl font-extrabold tracking-tight">
                  {steps != null ? (
                    <>
                      {Number(steps).toLocaleString()}{" "}
                      <span className="text-base font-normal text-gray-300">steps</span>
                    </>
                  ) : (
                    <span className="text-base font-normal text-gray-300">—</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* heart */}
          <section className="bg-zinc-900/70 p-5 rounded-2xl shadow-lg border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-9 h-9 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.1 21.35l-1.1-1.02C5.14 14.88 2 12.05 2 8.5 2 6.01 3.99 4 6.5 4c1.54 0 3.04.99 3.57 2.36h.86C11.46 4.99 12.96 4 14.5 4 17.01 4 19 6.01 19 8.5c0 3.55-3.14 6.38-8.01 11.83l-.89 1.02z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-400">Now</div>
                <div className="text-4xl font-extrabold">
                  {nowBpm}
                  <span className="text-base font-normal text-gray-300 ml-1">bpm</span>
                </div>
                {hr && (
                  <div className="mt-2 text-sm text-gray-300">
                    <span className="mr-3">min {hr.minBpm ?? 0}</span>
                    <span className="mr-3">max {hr.maxBpm ?? 0}</span>
                    <span>{hr.samples ?? 0} samples</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* sleep */}
          <section className="bg-zinc-900/70 p-5 rounded-2xl shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-lg font-medium">Sleep (Last 7 Days)</p>
            </div>

            <div className="text-sm mb-3">
              <span className="text-gray-400">Today:</span>{" "}
              {sleepToday ? (
                <>
                  <b>
                    {h}h {m}m
                  </b>{" "}
                  <span className="text-gray-300">• {sleepToday.sessionCount} session(s)</span>
                </>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  barSize={chartRows.length === 1 ? 60 : 28}
                  margin={{ top: 8, right: 12, left: -8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopOpacity="1" stopColor="#34d399" />
                      <stop offset="100%" stopOpacity="1" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="date" stroke="#a3a3a3" />
                  <YAxis unit="h" stroke="#a3a3a3" domain={[0, 12]} />
                  <Tooltip
                    formatter={(v) => `${v} hrs`}
                    contentStyle={{ background: "#0b0b0b", border: "1px solid #2a2a2a" }}
                    labelStyle={{ color: "#e5e5e5" }}
                  />
                  <Bar dataKey="duration" radius={[8, 8, 0, 0]} fill="url(#sleepGrad)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* nudge */}
          <section className="text-sm text-gray-300">
            {steps != null && sleepToday != null ? (
              (() => {
                const sleptEnough = (sleepToday.totalMinutes || 0) >= 420;
                const walkedWell = (steps || 0) >= 7000;
                if (walkedWell && sleptEnough)
                  return "Nice! 7k+ steps and 7h+ sleep—keep that loop going.";
                if (walkedWell) return "Active day (7k+). Wind down earlier to push sleep past 7h.";
                if (sleptEnough)
                  return "Sleep looks solid (7h+). A ~7k-step day can deepen sleep quality.";
                return "Below 7k steps and 7h sleep. A 20–30 min walk + fixed bedtime will nudge both up.";
              })()
            ) : (
              <span>Data loads automatically. If values look stale, tap Sync.</span>
            )}
          </section>

          {/* CTA */}
          <section className="mt-2">
            <button
              onClick={openAssistant}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-3 rounded-2xl"
            >
              Open Smart Assistant →
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}

export default ActivityScreen;
