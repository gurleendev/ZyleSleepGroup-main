// src/components/SmartAssistantScreen.jsx
import React, { useCallback } from "react";
import SmartAssistant from "./SmartAssistant";

// persist + notify ActivityScreen without a full resync
function applyPlanToStorage({ bedtime, wakeTime, sleepDurationHrs }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const durationMin = Math.round((sleepDurationHrs ?? 0) * 60);

  const hist = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]")
    .filter((e) => e.date !== todayStr);

  hist.push({
    date: todayStr,
    slept: bedtime || "",
    woke: wakeTime || "",
    duration: durationMin / 60,
    source: "ai",
  });
  localStorage.setItem("actualSleepHistory", JSON.stringify(hist));

  window.dispatchEvent(new CustomEvent("sleep-plan-applied", {
    detail: { bedtime, wakeTime, sleepDurationMin: durationMin }
  }));
}

/** Props:
 *  - goBack: () => void
 */
export default function SmartAssistantScreen({ goBack }) {
  const handleApply = useCallback(({ bedtime, wakeTime, sleepDurationHrs }) => {
    applyPlanToStorage({ bedtime, wakeTime, sleepDurationHrs });
    goBack(); // back to Activity
  }, [goBack]);

  return (
    <div className="min-h-screen bg-background text-text px-5 py-4">
      <header className="flex items-center justify-between mb-3">
        <button onClick={goBack} className="text-green-400 hover:underline text-sm">
          ← Back
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold">Smart Assistant</h1>
        <span className="opacity-0">spacer</span>
      </header>
      <SmartAssistant onApply={handleApply} />
    </div>
  );
}
