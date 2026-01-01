import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiPlus,
  FiShield,
  FiPlay,
  FiCheck,
  FiClock,
  FiEdit2,
  FiFileText,
  FiMapPin,
  FiCalendar,
  FiUser,
  FiChevronRight,
  FiX
} from 'react-icons/fi';
import { isolationPlanApi, terminalApi, locationApi, authApi } from '../api/client';
import type { IsolationPlan, User } from '../types';
import {
  ISOLATION_PLAN_STATUS_LABELS,
  ISOLATION_PLAN_STATUS_COLORS
} from '../types';

type FilterStatus = 'all' | 'active' | 'draft' | 'completed';
type ModalStep = 'terminal' | 'location' | 'diagram';

interface Terminal {
  id: string;
  code: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  diagram_count: number;
}

interface Diagram {
  id: string;
  name: string;
}

export function SikringsplanerPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<IsolationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  // Modal state for creating new plan
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('terminal');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadUser();
    loadPlans();
  }, []);

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

  const loadPlans = async () => {
    setLoading(true);
    const { data } = await isolationPlanApi.getAll();
    if (data) {
      setPlans(data);
    }
    setLoading(false);
  };

  const openModal = async () => {
    setShowModal(true);
    setModalStep('terminal');
    setSelectedTerminal(null);
    setSelectedLocation(null);
    setLocations([]);
    setDiagrams([]);
    setLoadingData(true);

    // Load terminals
    const { data: terminalData } = await terminalApi.getAll();
    if (terminalData) {
      setTerminals(terminalData);
    }

    setLoadingData(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalStep('terminal');
    setSelectedTerminal(null);
    setSelectedLocation(null);
  };

  const selectTerminal = async (terminal: Terminal) => {
    setSelectedTerminal(terminal);
    setModalStep('location');
    setLoadingData(true);

    // Load locations for this terminal
    const { data: locationData } = await locationApi.getByTerminal(terminal.id);
    if (locationData) {
      setLocations(locationData);
    }

    setLoadingData(false);
  };

  const selectLocation = async (location: Location) => {
    setSelectedLocation(location);
    setModalStep('diagram');
    setLoadingData(true);

    // Load diagrams for this location
    const { data: locationDetail } = await locationApi.getOne(location.id);
    if (locationDetail?.diagrams) {
      setDiagrams(locationDetail.diagrams);
    }

    setLoadingData(false);
  };

  const selectDiagram = (diagramId: string) => {
    closeModal();
    navigate(`/diagram/${diagramId}?opretSikringsplan=true`);
  };

  const goBack = () => {
    if (modalStep === 'location') {
      setModalStep('terminal');
      setSelectedTerminal(null);
    } else if (modalStep === 'diagram') {
      setModalStep('location');
      setSelectedLocation(null);
    }
  };

  const filteredPlans = plans.filter((plan) => {
    if (filter === 'all') return true;
    if (filter === 'active') return plan.status === 'active' || plan.status === 'approved';
    if (filter === 'draft') return plan.status === 'draft' || plan.status === 'pending_approval';
    if (filter === 'completed') return plan.status === 'completed';
    return true;
  });

  const getStatusIcon = (status: IsolationPlan['status']) => {
    switch (status) {
      case 'active': return <FiPlay />;
      case 'approved': return <FiCheck />;
      case 'pending_approval': return <FiClock />;
      case 'draft': return <FiEdit2 />;
      case 'completed': return <FiCheck />;
      default: return <FiShield />;
    }
  };

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'active').length,
    approved: plans.filter(p => p.status === 'approved').length,
    draft: plans.filter(p => p.status === 'draft' || p.status === 'pending_approval').length,
    completed: plans.filter(p => p.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Indlaeser sikringsplaner...</p>
      </div>
    );
  }

  return (
    <div className="sikringsplaner-page">
      {/* Modern animated background */}
      <div className="modern-background" />

      <header className="page-header dashboard-header-modern">
        <button className="btn-back" onClick={() => navigate('/')}>
          <FiArrowLeft />
          <span>Tilbage</span>
        </button>
        <div className="header-title">
          <FiShield className="header-icon" />
          <h1>Sikringsplaner</h1>
          <span className="header-subtitle">LOTO - Lock Out Tag Out</span>
        </div>
        <div className="header-right">
          {isAdmin && (
            <button className="btn-primary btn-modern" onClick={openModal}>
              <FiPlus />
              <span>Ny sikringsplan</span>
            </button>
          )}
        </div>
      </header>

      <main className="page-content">
        {/* Stats Overview - Modern */}
        <div className="sikringsplaner-stats">
          <div className="stat-card stat-card-modern">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Totalt</span>
          </div>
          <div className="stat-card stat-card-modern active">
            <span className="stat-value">{stats.active}</span>
            <span className="stat-label">Aktive</span>
          </div>
          <div className="stat-card stat-card-modern approved">
            <span className="stat-value">{stats.approved}</span>
            <span className="stat-label">Godkendte</span>
          </div>
          <div className="stat-card stat-card-modern draft">
            <span className="stat-value">{stats.draft}</span>
            <span className="stat-label">Kladder</span>
          </div>
          <div className="stat-card stat-card-modern completed">
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Afsluttede</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="sikringsplaner-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alle ({stats.total})
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Aktive ({stats.active + stats.approved})
          </button>
          <button
            className={`filter-btn ${filter === 'draft' ? 'active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Kladder ({stats.draft})
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Afsluttede ({stats.completed})
          </button>
        </div>

        {/* Plans List */}
        {filteredPlans.length === 0 ? (
          <div className="empty-state">
            <FiShield className="empty-icon" />
            <h3>Ingen sikringsplaner fundet</h3>
            <p>
              {filter === 'all'
                ? 'Der er endnu ikke oprettet nogen sikringsplaner.'
                : `Der er ingen ${filter === 'active' ? 'aktive' : filter === 'draft' ? 'kladde' : 'afsluttede'} sikringsplaner.`}
            </p>
            {isAdmin && filter === 'all' && (
              <button className="btn-primary" onClick={openModal}>
                <FiPlus />
                Opret den foerste sikringsplan
              </button>
            )}
          </div>
        ) : (
          <div className="sikringsplaner-list">
            {filteredPlans.map((plan) => (
              <div
                key={plan.id}
                className="sikringsplan-card"
                onClick={() => navigate(`/diagram/${plan.diagramId}`)}
              >
                <div className="plan-card-main">
                  <div
                    className="plan-status-indicator"
                    style={{ background: ISOLATION_PLAN_STATUS_COLORS[plan.status] }}
                  >
                    {getStatusIcon(plan.status)}
                  </div>

                  <div className="plan-card-content">
                    <div className="plan-card-header">
                      <h3>{plan.name}</h3>
                      <span
                        className="plan-status-badge"
                        style={{ background: ISOLATION_PLAN_STATUS_COLORS[plan.status] }}
                      >
                        {ISOLATION_PLAN_STATUS_LABELS[plan.status]}
                      </span>
                    </div>

                    {plan.description && (
                      <p className="plan-description">{plan.description}</p>
                    )}

                    <div className="plan-meta-row">
                      {plan.terminalCode && (
                        <span className="meta-item">
                          <FiMapPin />
                          {plan.terminalCode}
                          {plan.locationName && ` - ${plan.locationName}`}
                        </span>
                      )}
                      {plan.diagramName && (
                        <span className="meta-item">
                          <FiFileText />
                          {plan.diagramName}
                        </span>
                      )}
                      {plan.equipmentTag && (
                        <span className="meta-item equipment">
                          {plan.equipmentTag}
                        </span>
                      )}
                      {plan.workOrder && (
                        <span className="meta-item work-order">
                          WO: {plan.workOrder}
                        </span>
                      )}
                    </div>

                    <div className="plan-meta-row">
                      {plan.plannedStart && (
                        <span className="meta-item">
                          <FiCalendar />
                          Planlagt: {new Date(plan.plannedStart).toLocaleDateString('da-DK')}
                          {plan.plannedEnd && ` - ${new Date(plan.plannedEnd).toLocaleDateString('da-DK')}`}
                        </span>
                      )}
                      {plan.createdByName && (
                        <span className="meta-item">
                          <FiUser />
                          Oprettet af: {plan.createdByName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="plan-card-right">
                    <div className="plan-progress-info">
                      <span className="progress-count">
                        {plan.verifiedCount || 0} / {plan.pointCount || 0}
                      </span>
                      <span className="progress-label">verificeret</span>
                      {plan.pointCount && plan.pointCount > 0 && (
                        <div className="progress-bar-mini">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${((plan.verifiedCount || 0) / plan.pointCount) * 100}%`
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <FiChevronRight className="card-arrow" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Step-based Selection Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal step-select-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                {modalStep !== 'terminal' && (
                  <button className="btn-back-modal" onClick={goBack}>
                    <FiArrowLeft />
                  </button>
                )}
                <h2>
                  {modalStep === 'terminal' && 'Vaelg terminal'}
                  {modalStep === 'location' && 'Vaelg lokation'}
                  {modalStep === 'diagram' && 'Vaelg tegning'}
                </h2>
              </div>
              <button className="modal-close" onClick={closeModal}>
                <FiX />
              </button>
            </div>

            {/* Breadcrumb */}
            <div className="modal-breadcrumb">
              <span className={modalStep === 'terminal' ? 'active' : 'completed'}>
                1. Terminal
                {selectedTerminal && `: ${selectedTerminal.code}`}
              </span>
              <FiChevronRight />
              <span className={modalStep === 'location' ? 'active' : modalStep === 'diagram' ? 'completed' : ''}>
                2. Lokation
                {selectedLocation && `: ${selectedLocation.name}`}
              </span>
              <FiChevronRight />
              <span className={modalStep === 'diagram' ? 'active' : ''}>
                3. Tegning
              </span>
            </div>

            <div className="modal-body">
              {loadingData ? (
                <div className="modal-loading">
                  <div className="spinner"></div>
                  <p>Indlaeser...</p>
                </div>
              ) : (
                <>
                  {/* Step 1: Terminal */}
                  {modalStep === 'terminal' && (
                    terminals.length === 0 ? (
                      <div className="modal-empty">
                        <FiMapPin className="empty-icon" />
                        <p>Ingen terminaler fundet</p>
                      </div>
                    ) : (
                      <div className="selection-list">
                        {terminals.map((terminal) => (
                          <button
                            key={terminal.id}
                            className="selection-item"
                            onClick={() => selectTerminal(terminal)}
                          >
                            <FiMapPin className="item-icon" />
                            <div className="item-info">
                              <span className="item-code">{terminal.code}</span>
                              <span className="item-name">{terminal.name}</span>
                            </div>
                            <FiChevronRight className="item-arrow" />
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* Step 2: Location */}
                  {modalStep === 'location' && (
                    locations.length === 0 ? (
                      <div className="modal-empty">
                        <FiMapPin className="empty-icon" />
                        <p>Ingen lokationer fundet for denne terminal</p>
                      </div>
                    ) : (
                      <div className="selection-list">
                        {locations.map((location) => (
                          <button
                            key={location.id}
                            className="selection-item"
                            onClick={() => selectLocation(location)}
                          >
                            <FiMapPin className="item-icon" />
                            <div className="item-info">
                              <span className="item-name">{location.name}</span>
                              {location.description && (
                                <span className="item-description">{location.description}</span>
                              )}
                              <span className="item-count">{location.diagram_count} tegninger</span>
                            </div>
                            <FiChevronRight className="item-arrow" />
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* Step 3: Diagram */}
                  {modalStep === 'diagram' && (
                    diagrams.length === 0 ? (
                      <div className="modal-empty">
                        <FiFileText className="empty-icon" />
                        <p>Ingen tegninger fundet for denne lokation</p>
                      </div>
                    ) : (
                      <div className="selection-list">
                        {diagrams.map((diagram) => (
                          <button
                            key={diagram.id}
                            className="selection-item"
                            onClick={() => selectDiagram(diagram.id)}
                          >
                            <FiFileText className="item-icon" />
                            <div className="item-info">
                              <span className="item-name">{diagram.name}</span>
                            </div>
                            <FiChevronRight className="item-arrow" />
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
