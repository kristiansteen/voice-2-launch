import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const PALETTE_REMOVE = [
  'create.subprocess-expanded',
  'create.data-object',
  'create.data-store',
  'create.group',
  'create.participant',
];

const BpmnViewer = forwardRef(function BpmnViewer({ xml, onXmlChange, onElementDblClick }, ref) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const lastXmlRef = useRef(null);
  const [error, setError] = useState(null);

  // Expose canvas controls to parent via ref
  useImperativeHandle(ref, () => ({
    fitViewport() {
      try { modelerRef.current?.get('canvas').zoom('fit-viewport'); } catch { /* not ready */ }
    },
    zoomIn() {
      try {
        const canvas = modelerRef.current?.get('canvas');
        if (canvas) canvas.zoom(Math.min(canvas.zoom() * 1.25, 4));
      } catch { /* not ready */ }
    },
    zoomOut() {
      try {
        const canvas = modelerRef.current?.get('canvas');
        if (canvas) canvas.zoom(Math.max(canvas.zoom() / 1.25, 0.2));
      } catch { /* not ready */ }
    },
  }), []);

  // ── Create modeler once on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
      if (cancelled || !containerRef.current) return;

      const modeler = new BpmnModeler({ container: containerRef.current });
      modelerRef.current = modeler;

      // Strip unwanted palette entries
      try {
        const pp = modeler.get('paletteProvider');
        const origGet = pp.getPaletteEntries.bind(pp);
        pp.getPaletteEntries = (element) => {
          const entries = origGet(element);
          PALETTE_REMOVE.forEach(k => delete entries[k]);
          return entries;
        };
        const palette = modeler.get('palette');
        palette.close();
        palette.open();
      } catch { /* CSS fallback handles it */ }

      // Double-click on an element opens the step curtain
      modeler.get('eventBus').on('element.dblclick', (event) => {
        const { element } = event;
        // Skip root process / canvas background
        if (element.type === 'bpmn:Process' || element.type === 'bpmn:Collaboration') return;
        onElementDblClick?.(element);
      });

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

      // Import any xml that arrived before the modeler was ready
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
    if (!modeler) return; // not ready yet — init effect handles it

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
      <div ref={containerRef} className="bpmn-container" style={{ width: '100%', height: '100%' }} />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-6 text-center gap-3">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-red-700">We couldn't render this diagram.</p>
          <p className="text-xs text-red-500">Try re-generating the diagram from the description panel.</p>
          <details className="text-xs text-red-400 max-w-xs">
            <summary className="cursor-pointer hover:text-red-600">Technical details</summary>
            <p className="mt-1 text-left font-mono break-all">{error}</p>
          </details>
        </div>
      )}
    </div>
  );
});

export default BpmnViewer;
