import { useState, useCallback, useEffect } from 'react';

function systemsKey(userId) {
  return userId ? `voice2bpmn_systems_${userId}` : null;
}

export function useSystemRepository(userId) {
  const key = systemsKey(userId);
  const [systems, setSystems] = useState([]);

  // Reload whenever the logged-in user changes
  useEffect(() => {
    if (!key) { setSystems([]); return; }
    try { setSystems(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setSystems([]); }
  }, [key]);

  function persist(list) {
    if (key) { try { localStorage.setItem(key, JSON.stringify(list)); } catch {} }
  }

  const addSystem = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSystems(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      persist(next);
      return next;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeSystem = useCallback((name) => {
    setSystems(prev => {
      const next = prev.filter(s => s !== name);
      persist(next);
      return next;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const importFromText = useCallback((text) => {
    const lines = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setSystems(prev => {
      const next = [...new Set([...prev, ...lines])];
      persist(next);
      return next;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = useCallback(() => {
    setSystems([]);
    persist([]);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { systems, addSystem, removeSystem, importFromText, clearAll };
}
