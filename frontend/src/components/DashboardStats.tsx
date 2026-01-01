import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiGrid, FiLayers, FiMapPin, FiFileText, FiAlertCircle, FiTrendingUp, FiShield, FiPlay, FiLock } from 'react-icons/fi';
import { statsApi, isolationPlanApi, type DashboardStats } from '../api/client';
import { useStore } from '../store/useStore';
import { ANNOTATION_TYPE_LABELS, ISOLATION_PLAN_STATUS_LABELS, ISOLATION_PLAN_STATUS_COLORS, type IsolationPlan } from '../types';
import './DashboardStats.css';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}

function StatCard({ title, value, icon, color = 'default', subtitle }: StatCardProps) {
  return (
    <div className={`stat-card stat-card-modern stat-card-${color} hover-glow`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-title">{title}</span>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

interface StatusBarProps {
  ok: number;
  warning: number;
  critical: number;
  notInspected: number;
}

function StatusBar({ ok, warning, critical, notInspected }: StatusBarProps) {
  const total = ok + warning + critical + notInspected;
  if (total === 0) return null;

  const okPct = (ok / total) * 100;
  const warningPct = (warning / total) * 100;
  const criticalPct = (critical / total) * 100;
  const notInspectedPct = (notInspected / total) * 100;

  return (
    <div className="status-bar-container">
      <div className="status-bar">
        {ok > 0 && <div className="status-bar-segment status-ok" style={{ width: `${okPct}%` }} title={`OK: ${ok}`} />}
        {warning > 0 && <div className="status-bar-segment status-warning" style={{ width: `${warningPct}%` }} title={`Advarsel: ${warning}`} />}
        {critical > 0 && <div className="status-bar-segment status-critical" style={{ width: `${criticalPct}%` }} title={`Kritisk: ${critical}`} />}
        {notInspected > 0 && <div className="status-bar-segment status-not-inspected" style={{ width: `${notInspectedPct}%` }} title={`Ikke inspiceret: ${notInspected}`} />}
      </div>
      <div className="status-bar-legend">
        <span className="legend-item"><span className="legend-dot status-ok" /> OK ({ok})</span>
        <span className="legend-item"><span className="legend-dot status-warning" /> Advarsel ({warning})</span>
        <span className="legend-item"><span className="legend-dot status-critical" /> Kritisk ({critical})</span>
        <span className="legend-item"><span className="legend-dot status-not-inspected" /> Ikke inspiceret ({notInspected})</span>
      </div>
    </div>
  );
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    approved: 'Godkendt',
    conditional: 'Betinget',
    rejected: 'Afvist',
    pending: 'Afventer',
  };
  return texts[status] || status;
}

function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    approved: 'status-approved',
    conditional: 'status-conditional',
    rejected: 'status-rejected',
    pending: 'status-pending',
  };
  return classes[status] || '';
}

export default function DashboardStatsComponent() {
  const navigate = useNavigate();
  const { activeInspectionType } = useStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activePlans, setActivePlans] = useState<IsolationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    loadActivePlans();
  }, [activeInspectionType]);

  async function loadStats() {
    setLoading(true);
    const result = await statsApi.getDashboard(activeInspectionType);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setStats(result.data);
    }
    setLoading(false);
  }

  async function loadActivePlans() {
    const result = await isolationPlanApi.getActive();
    if (result.data) {
      setActivePlans(result.data);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-stats loading">
        <div className="loading-spinner" />
        <p>Indlæser statistik...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-stats error">
        <FiAlertCircle size={24} />
        <p>{error}</p>
        <button onClick={loadStats}>Prøv igen</button>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, annotationStatus, inspectionStatus, terminalStats, recentInspections } = stats;

  return (
    <div className="dashboard-stats">
      {/* Overview Cards */}
      <section className="stats-section">
        <h2 className="stats-section-title">
          <FiTrendingUp /> Overblik
        </h2>
        <div className="stats-cards-grid">
          <StatCard
            title="Terminaler"
            value={overview.total_terminals}
            icon={<FiGrid />}
            color="info"
          />
          <StatCard
            title="Lokationer"
            value={overview.total_locations}
            icon={<FiMapPin />}
            color="info"
          />
          <StatCard
            title="Diagrammer"
            value={overview.total_diagrams}
            icon={<FiFileText />}
            color="info"
          />
          <StatCard
            title={`${ANNOTATION_TYPE_LABELS[activeInspectionType]} markeringer`}
            value={overview.total_annotations}
            icon={<FiLayers />}
            color="default"
          />
          <StatCard
            title="Inspektioner"
            value={overview.total_inspections}
            icon={<FiActivity />}
            color="default"
          />
          <StatCard
            title="Kommende (30 dage)"
            value={overview.upcoming_inspections}
            icon={<FiClock />}
            color="warning"
            subtitle="Inspektioner planlagt"
          />
          <StatCard
            title="Forfaldne"
            value={overview.overdue_inspections}
            icon={<FiAlertTriangle />}
            color={overview.overdue_inspections > 0 ? 'danger' : 'success'}
            subtitle="Overskredet deadline"
          />
          <StatCard
            title="Kritiske målinger"
            value={overview.critical_measurements}
            icon={<FiAlertCircle />}
            color={overview.critical_measurements > 0 ? 'danger' : 'success'}
            subtitle="Under alert-grænse"
          />
        </div>
      </section>

      {/* Annotation Status Overview */}
      <section className="stats-section">
        <h2 className="stats-section-title">
          <FiCheckCircle /> {ANNOTATION_TYPE_LABELS[activeInspectionType]} status
        </h2>
        <StatusBar
          ok={annotationStatus.ok_count}
          warning={annotationStatus.warning_count}
          critical={annotationStatus.critical_count}
          notInspected={annotationStatus.not_inspected_count}
        />
      </section>

      {/* Inspection Status */}
      <section className="stats-section">
        <h2 className="stats-section-title">
          <FiActivity /> Inspektionsstatus
        </h2>
        <div className="inspection-status-cards">
          <div className="inspection-status-card approved">
            <span className="status-count">{inspectionStatus.approved_count}</span>
            <span className="status-label">Godkendt</span>
          </div>
          <div className="inspection-status-card conditional">
            <span className="status-count">{inspectionStatus.conditional_count}</span>
            <span className="status-label">Betinget</span>
          </div>
          <div className="inspection-status-card rejected">
            <span className="status-count">{inspectionStatus.rejected_count}</span>
            <span className="status-label">Afvist</span>
          </div>
          <div className="inspection-status-card pending">
            <span className="status-count">{inspectionStatus.pending_count}</span>
            <span className="status-label">Afventer</span>
          </div>
        </div>
      </section>

      {/* Terminal Stats */}
      {terminalStats.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section-title">
            <FiGrid /> Status per Terminal
          </h2>
          <div className="terminal-stats-table">
            <table>
              <thead>
                <tr>
                  <th>Terminal</th>
                  <th>{ANNOTATION_TYPE_LABELS[activeInspectionType]}</th>
                  <th>OK</th>
                  <th>Advarsel</th>
                  <th>Kritisk</th>
                  <th>Ikke insp.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {terminalStats.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.code}</strong>
                      <span className="terminal-name">{t.name}</span>
                    </td>
                    <td>{t.annotation_count}</td>
                    <td className="status-cell ok">{t.ok_count}</td>
                    <td className="status-cell warning">{t.warning_count}</td>
                    <td className="status-cell critical">{t.critical_count}</td>
                    <td className="status-cell not-inspected">{t.not_inspected_count}</td>
                    <td>
                      <div className="mini-status-bar">
                        {t.annotation_count > 0 && (
                          <>
                            <div className="mini-segment ok" style={{ width: `${(t.ok_count / t.annotation_count) * 100}%` }} />
                            <div className="mini-segment warning" style={{ width: `${(t.warning_count / t.annotation_count) * 100}%` }} />
                            <div className="mini-segment critical" style={{ width: `${(t.critical_count / t.annotation_count) * 100}%` }} />
                            <div className="mini-segment not-inspected" style={{ width: `${(t.not_inspected_count / t.annotation_count) * 100}%` }} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Active Isolation Plans */}
      {activePlans.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section-title">
            <FiShield /> Aktive Sikringsplaner
          </h2>
          <div className="isolation-plans-grid">
            {activePlans.map((plan) => (
              <div
                key={plan.id}
                className="isolation-plan-card glass-card hover-glow"
                onClick={() => navigate(`/diagram/${plan.diagramId}`)}
              >
                <div className="plan-card-header">
                  <span
                    className="plan-status-badge"
                    style={{ background: ISOLATION_PLAN_STATUS_COLORS[plan.status] }}
                  >
                    {plan.status === 'active' ? <FiPlay /> : <FiLock />}
                    {ISOLATION_PLAN_STATUS_LABELS[plan.status]}
                  </span>
                  {plan.terminalCode && (
                    <span className="terminal-badge">{plan.terminalCode}</span>
                  )}
                </div>
                <h3 className="plan-name">{plan.name}</h3>
                {plan.description && (
                  <p className="plan-description">{plan.description}</p>
                )}
                <div className="plan-card-footer">
                  <div className="plan-meta">
                    {plan.equipmentTag && (
                      <span className="equipment-tag">{plan.equipmentTag}</span>
                    )}
                    {plan.workOrder && (
                      <span className="work-order">WO: {plan.workOrder}</span>
                    )}
                  </div>
                  <div className="plan-progress">
                    <span className="progress-text">
                      {plan.verifiedCount || 0} / {plan.pointCount || 0} verificeret
                    </span>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: plan.pointCount
                            ? `${((plan.verifiedCount || 0) / plan.pointCount) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Inspections */}
      {recentInspections.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section-title">
            <FiClock /> Seneste Inspektioner
          </h2>
          <div className="recent-inspections-list">
            {recentInspections.map((insp) => (
              <div key={insp.id} className="recent-inspection-item">
                <div className="inspection-info">
                  <span className="kks-number">{insp.kks_number}</span>
                  {insp.terminal_code && (
                    <span className="terminal-badge">{insp.terminal_code}</span>
                  )}
                </div>
                <div className="inspection-details">
                  <span className="inspector">{insp.inspector_name}</span>
                  <span className="date">
                    {new Date(insp.inspection_date).toLocaleDateString('da-DK')}
                  </span>
                </div>
                <span className={`inspection-status ${getStatusClass(insp.overall_status)}`}>
                  {getStatusText(insp.overall_status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
