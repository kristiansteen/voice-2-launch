import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';


const BpmnViewer = forwardRef(function BpmnViewer({ xml, onXmlChange, onElementDblClick }, ref) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const lastXmlRef = useRef(null);
  const [error, setError] = useState(null);

  // Expose canvas + history controls to parent via ref
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
    undo() {
      try { modelerRef.current?.get('commandStack').undo(); } catch { /* not ready */ }
    },
    redo() {
      try { modelerRef.current?.get('commandStack').redo(); } catch { /* not ready */ }
    },
    canUndo() {
      try { return modelerRef.current?.get('commandStack').canUndo() ?? false; } catch { return false; }
    },
    canRedo() {
      try { return modelerRef.current?.get('commandStack').canRedo() ?? false; } catch { return false; }
    },
    activateTool(toolName, event) {
      const m = modelerRef.current;
      if (!m) return;
      try {
        if (toolName === 'hand')    { m.get('handTool').activateHand(event); return; }
        if (toolName === 'lasso')   { m.get('lassoTool').activateSelection(event); return; }
        if (toolName === 'space')   { m.get('spaceTool').activateSelection(event); return; }
        if (toolName === 'connect') { m.get('globalConnect').start(event); return; }
        const shapeTypes = {
          'start-event':        { type: 'bpmn:StartEvent' },
          'intermediate-event': { type: 'bpmn:IntermediateCatchEvent' },
          'end-event':          { type: 'bpmn:EndEvent' },
          'gateway':            { type: 'bpmn:ExclusiveGateway' },
          'task':               { type: 'bpmn:Task' },
        };
        if (shapeTypes[toolName]) {
          const shape = m.get('elementFactory').createShape(shapeTypes[toolName]);
          m.get('create').start(event, shape);
        }
      } catch { /* not ready */ }
    },
  }), []);

  // ── Create modeler once on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
      if (cancelled || !containerRef.current) return;

      const rendererMod = await import('../bpmn/customRenderer.js');
      const modeler = new BpmnModeler({ container: containerRef.current, additionalModules: [rendererMod.customRenderModule] });
      modelerRef.current = modeler;

      // Let bpmn-js initialise the palette normally, then hide it via CSS
      // (closing without re-opening leaves bpmn-js in a broken state)
      try { modeler.get('palette').open(); } catch { /* not critical */ }

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

  // ── Global keyboard undo/redo ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        try { modelerRef.current?.get('commandStack').undo(); } catch { /* not ready */ }
      }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        try { modelerRef.current?.get('commandStack').redo(); } catch { /* not ready */ }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Respond to panel resize (debounced) ───────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const canvas = modelerRef.current?.get('canvas');
          if (canvas) { canvas.resized(); canvas.zoom('fit-viewport'); }
        } catch { /* not ready */ }
      }, 60);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} className="bpmn-container" style={{ width: '100%', height: '100%' }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-sm p-4 text-center">
          Diagram render error: {error}
        </div>
      )}
    </div>
  );
});

export default BpmnViewer;
