import { useState } from 'react';

// Draggable divider between two panel wrappers.
export default function ResizeHandle({ aRef, bRef, disabled, aKey, bKey, onDragEnd }) {
  const [active, setActive] = useState(false);

  function handleMouseDown(e) {
    if (disabled) return;
    e.preventDefault();
    setActive(true);

    const startX = e.clientX;
    const aEl = aRef.current;
    const bEl = bRef.current;
    const aStart = aEl.getBoundingClientRect().width;
    const bStart = bEl.getBoundingClientRect().width;
    const MIN = 160;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const delta = ev.clientX - startX;
      const newA = Math.max(MIN, Math.min(aStart + delta, aStart + bStart - MIN));
      const newB = aStart + bStart - newA;
      aEl.style.flex = 'none';
      aEl.style.width = newA + 'px';
      bEl.style.flex = 'none';
      bEl.style.width = newB + 'px';
    }

    function onUp() {
      setActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalA = aEl.getBoundingClientRect().width;
      const finalB = bEl.getBoundingClientRect().width;
      onDragEnd(aKey, finalA, bKey, finalB);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (disabled) {
    return <div className="shrink-0 border-r border-gray-700" style={{ width: 0 }} />;
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: 5, flexShrink: 0 }}
      className={[
        'border-r border-gray-700 cursor-col-resize transition-colors',
        active ? 'border-green-500/60 bg-green-500/20' : 'hover:border-green-500/50 hover:bg-green-500/10',
      ].join(' ')}
    />
  );
}
