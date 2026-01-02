import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { STATUS_COLORS, ANNOTATION_TYPE_COLORS, ANNOTATION_TYPE_KKS_PREFIX, ANNOTATION_TYPE_LABELS, type PipeAnnotation, type AnnotationType } from '../types';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  diagramId: string;
  annotations: PipeAnnotation[];
  zoom: number;
}

// Highlighter colors by status (semi-transparent)
const HIGHLIGHT_COLORS = {
  ok: 'rgba(34, 197, 94, 0.35)',
  warning: 'rgba(234, 179, 8, 0.4)',
  critical: 'rgba(239, 68, 68, 0.4)',
  not_inspected: 'rgba(59, 130, 246, 0.35)',
} as const;

// Type-specific highlight colors for not_inspected status
const TYPE_HIGHLIGHT_COLORS: Record<AnnotationType, string> = {
  pipe: 'rgba(59, 130, 246, 0.35)',      // Blue
  tank: 'rgba(139, 92, 246, 0.35)',      // Purple
  component: 'rgba(245, 158, 11, 0.35)', // Orange/amber
};

// Get highlight color based on status and type
const getHighlightColor = (status: string, annotationType?: AnnotationType) => {
  if (status === 'not_inspected' && annotationType) {
    return TYPE_HIGHLIGHT_COLORS[annotationType];
  }
  return HIGHLIGHT_COLORS[status as keyof typeof HIGHLIGHT_COLORS] || HIGHLIGHT_COLORS.not_inspected;
};

export function AnnotationCanvas({ width, height, diagramId, annotations, zoom }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Current drawing session - can have multiple strokes before saving
  const [currentStrokes, setCurrentStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [activeStroke, setActiveStroke] = useState<{ x: number; y: number }[]>([]);

  // Line drawing mode - stores clicked points
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);

  const {
    currentTool,
    selectedAnnotationId,
    addAnnotation,
    setSelectedAnnotation,
    isLocked,
    activeInspectionType,
  } = useStore();

  // Use the global active inspection type for new annotations
  const selectedAnnotationType = activeInspectionType;

  // Flatten all strokes into single path for saving
  const getAllPoints = useCallback(() => {
    const allStrokes = activeStroke.length > 0
      ? [...currentStrokes, activeStroke]
      : currentStrokes;
    return allStrokes.flat();
  }, [currentStrokes, activeStroke]);

  // Check if we have an unsaved drawing
  const hasUnsavedDrawing = currentStrokes.length > 0 || activeStroke.length > 0 || linePoints.length > 0;

  // Save current drawing as annotation
  const saveCurrentDrawing = async () => {
    let points: { x: number; y: number }[] = [];

    if (currentTool === 'draw-line' && linePoints.length >= 2) {
      points = linePoints;
    } else {
      points = getAllPoints();
    }

    if (points.length < 2) return;

    // Count existing annotations of selected type to generate KKS number
    const typeCount = annotations.filter(a => a.annotationType === selectedAnnotationType).length;
    const kksPrefix = ANNOTATION_TYPE_KKS_PREFIX[selectedAnnotationType];
    const defaultColor = ANNOTATION_TYPE_COLORS[selectedAnnotationType];

    const newAnnotation: Omit<PipeAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
      annotationType: selectedAnnotationType,
      kksNumber: `${kksPrefix}-${String(typeCount + 1).padStart(3, '0')}`,
      points: points,
      color: defaultColor,
      strokeWidth: 14,
      status: 'not_inspected',
    };

    await addAnnotation(diagramId, newAnnotation);

    // Clear current drawing
    setCurrentStrokes([]);
    setActiveStroke([]);
    setLinePoints([]);
    setPreviewPoint(null);
  };

  // Cancel current drawing
  const cancelCurrentDrawing = () => {
    setCurrentStrokes([]);
    setActiveStroke([]);
    setLinePoints([]);
    setPreviewPoint(null);
  };

  // Undo last line point
  const undoLastPoint = () => {
    if (linePoints.length > 0) {
      setLinePoints(prev => prev.slice(0, -1));
    }
  };

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // In locked mode, only draw the selected annotation
    // In unlocked mode, draw all annotations
    annotations.forEach((annotation) => {
      if (annotation.points.length < 2) return;

      // Skip non-selected annotations when locked
      if (isLocked && annotation.id !== selectedAnnotationId) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y);

      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
      }

      ctx.strokeStyle = getHighlightColor(annotation.status, annotation.annotationType);
      ctx.lineWidth = annotation.id === selectedAnnotationId ? 18 : 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'multiply';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      // Draw selection border for selected annotation
      if (annotation.id === selectedAnnotationId) {
        ctx.beginPath();
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        for (let i = 1; i < annotation.points.length; i++) {
          ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        ctx.strokeStyle = STATUS_COLORS[annotation.status];
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw label
      const midPoint = annotation.points[Math.floor(annotation.points.length / 2)];
      const label = annotation.kksNumber;
      ctx.font = 'bold 11px sans-serif';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = STATUS_COLORS[annotation.status];
      ctx.globalAlpha = 0.9;
      ctx.fillRect(midPoint.x - 4, midPoint.y - 22, textWidth + 8, 18);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, midPoint.x, midPoint.y - 8);
    });

    // Don't draw current strokes when locked
    if (isLocked) return;

    // Draw current unsaved freehand strokes
    const allCurrentStrokes = activeStroke.length > 0
      ? [...currentStrokes, activeStroke]
      : currentStrokes;

    allCurrentStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;

      // Highlighter effect - use selected type color
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.strokeStyle = TYPE_HIGHLIGHT_COLORS[selectedAnnotationType];
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'multiply';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    });

    // Draw line points and preview for line drawing mode
    if (linePoints.length > 0) {
      // Draw the line segments
      ctx.beginPath();
      ctx.moveTo(linePoints[0].x, linePoints[0].y);
      for (let i = 1; i < linePoints.length; i++) {
        ctx.lineTo(linePoints[i].x, linePoints[i].y);
      }

      // Draw preview line to mouse position
      if (previewPoint) {
        ctx.lineTo(previewPoint.x, previewPoint.y);
      }

      ctx.strokeStyle = TYPE_HIGHLIGHT_COLORS[selectedAnnotationType];
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'multiply';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      // Draw point markers
      linePoints.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? '#22c55e' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw "in progress" indicator for freehand current drawing
    if (allCurrentStrokes.length > 0) {
      const allPoints = allCurrentStrokes.flat();
      if (allPoints.length > 0) {
        const firstPoint = allPoints[0];

        // Draw start indicator
        ctx.beginPath();
        ctx.arc(firstPoint.x, firstPoint.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

  }, [annotations, currentStrokes, activeStroke, linePoints, previewPoint, selectedAnnotationId, isLocked, width, height, selectedAnnotationType]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    // Adjust for zoom - the canvas is scaled by CSS transform
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // In locked mode, only allow clicking to select/deselect pipes
    if (isLocked) {
      const pos = getMousePos(e);
      const clickedAnnotation = findAnnotationAtPoint(pos.x, pos.y);
      // Toggle selection: if clicking the same, deselect; otherwise select
      if (clickedAnnotation?.id === selectedAnnotationId) {
        setSelectedAnnotation(null);
      } else {
        setSelectedAnnotation(clickedAnnotation?.id || null);
      }
      return;
    }

    if (currentTool === 'draw-free') {
      const pos = getMousePos(e);
      setIsDrawing(true);
      setActiveStroke([pos]);
    } else if (currentTool === 'select') {
      const pos = getMousePos(e);
      const clickedAnnotation = findAnnotationAtPoint(pos.x, pos.y);
      setSelectedAnnotation(clickedAnnotation?.id || null);
    }
    // Line drawing uses click, not mousedown+drag
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLocked) return; // No line drawing when locked

    if (currentTool === 'draw-line') {
      const pos = getMousePos(e);
      setLinePoints(prev => [...prev, pos]);
    }
  };

  const handleDoubleClick = () => {
    if (isLocked) return; // No actions on double-click when locked

    if (currentTool === 'draw-line' && linePoints.length >= 2) {
      // Double-click finishes line drawing and saves
      saveCurrentDrawing();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLocked) return; // No drawing when locked

    if (currentTool === 'draw-line' && linePoints.length > 0) {
      // Update preview point for line drawing
      const pos = getMousePos(e);
      setPreviewPoint(pos);
    }

    if (!isDrawing || currentTool !== 'draw-free') return;

    const pos = getMousePos(e);
    const lastPoint = activeStroke[activeStroke.length - 1];

    if (lastPoint) {
      const distance = Math.sqrt((pos.x - lastPoint.x) ** 2 + (pos.y - lastPoint.y) ** 2);
      if (distance > 3) {
        setActiveStroke(prev => [...prev, pos]);
      }
    }
  };

  const handleMouseUp = () => {
    if (isLocked) return;
    if (!isDrawing || currentTool !== 'draw-free') return;

    setIsDrawing(false);

    // Add active stroke to current strokes (don't save yet!)
    if (activeStroke.length >= 2) {
      setCurrentStrokes(prev => [...prev, activeStroke]);
    }
    setActiveStroke([]);
  };

  const handleMouseLeave = () => {
    if (isLocked) return;

    setPreviewPoint(null);

    if (isDrawing && activeStroke.length >= 2) {
      setCurrentStrokes(prev => [...prev, activeStroke]);
    }
    setIsDrawing(false);
    setActiveStroke([]);
  };

  const findAnnotationAtPoint = (x: number, y: number): PipeAnnotation | null => {
    const threshold = 15;

    for (const annotation of annotations) {
      for (let i = 0; i < annotation.points.length - 1; i++) {
        const p1 = annotation.points[i];
        const p2 = annotation.points[i + 1];

        const dist = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist < threshold) {
          return annotation;
        }
      }
    }
    return null;
  };

  const distanceToLineSegment = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCursor = () => {
    if (isLocked) return 'pointer'; // Show pointer in locked mode for clicking pipes
    if (currentTool === 'draw-free' || currentTool === 'draw-line') return 'crosshair';
    if (currentTool === 'pan') return 'grab';
    return 'default';
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return; // No drawing shortcuts when locked

      if (e.key === 'Enter' && hasUnsavedDrawing) {
        e.preventDefault();
        saveCurrentDrawing();
      } else if (e.key === 'Escape' && hasUnsavedDrawing) {
        e.preventDefault();
        cancelCurrentDrawing();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && linePoints.length > 0) {
        e.preventDefault();
        undoLastPoint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedDrawing, linePoints.length, isLocked]);

  // Get drawing mode hint text
  const getHintText = () => {
    const typeName = ANNOTATION_TYPE_LABELS[selectedAnnotationType].toLowerCase();
    if (currentTool === 'draw-line') {
      return 'Klik for at tilføje punkter, dobbeltklik for at afslutte, Ctrl+Z for at fortryde punkt';
    }
    return `Tegn flere streger på samme ${typeName}, tryk Gem når færdig`;
  };

  return (
    <div className="annotation-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="annotation-canvas"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* Locked mode indicator */}
      {isLocked && (
        <div className="locked-indicator">
          Klik på en markering for at se detaljer
        </div>
      )}

      {/* Active type indicator - show when drawing tools active */}
      {!isLocked && (currentTool === 'draw-free' || currentTool === 'draw-line') && (
        <div className="annotation-type-indicator">
          <span
            className="type-badge"
            style={{
              backgroundColor: ANNOTATION_TYPE_COLORS[selectedAnnotationType],
            }}
          >
            <span className="type-icon">
              {selectedAnnotationType === 'pipe' && '━'}
              {selectedAnnotationType === 'tank' && '⬡'}
              {selectedAnnotationType === 'component' && '⚙'}
            </span>
            {ANNOTATION_TYPE_LABELS[selectedAnnotationType]}
          </span>
        </div>
      )}

      {/* Drawing controls overlay */}
      {!isLocked && hasUnsavedDrawing && (currentTool === 'draw-free' || currentTool === 'draw-line') && (
        <div className="drawing-controls">
          <button
            className="btn-save"
            onClick={saveCurrentDrawing}
            title={`Gem ${ANNOTATION_TYPE_LABELS[selectedAnnotationType]} (Enter)`}
          >
            ✓ Gem {ANNOTATION_TYPE_LABELS[selectedAnnotationType]}
          </button>
          <button
            className="btn-cancel"
            onClick={cancelCurrentDrawing}
            title="Annuller (Esc)"
          >
            ✕ Annuller
          </button>
          {currentTool === 'draw-line' && linePoints.length > 0 && (
            <button
              className="btn-undo"
              onClick={undoLastPoint}
              title="Fortryd punkt (Ctrl+Z)"
            >
              ↩ Fortryd
            </button>
          )}
          <span className="drawing-hint">
            {getHintText()}
          </span>
        </div>
      )}
    </div>
  );
}
