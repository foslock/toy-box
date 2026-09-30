// What the page remembers about you between visits (localStorage), and the clock it reads the time from. ?at=3:00 and
// ?day=1 bend the clock, for trying the night and the next-day endings without waiting for them.
const KEY = 'toybox.staypage.v1';
const blank = () => ({ visits: 0, first: 0, last: 0, lastDay: -1, lastAct: '', endings: {}, sound: true });

export const dayNumber = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

export function makeClock({ at = null, day = 0, realNow = () => new Date() } = {}) {
  return {
    overridden: !!(at || day),
    date() {
      const d = realNow();
      if (day) d.setDate(d.getDate() + day);
      if (at) d.setHours(at.h, at.m, 0, 0);
      return d;
    },
  };
}

// localStorage can throw (private windows, blocked site data), so it falls back to keeping things in memory.
export function makeStorage(win) {
  let ls = null, mem = null;
  try { ls = win.localStorage; ls.getItem(KEY); } catch { ls = null; }
  return {
    read() { try { return ls ? ls.getItem(KEY) : mem; } catch { return mem; } },
    write(s) { mem = s; try { ls && ls.setItem(KEY, s); } catch {} },
    clear() { mem = null; try { ls && ls.removeItem(KEY); } catch {} },
  };
}

export function createStore({ storage, clock, total = 12 }) {
  let st = blank();
  try { const raw = storage.read(); if (raw) st = { ...blank(), ...JSON.parse(raw) }; } catch {}
  const prev = JSON.parse(JSON.stringify(st));   // what the last visit left behind
  const save = () => storage.write(JSON.stringify(st));
  const store = {
    prev, total,
    get state() { return st; },
    clock,
    today: () => dayNumber(clock.date()),
    hour: () => { const d = clock.date(); return d.getHours() + d.getMinutes() / 60; },
    // called once when the page opens
    boot() {
      st.visits++; st.lastAct = 'left'; if (!st.first) st.first = Date.now();
      if (!clock.overridden) { st.last = Date.now(); st.lastDay = store.today(); }
      save();
    },
    act(a) { st.lastAct = a; save(); },
    has: id => !!st.endings[id],
    count: () => Object.keys(st.endings).length,
    addEnding(id) {
      const isNew = !st.endings[id];
      if (isNew) st.endings[id] = Date.now();
      st.lastAct = 'ended:' + id;
      save();
      return isNew;
    },
    setSound(on) { st.sound = !!on; save(); },
    forget() { storage.clear(); st = blank(); },
  };
  return store;
}
