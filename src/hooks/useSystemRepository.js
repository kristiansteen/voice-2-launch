import { useState, useCallback } from 'react';

const KEY = 'voice2bpmn_systems';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function useSystemRepository() {
  const [systems, setSystems] = useState(load);

  const addSystem = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSystems(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      save(next);
      return next;
    });
  }, []);

  const removeSystem = useCallback((name) => {
    setSystems(prev => {
      const next = prev.filter(s => s !== name);
      save(next);
      return next;
    });
  }, []);

  const importFromText = useCallback((text) => {
    const lines = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setSystems(prev => {
      const next = [...new Set([...prev, ...lines])];
      save(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSystems([]);
    save([]);
  }, []);

  return { systems, addSystem, removeSystem, importFromText, clearAll };
}
