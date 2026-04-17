// src/components/SleepCalculatorScreen.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { scheduleNativeAlarm } from "../capacitor/healthConnect";
import { getAlarms, setAlarms } from "../library/notify";

/* ---------- helpers ---------- */

// Soft request for notification permission (won't crash if plugin missing)
async function ensureNotificationPermissionSoft() {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm?.display !== "granted") await LocalNotifications.requestPermissions();
  } catch {
    /* plugin not installed in this build; ignore */
  }
}

// Parse "7:30 am" / "12:05 PM" -> { h24: 7, m: 30 } etc.
function parse12h(label) {
  // Normalize: lower, strip dots, collapse weird spaces
  const s = (label || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")                  // "a.m." -> "am"
    .replace(/[\u00a0\u202f]/g, " ")     // NBSP / narrow NBSP -> space
    .replace(/\s+/g, " ");               // collapse spaces

  const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3];

  if (ap === "am") h = (h === 12) ? 0 : h;
  else h = (h === 12) ? 12 : h + 12;

  return { h24: h, m: min };
}

// Add to shared alarm storage so Alarm tab shows the new alarm
function addAlarmToStorage(h24, m) {
  const when = new Date();
  when.setHours(h24, m, 0, 0);
  if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1); // next day if past
  const id = Date.now();
  const next = [...getAlarms(), { id, time: when.toISOString(), enabled: true }].sort(
    (a, b) => new Date(a.time) - new Date(b.time)
  );
  setAlarms(next);
  return when; // for UX message
}

/* ---------- component ---------- */

export function SleepCalculatorScreen({ goBack, navigateTo }) {
  const [hour, setHour] = useState("7");
  const [minute, setMinute] = useState("30");
  const [amPm, setAmPm] = useState("AM");
  const [sleepDuration, setSleepDuration] = useState(8);
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState("wake"); // "wake" or "bed"

  // Smart assistant (unchanged behavior)
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantStep, setAssistantStep] = useState(0);
  const [aiResult, setAiResult] = useState("");
  const [showApplyButton, setShowApplyButton] = useState(false);
  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [pendingAIRecommendation, setPendingAIRecommendation] = useState(null);

  // First confirm dialog (select → confirm)
  const [selectedTime, setSelectedTime] = useState(null);

  // Second dialog: Set alarm now?
  const [showSetAlarmPrompt, setShowSetAlarmPrompt] = useState(false);
  const [pendingSetAlarmLabel, setPendingSetAlarmLabel] = useState(null);

  // Daily confirmation input (unchanged)
  const [showSleepConfirmation, setShowSleepConfirmation] = useState(false);
  const [actualSleepTime, setActualSleepTime] = useState("");
  const [wakeEstimateTime, setWakeEstimateTime] = useState("");

  // misc
  const [showResults, setShowResults] = useState(false);
  const [skipHistoryUpdate, setSkipHistoryUpdate] = useState(false);

  const [assistantData, setAssistantData] = useState(() => {
    const saved = localStorage.getItem("assistantData");
    return saved
      ? JSON.parse(saved)
      : {
          age: "",
          bedtimeConsistency: "",
          screenTimeBeforeBed: "",
          caffeineAfter6pm: false,
          exerciseFrequency: "",
          stressLevel: "",
        };
  });

  // Restore last chosen bed/wake times + first time sleep confirmation
  useEffect(() => {
    const stored =
      mode === "wake"
        ? localStorage.getItem("wakeTime")
        : localStorage.getItem("bedTime");

    if (stored) {
      const v = JSON.parse(stored);
      if (v?.hour && v?.minute && v?.amPm) {
        setHour(v.hour);
        setMinute(v.minute);
        setAmPm(v.amPm);
      }
    }

    if (localStorage.getItem("confirmedSleepEntry") !== "yes") {
      setTimeout(() => setShowSleepConfirmation(true), 300);
    }

    setShowResults(false);
    setResults([]);
  }, [mode]);

  // Persist today’s chosen hour/minute/amPm into a simple history record
  useEffect(() => {
    if (skipHistoryUpdate) return;
    const today = new Date().toISOString().split("T")[0];
    const history = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    const filtered = history.filter((entry) => entry.date !== today);
    const previous = history.find((e) => e.date === today) || {};

    const updatedEntry = {
      date: today,
      slept: previous.slept || "",
      woke: previous.woke || "",
      duration: parseFloat(sleepDuration),
      source: "manual",
    };

    if (mode === "wake") {
      updatedEntry.woke = `${hour}:${minute} ${amPm}`;
    } else {
      updatedEntry.slept = `${hour}:${minute} ${amPm}`;
    }

    filtered.push(updatedEntry);
    localStorage.setItem("actualSleepHistory", JSON.stringify(filtered));
  }, [hour, minute, amPm, sleepDuration, mode]);

  // Compute recommended times
  const calculateTimes = () => {
    let h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (amPm === "PM" && h !== 12) h += 12;
    if (amPm === "AM" && h === 12) h = 0;

    const referenceTime = new Date();
    referenceTime.setHours(h, m, 0, 0);

    const cycleMinutes = 90;
    const maxCycles = Math.floor((sleepDuration * 60) / cycleMinutes);
    const output = [];

    for (let i = maxCycles; i >= 1; i--) {
      const time = new Date(referenceTime.getTime());
      if (mode === "wake") {
        time.setTime(time.getTime() - i * cycleMinutes * 60000);
      } else {
        time.setTime(time.getTime() + i * cycleMinutes * 60000);
      }
      output.push({
        time,
        label: time.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        cycles: i,
      });
    }

    const sorted = mode === "bed" ? output.sort((a, b) => a.time - b.time) : output;
    setResults(sorted);

    // lightweight log of desired sleep duration
    const sleepLog = JSON.parse(localStorage.getItem("sleepLog") || "[]");
    const today = new Date().toISOString().split("T")[0];
    sleepLog.push({ date: today, duration: parseFloat(sleepDuration) });
    localStorage.setItem("sleepLog", JSON.stringify(sleepLog));
  };

  // Selecting a recommended time → show first confirm dialog
  const handleSelectTime = (timeObj) => {
    setSelectedTime(timeObj);

    // store selection into “actualSleepHistory” for the day
    const today = new Date().toISOString().split("T")[0];
    const history = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    const filtered = history.filter((entry) => entry.date !== today);
    const previous = history.find((e) => e.date === today) || {};

    const updatedEntry = {
      date: today,
      slept: mode === "wake" ? timeObj.label : previous.slept || "",
      woke: mode === "bed" ? timeObj.label : previous.woke || "",
      duration: parseFloat(sleepDuration),
      source: "selection",
    };

    filtered.push(updatedEntry);
    localStorage.setItem("actualSleepHistory", JSON.stringify(filtered));
  };

  // (Optional) store AI recommendation to history
  const storeAIRecommendation = (bedtime, wakeTime) => {
    const today = new Date().toISOString().split("T")[0];
    const history = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    const filtered = history.filter((entry) => entry.date !== today);
    const updatedEntry = {
      date: today,
      slept: bedtime,
      woke: wakeTime,
      duration: parseFloat(sleepDuration),
      source: "ai",
    };
    filtered.push(updatedEntry);
    localStorage.setItem("actualSleepHistory", JSON.stringify(filtered));
  };

  // --- Smart Assistant (network call redacted; keep your own implementation) ---
  const assistantQuestions = [
    {
      label: "How old are you?",
      input: (
        <input
          type="number"
          className="bg-card px-4 py-2 rounded w-full"
          value={assistantData.age}
          onChange={(e) => setAssistantData({ ...assistantData, age: e.target.value })}
        />
      ),
    },
    {
      label: "Do you go to bed around the same time daily?",
      input: (
        <select
          className="bg-card px-4 py-2 rounded w-full"
          value={assistantData.bedtimeConsistency}
          onChange={(e) =>
            setAssistantData({ ...assistantData, bedtimeConsistency: e.target.value })
          }
        >
          <option value="">Select</option>
          <option>Always</option>
          <option>Sometimes</option>
          <option>Rarely</option>
        </select>
      ),
    },
    {
      label: "How much screen time before bed?",
      input: (
        <select
          className="bg-card px-4 py-2 rounded w-full"
          value={assistantData.screenTimeBeforeBed}
          onChange={(e) =>
            setAssistantData({ ...assistantData, screenTimeBeforeBed: e.target.value })
          }
        >
          <option value="">Select</option>
          <option>None</option>
          <option>Under 1 hour</option>
          <option>1–2 hours</option>
          <option>Over 2 hours</option>
        </select>
      ),
    },
    {
      label: "Did you drink caffeine after 6PM?",
      input: (
        <input
          type="checkbox"
          className="mr-2"
          checked={assistantData.caffeineAfter6pm}
          onChange={(e) =>
            setAssistantData({ ...assistantData, caffeineAfter6pm: e.target.checked })
          }
        />
      ),
    },
    {
      label: "How often do you exercise weekly?",
      input: (
        <select
          className="bg-card px-4 py-2 rounded w-full"
          value={assistantData.exerciseFrequency}
          onChange={(e) =>
            setAssistantData({ ...assistantData, exerciseFrequency: e.target.value })
          }
        >
          <option value="">Select</option>
          <option>Never</option>
          <option>1–2 times</option>
          <option>3–5 times</option>
          <option>Daily</option>
        </select>
      ),
    },
    {
      label: "How stressed have you felt this week?",
      input: (
        <select
          className="bg-card px-4 py-2 rounded w-full"
          value={assistantData.stressLevel}
          onChange={(e) =>
            setAssistantData({ ...assistantData, stressLevel: e.target.value })
          }
        >
          <option value="">Select</option>
          <option>Low</option>
          <option>Moderate</option>
          <option>High</option>
        </select>
      ),
    },
  ];

  // Save “actual sleep” modal
  const saveSleepRecord = () => {
    if (!actualSleepTime || !wakeEstimateTime) return;
    const history = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    history.push({
      date: new Date().toISOString().split("T")[0],
      slept: actualSleepTime,
      woke: wakeEstimateTime,
    });
    localStorage.setItem("actualSleepHistory", JSON.stringify(history));
    localStorage.setItem("confirmedSleepEntry", "yes");
    setShowSleepConfirmation(false);
  };

  const skipSleepInput = () => {
    localStorage.setItem("confirmedSleepEntry", "yes");
    setShowSleepConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-background text-text p-6 pb-24">
      {!showAssistant && (
        <>
          <button onClick={goBack} className="text-primary mb-4">
            {"< Back"}
          </button>

          <h2 className="text-xl font-bold mb-4">
            When do you want to {mode === "wake" ? "wake up" : "sleep"}?
          </h2>

          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setMode("wake")}
              className={`px-4 py-2 rounded-lg font-semibold ${
                mode === "wake" ? "bg-primary text-black" : "bg-card text-white"
              }`}
            >
              Wake Up Time
            </button>
            <button
              onClick={() => setMode("bed")}
              className={`px-4 py-2 rounded-lg font-semibold ${
                mode === "bed" ? "bg-primary text-black" : "bg-card text-white"
              }`}
            >
              Bed Time
            </button>
          </div>

          <div className="mb-4 flex gap-2 items-center">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="bg-card text-white px-4 py-2 rounded"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span className="text-white">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="bg-card text-white px-4 py-2 rounded"
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={amPm}
              onChange={(e) => setAmPm(e.target.value)}
              className="bg-card text-white px-4 py-2 rounded"
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2">Desired sleep duration (hours):</label>
            <input
              type="number"
              value={sleepDuration}
              onChange={(e) => setSleepDuration(Number(e.target.value))}
              className="bg-card text-white px-4 py-2 rounded w-full"
              min="1"
              max="12"
            />
          </div>

          <button
            onClick={() => {
              calculateTimes();
              setShowResults(true);
            }}
            className="bg-primary text-black font-semibold px-6 py-2 rounded-lg mb-6"
          >
            {mode === "wake" ? "Calculate Wake Time" : "Calculate Bed Time"}
          </button>

          <div>
            <p className="font-semibold mb-2">Want personalized help? 🤖</p>
            <button
              onClick={() => setShowAssistant(true)}
              className="text-sm underline text-accent"
            >
              Activate Smart Assistant
            </button>
          </div>

          {showResults && results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">
                Recommended {mode === "wake" ? "BedTimes" : "Wake Times"}:
              </h3>
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-sm bg-muted px-4 py-2 my-2 rounded"
                >
                  <span>
                    {r.label.toLowerCase()} ({r.cycles} Sleep Cycle
                    {r.cycles > 1 ? "s" : ""})
                  </span>
                  <button
                    onClick={() => handleSelectTime(r)}
                    className="bg-primary text-black px-3 py-1 rounded text-xs font-semibold"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* First confirmation: keep label, then ask to set alarm now */}
      {selectedTime && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-5/6 max-w-md">
            <h2 className="text-lg font-bold mb-4 text-white">Confirm Selection</h2>
            <p className="mb-4 text-white">
              Are you sure you want to {mode === "wake" ? "sleep" : "wake up"} at{" "}
              <strong>{selectedTime.label}</strong>?
            </p>
            <div className="flex justify-end gap-4">
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded"
                onClick={() => setSelectedTime(null)}
              >
                Cancel
              </button>
              <button
                className="bg-green-500 text-black px-4 py-2 rounded font-semibold"
                onClick={() => {
                  const label = selectedTime?.label; // keep before clearing
                  setPendingSetAlarmLabel(label);
                  setSelectedTime(null);
                  setShowSetAlarmPrompt(true);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Second confirmation: set alarm now? */}
      {showSetAlarmPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-5/6 max-w-md text-white">
            <h2 className="text-lg font-bold mb-4">Set Alarm Now?</h2>
            <p className="mb-4">
              Do you want to set the alarm right now for{" "}
              <strong>{(pendingSetAlarmLabel || "").toUpperCase()}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-600 px-4 py-2 rounded"
                onClick={() => setShowSetAlarmPrompt(false)}
              >
                No
              </button>
              <button
                className="bg-gray-500 px-4 py-2 rounded"
                onClick={() => setShowSetAlarmPrompt(false)}
              >
                Skip
              </button>
              <button
                className="bg-green-500 text-black px-4 py-2 rounded font-semibold"
                onClick={async () => {
                  try {
                    if (Capacitor.getPlatform() !== "android") {
                      alert("Alarms ring on Android devices. Saved time only.");
                      setShowSetAlarmPrompt(false);
                      return;
                    }
                    const parsed = parse12h(pendingSetAlarmLabel);
                    if (!parsed) throw new Error("Could not parse time string.");

                    // 1) Save to the shared list so Alarm tab shows it
                    const when = addAlarmToStorage(parsed.h24, parsed.m);

                    // 2) Soft request notification permission
                    await ensureNotificationPermissionSoft();

                    // 3) Schedule native alarm
                    await scheduleNativeAlarm(parsed.h24, parsed.m);

                    alert(
                      `Alarm scheduled for ${when.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })} on ${when.toDateString()}.`
                    );

                    // 4) Jump to Alarm tab if parent passed navigateTo
                    if (typeof navigateTo === "function") navigateTo("Alarm");
                  } catch (e) {
                    alert(`Failed to schedule alarm:\n${e?.message ?? String(e)}`);
                    console.error(e);
                  } finally {
                    setShowSetAlarmPrompt(false);
                  }
                }}
              >
                Yes, Set Alarm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily “did you sleep at recommended time?” dialog */}
      {showSleepConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg w-full max-w-md text-white">
            <h2 className="text-lg font-bold mb-2">Did you sleep at the recommended time?</h2>
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => setShowSleepConfirmation(false)}
                className="bg-green-500 px-4 py-2 rounded text-black font-semibold"
              >
                Yes
              </button>
              <button
                onClick={() => setShowSleepConfirmation("input")}
                className="bg-red-500 px-4 py-2 rounded text-black font-semibold"
              >
                No
              </button>
              <button onClick={skipSleepInput} className="border border-white px-4 py-2 rounded">
                Skip
              </button>
            </div>

            {showSleepConfirmation === "input" && (
              <div className="mt-4">
                <label className="block mb-2">What time did you actually sleep?</label>
                <input
                  type="time"
                  value={actualSleepTime}
                  onChange={(e) => setActualSleepTime(e.target.value)}
                  className="bg-background text-white w-full px-4 py-2 rounded mb-4"
                />
                <label className="block mb-2">Estimated time you woke up</label>
                <input
                  type="time"
                  value={wakeEstimateTime}
                  onChange={(e) => setWakeEstimateTime(e.target.value)}
                  className="bg-background text-white w-full px-4 py-2 rounded mb-4"
                />
                <button
                  onClick={saveSleepRecord}
                  className="bg-primary px-4 py-2 rounded text-black font-semibold w-full"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Assistant panel (keep your existing sendToGPT if you need it) */}
      {showAssistant && (
        <div className="mt-6 border-t border-gray-600 pt-4">
          <h3 className="text-lg font-semibold mb-4">Smart AI Assistant</h3>

          <div className="w-full bg-gray-700 h-2 rounded mb-4">
            <div
              className="h-2 bg-primary rounded"
              style={{
                width: `${((assistantStep + 1) / assistantQuestions.length) * 100}%`,
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={assistantStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h4 className="text-base font-bold mb-2">
                {assistantQuestions[assistantStep].label}
              </h4>
              <div className="mb-6">{assistantQuestions[assistantStep].input}</div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between items-center">
            {assistantStep > 0 ? (
              <button
                onClick={() => setAssistantStep((prev) => prev - 1)}
                className="text-primary"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {assistantStep < assistantQuestions.length - 1 ? (
              <button
                onClick={() => setAssistantStep((prev) => prev + 1)}
                className="bg-primary text-black px-4 py-2 rounded font-semibold"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => {
                  // your existing sendToGPT implementation here
                  // (left out to avoid shipping secrets in source)
                  alert("Connect your AI call in sendToGPT() to use recommendations.");
                }}
                className="bg-green-500 text-black px-4 py-2 rounded font-semibold"
              >
                Get Smart Recommendation
              </button>
            )}
          </div>
        </div>
      )}

      {aiResult && (
        <div className="mt-6 bg-card p-4 rounded-lg">
          <h4 className="font-semibold mb-2">AI Recommendation:</h4>
          <p className="text-sm text-white mb-4">{aiResult}</p>

          {showApplyButton && (
            <button
              className="bg-primary text-black px-4 py-2 rounded font-semibold"
              onClick={() => {
                setShowConfirmApplyDialog(true);
                setShowAssistant(false);
                setShowResults(true);
                setShowApplyButton(false);
              }}
            >
              Apply Recommendation
            </button>
          )}
        </div>
      )}

      {showConfirmApplyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-5/6 max-w-md">
            <h2 className="text-lg font-bold mb-4 text-white">Confirm Apply</h2>
            <p className="mb-4 text-white">
              This will update your bed/wake time and calculate new recommendations. Proceed?
            </p>
            <div className="flex justify-end gap-4">
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded"
                onClick={() => setShowConfirmApplyDialog(false)}
              >
                Cancel
              </button>
              <button
                className="bg-green-500 text-black px-4 py-2 rounded font-semibold"
                onClick={() => {
                  if (pendingAIRecommendation) {
                    storeAIRecommendation(
                      pendingAIRecommendation.bedtime,
                      pendingAIRecommendation.wakeTime
                    );
                  }
                  calculateTimes();
                  setShowConfirmApplyDialog(false);
                  setShowResults(true);
                }}
              >
                Yes, Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SleepCalculatorScreen;
