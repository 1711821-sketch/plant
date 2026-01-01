import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiMapPin,
  FiFileText,
  FiLayers,
  FiClipboard,
  FiCalendar,
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
} from 'react-icons/fi';
import { statsApi, type TerminalStats as TerminalStatsType } from '../api/client';
import { useStore } from '../store/useStore';
import './TerminalStats.css';

interface TerminalStatsProps {
  terminalId: string;
  terminalCode?: string;
}

export default function TerminalStats({ terminalId }: TerminalStatsProps) {
  const navigate = useNavigate();
  const { activeInspectionType } = useStore();
  const [stats, setStats] = useState<TerminalStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [terminalId, activeInspectionType]);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await statsApi.getTerminal(terminalId, activeInspectionType);
    if (data) {
      setStats(data);
    } else {
      setError(error || 'Kunne ikke hente statistik');
    }
    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('da-DK', { month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'critical': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  const getUrgencyClass = (daysUntil: number) => {
    if (daysUntil <= 7) return 'urgent';
    if (daysUntil <= 30) return 'soon';
    return 'later';
  };

  if (isLoading) {
    return (
      <div className="terminal-stats loading">
        <div className="loading-spinner" />
        <p>Indlæser statistik...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="terminal-stats error">
        <FiAlertCircle size={32} />
        <p>{error}</p>
        <button onClick={loadStats}>Prøv igen</button>
      </div>
    );
  }

  if (!stats) return null;

  const totalAnnotations =
    (stats.annotationStatus.ok_count || 0) +
    (stats.annotationStatus.warning_count || 0) +
    (stats.annotationStatus.critical_count || 0) +
    (stats.annotationStatus.not_inspected_count || 0);

  return (
    <div className="terminal-stats">
      {/* Overview Cards */}
      <div className="stats-section">
        <h3 className="stats-section-title">
          <FiLayers /> Oversigt
        </h3>
        <div className="overview-cards">
          <div className="overview-card">
            <div className="overview-icon locations">
              <FiMapPin />
            </div>
            <div className="overview-content">
              <span className="overview-value">{stats.overview.total_locations}</span>
              <span className="overview-label">Lokationer</span>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon diagrams">
              <FiFileText />
            </div>
            <div className="overview-content">
              <span className="overview-value">{stats.overview.total_diagrams}</span>
              <span className="overview-label">Tegninger</span>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon annotations">
              <FiLayers />
            </div>
            <div className="overview-content">
              <span className="overview-value">{stats.overview.total_annotations}</span>
              <span className="overview-label">Markeringer</span>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon inspections">
              <FiClipboard />
            </div>
            <div className="overview-content">
              <span className="overview-value">{stats.overview.total_inspections}</span>
              <span className="overview-label">Inspektioner</span>
            </div>
          </div>
        </div>
      </div>

      {/* Type Distribution */}
      {stats.annotationTypes && (stats.annotationTypes.pipe_count > 0 || stats.annotationTypes.tank_count > 0 || stats.annotationTypes.component_count > 0) && (
        <div className="stats-section">
          <h3 className="stats-section-title">
            <FiLayers /> Markeringstyper
          </h3>
          <div className="type-distribution">
            <div className="type-cards">
              <div className="type-card pipe">
                <span className="type-icon">━</span>
                <span className="type-value">{stats.annotationTypes.pipe_count || 0}</span>
                <span className="type-label">Rør</span>
              </div>
              <div className="type-card tank">
                <span className="type-icon">⬡</span>
                <span className="type-value">{stats.annotationTypes.tank_count || 0}</span>
                <span className="type-label">Tanke</span>
              </div>
              <div className="type-card component">
                <span className="type-icon">⚙</span>
                <span className="type-value">{stats.annotationTypes.component_count || 0}</span>
                <span className="type-label">Komponenter</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Distribution */}
      <div className="stats-section">
        <h3 className="stats-section-title">
          <FiCheckCircle /> Inspektionsstatus
        </h3>
        <div className="status-distribution">
          <div className="status-bar-wrapper">
            <div className="status-bar-full">
              {totalAnnotations > 0 && (
                <>
                  {stats.annotationStatus.ok_count > 0 && (
                    <div
                      className="status-segment ok"
                      style={{ width: `${(stats.annotationStatus.ok_count / totalAnnotations) * 100}%` }}
                    />
                  )}
                  {stats.annotationStatus.warning_count > 0 && (
                    <div
                      className="status-segment warning"
                      style={{ width: `${(stats.annotationStatus.warning_count / totalAnnotations) * 100}%` }}
                    />
                  )}
                  {stats.annotationStatus.critical_count > 0 && (
                    <div
                      className="status-segment critical"
                      style={{ width: `${(stats.annotationStatus.critical_count / totalAnnotations) * 100}%` }}
                    />
                  )}
                  {stats.annotationStatus.not_inspected_count > 0 && (
                    <div
                      className="status-segment not-inspected"
                      style={{ width: `${(stats.annotationStatus.not_inspected_count / totalAnnotations) * 100}%` }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="status-legend">
            <div className="legend-item">
              <span className="legend-dot ok" />
              <span>OK ({stats.annotationStatus.ok_count || 0})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot warning" />
              <span>Advarsel ({stats.annotationStatus.warning_count || 0})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot critical" />
              <span>Kritisk ({stats.annotationStatus.critical_count || 0})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot not-inspected" />
              <span>Ikke inspiceret ({stats.annotationStatus.not_inspected_count || 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      {(stats.overview.overdue_count > 0 || stats.overview.critical_measurements > 0) && (
        <div className="stats-section">
          <div className="alert-cards">
            {stats.overview.overdue_count > 0 && (
              <div className="alert-card overdue">
                <FiAlertTriangle />
                <div className="alert-content">
                  <span className="alert-value">{stats.overview.overdue_count}</span>
                  <span className="alert-label">Forfaldne inspektioner</span>
                </div>
              </div>
            )}
            {stats.overview.critical_measurements > 0 && (
              <div className="alert-card critical">
                <FiAlertCircle />
                <div className="alert-content">
                  <span className="alert-value">{stats.overview.critical_measurements}</span>
                  <span className="alert-label">Kritiske målinger</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspection Timeline */}
      {stats.inspectionTimeline.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">
            <FiCalendar /> Inspektionsplan (12 måneder)
          </h3>
          <div className="timeline-chart">
            {stats.inspectionTimeline.map((item) => (
              <div key={item.month} className="timeline-bar-wrapper">
                <div className="timeline-bar">
                  <div
                    className="timeline-bar-fill"
                    style={{
                      height: `${Math.min((item.count / Math.max(...stats.inspectionTimeline.map((i) => i.count))) * 100, 100)}%`,
                    }}
                  >
                    <span className="timeline-count">{item.count}</span>
                  </div>
                </div>
                <span className="timeline-label">{formatMonth(item.month)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Inspections */}
      {stats.overdueInspections.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title overdue">
            <FiAlertTriangle /> Forfaldne inspektioner
          </h3>
          <div className="inspection-timeline-list">
            {stats.overdueInspections.map((inspection) => (
              <div
                key={inspection.id}
                className="inspection-timeline-item overdue"
                onClick={() => navigate(`/diagram/${inspection.diagram_id}?annotation=${inspection.id}`)}
              >
                <div className="timeline-item-status">
                  <FiXCircle />
                </div>
                <div className="timeline-item-content">
                  <div className="timeline-item-header">
                    <span className="kks-number">{inspection.kks_number}</span>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(inspection.status) }}
                    />
                  </div>
                  <div className="timeline-item-details">
                    <span>{inspection.location_name}</span>
                    <span className="separator">•</span>
                    <span>{inspection.diagram_name}</span>
                  </div>
                </div>
                <div className="timeline-item-date overdue">
                  <span className="days">{Math.round(inspection.days_overdue)} dage</span>
                  <span className="label">forfalden</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Inspections */}
      {stats.upcomingInspections.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">
            <FiClock /> Kommende inspektioner (90 dage)
          </h3>
          <div className="inspection-timeline-list">
            {stats.upcomingInspections.map((inspection) => (
              <div
                key={inspection.id}
                className={`inspection-timeline-item ${getUrgencyClass(inspection.days_until)}`}
                onClick={() => navigate(`/diagram/${inspection.diagram_id}?annotation=${inspection.id}`)}
              >
                <div className="timeline-item-status">
                  <FiCalendar />
                </div>
                <div className="timeline-item-content">
                  <div className="timeline-item-header">
                    <span className="kks-number">{inspection.kks_number}</span>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(inspection.status) }}
                    />
                  </div>
                  <div className="timeline-item-details">
                    <span>{inspection.location_name}</span>
                    <span className="separator">•</span>
                    <span>{inspection.diagram_name}</span>
                  </div>
                </div>
                <div className={`timeline-item-date ${getUrgencyClass(inspection.days_until)}`}>
                  <span className="days">
                    {inspection.days_until <= 0
                      ? 'I dag'
                      : inspection.days_until === 1
                      ? '1 dag'
                      : `${Math.round(inspection.days_until)} dage`}
                  </span>
                  <span className="label">{formatDate(inspection.next_inspection)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Inspections */}
      {stats.recentInspections.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">
            <FiClipboard /> Seneste inspektioner
          </h3>
          <div className="recent-list">
            {stats.recentInspections.map((inspection) => (
              <div
                key={inspection.id}
                className="recent-item"
                onClick={() => navigate(`/diagram/${inspection.annotation_id}`)}
              >
                <div className="recent-item-info">
                  <span className="kks">{inspection.kks_number}</span>
                  <span className="location">{inspection.location_name}</span>
                </div>
                <div className="recent-item-meta">
                  <span className="date">{formatDate(inspection.inspection_date)}</span>
                  <span className={`status-pill ${inspection.overall_status}`}>
                    {inspection.overall_status === 'approved'
                      ? 'Godkendt'
                      : inspection.overall_status === 'conditional'
                      ? 'Betinget'
                      : inspection.overall_status === 'rejected'
                      ? 'Afvist'
                      : 'Afventer'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location Stats */}
      {stats.locationStats.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">
            <FiMapPin /> Status per lokation
          </h3>
          <div className="location-stats-grid">
            {stats.locationStats.map((loc) => {
              const total =
                (loc.ok_count || 0) +
                (loc.warning_count || 0) +
                (loc.critical_count || 0) +
                (loc.not_inspected_count || 0);
              return (
                <div key={loc.id} className="location-stat-card">
                  <div className="location-stat-header">
                    <span className="location-name">{loc.name}</span>
                    <span className="annotation-count">{loc.annotation_count || 0} markeringer</span>
                  </div>
                  {total > 0 && (
                    <div className="mini-status-bar">
                      {loc.ok_count > 0 && (
                        <div className="mini-segment ok" style={{ width: `${(loc.ok_count / total) * 100}%` }} />
                      )}
                      {loc.warning_count > 0 && (
                        <div className="mini-segment warning" style={{ width: `${(loc.warning_count / total) * 100}%` }} />
                      )}
                      {loc.critical_count > 0 && (
                        <div className="mini-segment critical" style={{ width: `${(loc.critical_count / total) * 100}%` }} />
                      )}
                      {loc.not_inspected_count > 0 && (
                        <div className="mini-segment not-inspected" style={{ width: `${(loc.not_inspected_count / total) * 100}%` }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
