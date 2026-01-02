import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi';
import { PdfViewer } from './PdfViewer';
import { AnnotationCanvas, type DrawingState } from './AnnotationCanvas';
import { IsolationCanvas } from './IsolationCanvas';
import { useStore } from '../store/useStore';
import type { IsolationPoint, IsolationPointType } from '../types';

interface DiagramViewProps {
  hideAnnotations?: boolean;
  // Isolation mode props
  isolationMode?: boolean;
  isolationPoints?: IsolationPoint[];
  selectedIsolationPointId?: string | null;
  isIsolationLocked?: boolean;
  activeIsolationTool?: IsolationPointType | null;
  isolationPointSize?: number;
  onIsolationPointClick?: (point: IsolationPoint) => void;
  onIsolationPointCreate?: (x: number, y: number, type: IsolationPointType) => void;
  onIsolationPointMove?: (pointId: string, x: number, y: number) => void;
  // Drawing state callback
  onDrawingStateChange?: (state: DrawingState) => void;
}

export function DiagramView({
  hideAnnotations = false,
  isolationMode = false,
  isolationPoints = [],
  selectedIsolationPointId = null,
  isIsolationLocked = true,
  activeIsolationTool = null,
  isolationPointSize,
  onIsolationPointClick,
  onIsolationPointCreate,
  onIsolationPointMove,
  onDrawingStateChange,
}: DiagramViewProps) {
  const { diagrams, currentDiagramId, zoom, zoomIn, zoomOut, setZoom, resetZoom, activeInspectionType, currentTool, panOffset, setPanOffset } = useStore();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const currentDiagram = diagrams.find((d) => d.id === currentDiagramId);

  // Filter annotations by active inspection type
  const filteredAnnotations = useMemo(() => {
    if (!currentDiagram) return [];
    return currentDiagram.annotations.filter(
      (a) => (a.annotationType || 'pipe') === activeInspectionType
    );
  }, [currentDiagram, activeInspectionType]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvasSize({
      width: canvas.width,
      height: canvas.height,
    });
  }, []);

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoomIn, zoomOut, setZoom]);

  // Pan mouse handlers
  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool === 'pan' || spacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [currentTool, spacePressed, panOffset]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      setPanOffset({ x: newX, y: newY });
    }
  }, [isPanning, panStart, setPanOffset]);

  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Cursor style based on pan state
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (currentTool === 'pan' || spacePressed) return 'grab';
    return 'default';
  };

  if (!currentDiagram) {
    return (
      <div className="diagram-view empty">
        <div className="empty-state">
          <h2>Ingen tegning valgt</h2>
          <p>Upload en PDF-tegning for at komme i gang</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="diagram-view"
      ref={containerRef}
      onMouseDown={handlePanMouseDown}
      onMouseMove={handlePanMouseMove}
      onMouseUp={handlePanMouseUp}
      onMouseLeave={handlePanMouseUp}
      style={{ cursor: getCursorStyle() }}
    >
      <div
        className="diagram-container"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* PDF Layer */}
        <div className="pdf-layer">
          <PdfViewer
            pdfUrl={currentDiagram.pdfUrl}
            onCanvasReady={handleCanvasReady}
          />
        </div>

        {/* Annotation Layer (overlay) - hidden in sikringsplan mode */}
        {canvasSize.width > 0 && !hideAnnotations && !isolationMode && (
          <div className="annotation-layer">
            <AnnotationCanvas
              width={canvasSize.width}
              height={canvasSize.height}
              diagramId={currentDiagram.id}
              annotations={filteredAnnotations}
              zoom={zoom}
              onDrawingStateChange={onDrawingStateChange}
            />
          </div>
        )}

        {/* Isolation Layer (overlay) - shown in sikringsplan mode */}
        {canvasSize.width > 0 && isolationMode && (
          <div className="isolation-layer">
            <IsolationCanvas
              width={canvasSize.width}
              height={canvasSize.height}
              zoom={zoom}
              points={isolationPoints}
              selectedPointId={selectedIsolationPointId}
              isLocked={isIsolationLocked}
              activeTool={activeIsolationTool}
              pointSize={isolationPointSize}
              onPointClick={onIsolationPointClick || (() => {})}
              onPointCreate={onIsolationPointCreate || (() => {})}
              onPointMove={onIsolationPointMove || (() => {})}
            />
          </div>
        )}
      </div>

      {/* Floating Zoom Controls - always visible */}
      <div className="zoom-controls-floating">
        <button
          className="zoom-btn"
          onClick={zoomOut}
          title="Zoom ud (-)"
          disabled={zoom <= 0.25}
        >
          <FiZoomOut />
        </button>
        <button
          className="zoom-btn zoom-display"
          onClick={resetZoom}
          title="Nulstil zoom (0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="zoom-btn"
          onClick={zoomIn}
          title="Zoom ind (+)"
          disabled={zoom >= 4}
        >
          <FiZoomIn />
        </button>
        <button
          className="zoom-btn"
          onClick={resetZoom}
          title="Tilpas til vindue"
        >
          <FiMaximize />
        </button>
      </div>
    </div>
  );
}
