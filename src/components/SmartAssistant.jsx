// src/components/SmartAssistant.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  readTodaySteps,
  readTodayHeartRate,
  readSleepSummary7,
  getCachedSleep7,
} from "../capacitor/healthConnect";

const OPENAI_KEY = "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"

const Qs = [
  { key: "age", label: "How old are you?", render: (v, set) => (
      <input type="number" className="bg-card px-4 py-2 rounded w-full"
        value={v.age} onChange={e=>set({ ...v, age: e.target.value })}/>
  )},
  { key: "bedtimeConsistency", label: "Do you keep a consistent bedtime?", render: (v, set) => (
      <select className="bg-card px-4 py-2 rounded w-full"
        value={v.bedtimeConsistency} onChange={e=>set({ ...v, bedtimeConsistency: e.target.value })}>
        <option value="">Select</option><option>Always</option><option>Sometimes</option><option>Rarely</option>
      </select>
  )},
  { key: "screenTimeBeforeBed", label: "How much screen time before bed?", render: (v, set) => (
      <select className="bg-card px-4 py-2 rounded w-full"
        value={v.screenTimeBeforeBed} onChange={e=>set({ ...v, screenTimeBeforeBed: e.target.value })}>
        <option value="">Select</option><option>None</option><option>Under 1 hour</option><option>1–2 hours</option><option>Over 2 hours</option>
      </select>
  )},
  { key: "caffeineAfter6pm", label: "Did you drink caffeine after 6PM?", render: (v, set) => (
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" className="mr-1"
          checked={v.caffeineAfter6pm} onChange={e=>set({ ...v, caffeineAfter6pm: e.target.checked })}/>
        <span>Yes</span>
      </label>
  )},
  { key: "exerciseFrequency", label: "How often do you exercise weekly?", render: (v, set) => (
      <select className="bg-card px-4 py-2 rounded w-full"
        value={v.exerciseFrequency} onChange={e=>set({ ...v, exerciseFrequency: e.target.value })}>
        <option value="">Select</option><option>Never</option><option>1–2 times</option><option>3–5 times</option><option>Daily</option>
      </select>
  )},
  { key: "stressLevel", label: "How stressed did you feel this week?", render: (v, set) => (
      <select className="bg-card px-4 py-2 rounded w-full"
        value={v.stressLevel} onChange={e=>set({ ...v, stressLevel: e.target.value })}>
        <option value="">Select</option><option>Low</option><option>Moderate</option><option>High</option>
      </select>
  )},
];

// util
const hhmm = (min) => ({ h: Math.floor((min||0)/60), m: (min||0)%60 });

function buildPrompt(answers, metrics) {
  return `You are a helpful sleep expert. Based on the user's responses AND metrics, suggest the ideal bedtime, wake-up time, and number of sleep cycles.

User answers:
${JSON.stringify(answers, null, 2)}

Recent metrics:
${JSON.stringify({
  steps: metrics.steps,
  heart: metrics.heart,
  todayMinutes: metrics.todayMinutes,
}, null, 2)}

Return strictly in this format:
Bedtime: HH:MM AM/PM
Wake-up Time: HH:MM AM/PM
Sleep Cycles: X

Suggestion: (<=3 lines of personalized tips)`;
}

function parseTimes(aiText) {
  const bedtimeMatch = aiText.match(/bedtime:?[\s\-]*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const wakeMatch   = aiText.match(/wake[-\s]?up time:?[\s\-]*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const cyclesMatch = aiText.match(/sleep cycles?:?\s*(\d+)/i);

  const bedtime = bedtimeMatch ? `${bedtimeMatch[1]}:${bedtimeMatch[2]} ${bedtimeMatch[3].toUpperCase()}` : undefined;
  const wakeTime = wakeMatch ? `${wakeMatch[1]}:${wakeMatch[2]} ${wakeMatch[3].toUpperCase()}` : undefined;
  const sleepDurationHrs = cyclesMatch ? Math.max(1, Number(cyclesMatch[1]) * 1.5) : undefined;

  return { bedtime, wakeTime, sleepDurationHrs };
}

/**
 * Props:
 * - onApply({ bedtime: "HH:MM AM/PM", wakeTime: "HH:MM AM/PM", sleepDurationHrs: number }) -> void
 *   (Parent will update localStorage/UI)
 */
export default function SmartAssistant({ onApply }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem("assistantData");
    return saved ? JSON.parse(saved) : {
      age: "", bedtimeConsistency: "", screenTimeBeforeBed: "",
      caffeineAfter6pm: false, exerciseFrequency: "", stressLevel: "",
    };
  });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [metrics, setMetrics] = useState({
    steps: 0,
    heart: { avgBpm: 0, minBpm: 0, maxBpm: 0, samples: 0 },
    sleep7: [],
    todayMinutes: 0,
  });

  // Load HC metrics (cached first, then fresh)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cached = await getCachedSleep7();
        let days = Array.isArray(cached?.days) ? cached.days : [];
        let todayMin = days.length ? days[days.length - 1].totalMinutes : 0;

        try {
          const fresh = await readSleepSummary7(); // {today, days}
          if (fresh?.days?.length) {
            days = fresh.days;
            if (fresh.today) todayMin = Number(fresh.today.totalMinutes || 0);
          }
        } catch {}

        const steps = await readTodaySteps().catch(() => 0);
        const heart = await readTodayHeartRate().catch(() => ({avgBpm:0,minBpm:0,maxBpm:0,samples:0}));

        setMetrics({ steps, heart, sleep7: days, todayMinutes: todayMin });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist answers
  useEffect(() => {
    localStorage.setItem("assistantData", JSON.stringify(answers));
  }, [answers]);

  const summary = useMemo(() => {
    const last = metrics.sleep7.at(-1);
    const { h, m } = hhmm(metrics.todayMinutes);
    return [
      `Steps today: ${metrics.steps}`,
      `Heart samples: ${metrics.heart.samples} (avg ${Math.round(metrics.heart.avgBpm||0)} bpm)`,
      `Sleep today: ${h}h ${m}m • sessions ${(last?.sessionCount ?? 0)}`
    ].join("\n");
  }, [metrics]);

  async function getAI() {
    setAiLoading(true);
    setAiText("");

    const prompt = buildPrompt(answers, metrics);

    try {
      if (!OPENAI_KEY) {
        // mock fallback (no key provided)
        const mock =
          "Bedtime: 11:00 PM\nWake-up Time: 7:00 AM\nSleep Cycles: 5\n\nSuggestion: Aim for consistent bedtimes, cut screens 45 min before bed, and keep caffeine before 2PM.";
        setAiText(mock);
        return;
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a sleep coach assistant." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "OpenAI error");
      }

      const text = data.choices?.[0]?.message?.content?.trim() || "";
      setAiText(text);
    } catch (e) {
      console.warn("AI request failed, using mock:", e?.message || e);
      const mock =
        "Bedtime: 10:45 PM\nWake-up Time: 6:45 AM\nSleep Cycles: 5\n\nSuggestion: Keep bedtime steady, reduce late caffeine, and try a 10-minute wind-down.";
      setAiText(mock);
    } finally {
      setAiLoading(false);
    }
  }

  function parseAndApply() {
    if (!aiText) return;
    const { bedtime, wakeTime, sleepDurationHrs } = parseTimes(aiText);
    if (onApply) onApply({ bedtime, wakeTime, sleepDurationHrs });
  }

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-white/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Smart Assistant</h3>
        <span className="text-xs text-gray-400">{loading ? "Loading health data…" : "Ready"}</span>
      </div>

      {/* quick health snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-gray-400">Steps</div>
          <div className="text-xl font-semibold">{metrics.steps?.toLocaleString?.() ?? 0}</div>
        </div>
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-gray-400">Heart</div>
          <div className="text-xl font-semibold">
            {Math.round(metrics.heart?.avgBpm || 0)} <span className="text-xs">avg bpm</span>
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-gray-400">Sleep Today</div>
          <div className="text-xl font-semibold">
            {hhmm(metrics.todayMinutes).h}h {hhmm(metrics.todayMinutes).m}m
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div className="w-full bg-gray-800 h-2 rounded mb-4">
        <div className="h-2 bg-green-500 rounded" style={{ width: `${((step + 1) / Qs.length) * 100}%` }} />
      </div>

      {/* animated question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <div className="text-sm font-semibold mb-2">{Qs[step].label}</div>
          <div className="mb-4">{Qs[step].render(answers, setAnswers)}</div>
        </motion.div>
      </AnimatePresence>

      {/* nav + actions */}
      <div className="flex justify-between items-center">
        {step > 0 ? (
          <button className="text-green-400" onClick={() => setStep((s) => s - 1)}>← Back</button>
        ) : <span />}
        {step < Qs.length - 1 ? (
          <button className="bg-primary text-black px-4 py-2 rounded font-semibold" onClick={() => setStep((s) => s + 1)}>
            Next →
          </button>
        ) : (
          <button
            className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded font-semibold disabled:opacity-60"
            disabled={aiLoading}
            onClick={getAI}
          >
            {aiLoading ? "Thinking…" : "Get Recommendation"}
          </button>
        )}
      </div>

      {/* AI output */}
      {!!aiText && (
        <div className="mt-4 bg-black/30 rounded-lg p-4">
          <div className="font-semibold mb-2">AI Recommendation</div>
          <pre className="text-sm whitespace-pre-wrap">{aiText}</pre>
          <div className="mt-3 flex gap-2">
            <button className="bg-gray-700 px-3 py-2 rounded" onClick={() => setAiText("")}>Dismiss</button>
            <button className="bg-primary text-black px-3 py-2 rounded font-semibold" onClick={parseAndApply}>
              Apply to Today
            </button>
          </div>
        </div>
      )}

      {/* For debugging or your server prompt */}
      <details className="mt-3 text-xs text-gray-400">
        <summary>Data summary (dev)</summary>
        <pre className="mt-2">{summary}</pre>
      </details>
    </div>
  );
}
