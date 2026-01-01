import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PdfViewer } from './PdfViewer';
import { AnnotationCanvas } from './AnnotationCanvas';
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
}: DiagramViewProps) {
  const { diagrams, currentDiagramId, zoom, zoomIn, zoomOut, setZoom, activeInspectionType } = useStore();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, setZoom]);

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
    <div className="diagram-view" ref={containerRef}>
      <div
        className="diagram-container"
        style={{
          transform: `scale(${zoom})`,
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
    </div>
  );
}
