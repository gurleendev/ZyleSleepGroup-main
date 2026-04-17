
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function SleepReportScreen({goBack}) {
  const [sleepData, setSleepData] = useState([]);

  const computeSleepData = (entries) => {
    const uniqueMap = new Map();

    entries.forEach((entry) => {
      if (entry.date && entry.slept && entry.woke) {
        uniqueMap.set(entry.date, entry);
      }
    });

    return Array.from(uniqueMap.values())
      .slice(-7)
      .map((entry) => {
        try {
          const parseTime = (timeStr) => {
            const [time, meridiem] = timeStr.split(" ");
            let [h, m] = time.split(":").map(Number);
            if (meridiem?.toUpperCase() === "PM" && h !== 12) h += 12;
            if (meridiem?.toUpperCase() === "AM" && h === 12) h = 0;
            return { hour: h, minute: m };
          };
          
          const { hour: sh, minute: sm } = parseTime(entry.slept);
          const { hour: wh, minute: wm } = parseTime(entry.woke);
          
      
          const start = new Date();
          const end = new Date();
          start.setHours(sh, sm, 0, 0);
          end.setHours(wh, wm, 0, 0);
          if (end <= start) end.setDate(end.getDate() + 1);
      
          const duration = (end - start) / (1000 * 60 * 60);
          return { date: entry.date, duration: parseFloat(duration.toFixed(2)) };
        } catch (err) {
          console.error("Invalid entry:", entry);
          return null;
        }
      })      
      .filter(Boolean);
  };

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    const actualOnly = stored.filter(entry => entry.source !== "sample");
    setSleepData(computeSleepData(actualOnly));
  }, []);

  const loadSampleData = () => {
    const sample = [
      { date: "2025-03-25", slept: "11:15 PM", woke: "07:00 AM" },
      { date: "2025-03-26", slept: "10:45 PM", woke: "06:45 AM" },
      { date: "2025-03-27", slept: "12:00 AM", woke: "08:00 AM" },
      { date: "2025-03-28", slept: "11:30 PM", woke: "07:30 AM" },
      { date: "2025-03-29", slept: "11:00 PM", woke: "06:45 AM" },
      { date: "2025-03-30", slept: "10:30 PM", woke: "06:15 AM" },
      { date: "2025-03-31", slept: "12:15 AM", woke: "08:00 AM" },
    ];
  
    setSleepData(computeSleepData(sample));
  };
  
  const clearSampleData = () => {
    const existing = JSON.parse(localStorage.getItem("actualSleepHistory") || "[]");
    const filtered = existing.filter(entry => entry.source !== "sample");
    localStorage.setItem("actualSleepHistory", JSON.stringify(filtered));
    setSleepData(computeSleepData(filtered));
  };
  
  

  return (
    <div className="min-h-screen bg-background text-text p-6">
       <div className="absolute top-4 left-4">
        <button onClick={goBack} className="text-green-400 hover:underline text-sm">
          {'< Back'}
          </button>
          </div>
          <br></br>
      <h2 className="text-xl font-bold mb-4">Sleep Report (Last 7 Days)</h2>

      <div className="flex gap-4 mb-6">
        <button
          onClick={loadSampleData}
          className="bg-primary text-black px-4 py-2 rounded font-semibold"
        >
          Load Sample Data
        </button>
        <button
          onClick={clearSampleData}
          className="bg-red-500 text-white px-4 py-2 rounded font-semibold"
        >
          Clear Sample Data
        </button>
      </div>

      {sleepData.length >= 1 ? (
        <>
          <ResponsiveContainer width="100%" height={sleepData.length === 1 ? 200 : 300}>
            <BarChart
              data={sleepData}
              barSize={sleepData.length === 1 ? 60 : 30}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#ccc" />
              <YAxis unit="h" stroke="#ccc" domain={[0, 12]} />
              <Tooltip formatter={(value) => `${value} hrs`} labelStyle={{ color: "white" }} />
              <Bar dataKey="duration" fill="#00f2a9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {sleepData.length === 1 && (
            <p className="text-sm text-muted text-center mt-2">
              Showing data for one day only.
            </p>
          )
          
          }
        </>
      ) : (
        <p className="text-sm text-muted">
          No sleep data available. Try recording your sleep or load sample data.
        </p>
      )}
    </div>
  );
}
