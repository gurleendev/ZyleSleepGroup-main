import { useState, useEffect } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import SignupScreen from "./components/SignupScreen";
import { HomeScreen } from "./components/HomeScreen";
import { HydrationScreen } from "./components/HydrationScreen";
import { ActivityScreen } from "./components/ActivityScreen";
import { SleepCalculatorScreen } from "./components/SleepCalculatorScreen";
import AlarmScreen from "./components/AlarmScreen.jsx";
import { SleepReportScreen } from "./components/SleepReportScreen.jsx";
import { BottomNavBar } from "./components/BottomNavBar";
import SmartAssistantScreen from "./components/SmartAssistantScreen";
import { LocalNotifications } from "@capacitor/local-notifications";

export default function App() {
  // ✅ auto-login seed
  const savedUser = localStorage.getItem("user");
  const [user, setUser] = useState(() => (savedUser ? JSON.parse(savedUser) : null));
  const [step, setStep] = useState(() => (savedUser ? 2 : 0)); // jump to app if user exists
  const [tab, setTab] = useState("Home");
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
  }, [user]);

  const goToLogin = () => {
    setAuthMode("login");
    setStep(1);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setStep(2);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setAuthMode("login");
    setStep(1);
  };

  const goBackToTabs = () => setTab("Home");

  const renderTab = () => {
    switch (tab) {
      case "Home":
        return (
          <HomeScreen
            user={user}
            navigateTo={setTab}
            onLogin={() => { setAuthMode("login"); setStep(1); }}
            onLogout={handleLogout}
          />
        );

      case "Hydration":
        return <HydrationScreen goBack={goBackToTabs} />;

      case "Activity":
        return (
          <ActivityScreen
            user={user}
            onLogin={() => { setAuthMode("login"); setStep(1); }}
            onLogout={handleLogout}
            goBack={goBackToTabs}
            openAssistant={() => setTab("Assistant")}
          />
        );

      case "Assistant":
        return <SmartAssistantScreen goBack={() => setTab("Activity")} />;

      case "Calculator":
        return <SleepCalculatorScreen goBack={goBackToTabs} />;

      // case "SleepReport":
      //   return <SleepReportScreen goBack={goBackToTabs} />;

      case "Alarm":
        return <AlarmScreen goBack={goBackToTabs} />;

      default:
        return (
          <HomeScreen
            user={user}
            navigateTo={setTab}
            onLogin={() => { setAuthMode("login"); setStep(1); }}
            onLogout={handleLogout}
          />
        );
    }
  };

  // Keep in sync with BottomNavBar's HEIGHT (64px)
  const BOTTOM_BAR_PADDING = "calc(64px + env(safe-area-inset-bottom))";

  return (
    <>
      {step === 0 && <WelcomeScreen onNext={goToLogin} />}

      {step === 1 && authMode === "login" && (
        <LoginScreen
          onLogin={handleLogin}
          goToSignup={() => setAuthMode("signup")}
        />
      )}

      {step === 1 && authMode === "signup" && (
        <SignupScreen
          onSignup={(data) => {
            // (optional) store a mock registry
            const users = JSON.parse(localStorage.getItem("zyle_users") || "[]");
            users.push({ ...data, createdAt: Date.now() });
            localStorage.setItem("zyle_users", JSON.stringify(users));

            // Prefill email on login
            localStorage.setItem(
              "loginRemember",
              JSON.stringify({ email: data.email })
            );

            // Return to login (not auto-login)
            setAuthMode("login");
            setStep(1);
          }}
          goToLogin={() => {
            setAuthMode("login");
            setStep(1);
          }}
        />
      )}

      {step === 2 && (
        <>
          {/* ✅ Top safe-area padding + bottom padding for nav bar */}
          <div
            className="min-h-screen"
            style={{
              paddingTop: "calc(env(safe-area-inset-top) + 8px)",
              paddingBottom: tab !== "Assistant" ? BOTTOM_BAR_PADDING : 0,
            }}
          >
            {renderTab()}
          </div>

          {/* Hide bottom nav on Assistant page */}
          {tab !== "Assistant" && (
            <BottomNavBar currentTab={tab} setTab={setTab} />
          )}
        </>
      )}
    </>
  );
}

// Helper kept here; imports are at the top
export async function ensureNotificationPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}
