import { useEffect, useRef, useState } from 'react';

// Palette entries to hide — keeps the palette clean and BPMN-focused
const PALETTE_REMOVE = [
  'create.subprocess-expanded',
  'create.data-object',
  'create.data-store',
  'create.group',
  'create.participant',
];

export default function BpmnViewer({ xml, onXmlChange }) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  // Tracks the last XML we either imported or exported — prevents round-trip re-imports
  const lastXmlRef = useRef(null);
  const [error, setError] = useState(null);

  // ── Create modeler once on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
      if (cancelled || !containerRef.current) return;

      const modeler = new BpmnModeler({ container: containerRef.current });
      modelerRef.current = modeler;

      // Strip unwanted palette entries after modeler boots
      try {
        const pp = modeler.get('paletteProvider');
        const origGet = pp.getPaletteEntries.bind(pp);
        pp.getPaletteEntries = (element) => {
          const entries = origGet(element);
          PALETTE_REMOVE.forEach(k => delete entries[k]);
          return entries;
        };
        // Force palette to re-render with filtered entries
        const palette = modeler.get('palette');
        palette.close();
        palette.open();
      } catch { /* palette API unavailable — CSS fallback handles it */ }

      // Sync user edits back to parent without triggering re-import
      modeler.on('commandStack.changed', async () => {
        try {
          const { xml: updated } = await modeler.saveXML({ format: true });
          lastXmlRef.current = updated;
          onXmlChange?.(updated);
        } catch (err) {
          console.error('saveXML error:', err);
        }
      });

      // If xml prop arrived before the modeler was ready, import it now
      const pending = lastXmlRef.current;
      if (pending && !cancelled) {
        try {
          await modeler.importXML(pending);
          modeler.get('canvas').zoom('fit-viewport');
          setError(null);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Failed to render diagram');
        }
      }
    })();

    return () => {
      cancelled = true;
      modelerRef.current?.destroy();
      modelerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Import XML when it changes from outside ───────────────────────
  useEffect(() => {
    if (!xml || xml === lastXmlRef.current) return;
    lastXmlRef.current = xml;

    const modeler = modelerRef.current;
    if (!modeler) return; // modeler not ready yet — init effect will handle it

    modeler.importXML(xml)
      .then(({ warnings }) => {
        if (warnings?.length) console.warn('BPMN import warnings:', warnings);
        modeler.get('canvas').zoom('fit-viewport');
        setError(null);
      })
      .catch(err => {
        console.error('bpmn-js import error:', err);
        setError(err.message || 'Failed to render diagram');
      });
  }, [xml]);

  // ── Respond to panel resize (debounced) ───────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { modelerRef.current?.get('canvas').resized(); } catch { /* not ready */ }
      }, 60);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        className="bpmn-container"
        style={{ width: '100%', height: '100%' }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-sm p-4 text-center">
          Diagram render error: {error}
        </div>
      )}
    </div>
  );
}
