import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiCheck, FiX, FiRotateCcw } from 'react-icons/fi';
import { useStore } from '../store/useStore';
import { authApi } from '../api/client';
import { Toolbar } from '../components/Toolbar';
import { DiagramView } from '../components/DiagramView';
import { Sidebar } from '../components/Sidebar';
import { IsolationPlanSidebar } from '../components/IsolationPlanSidebar';
import type { User, IsolationPoint, IsolationPointType } from '../types';
import { ANNOTATION_TYPE_LABELS, ANNOTATION_TYPE_COLORS } from '../types';
import type { DrawingState } from '../components/AnnotationCanvas';
import html2canvas from 'html2canvas';

export function DiagramPage() {
  const { diagramId } = useParams<{ diagramId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if we're in sikringsplan mode
  const isSikringsplanMode = searchParams.get('opretSikringsplan') === 'true' || searchParams.get('sikringsplan') === 'true';
  const initialPlanId = searchParams.get('planId');

  const [user, setUser] = useState<User | null>(null);
  const replacePdfInputRef = useRef<HTMLInputElement>(null);
  const {
    fetchDiagram,
    diagrams,
    currentDiagramId,
    isLoading,
    error,
    clearError,
    setLocked,
    activeInspectionType,
    replaceDiagramPdf,
  } = useStore();

  const isAdmin = user?.role === 'admin';
  const currentDiagram = diagrams.find((d) => d.id === currentDiagramId);

  // Isolation plan state
  const [isolationPoints, setIsolationPoints] = useState<IsolationPoint[]>([]);
  const [selectedIsolationPointId, setSelectedIsolationPointId] = useState<string | null>(null);
  const [isIsolationLocked, setIsIsolationLocked] = useState(true);
  const [activeIsolationTool, setActiveIsolationTool] = useState<IsolationPointType | null>(null);
  const [isolationPointSize, setIsolationPointSize] = useState<number>(22);

  // Drawing state from AnnotationCanvas
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);

  // Ref for diagram capture
  const diagramContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (diagramId) {
      fetchDiagram(diagramId);
    }
  }, [diagramId, fetchDiagram]);

  useEffect(() => {
    // Set locked mode based on user role
    if (user !== null) {
      if (user.role === 'admin') {
        setLocked(false);
      } else {
        setLocked(true);
      }
    }
  }, [user, setLocked]);

  const loadUser = async () => {
    const { data } = await authApi.me();
    if (data) {
      setUser({
        id: data.userId,
        username: '',
        name: data.name,
        role: data.role as 'admin' | 'user',
      });
    }
  };

  const handleUploadPdf = () => {
    // Not used on this page since we're viewing existing diagram
  };

  // Replace PDF handler
  const handleReplacePdf = () => {
    // Show confirmation and trigger file input
    if (confirm('Er du sikker på at du vil erstatte PDF-tegningen?\n\nBemærk: Alle eksisterende markeringer bibeholdes, men deres position kan være forkert hvis den nye tegning har en anden layout.')) {
      replacePdfInputRef.current?.click();
    }
  };

  const handleReplacePdfConfirm = async (file: File) => {
    if (!currentDiagramId) return;

    await replaceDiagramPdf(currentDiagramId, file);

    // Refresh diagram to get new PDF
    if (diagramId) {
      await fetchDiagram(diagramId);
    }
  };

  const handleReplacePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleReplacePdfConfirm(file);
    }
    // Reset input
    if (replacePdfInputRef.current) {
      replacePdfInputRef.current.value = '';
    }
  };

  // Isolation callbacks
  const handleIsolationPointClick = useCallback((point: IsolationPoint) => {
    setSelectedIsolationPointId(point.id);
  }, []);

  const handleIsolationPointCreate = useCallback((x: number, y: number, type: IsolationPointType) => {
    console.log('DiagramPage: handleIsolationPointCreate called', { x, y, type });
    // This is handled by the sidebar via window.__isolationSidebar
    const sidebar = (window as any).__isolationSidebar;
    if (sidebar?.handlePointCreate) {
      console.log('DiagramPage: Calling sidebar.handlePointCreate');
      sidebar.handlePointCreate(x, y, type);
    } else {
      console.error('DiagramPage: sidebar.handlePointCreate not found!');
    }
  }, []);

  const handleIsolationPointMove = useCallback((pointId: string, x: number, y: number) => {
    // This is handled by the sidebar via window.__isolationSidebar
    const sidebar = (window as any).__isolationSidebar;
    if (sidebar?.handlePointMove) {
      sidebar.handlePointMove(pointId, x, y);
    }
  }, []);

  const handleIsolationPointSelected = useCallback((point: IsolationPoint | null) => {
    setSelectedIsolationPointId(point?.id || null);
  }, []);

  const handleIsolationToolChange = useCallback((tool: IsolationPointType | null) => {
    console.log('DiagramPage: Tool changed to', tool);
    setActiveIsolationTool(tool);
  }, []);

  const handleIsolationLockChange = useCallback((locked: boolean) => {
    console.log('DiagramPage: Lock changed to', locked);
    setIsIsolationLocked(locked);
  }, []);

  const handleIsolationPointsChange = useCallback((points: IsolationPoint[]) => {
    setIsolationPoints(points);
  }, []);

  const handleIsolationPointSizeChange = useCallback((size: number) => {
    setIsolationPointSize(size);
  }, []);

  // Drawing state callback
  const handleDrawingStateChange = useCallback((state: DrawingState) => {
    setDrawingState(state);
  }, []);

  // Capture diagram for printing - captures the visible zoomed area
  const handleCaptureDiagram = useCallback(async (): Promise<string | null> => {
    const diagramContainer = diagramContainerRef.current;
    if (!diagramContainer) {
      console.error('Diagram container ref not found');
      return null;
    }

    try {
      // Find the diagram-view element which contains the zoomed content
      const diagramView = diagramContainer.querySelector('.diagram-view');
      if (!diagramView) {
        console.error('Diagram view not found');
        return null;
      }

      // Use html2canvas to capture the visible area
      const canvas = await html2canvas(diagramView as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing diagram:', error);
      return null;
    }
  }, []);

  // Debug: Log current state
  console.log('DiagramPage render:', {
    isIsolationLocked,
    activeIsolationTool,
    isolationPointsCount: isolationPoints.length,
  });

  const handleBack = () => {
    if (isSikringsplanMode) {
      navigate('/sikringsplaner');
    } else if (currentDiagram?.locationId) {
      navigate(`/location/${currentDiagram.locationId}`);
    } else {
      navigate('/');
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Indlæser tegning...</p>
      </div>
    );
  }

  if (!currentDiagram) {
    return (
      <div className="page-error">
        <p>Tegning ikke fundet</p>
        <button onClick={() => navigate('/')}>Tilbage til oversigt</button>
      </div>
    );
  }

  return (
    <div className={`diagram-page ${isSikringsplanMode ? 'sikringsplan-mode' : ''}`}>
      <header className="diagram-header">
        <button className="btn-back" onClick={handleBack}>
          <FiArrowLeft />
          <span>Tilbage</span>
        </button>
        <div className="header-info">
          {currentDiagram.terminalCode && (
            <span className="terminal-badge">{currentDiagram.terminalCode}</span>
          )}
          <h1>{currentDiagram.name}</h1>
          {currentDiagram.locationName && (
            <span className="location-name">{currentDiagram.locationName}</span>
          )}
          {isSikringsplanMode ? (
            <span className="type-badge sikringsplan-badge">
              <FiShield />
              Sikringsplan
            </span>
          ) : (
            <span className="type-badge">{ANNOTATION_TYPE_LABELS[activeInspectionType]}</span>
          )}
        </div>
        <div className="header-right">
          {/* Drawing controls in header */}
          {drawingState?.hasUnsavedDrawing && !isSikringsplanMode && (
            <div className="header-drawing-controls">
              <span
                className="drawing-type-badge"
                style={{ backgroundColor: ANNOTATION_TYPE_COLORS[drawingState.annotationType] }}
              >
                {ANNOTATION_TYPE_LABELS[drawingState.annotationType]}
              </span>
              {drawingState.canUndo && (
                <button
                  className="btn-header-action btn-undo"
                  onClick={drawingState.undoLastPoint}
                  title="Fortryd punkt (Ctrl+Z)"
                >
                  <FiRotateCcw />
                  <span>Fortryd</span>
                </button>
              )}
              <button
                className="btn-header-action btn-cancel"
                onClick={drawingState.cancel}
                title="Annuller (Esc)"
              >
                <FiX />
                <span>Annuller</span>
              </button>
              <button
                className="btn-header-action btn-save"
                onClick={drawingState.save}
                title={`Gem ${ANNOTATION_TYPE_LABELS[drawingState.annotationType]} (Enter)`}
              >
                <FiCheck />
                <span>Gem</span>
              </button>
            </div>
          )}
          {!isAdmin && !isSikringsplanMode && !drawingState?.hasUnsavedDrawing && (
            <span className="view-mode-badge">Kun visning</span>
          )}
        </div>
      </header>

      {isAdmin && !isSikringsplanMode && (
        <Toolbar
          onUploadPdf={handleUploadPdf}
          onReplacePdf={handleReplacePdf}
        />
      )}

      {/* Hidden file input for PDF replacement */}
      <input
        ref={replacePdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleReplacePdfFileSelect}
      />

      <div className="diagram-workspace" ref={diagramContainerRef}>
        <DiagramView
          hideAnnotations={isSikringsplanMode}
          isolationMode={isSikringsplanMode}
          isolationPoints={isolationPoints}
          selectedIsolationPointId={selectedIsolationPointId}
          isIsolationLocked={isIsolationLocked}
          activeIsolationTool={activeIsolationTool}
          isolationPointSize={isolationPointSize}
          onIsolationPointClick={handleIsolationPointClick}
          onIsolationPointCreate={handleIsolationPointCreate}
          onIsolationPointMove={handleIsolationPointMove}
          onDrawingStateChange={handleDrawingStateChange}
        />
        {isSikringsplanMode ? (
          <IsolationPlanSidebar
            diagramId={currentDiagram.id}
            isAdmin={isAdmin}
            initialPlanId={initialPlanId}
            onPointSelected={handleIsolationPointSelected}
            onToolChange={handleIsolationToolChange}
            onLockChange={handleIsolationLockChange}
            onPointsChange={handleIsolationPointsChange}
            onPointSizeChange={handleIsolationPointSizeChange}
            onCaptureDiagram={handleCaptureDiagram}
          />
        ) : (
          <Sidebar />
        )}
      </div>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={clearError}>&times;</button>
        </div>
      )}
    </div>
  );
}
