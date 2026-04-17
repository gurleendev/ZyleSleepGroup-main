import { useEffect, useMemo, useState } from "react";

/** @typedef {{ ts: number, liters: number }} Intake */

const STORAGE_KEYS = {
  glasses: "hydration_glasses",
  unit: "hydration_unit",
  input: "hydration_input",
  date: "hydration_date",
  goal: "hydration_goal_liters",
  cap: "hydration_cap_liters",
  log: "hydration_intake_log", // JSON of Intake[]
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function HydrationScreen({ goBack }) {
  // --- user-adjustables (persisted) ---
  const [unit, setUnit] = useState("liters");     // "liters" | "ml" | "oz"
  const [inputValue, setInputValue] = useState(0.25);
  const [dailyGoal, setDailyGoal] = useState(2);
  const [dailyCap, setDailyCap] = useState(4);

  // --- counters / state ---
  const [glasses, setGlasses] = useState(0);
  /** @type {[Intake[], Function]} */
  const [intakeLog, setIntakeLog] = useState([]);
  const [banner, setBanner] = useState("");

  // --- constants / UX guards ---
  const HOURLY_LIMIT_L = 0.8;
  const MIN_PER_GLASS_L = 0.03;
  const MAX_PER_GLASS_L = 1.0;

  // --- helpers ---
  const toLiters = (value, u) =>
    u === "ml" ? value / 1000 : u === "oz" ? value * 0.0295735 : value;

  const fromLiters = (liters, u) =>
    u === "ml" ? liters * 1000 : u === "oz" ? liters / 0.0295735 : liters;

  const litersPerGlassRaw = toLiters(Number(inputValue) || 0, unit);
  const litersPerGlass = useMemo(
    () => Math.min(Math.max(litersPerGlassRaw, MIN_PER_GLASS_L), MAX_PER_GLASS_L),
    [litersPerGlassRaw]
  );

  // --- derived totals ---
  const totalLitersNum = useMemo(
    () => intakeLog.reduce((sum, it) => sum + it.liters, 0),
    [intakeLog]
  );
  const totalLitersLabel = totalLitersNum.toFixed(2);
  const progressPercent = Math.min((totalLitersNum / dailyGoal) * 100, 100);
  const goalLeft = Math.max(0, dailyGoal - totalLitersNum);
  const capLeft = Math.max(0, dailyCap - totalLitersNum);

  // hourly window stats (for sidebar + add check)
  const nowMs = Date.now();
  const hourAgo = nowMs - 60 * 60 * 1000;
  const lastHourSum = intakeLog
    .filter((it) => it.ts >= hourAgo)
    .reduce((s, it) => s + it.liters, 0);
  const hourlyLeft = Math.max(0, HOURLY_LIMIT_L - lastHourSum);

  // --- load on mount ---
  useEffect(() => {
    const savedDate = localStorage.getItem(STORAGE_KEYS.date);
    const today = todayStr();

    const savedUnit = localStorage.getItem(STORAGE_KEYS.unit) || "liters";
    const savedInput = parseFloat(localStorage.getItem(STORAGE_KEYS.input) || "0.25");
    const savedGoal  = parseFloat(localStorage.getItem(STORAGE_KEYS.goal) || "2");
    const savedCap   = parseFloat(localStorage.getItem(STORAGE_KEYS.cap) || "4");

    setUnit(savedUnit);
    setInputValue(isFinite(savedInput) ? savedInput : 0.25);
    setDailyGoal(isFinite(savedGoal) ? savedGoal : 2);
    setDailyCap(isFinite(savedCap) ? savedCap : 4);

    if (savedDate === today) {
      try {
        const logJson = localStorage.getItem(STORAGE_KEYS.log);
        const parsed = logJson ? JSON.parse(logJson) : [];
        setIntakeLog(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
        const savedGlasses = parseInt(localStorage.getItem(STORAGE_KEYS.glasses) || "0", 10);
        setGlasses(isFinite(savedGlasses) ? savedGlasses : parsed.length);
      } catch {
        setIntakeLog([]);
        setGlasses(0);
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.date, today);
      setIntakeLog([]);
      setGlasses(0);
    }
  }, []);

  // --- persist on change ---
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.unit, unit); }, [unit]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.input, String(inputValue || 0)); }, [inputValue]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.goal,  String(dailyGoal || 2)); }, [dailyGoal]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.cap,   String(dailyCap || 4));  }, [dailyCap]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.glasses, String(glasses)); }, [glasses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.log, JSON.stringify(intakeLog)); }, [intakeLog]);

  // --- midnight rollover ---
  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem(STORAGE_KEYS.date);
      const now = todayStr();
      if (stored !== now) {
        localStorage.setItem(STORAGE_KEYS.date, now);
        setIntakeLog([]);
        setGlasses(0);
        setBanner("New day — hydration reset.");
        setTimeout(() => setBanner(""), 3000);
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // --- rules & handlers ---
  function withinHourlyLimit(nextLiters) {
    return lastHourSum + nextLiters <= HOURLY_LIMIT_L + 1e-9;
  }

  function handleAddGlass() {
    setBanner("");
    const glassL = litersPerGlass;

    if (!isFinite(glassL) || glassL <= 0) {
      setBanner("Please enter a valid amount (> 0).");
      return;
    }
    if (glassL !== litersPerGlassRaw) {
      setBanner(`Per-glass adjusted to ${litersPerGlass.toFixed(2)} L (min 0.03 L, max 1.00 L).`);
    }
    if (totalLitersNum + glassL > dailyCap + 1e-9) {
      setBanner(`Daily cap reached: ${totalLitersLabel}/${dailyCap.toFixed(2)} L.`);
      return;
    }
    if (!withinHourlyLimit(glassL)) {
      setBanner(`Pace check: limit is ${HOURLY_LIMIT_L.toFixed(2)} L per hour. Try later.`);
      return;
    }

    const now = Date.now();
    setIntakeLog((log) => [...log, { ts: now, liters: glassL }]);
    setGlasses((g) => g + 1);

    if (totalLitersNum < dailyGoal && totalLitersNum + glassL >= dailyGoal) {
      setBanner(`Nice! You reached your goal of ${dailyGoal.toFixed(2)} L today.`);
      setTimeout(() => setBanner(""), 4000);
    }
  }

  function handleUndo() {
    if (!intakeLog.length) return;
    setIntakeLog(intakeLog.slice(0, -1));
    setGlasses((g) => Math.max(0, g - 1));
  }

  function handleReset() {
    setIntakeLog([]);
    setGlasses(0);
    setBanner("Hydration cleared for today.");
    setTimeout(() => setBanner(""), 2500);
  }

  // --- convenience readouts for sidebar ---
  const last = intakeLog[intakeLog.length - 1];
  const lastWhen =
    last ? `${Math.max(0, Math.floor((Date.now() - last.ts) / 60000))} min ago` : "—";
  const canDrinkNow = hourlyLeft >= litersPerGlass - 1e-9;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* subtle radial glow to kill empty feel on wide screens */}
      <div className="pointer-events-none fixed inset-0 opacity-40"
           style={{ background:
             "radial-gradient(600px 300px at 20% 10%, rgba(59,130,246,0.10), transparent), radial-gradient(600px 300px at 80% 90%, rgba(34,197,94,0.08), transparent)" }} />

      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 md:px-8 py-6 relative">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold">Hydration Tracker 💧</h2>
          <div className="text-xs opacity-0">.</div>
        </div>
        <p className="mb-4 text-center opacity-80">Smart limits • Daily reset • Gentle nudges</p>

        {banner && (
          <div className="mb-4 w-full bg-blue-900/40 border border-blue-500/50 text-blue-200 px-4 py-2 rounded-lg">
            {banner}
          </div>
        )}

        {/* 2-col on sm+; single on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          {/* LEFT: main controller card */}
          <div className="bg-gray-800/90 backdrop-blur p-6 rounded-2xl w-full text-center shadow-lg space-y-5">
            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <label className="block mb-1 text-xs uppercase tracking-wide text-gray-400">
                  Daily goal (L)
                </label>
                <input
                  type="number" min={0.5} max={6} step={0.1}
                  value={dailyGoal}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setDailyGoal(isFinite(v) ? Math.min(Math.max(v, 0.5), 6) : 2);
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs uppercase tracking-wide text-gray-400">
                  Daily cap (L)
                </label>
                <input
                  type="number" min={1} max={6} step={0.1}
                  value={dailyCap}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const next = isFinite(v) ? Math.min(Math.max(v, 1), 6) : 4;
                    setDailyCap(Math.max(next, dailyGoal));
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"
                />
              </div>
            </div>

            {/* Per-glass amount */}
            <div className="text-left">
              <label className="block mb-1 text-xs uppercase tracking-wide text-gray-400">
                Amount per glass
              </label>
              <div className="flex gap-2">
                <input
                  type="number" step="0.01" min="0.01"
                  value={inputValue}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    setInputValue(isFinite(raw) ? raw : 0);
                  }}
                  className="w-28 px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-gray-700 text-white px-2 py-1 rounded border border-gray-600"
                >
                  <option value="liters">L</option>
                  <option value="ml">ml</option>
                  <option value="oz">oz</option>
                </select>
                <div className="text-xs text-gray-400 self-center">
                  ≈ {fromLiters(litersPerGlass, unit).toFixed(0)} {unit}
                </div>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Per-glass bounds: 30 ml to 1,000 ml (auto-clamped)
              </div>
            </div>

            {/* Totals */}
            <div>
              <p className="text-5xl font-bold text-blue-400">{glasses}</p>
              <p className="mb-1">Glasses of water</p>
              <p className="text-sm text-gray-300">
                That’s <span className="text-blue-300 font-semibold">{totalLitersLabel} L</span> today
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Goal left: {goalLeft.toFixed(2)} L • Cap left: {capLeft.toFixed(2)} L
              </p>
            </div>

            {/* Progress */}
            <div>
              <div className="w-full bg-gray-700 h-4 rounded mb-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-gray-400">
                Progress: {progressPercent.toFixed(0)}% of {dailyGoal.toFixed(2)} L goal
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={handleAddGlass}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded font-semibold"
              >
                +1 Glass
              </button>
              <button
                onClick={handleUndo}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold"
              >
                Undo
              </button>
              <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
              >
                Reset Today
              </button>
            </div>

            <p className="text-[11px] text-gray-500 pt-2">
              This app provides general guidance and pacing limits only.
            </p>
          </div>

          {/* RIGHT: compact summary / recent log */}
          <aside className="bg-gray-850 bg-gray-800/70 backdrop-blur p-5 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-lg font-semibold">Today</h3>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-700/60 rounded-xl p-3">
                <div className="text-xs text-gray-300">Total</div>
                <div className="text-xl font-bold">{totalLitersLabel} L</div>
              </div>
              <div className="bg-gray-700/60 rounded-xl p-3">
                <div className="text-xs text-gray-300">Hourly left</div>
                <div className="text-xl font-bold">{hourlyLeft.toFixed(2)} L</div>
              </div>
              <div className="bg-gray-700/60 rounded-xl p-3">
                <div className="text-xs text-gray-300">Last glass</div>
                <div className="text-xl font-bold">{lastWhen}</div>
              </div>
            </div>

            <div className={`rounded-xl p-3 ${canDrinkNow ? "bg-emerald-900/30 border border-emerald-600/40" : "bg-amber-900/30 border border-amber-600/40"}`}>
              <div className="text-sm">
                {canDrinkNow
                  ? "You're clear for another glass based on the hourly pace."
                  : `Slow down: only ${hourlyLeft.toFixed(2)} L left in this hour.`}
              </div>
            </div>

            <div>
              <div className="text-sm mb-2 font-medium">Recent glasses</div>
              <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                {intakeLog.length === 0 && (
                  <li className="text-sm text-gray-400">No intake logged yet.</li>
                )}
                {intakeLog
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((it, idx) => {
                    const dt = new Date(it.ts);
                    const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <li key={idx} className="flex items-center justify-between bg-gray-700/40 rounded-lg px-3 py-2">
                        <span className="text-sm">{time}</span>
                        <span className="text-sm text-blue-300">{it.liters.toFixed(2)} L</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
