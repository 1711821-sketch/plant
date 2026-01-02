import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { STATUS_COLORS, ANNOTATION_TYPE_LABELS, ANNOTATION_TYPE_COLORS, type PipeAnnotation, type Inspection, type AnnotationType } from '../types';
import { FiChevronDown, FiChevronRight, FiPlusCircle, FiClipboard, FiAlertCircle, FiCheckCircle, FiAlertTriangle, FiClock } from 'react-icons/fi';
import { inspectionApi } from '../api/client';
import { InspectionForm } from './InspectionForm';

export function Sidebar() {
  const {
    diagrams,
    currentDiagramId,
    selectedAnnotationId,
    setSelectedAnnotation,
    updateAnnotation,
    isLocked,
    activeInspectionType,
  } = useStore();

  const currentDiagram = diagrams.find((d) => d.id === currentDiagramId);

  // Filter annotations by active inspection type
  const filteredAnnotations = currentDiagram?.annotations.filter(
    (a) => (a.annotationType || 'pipe') === activeInspectionType
  ) || [];

  // Only show selected annotation if it matches the active inspection type
  const selectedAnnotation = currentDiagram?.annotations.find(
    (a) => a.id === selectedAnnotationId && (a.annotationType || 'pipe') === activeInspectionType
  );

  const [expandedSections, setExpandedSections] = useState({
    list: true,
    details: true,
    inspections: true,
  });

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [editingInspectionId, setEditingInspectionId] = useState<string | undefined>();

  // Load inspections when annotation changes
  useEffect(() => {
    if (selectedAnnotationId) {
      loadInspections();
    } else {
      setInspections([]);
    }
  }, [selectedAnnotationId]);

  const loadInspections = async () => {
    if (!selectedAnnotationId) return;

    setLoadingInspections(true);
    const { data, error } = await inspectionApi.getByAnnotation(selectedAnnotationId);

    if (!error && data) {
      setInspections(data);
    }
    setLoadingInspections(false);
  };

  const handleNewInspection = () => {
    setEditingInspectionId(undefined);
    setShowInspectionForm(true);
  };

  const handleEditInspection = (inspectionId: string) => {
    setEditingInspectionId(inspectionId);
    setShowInspectionForm(true);
  };

  const handleInspectionSaved = () => {
    setShowInspectionForm(false);
    setEditingInspectionId(undefined);
    loadInspections();
  };

  const toggleSection = (section: 'list' | 'details' | 'inspections') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleUpdateAnnotation = (updates: Partial<PipeAnnotation>) => {
    if (currentDiagramId && selectedAnnotationId) {
      updateAnnotation(currentDiagramId, selectedAnnotationId, updates);
    }
  };

  // Get annotation type icon
  const getTypeIcon = (type: AnnotationType) => {
    switch (type) {
      case 'pipe': return '━';
      case 'tank': return '⬡';
      case 'component': return '⚙';
      default: return '━';
    }
  };

  // Get status icon
  const getStatusIcon = (status: PipeAnnotation['status']) => {
    switch (status) {
      case 'ok': return <FiCheckCircle />;
      case 'warning': return <FiAlertTriangle />;
      case 'critical': return <FiAlertCircle />;
      default: return <FiClock />;
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Inspektioner</h2>
        {currentDiagram && <p className="diagram-name">{currentDiagram.name}</p>}
      </div>

      {/* Selected Annotation Hero Card */}
      {selectedAnnotation ? (
        <div
          className="selected-annotation-hero"
          style={{
            '--status-color': STATUS_COLORS[selectedAnnotation.status]
          } as React.CSSProperties}
        >
          <div className="hero-status-indicator">
            {getStatusIcon(selectedAnnotation.status)}
          </div>
          <div className="hero-content">
            <span className="hero-kks">{selectedAnnotation.kksNumber}</span>
            <span className="hero-type">
              <span style={{ color: ANNOTATION_TYPE_COLORS[selectedAnnotation.annotationType || 'pipe'] }}>
                {getTypeIcon(selectedAnnotation.annotationType || 'pipe')}
              </span>
              {ANNOTATION_TYPE_LABELS[selectedAnnotation.annotationType || 'pipe']}
            </span>
          </div>
          <div className="hero-status-badge">
            {getStatusText(selectedAnnotation.status)}
          </div>
        </div>
      ) : filteredAnnotations.length > 0 ? (
        <div className="select-annotation-prompt">
          <FiClipboard className="prompt-icon" />
          <span>Vælg en markering for at se detaljer</span>
        </div>
      ) : null}

      {/* Annotations List */}
      <div className="sidebar-section">
        <button className="section-header" onClick={() => toggleSection('list')}>
          {expandedSections.list ? <FiChevronDown /> : <FiChevronRight />}
          <span>{ANNOTATION_TYPE_LABELS[activeInspectionType]} ({filteredAnnotations.length})</span>
        </button>

        {expandedSections.list && (
          <div className="annotations-list">
            {filteredAnnotations.length === 0 && (
              <p className="empty-state">
                <FiPlusCircle />
                Brug tegneværktøjer til at markere {ANNOTATION_TYPE_LABELS[activeInspectionType].toLowerCase()}
              </p>
            )}
            {filteredAnnotations.map((annotation) => (
              <div
                key={annotation.id}
                className={`annotation-item ${annotation.id === selectedAnnotationId ? 'selected' : ''}`}
                onClick={() => setSelectedAnnotation(annotation.id)}
              >
                <span
                  className="type-icon"
                  style={{ color: ANNOTATION_TYPE_COLORS[annotation.annotationType || 'pipe'] }}
                  title={ANNOTATION_TYPE_LABELS[annotation.annotationType || 'pipe']}
                >
                  {getTypeIcon(annotation.annotationType || 'pipe')}
                </span>
                <span
                  className="status-dot"
                  style={{ backgroundColor: STATUS_COLORS[annotation.status] }}
                />
                <span className="kks-number">{annotation.kksNumber}</span>
                <span className="status-text">{getStatusText(annotation.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Annotation Details */}
      {selectedAnnotation && (
        <div className="sidebar-section">
          <button className="section-header" onClick={() => toggleSection('details')}>
            {expandedSections.details ? <FiChevronDown /> : <FiChevronRight />}
            <span>Detaljer</span>
          </button>

          {expandedSections.details && (
            <div className="annotation-details">
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <input
                    type="text"
                    value={ANNOTATION_TYPE_LABELS[selectedAnnotation.annotationType || 'pipe']}
                    disabled
                    style={{
                      borderColor: ANNOTATION_TYPE_COLORS[selectedAnnotation.annotationType || 'pipe'],
                      backgroundColor: 'var(--bg-gray)',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>KKS Nummer</label>
                  <input
                    type="text"
                    value={selectedAnnotation.kksNumber}
                    onChange={(e) => handleUpdateAnnotation({ kksNumber: e.target.value })}
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={selectedAnnotation.status}
                  onChange={(e) =>
                    handleUpdateAnnotation({
                      status: e.target.value as PipeAnnotation['status'],
                    })
                  }
                >
                  <option value="not_inspected">Ikke inspiceret</option>
                  <option value="ok">OK</option>
                  <option value="warning">Advarsel</option>
                  <option value="critical">Kritisk</option>
                </select>
              </div>

              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea
                  value={selectedAnnotation.description || ''}
                  onChange={(e) => handleUpdateAnnotation({ description: e.target.value })}
                  placeholder="Tilføj beskrivelse..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Materiale</label>
                  <input
                    type="text"
                    value={selectedAnnotation.material || ''}
                    onChange={(e) => handleUpdateAnnotation({ material: e.target.value })}
                    placeholder="f.eks. SS316"
                  />
                </div>

                <div className="form-group">
                  <label>{selectedAnnotation.annotationType === 'tank' ? 'Kapacitet' : 'Dimension'}</label>
                  <input
                    type="text"
                    value={selectedAnnotation.diameter || ''}
                    onChange={(e) => handleUpdateAnnotation({ diameter: e.target.value })}
                    placeholder={selectedAnnotation.annotationType === 'tank' ? 'f.eks. 1000 m³' : 'f.eks. DN100'}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sidste inspektion</label>
                  <input
                    type="date"
                    value={selectedAnnotation.lastInspection || ''}
                    onChange={(e) => handleUpdateAnnotation({ lastInspection: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Næste inspektion</label>
                  <input
                    type="date"
                    value={selectedAnnotation.nextInspection || ''}
                    onChange={(e) => handleUpdateAnnotation({ nextInspection: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-meta">
                <small>Oprettet: {new Date(selectedAnnotation.createdAt).toLocaleDateString('da-DK')}</small>
                <small>Opdateret: {new Date(selectedAnnotation.updatedAt).toLocaleDateString('da-DK')}</small>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspections Section */}
      {selectedAnnotation && (
        <div className="sidebar-section inspections-section">
          <button className="section-header" onClick={() => toggleSection('inspections')}>
            {expandedSections.inspections ? <FiChevronDown /> : <FiChevronRight />}
            <FiClipboard style={{ marginLeft: '0.25rem' }} />
            <span>Inspektioner ({inspections.length})</span>
          </button>

          {expandedSections.inspections && (
            <div className="inspections-content">
              {loadingInspections ? (
                <div className="loading-state" style={{ padding: '1rem' }}>
                  <small>Indlæser inspektioner...</small>
                </div>
              ) : inspections.length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem', border: 'none', background: 'transparent' }}>
                  <small>Ingen inspektioner endnu</small>
                </div>
              ) : (
                <div className="inspections-list">
                  {inspections.map((inspection) => (
                    <div
                      key={inspection.id}
                      className="inspection-item"
                      onClick={() => handleEditInspection(inspection.id)}
                    >
                      <span className="inspection-date">
                        {new Date(inspection.inspectionDate).toLocaleDateString('da-DK')}
                      </span>
                      {inspection.reportNumber && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {inspection.reportNumber}
                        </span>
                      )}
                      <span className={`inspection-status ${inspection.overallStatus}`}>
                        {getInspectionStatusText(inspection.overallStatus)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!isLocked && (
                <button className="btn-new-inspection" onClick={handleNewInspection}>
                  <FiPlusCircle />
                  Ny inspektion
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspection Form Modal */}
      {showInspectionForm && selectedAnnotation && (
        <InspectionForm
          annotationId={selectedAnnotation.id}
          kksNumber={selectedAnnotation.kksNumber}
          material={selectedAnnotation.material}
          diameter={selectedAnnotation.diameter}
          inspectionId={editingInspectionId}
          onClose={() => {
            setShowInspectionForm(false);
            setEditingInspectionId(undefined);
          }}
          onSaved={handleInspectionSaved}
        />
      )}
    </aside>
  );
}

function getInspectionStatusText(status: string): string {
  const texts: Record<string, string> = {
    approved: 'Godkendt',
    conditional: 'Betinget',
    rejected: 'Afvist',
    pending: 'Afventer',
  };
  return texts[status] || status;
}

function getStatusText(status: PipeAnnotation['status']): string {
  const texts = {
    ok: 'OK',
    warning: 'Advarsel',
    critical: 'Kritisk',
    not_inspected: 'Ikke inspiceret',
  };
  return texts[status];
}
