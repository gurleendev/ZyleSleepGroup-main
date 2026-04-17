import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Logo from "./Logo";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const rules = [
  { label: "8+ chars", test: (s) => s.length >= 8 },
  { label: "Number",   test: (s) => /\d/.test(s) },
  { label: "Letter",   test: (s) => /[A-Za-z]/.test(s) },
];

export function LoginScreen({ onLogin, goToSignup }) {
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("loginRemember") || "{}");
    if (saved?.email) setForm((f) => ({ ...f, email: saved.email }));
  }, []);

  useEffect(() => {
    if (form.remember) {
      localStorage.setItem("loginRemember", JSON.stringify({ email: form.email }));
    } else {
      localStorage.removeItem("loginRemember");
    }
  }, [form.remember, form.email]);

  const errors = useMemo(() => {
    const e = {};
    if (!form.email) e.email = "Email is required.";
    else if (!emailRe.test(form.email)) e.email = "Enter a valid email.";
    if (!form.password) e.password = "Password is required.";
    return e;
  }, [form]);

  const pwScore = rules.reduce((a, r) => a + (r.test(form.password) ? 1 : 0), 0);
  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) {
      setTouched({ email: true, password: true });
      return;
    }
    setSubmitting(true);
    try {
      await onLogin({ email: form.email.trim(), password: form.password });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black to-zinc-900 text-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-[92%] max-w-md"
      >
        <div className="backdrop-blur-md bg-zinc-800/70 border border-zinc-700 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Logo size={40} />
            <div>
              <h1 className="text-2xl font-bold leading-tight">ZyleSleep</h1>
              <p className="text-xs text-zinc-300">Better sleep, smarter days.</p>
            </div>
          </div>

          <div className="mb-3">
            <label className="block mb-1 text-sm">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
              placeholder="email@example.com"
              autoComplete="email"
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-sm text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="mb-2">
            <label className="block mb-1 text-sm">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="w-full px-4 py-2.5 pr-12 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-emerald-400 outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white text-sm px-2 py-1"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password}</p>
            )}
          </div>

          {/* strength meter (nice hint even for login) */}
          <div className="mb-4">
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${pwScore >= 3 ? "bg-emerald-400" : pwScore === 2 ? "bg-yellow-400" : "bg-red-400"}`}
                style={{ width: `${(pwScore / rules.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                className="accent-emerald-400"
              />
              Remember me
            </label>
            <button type="button" className="text-sm text-zinc-300 hover:text-white">
              Forgot password?
            </button>
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`w-full py-2.5 rounded-xl font-semibold transition
              ${canSubmit ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-zinc-700 text-zinc-400 cursor-not-allowed"}`}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center mt-4 text-sm text-zinc-300">
            Don’t have an account?{" "}
            <button className="underline hover:text-white" onClick={goToSignup}>
              Create one
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default LoginScreen;
