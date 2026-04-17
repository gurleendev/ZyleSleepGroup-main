// src/components/AlarmScreen.jsx
import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { toLocalDateTime, format12h, getAlarms, setAlarms } from '../library/notify';
import { scheduleNativeAlarm, /* cancelNativeAlarm, */ checkAvailability } from '../capacitor/healthConnect';

const AlarmScreen = () => {
  const [hour, setHour] = useState('6');
  const [minute, setMinute] = useState('30');
  const [amPm, setAmPm] = useState('AM');
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('');

  const isAndroid = () => Capacitor.getPlatform() === 'android';

  useEffect(() => {
    setList(getAlarms());
    // ask for notification permission once
    (async () => {
      if (!isAndroid()) return;
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    })();
  }, []);

  const scheduleAlarm = async () => {
    try {
      // simple input guard
      const h = Math.max(1, Math.min(12, parseInt(hour || '0', 10)));
      const m = Math.max(0, Math.min(59, parseInt(minute || '0', 10)));

      const when = toLocalDateTime(String(h), String(m), amPm);
      if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);

      let nativeRes = null;
      if (isAndroid()) {
        console.log('[AlarmScreen] scheduling native alarm for', when.toString());
        nativeRes = await scheduleNativeAlarm(when.getHours(), when.getMinutes());
      }

      const id = Date.now();
      const next = [...list, { id, time: when.toISOString(), enabled: true }]
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      setList(next); setAlarms(next);

      const msg = `Alarm set for ${format12h(when)} (${when.toDateString()}).` +
                  (nativeRes ? ` Native: ${JSON.stringify(nativeRes)}` : '');
      console.log('[AlarmScreen] success:', msg);
      setStatus(msg);
      alert(msg);
    } catch (e) {
      console.error('[AlarmScreen] schedule failed', e);
      alert(`Schedule failed:\n${e?.message ?? JSON.stringify(e)}`);
      setStatus('Failed to schedule alarm.');
    }
  };

  const cancelAlarmItem = async (id) => {
    const next = list.filter(a => a.id !== id);
    setList(next); setAlarms(next);
    // If you later wire native cancel, call it here with your requestCode mapping.
  };

  const toggleAlarm = async (id) => {
    const next = list.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setList(next); setAlarms(next);

    // Re-schedule native if toggled ON (simple demo behavior)
    if (isAndroid() && next.find(a => a.id === id)?.enabled) {
      const when = new Date(next.find(a => a.id === id).time);
      if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
      try {
        await scheduleNativeAlarm(when.getHours(), when.getMinutes());
      } catch { /* ignore */ }
    }
  };

  const scheduleTomorrowSameTime = async (id) => {
    const old = list.find(a => a.id === id); if (!old) return;
    const when = new Date(old.time); when.setDate(when.getDate() + 1);
    try {
      if (isAndroid()) await scheduleNativeAlarm(when.getHours(), when.getMinutes());
    } catch { /* ignore */ }
    const newId = Date.now();
    const next = [...list, { id: newId, time: when.toISOString(), enabled: true }]
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    setList(next); setAlarms(next);
  };

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Set Alarm</h1>

      <div className="bg-neutral-900 rounded-2xl p-4 mb-4 grid grid-cols-3 gap-2">
        <input aria-label="Hour" className="bg-black rounded-xl p-3 text-center"
               value={hour} onChange={e=>setHour(e.target.value.replace(/[^0-9]/g,''))} placeholder="HH"/>
        <input aria-label="Minute" className="bg-black rounded-xl p-3 text-center"
               value={minute} onChange={e=>setMinute(e.target.value.replace(/[^0-9]/g,''))} placeholder="MM"/>
        <select aria-label="AM or PM" className="bg-black rounded-xl p-3"
                value={amPm} onChange={e=>setAmPm(e.target.value)}>
          <option>AM</option><option>PM</option>
        </select>

        <button type="button" onClick={scheduleAlarm}
                className="col-span-3 mt-2 bg-primary rounded-2xl px-4 py-3 font-semibold">
          Schedule Alarm
        </button>

        <button
          type="button"
          className="col-span-3 mt-2 rounded-2xl px-4 py-3 bg-neutral-800"
          onClick={async () => {
            try {
              const ok = await checkAvailability();
              alert('Native reachable ✅\n' + JSON.stringify(ok));
            } catch (e) {
              alert('Native not reachable ❌\n' + (e?.message ?? String(e)));
            }
          }}>
          Test Native Call
        </button>

        {status && <p className="col-span-3 text-sm text-green-400 mt-2">{status}</p>}
        {!isAndroid() && <p className="col-span-3 text-xs text-amber-400">On web, alarms don’t ring in background.</p>}
      </div>

      <h2 className="text-xl font-semibold mb-2">Upcoming Alarms</h2>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-neutral-400">No alarms scheduled.</p>}
        {list.map(a => {
          const when = new Date(a.time);
          return (
            <div key={a.id} className="bg-neutral-900 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{format12h(when)}</div>
                <div className="text-xs text-neutral-400">{when.toDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>toggleAlarm(a.id)} className={`px-3 py-2 rounded-xl ${a.enabled? 'bg-green-700':'bg-neutral-700'}`}>{a.enabled? 'On':'Off'}</button>
                <button onClick={()=>scheduleTomorrowSameTime(a.id)} className="px-3 py-2 rounded-xl bg-blue-700">+1 day</button>
                <button onClick={()=>cancelAlarmItem(a.id)} className="px-3 py-2 rounded-xl bg-red-700">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlarmScreen;

