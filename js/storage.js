// localStorage wrapper that never throws. Keys live under "srq:"; every value is stored as { v: 1, ... }.
// When storage is blocked or full, an in-memory Map keeps the session working and `persistent` turns false.

const NS = 'srq:';
const V = 1;

export function createStore(backendFactory = () => window.localStorage) {
  const memory = new Map();
  let backend = null;
  try {
    // Reading window.localStorage itself can throw; zero-quota private modes throw on the first write.
    const b = backendFactory();
    b.setItem(NS + 'probe', '1');
    b.removeItem(NS + 'probe');
    backend = b;
  } catch {
    backend = null;
  }

  return {
    get persistent() {
      return backend !== null;
    },
    get(key) {
      let raw = memory.get(key) ?? null;
      try {
        if (backend) raw = backend.getItem(NS + key) ?? raw;
      } catch {
        /* keep the memory copy */
      }
      if (raw == null) return null;
      try {
        const o = JSON.parse(raw);
        return o && typeof o === 'object' && o.v === V ? o : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(Object.assign({ v: V }, value, { v: V }));
      memory.set(key, raw); // the session keeps working even when the disk write fails
      if (!backend) return false;
      try {
        backend.setItem(NS + key, raw);
        return true;
      } catch {
        backend = null;
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        if (backend) backend.removeItem(NS + key);
      } catch {
        /* ignore */
      }
    },
    keys(prefix = '') {
      const out = new Set([...memory.keys()].filter((k) => k.startsWith(prefix)));
      try {
        for (let i = 0; backend && i < backend.length; i++) {
          const k = backend.key(i);
          if (k && k.startsWith(NS + prefix)) out.add(k.slice(NS.length));
        }
      } catch {
        /* ignore */
      }
      return [...out].filter((k) => k !== 'probe');
    },
  };
}
