import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiFileText, FiPlus, FiTrash2, FiEdit2, FiGrid, FiBarChart2, FiChevronDown, FiChevronRight, FiMapPin } from 'react-icons/fi';
import { terminalApi, locationApi, authApi } from '../api/client';
import type { Terminal, Location, User } from '../types';
import { ANNOTATION_TYPE_LABELS } from '../types';
import { useStore } from '../store/useStore';
import TerminalStats from '../components/TerminalStats';
import { InspectionTypeBadge } from '../components/InspectionTypeSelector';

interface DiagramInfo {
  id: string;
  name: string;
  pdf_filename: string;
  created_at: string;
}

interface LocationWithDiagrams extends Location {
  diagram_count: number;
  diagrams?: DiagramInfo[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export function TerminalPage() {
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();
  const { activeInspectionType } = useStore();

  const [user, setUser] = useState<User | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [locations, setLocations] = useState<LocationWithDiagrams[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', description: '' });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [activeTab, setActiveTab] = useState<'locations' | 'stats'>('locations');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (terminalId) {
      loadData();
    }
  }, [terminalId]);

  const loadData = async () => {
    if (!terminalId) return;

    setIsLoading(true);

    // Load user info
    const { data: userData } = await authApi.me();
    if (userData) {
      setUser({
        id: userData.userId,
        username: '',
        name: userData.name,
        role: userData.role as 'admin' | 'user',
      });
    }

    // Load terminal
    const { data } = await terminalApi.getOne(terminalId);
    if (data) {
      setTerminal(data);
      // Also load locations with diagram counts
      const locResult = await locationApi.getByTerminal(terminalId);
      if (locResult.data) {
        setLocations(locResult.data);
      }
    }
    setIsLoading(false);
  };

  const loadTerminal = async () => {
    if (!terminalId) return;
    const { data } = await terminalApi.getOne(terminalId);
    if (data) {
      setTerminal(data);
      const locResult = await locationApi.getByTerminal(terminalId);
      if (locResult.data) {
        setLocations(locResult.data);
      }
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalId) return;

    const { data } = await locationApi.create(terminalId, newLocation);
    if (data) {
      setShowAddModal(false);
      setNewLocation({ name: '', description: '' });
      loadTerminal();
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;

    const { data } = await locationApi.update(editingLocation.id, {
      name: editingLocation.name,
      description: editingLocation.description,
    });
    if (data) {
      setEditingLocation(null);
      loadTerminal();
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne lokation? Alle tegninger tilknyttet lokationen vil blive frigjort.')) {
      return;
    }

    await locationApi.delete(locationId);
    loadTerminal();
  };

  const toggleLocationExpand = async (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;

    // If already expanded, just collapse
    if (location.isExpanded) {
      setLocations(prev => prev.map(l =>
        l.id === locationId ? { ...l, isExpanded: false } : l
      ));
      return;
    }

    // If diagrams already loaded, just expand
    if (location.diagrams) {
      setLocations(prev => prev.map(l =>
        l.id === locationId ? { ...l, isExpanded: true } : l
      ));
      return;
    }

    // Load diagrams
    setLocations(prev => prev.map(l =>
      l.id === locationId ? { ...l, isLoading: true } : l
    ));

    const { data } = await locationApi.getOne(locationId);
    if (data) {
      setLocations(prev => prev.map(l =>
        l.id === locationId
          ? { ...l, diagrams: data.diagrams, isExpanded: true, isLoading: false }
          : l
      ));
    } else {
      setLocations(prev => prev.map(l =>
        l.id === locationId ? { ...l, isLoading: false } : l
      ));
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Indlæser terminal...</p>
      </div>
    );
  }

  if (!terminal) {
    return (
      <div className="page-error">
        <p>Terminal ikke fundet</p>
        <button onClick={() => navigate('/')}>Tilbage til oversigt</button>
      </div>
    );
  }

  return (
    <div className="terminal-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          <FiArrowLeft />
          <span>Tilbage</span>
        </button>
        <div className="header-title">
          <span className="terminal-badge">{terminal.code}</span>
          <h1>{terminal.name}</h1>
          <span className="header-subtitle">{ANNOTATION_TYPE_LABELS[activeInspectionType]}</span>
        </div>
      </header>

      <main className="page-content">
        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button
            className={`dashboard-tab ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            <FiGrid /> Lokationer
          </button>
          <button
            className={`dashboard-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <FiBarChart2 /> Statistik
          </button>
        </div>

        {activeTab === 'locations' ? (
          <>
            <div className="section-header">
              <h2>Lokationer</h2>
              {isAdmin && (
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                  <FiPlus />
                  <span>Tilføj lokation</span>
                </button>
              )}
            </div>

            {locations.length === 0 ? (
              <div className="empty-state">
                <p>Ingen lokationer oprettet endnu</p>
                {isAdmin && (
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    Opret første lokation
                  </button>
                )}
              </div>
            ) : (
              <div className="location-accordion">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className={`location-accordion-item ${location.isExpanded ? 'expanded' : ''}`}
                  >
                    <div
                      className="location-accordion-header"
                      onClick={() => location.diagram_count > 0 && toggleLocationExpand(location.id)}
                    >
                      <div className="location-expand-icon">
                        {location.diagram_count > 0 ? (
                          location.isLoading ? (
                            <div className="mini-spinner" />
                          ) : location.isExpanded ? (
                            <FiChevronDown />
                          ) : (
                            <FiChevronRight />
                          )
                        ) : (
                          <FiMapPin className="muted" />
                        )}
                      </div>
                      <div className="location-info">
                        <h3>{location.name}</h3>
                        {location.description && (
                          <p className="location-description">{location.description}</p>
                        )}
                      </div>
                      <div className="location-meta">
                        <span className="diagram-count">
                          <FiFileText />
                          {location.diagram_count} tegninger
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="location-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-icon-small"
                            onClick={() => setEditingLocation(location)}
                            title="Rediger"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="btn-icon-small danger"
                            onClick={() => handleDeleteLocation(location.id)}
                            title="Slet"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diagrams list */}
                    {location.isExpanded && location.diagrams && (
                      <div className="location-diagrams">
                        {location.diagrams.length === 0 ? (
                          <div className="no-diagrams">
                            <p>Ingen tegninger i denne lokation</p>
                          </div>
                        ) : (
                          <div className="diagram-list">
                            {location.diagrams.map((diagram) => (
                              <div
                                key={diagram.id}
                                className="diagram-list-item"
                                onClick={() => navigate(`/diagram/${diagram.id}`)}
                              >
                                <div className="diagram-icon">
                                  <FiFileText />
                                </div>
                                <div className="diagram-info">
                                  <span className="diagram-name">{diagram.name}</span>
                                  <span className="diagram-date">
                                    {new Date(diagram.created_at).toLocaleDateString('da-DK')}
                                  </span>
                                </div>
                                <div className="diagram-arrow">
                                  <FiChevronRight />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <TerminalStats terminalId={terminalId!} terminalCode={terminal.code} />
        )}
      </main>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Tilføj ny lokation</h2>
            <form onSubmit={handleAddLocation}>
              <div className="form-group">
                <label>Navn</label>
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="F.eks. Tankgård A"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea
                  value={newLocation.description}
                  onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                  placeholder="Valgfri beskrivelse"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Annuller
                </button>
                <button type="submit" className="btn-primary">
                  Opret lokation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {editingLocation && (
        <div className="modal-overlay" onClick={() => setEditingLocation(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Rediger lokation</h2>
            <form onSubmit={handleUpdateLocation}>
              <div className="form-group">
                <label>Navn</label>
                <input
                  type="text"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea
                  value={editingLocation.description || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingLocation(null)}>
                  Annuller
                </button>
                <button type="submit" className="btn-primary">
                  Gem ændringer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
