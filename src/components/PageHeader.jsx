import React from "react";

/**
 * Compact, sticky, safe-area-aware header.
 *
 * Props:
 * - title: string | ReactNode
 * - subtitle?: string
 * - onBack?: () => void
 * - user?: object | null
 * - onLogin?: () => void
 * - onLogout?: () => void
 * - right?: ReactNode
 * - compact?: boolean
 */
export default function PageHeader({
  title,
  subtitle,
  onBack,
  user,
  onLogin,
  onLogout,
  right,
  compact = true,
}) {
  const authBtn = !right && (
    user ? (
      <button
        onClick={onLogout}
        className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 shadow"
      >
        Logout
      </button>
    ) : (
      <button
        onClick={onLogin}
        className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 shadow"
      >
        Login
      </button>
    )
  );

  return (
    <div
      className="sticky z-[1000]"
      style={{ top: "calc(env(safe-area-inset-top) + 6px)" }}
    >
      <div
        className={`
          mx-4 rounded-2xl border border-white/10
          bg-zinc-900/70 backdrop-blur
          shadow-[0_8px_28px_rgba(0,0,0,0.4)]
          flex items-center gap-3
          ${compact ? "px-4 py-2.5" : "px-5 py-3.5"}
        `}
      >
        {/* Left: Back (optional) */}
        <div className="w-[72px]">
          {onBack && (
            <button
              onClick={onBack}
              className="px-2 py-1.5 text-sm rounded-lg text-emerald-400 hover:bg-zinc-800"
              aria-label="Back"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Center: Title + optional subtitle */}
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-lg sm:text-xl font-semibold truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-300 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: custom or auth */}
        <div className="w-[72px] flex justify-end">{right || authBtn}</div>
      </div>
    </div>
  );
}
