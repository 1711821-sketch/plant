import { useStore } from '../store/useStore';
import { FiMousePointer, FiEdit3, FiMove, FiUpload, FiTrash2, FiZoomIn, FiZoomOut, FiMaximize, FiLock, FiUnlock, FiRefreshCw } from 'react-icons/fi';

interface ToolbarProps {
  onUploadPdf: () => void;
  onReplacePdf?: () => void;
}

export function Toolbar({ onUploadPdf, onReplacePdf }: ToolbarProps) {
  const {
    currentTool,
    setCurrentTool,
    selectedAnnotationId,
    currentDiagramId,
    deleteAnnotation,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    strokeWidth,
    setStrokeWidth,
    isLocked,
    toggleLock,
    diagrams,
  } = useStore();

  const currentDiagram = diagrams.find((d) => d.id === currentDiagramId);
  const hasAnnotations = currentDiagram && currentDiagram.annotations.length > 0;

  const handleDelete = () => {
    if (selectedAnnotationId && currentDiagramId) {
      if (confirm('Er du sikker på at du vil slette denne markering?')) {
        deleteAnnotation(currentDiagramId, selectedAnnotationId);
      }
    }
  };

  return (
    <div className="toolbar">
      {/* Lock/Unlock Toggle */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isLocked ? 'locked' : ''}`}
          onClick={toggleLock}
          title={isLocked ? 'Lås op for redigering' : 'Lås tegning (skjul markeringer)'}
          disabled={!hasAnnotations}
        >
          {isLocked ? <FiLock /> : <FiUnlock />}
          <span>{isLocked ? 'Låst' : 'Lås'}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Selection & Drawing Tools - disabled when locked */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${currentTool === 'select' ? 'active' : ''}`}
          onClick={() => setCurrentTool('select')}
          title="Vælg (V)"
          disabled={isLocked}
        >
          <FiMousePointer />
          <span>Vælg</span>
        </button>

        <button
          className={`toolbar-btn ${currentTool === 'draw-free' ? 'active' : ''}`}
          onClick={() => setCurrentTool('draw-free')}
          title="Frihånd tegning (F)"
          disabled={isLocked}
        >
          <FiEdit3 />
          <span>Frihånd</span>
        </button>

        <button
          className={`toolbar-btn ${currentTool === 'draw-line' ? 'active' : ''}`}
          onClick={() => setCurrentTool('draw-line')}
          title="Lige linjer - klik punkter (L)"
          disabled={isLocked}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20L20 4" />
            <circle cx="4" cy="20" r="2" fill="currentColor" />
            <circle cx="20" cy="4" r="2" fill="currentColor" />
          </svg>
          <span>Lige linje</span>
        </button>

        <button
          className={`toolbar-btn ${currentTool === 'pan' ? 'active' : ''}`}
          onClick={() => setCurrentTool('pan')}
          title="Panorer (P) - Hold mellemrum nede"
          disabled={isLocked}
        >
          <FiMove />
          <span>Panorer</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Stroke Width Control */}
      <div className="toolbar-group stroke-width-group">
        <label className="stroke-width-label" title="Stregtykkelse">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="12" x2="20" y2="12" strokeWidth={strokeWidth / 4} />
          </svg>
          <span className="stroke-width-value">{strokeWidth}px</span>
        </label>
        <input
          type="range"
          min="4"
          max="40"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="stroke-width-slider"
          title={`Stregtykkelse: ${strokeWidth}px`}
          disabled={isLocked}
        />
      </div>

      <div className="toolbar-divider" />

      {/* Zoom Controls */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={zoomOut}
          title="Zoom ud (-)"
          disabled={zoom <= 0.25}
        >
          <FiZoomOut />
        </button>

        <button
          className="toolbar-btn zoom-display"
          onClick={resetZoom}
          title="Nulstil zoom (0)"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          className="toolbar-btn"
          onClick={zoomIn}
          title="Zoom ind (+)"
          disabled={zoom >= 4}
        >
          <FiZoomIn />
        </button>

        <button
          className="toolbar-btn"
          onClick={resetZoom}
          title="Tilpas til vindue"
        >
          <FiMaximize />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* File & Edit Actions */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onUploadPdf} title="Upload ny PDF tegning">
          <FiUpload />
          <span>Upload PDF</span>
        </button>

        {currentDiagramId && onReplacePdf && (
          <button className="toolbar-btn" onClick={onReplacePdf} title="Erstat PDF tegning">
            <FiRefreshCw />
            <span>Erstat PDF</span>
          </button>
        )}

        {selectedAnnotationId && (
          <button className="toolbar-btn danger" onClick={handleDelete} title="Slet markering">
            <FiTrash2 />
            <span>Slet</span>
          </button>
        )}
      </div>
    </div>
  );
}
