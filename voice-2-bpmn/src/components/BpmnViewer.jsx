import { useEffect, useRef, useState } from 'react';

export default function BpmnViewer({ xml, onXmlChange }) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const lastImportedRef = useRef(null); // prevents reimport after user edits
  const [error, setError] = useState(null);

  useEffect(() => {
    // Skip if this XML was just exported by the modeler itself
    if (!xml || !containerRef.current || xml === lastImportedRef.current) return;

    let cancelled = false;

    async function init() {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }

      setError(null);

      const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
      if (cancelled || !containerRef.current) return;

      const modeler = new BpmnModeler({ container: containerRef.current });
      modelerRef.current = modeler;

      try {
        await modeler.importXML(xml);
        lastImportedRef.current = xml;
        if (!cancelled) modeler.get('canvas').zoom('fit-viewport');
      } catch (err) {
        console.error('bpmn-js import error:', err);
        if (!cancelled) setError(err.message || 'Failed to render diagram');
        return;
      }

      // Sync edits back to parent
      modeler.on('commandStack.changed', async () => {
        try {
          const { xml: updatedXml } = await modeler.saveXML({ format: true });
          lastImportedRef.current = updatedXml; // mark before calling onXmlChange
          onXmlChange?.(updatedXml);
        } catch (err) {
          console.error('saveXML error:', err);
        }
      });
    }

    init();

    return () => {
      cancelled = true;
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [xml]);

  // Respond to panel resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!modelerRef.current) return;
      try { modelerRef.current.get('canvas').resized(); } catch { /* not ready */ }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        className="bpmn-container"
        style={{ width: '100%', height: '100%' }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-sm p-4">
          Diagram render error: {error}
        </div>
      )}
    </div>
  );
}
