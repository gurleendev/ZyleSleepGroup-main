import React from "react";
import PageHeader from "./PageHeader";

export function HomeScreen({ user, navigateTo, onLogin, onLogout }) {
  const cardClass =
    "relative h-44 sm:h-48 md:h-52 rounded-xl overflow-hidden shadow-md";

  const cards = [
    { label: "Set Alarm", image: "/images/alarm.jpg", tab: "Alarm" },
    { label: "Hydration", image: "/images/hydration.jpg", tab: "Hydration" },
    { label: "More Soon", image: "/images/startSleep.jpg", tab: "" },
  ];

  const displayName = user?.guest ? "Guest" : user?.name?.split(" ")[0] || "User";

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-screen-md pb-4">
        {/* ✅ Sticky header that doesn't move on scroll */}
        <PageHeader
          title={
            <>
              Hey, <span className="text-emerald-400">{displayName}</span>
            </>
          }
          subtitle="let’s have a good sleep 😴"
          user={user}
          onLogin={onLogin}
          onLogout={onLogout}
          compact={false}
          right={
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 shadow"
            >
              Logout
            </button>
          }
        />

        {/* Start Sleep full-width card */}
        <div className="mx-4 mt-4 relative h-64 sm:h-72 md:h-80 rounded-xl overflow-hidden shadow-lg">
          <img
            src="/images/Sleep2.jpg"
            alt="Start Sleep"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col justify-between p-4">
            <p className="text-lg font-semibold">Start Sleep</p>
            <button
              onClick={() => {
                localStorage.removeItem("confirmedSleepEntry");
                navigateTo("Calculator");
              }}
              className="bg-emerald-400 text-black px-4 py-2 rounded text-sm font-bold w-fit"
            >
              Start
            </button>
          </div>
        </div>

        {/* 2x2 Card Grid */}
        <div className="mx-4 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {cards.map((card) => (
            <div key={card.label} className={cardClass}>
              <img
                src={card.image}
                alt={card.label}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-black/40 flex flex-col justify-between p-3">
                <p className="font-medium">{card.label}</p>
                {card.tab && (
                  <button
                    onClick={() => navigateTo(card.tab)}
                    className="bg-emerald-400 text-black px-3 py-1 rounded text-sm font-semibold w-fit"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
