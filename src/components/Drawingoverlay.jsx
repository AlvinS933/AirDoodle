import { useCallback, useEffect, useRef, useState } from 'react';

const PRESET_COLORS = ['#f5f5f7', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
const MIN_SIZE = 2;
const MAX_SIZE = 40;

export default function DrawingOverlay() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const strokesRef = useRef([]); // committed strokes, for redraw on resize/undo
  const activeStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);

  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState('#f5f5f7');
  const [size, setSize] = useState(6);
  const [drawMode, setDrawMode] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);

  // --- canvas setup & resize handling -------------------------------------
  const redrawAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawAll();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redrawAll]);

  // --- draw-mode / click-through plumbing ---------------------------------
  useEffect(() => {
    window.overlayAPI?.setClickThrough(!drawMode);
  }, [drawMode]);

  useEffect(() => {
    const unsubscribe = window.overlayAPI?.onToggleDrawMode(() => {
      setDrawMode((prev) => !prev);
    });
    return unsubscribe;
  }, []);

  const handleToolbarEnter = () => window.overlayAPI?.setClickThrough(false);
  const handleToolbarLeave = () => {
    if (!drawMode) window.overlayAPI?.setClickThrough(true);
  };

  // --- pointer handlers ----------------------------------------------------
  const handlePointerDown = (e) => {
    if (!drawMode) return;
    isDrawingRef.current = true;
    activeStrokeRef.current = {
      tool,
      color,
      size,
      points: [[e.clientX, e.clientY]],
    };
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    stroke.points.push([e.clientX, e.clientY]);
    const ctx = ctxRef.current;
    drawSegment(ctx, stroke, stroke.points.length - 2);
  };

  const endStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (activeStrokeRef.current && activeStrokeRef.current.points.length > 1) {
      strokesRef.current.push(activeStrokeRef.current);
      setStrokeCount(strokesRef.current.length);
    }
    activeStrokeRef.current = null;
  };

  // --- toolbar actions -------------------------------------------------
  const handleUndo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };

  const handleClear = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redrawAll();
  };

  return (
    <div className="overlay-root">
      <canvas
        ref={canvasRef}
        className="overlay-canvas"
        style={{ cursor: drawMode ? 'crosshair' : 'default' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
      />

      <div
        className="toolbar"
        onMouseEnter={handleToolbarEnter}
        onMouseLeave={handleToolbarLeave}
      >
        <div className="toolbar-header">
          <span className={`status-dot ${drawMode ? 'status-on' : 'status-off'}`} />
          <span className="toolbar-label">{drawMode ? 'Drawing' : 'Click-through'}</span>
        </div>

        <div className="toolbar-section tool-row">
          <button
            className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool('pen')}
            title="Pen"
          >
            ✎
          </button>
          <button
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            ▢
          </button>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Color</span>
          <div className="swatch-grid">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
            <input
              type="color"
              className="swatch-custom"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Custom color"
            />
          </div>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Size</span>
          <div className="nib-preview-box">
            <div
              className="nib-preview"
              style={{
                width: size,
                height: size,
                background: tool === 'eraser' ? 'transparent' : color,
                border: tool === 'eraser' ? '2px solid var(--text-dim)' : 'none',
              }}
            />
          </div>
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </div>

        <div className="toolbar-section action-row">
          <button className="action-btn" onClick={handleUndo} disabled={strokeCount === 0}>
            Undo
          </button>
          <button className="action-btn" onClick={handleClear} disabled={strokeCount === 0}>
            Clear
          </button>
        </div>

        <div className="toolbar-section">
          <button
            className="mode-btn"
            onClick={() => setDrawMode((prev) => !prev)}
          >
            {drawMode ? 'Pause (⌘⇧D)' : 'Resume (⌘⇧D)'}
          </button>
          <button className="close-btn" onClick={() => window.overlayAPI?.closeOverlay()}>
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}

// --- canvas drawing helpers -------------------------------------------------

function applyStrokeStyle(ctx, stroke) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = stroke.size;
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }
}

function drawSegment(ctx, stroke, fromIndex) {
  const [x1, y1] = stroke.points[fromIndex];
  const [x2, y2] = stroke.points[fromIndex + 1];
  applyStrokeStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawStroke(ctx, stroke) {
  if (stroke.points.length < 2) return;
  applyStrokeStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
  }
  ctx.stroke();
}