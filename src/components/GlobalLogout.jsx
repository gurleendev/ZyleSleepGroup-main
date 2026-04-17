import { createPortal } from "react-dom";

export default function GlobalLogout({ onLogout, show = true }) {
  if (!show) return null;
  return createPortal(
    <div
      className="fixed z-[100000]"
      style={{
        top: "calc(env(safe-area-inset-top) + 12px)",
        right: "calc(env(safe-area-inset-right) + 12px)",
      }}
    >
      <button
        onClick={onLogout}
        className="bg-red-600 text-white px-3 py-1 rounded text-sm shadow"
      >
        Logout
      </button>
    </div>,
    document.body
  );
}
