// src/components/LoginScreen.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const strengthRules = [
  { label: "8+ chars", test: (s) => s.length >= 8 },
  { label: "Number", test: (s) => /\d/.test(s) },
  { label: "Letter", test: (s) => /[A-Za-z]/.test(s) },
];

export function LoginScreen({ onLogin, goToSignup }) {
  const [form, setForm] = useState({ name: "", age: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("loginRemember") || "{}");
    if (saved?.email || saved?.name) setForm((f) => ({ ...f, ...saved }));
  }, []);

  useEffect(() => {
    if (remember) {
      const toSave = { name: form.name, email: form.email };
      localStorage.setItem("loginRemember", JSON.stringify(toSave));
    } else {
      localStorage.removeItem("loginRemember");
    }
  }, [remember, form.name, form.email]);

  const errors = useMemo(() => {
    const e = {};
    if (!form.name?.trim()) e.name = "What's your name?";
    const ageNum = Number(form.age);
    if (!form.age) e.age = "Age is required.";
    else if (Number.isNaN(ageNum)) e.age = "Age must be a number.";
    else if (ageNum < 13) e.age = "Must be 13+.";
    else if (ageNum > 100) e.age = "That seems unlikely. 😉";

    if (!form.email) e.email = "Email is required.";
    else if (!emailRe.test(form.email)) e.email = "Enter a valid email.";

    if (!form.password) e.password = "Password is required.";
    else {
      const missing = strengthRules.filter((r) => !r.test(form.password));
      if (missing.length) e.password = `Needs: ${missing.map((m) => m.label).join(", ")}`;
    }
    return e;
  }, [form]);

  const pwStrength = useMemo(
    () => strengthRules.reduce((acc, r) => acc + (r.test(form.password) ? 1 : 0), 0),
    [form.password]
  );

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const markTouched = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async () => {
    if (!canSubmit) {
      setTouched({ name: true, age: true, email: true, password: true });
      return;
    }
    try {
      setSubmitting(true);
      await onLogin(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-b from-black to-zinc-900 text-white">
      <img
        src="https://source.unsplash.com/1600x900/?sleep,night"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none select-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-[92%] max-w-md"
      >
        <div className="backdrop-blur-md bg-zinc-800/70 border border-zinc-700 rounded-2xl shadow-2xl p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-bold">Welcome back 👋</h1>
            <p className="text-sm text-zinc-300">
              Let’s get you sleeping better and moving smarter.
            </p>
          </div>

          {/* Name */}
          <div className="mb-3">
            <label className="block mb-1 text-sm">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={setField("name")}
              onBlur={markTouched("name")}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
              placeholder="Onkar"
              autoComplete="name"
            />
            {touched.name && errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Age */}
          <div className="mb-3">
            <label className="block mb-1 text-sm">Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              value={form.age}
              onChange={setField("age")}
              onBlur={markTouched("age")}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
              placeholder="24"
            />
            {touched.age && errors.age && (
              <p className="mt-1 text-sm text-red-400">{errors.age}</p>
            )}
          </div>

          {/* Email */}
          <div className="mb-3">
            <label className="block mb-1 text-sm">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={setField("email")}
              onBlur={markTouched("email")}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
              placeholder="email@example.com"
              autoComplete="email"
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-sm text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block mb-1 text-sm">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={setField("password")}
                onBlur={markTouched("password")}
                className="w-full px-4 py-2.5 pr-12 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white text-sm px-2 py-1"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Strength meter */}
          <div className="mb-4">
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${pwStrength >= 3 ? "bg-emerald-400" : pwStrength === 2 ? "bg-yellow-400" : "bg-red-400"}`}
                style={{ width: `${(pwStrength / strengthRules.length) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Stronger passwords sleep better at night.
            </p>
          </div>

          {/* Options */}
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-emerald-400"
              />
              Remember me
            </label>
            <button type="button" className="text-sm text-zinc-300 hover:text-white">
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`w-full py-2.5 rounded-xl font-semibold transition
              ${canSubmit ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-zinc-700 text-zinc-400 cursor-not-allowed"}`}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-[1px] bg-zinc-700 flex-1" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="h-[1px] bg-zinc-700 flex-1" />
          </div>

          {/* Social placeholders */}
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-zinc-900 border border-zinc-700 rounded-xl py-2 text-sm hover:bg-zinc-800">
              Continue with Google
            </button>
            <button className="bg-zinc-900 border border-zinc-700 rounded-xl py-2 text-sm hover:bg-zinc-800">
              Continue with Apple
            </button>
          </div>

          {/* Guest */}
          <button
            onClick={() => {
              // ensure guest isn't polluted by remembered name/email
              localStorage.removeItem("loginRemember");
              onLogin({ name: "Guest", email: null, guest: true });
            }}
            className="mt-4 w-full py-2 text-sm text-zinc-300 hover:text-white"
          >
            Continue as guest
          </button>


          {/* Create account link */}
          {typeof goToSignup === "function" && (
            <div className="text-center mt-4 text-sm text-zinc-300">
              Don’t have an account?{" "}
              <button className="underline hover:text-white" onClick={goToSignup}>
                Create one
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-3">
          By signing in you agree to our Terms & Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}

export default LoginScreen;
