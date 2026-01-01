import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ANNOTATION_TYPE_LABELS, ANNOTATION_TYPE_COLORS, type AnnotationType } from '../types';
import './InspectionTypeSelector.css';

const TYPE_ICONS: Record<AnnotationType, string> = {
  pipe: '━',
  tank: '⬡',
  component: '⚙',
};

const TYPE_DESCRIPTIONS: Record<AnnotationType, string> = {
  pipe: 'Rørsystemer og rørledninger',
  tank: 'Tanke og beholdere',
  component: 'Pumper, ventiler, varmevekslere m.m.',
};

export function InspectionTypeSelector() {
  const navigate = useNavigate();
  const { activeInspectionType, setActiveInspectionType } = useStore();

  return (
    <div className="inspection-type-selector">
      <div className="type-selector-header">
        <h2>Vælg arbejdsområde</h2>
        <p>Vælg hvilken type udstyr eller funktion du vil arbejde med</p>
      </div>
      <div className="type-selector-cards">
        {(['pipe', 'tank', 'component'] as AnnotationType[]).map((type) => (
          <button
            key={type}
            className={`type-selector-card ${activeInspectionType === type ? 'active' : ''}`}
            onClick={() => setActiveInspectionType(type)}
            style={{
              '--type-color': ANNOTATION_TYPE_COLORS[type],
            } as React.CSSProperties}
          >
            <div className="type-selector-icon">
              {TYPE_ICONS[type]}
            </div>
            <div className="type-selector-content">
              <h3>{ANNOTATION_TYPE_LABELS[type]}</h3>
              <p>{TYPE_DESCRIPTIONS[type]}</p>
            </div>
            {activeInspectionType === type && (
              <div className="type-selector-check">✓</div>
            )}
          </button>
        ))}

        {/* Sikringsplaner - Separate section */}
        <button
          className="type-selector-card isolation-card"
          onClick={() => navigate('/sikringsplaner')}
          style={{
            '--type-color': '#6366f1',
          } as React.CSSProperties}
        >
          <div className="type-selector-icon isolation-icon">
            🛡️
          </div>
          <div className="type-selector-content">
            <h3>Sikringsplaner</h3>
            <p>LOTO - Sikring af udstyr ved vedligehold</p>
          </div>
          <div className="type-selector-arrow">→</div>
        </button>
      </div>
    </div>
  );
}

// Compact version for header/toolbar
export function InspectionTypeBadge() {
  const { activeInspectionType, setActiveInspectionType } = useStore();

  return (
    <div className="inspection-type-badge">
      {(['pipe', 'tank', 'component'] as AnnotationType[]).map((type) => (
        <button
          key={type}
          className={`type-badge-btn ${activeInspectionType === type ? 'active' : ''}`}
          onClick={() => setActiveInspectionType(type)}
          title={ANNOTATION_TYPE_LABELS[type]}
          style={{
            '--type-color': ANNOTATION_TYPE_COLORS[type],
          } as React.CSSProperties}
        >
          <span className="badge-icon">{TYPE_ICONS[type]}</span>
          <span className="badge-label">{ANNOTATION_TYPE_LABELS[type]}</span>
        </button>
      ))}
    </div>
  );
}

export default InspectionTypeSelector;

export { InspectionTypeBadge };
