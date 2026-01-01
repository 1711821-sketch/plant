import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiShield } from 'react-icons/fi';
import { useStore } from '../store/useStore';
import { authApi } from '../api/client';
import { Toolbar } from '../components/Toolbar';
import { DiagramView } from '../components/DiagramView';
import { Sidebar } from '../components/Sidebar';
import { IsolationPlanSidebar } from '../components/IsolationPlanSidebar';
import InspectionTypeBadge from '../components/InspectionTypeSelector';
import type { User, IsolationPoint, IsolationPointType } from '../types';
import { ANNOTATION_TYPE_LABELS } from '../types';

export function DiagramPage() {
  const { diagramId } = useParams<{ diagramId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if we're in sikringsplan mode
  const isSikringsplanMode = searchParams.get('opretSikringsplan') === 'true';

  const [user, setUser] = useState<User | null>(null);
  const {
    fetchDiagram,
    diagrams,
    currentDiagramId,
    isLoading,
    error,
    clearError,
    setLocked,
    activeInspectionType,
  } = useStore();

  const isAdmin = user?.role === 'admin';
  const currentDiagram = diagrams.find((d) => d.id === currentDiagramId);

  // Isolation plan state
  const [isolationPoints, setIsolationPoints] = useState<IsolationPoint[]>([]);
  const [selectedIsolationPointId, setSelectedIsolationPointId] = useState<string | null>(null);
  const [isIsolationLocked, setIsIsolationLocked] = useState(true);
  const [activeIsolationTool, setActiveIsolationTool] = useState<IsolationPointType | null>(null);
  const [isolationPointSize, setIsolationPointSize] = useState<number>(22);

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
          {!isAdmin && !isSikringsplanMode && (
            <span className="view-mode-badge">Kun visning</span>
          )}
        </div>
      </header>

      {isAdmin && !isSikringsplanMode && <Toolbar onUploadPdf={handleUploadPdf} />}

      <div className="diagram-workspace">
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
        />
        {isSikringsplanMode ? (
          <IsolationPlanSidebar
            diagramId={currentDiagram.id}
            isAdmin={isAdmin}
            onPointSelected={handleIsolationPointSelected}
            onToolChange={handleIsolationToolChange}
            onLockChange={handleIsolationLockChange}
            onPointsChange={handleIsolationPointsChange}
            onPointSizeChange={handleIsolationPointSizeChange}
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
