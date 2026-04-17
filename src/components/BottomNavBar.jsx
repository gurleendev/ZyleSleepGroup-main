// src/components/BottomNavBar.jsx
export function BottomNavBar({ currentTab, setTab }) {
  const tabs = [
    { label: "Home",      icon: "🏠" },
    { label: "Hydration", icon: "💧" },
    { label: "Activity",  icon: "📊" },
    { label: "Alarm",     icon: "⏰" },
  ];

  // Bar height (without safe-area). Keep in sync with your page bottom padding.
  const BAR_HEIGHT = 64; // px

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0
        bg-card/90 backdrop-blur-md
        border-t border-white/10
        shadow-[0_-6px_20px_rgba(0,0,0,0.35)]
        z-[99999]  /* <- sits above any page content */
        select-none
      "
      style={{
        height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex justify-around items-stretch h-full">
        {tabs.map(({ label, icon }) => {
          const active = currentTab === label;
          return (
            <li key={label} className="flex-1">
              <button
                type="button"
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(label)}
                className={`
                  w-full h-full
                  flex flex-col items-center justify-center gap-1
                  text-xs
                  ${active ? "text-primary" : "text-white/80 hover:text-white"}
                  transition-colors
                `}
                style={{ minHeight: 56 }} // generous touch target
              >
                <span className="text-2xl leading-none">{icon}</span>
                <span className="leading-none">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
