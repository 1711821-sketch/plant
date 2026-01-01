import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiFileText, FiLogOut, FiPlus, FiBarChart2, FiGrid, FiLayers } from 'react-icons/fi';
import { terminalApi, authApi, setAuthToken } from '../api/client';
import type { Terminal, User } from '../types';
import { ANNOTATION_TYPE_LABELS } from '../types';
import { useStore } from '../store/useStore';
import DashboardStats from '../components/DashboardStats';
import SearchBar from '../components/SearchBar';
import { InspectionTypeSelector, InspectionTypeBadge } from '../components/InspectionTypeSelector';

export function DashboardPage() {
  const navigate = useNavigate();
  const { activeInspectionType } = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [terminals, setTerminals] = useState<(Terminal & { location_count: number; diagram_count: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTerminal, setNewTerminal] = useState({ name: '', code: '', description: '' });
  const [activeTab, setActiveTab] = useState<'type-select' | 'terminals' | 'stats'>('type-select');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadUserAndTerminals();
  }, []);

  const loadUserAndTerminals = async () => {
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

    // Load terminals
    const { data: terminalData } = await terminalApi.getAll();
    if (terminalData) {
      setTerminals(terminalData);
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await authApi.logout();
    setAuthToken(null);
    window.location.href = '/login';
  };

  const handleAddTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await terminalApi.create(newTerminal);
    if (data) {
      setShowAddModal(false);
      setNewTerminal({ name: '', code: '', description: '' });
      loadUserAndTerminals();
    }
  };

  const getTerminalColor = (code: string) => {
    const colors: Record<string, string> = {
      SOT: '#3b82f6',
      GOT: '#22c55e',
      EOT: '#f59e0b',
      AOT: '#8b5cf6',
    };
    return colors[code] || '#6b7280';
  };

  return (
    <div className="dashboard-page">
      {/* Modern animated background */}
      <div className="modern-background" />

      <header className="dashboard-header dashboard-header-modern">
        <div className="header-left">
          <h1>AnlægsPortalen</h1>
          <span className="header-subtitle">{ANNOTATION_TYPE_LABELS[activeInspectionType]}</span>
        </div>
        <div className="header-right">
          <SearchBar />
          <span className="user-info">
            {user?.name}
          </span>
          <button className="btn-icon" onClick={handleLogout} title="Log ud">
            <FiLogOut />
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {/* Tab Navigation - Modern */}
        <div className="dashboard-tabs dashboard-tabs-modern">
          <button
            className={`dashboard-tab dashboard-tab-modern ${activeTab === 'type-select' ? 'active' : ''}`}
            onClick={() => setActiveTab('type-select')}
          >
            <FiLayers /> Vælg Type
          </button>
          <button
            className={`dashboard-tab dashboard-tab-modern ${activeTab === 'terminals' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminals')}
          >
            <FiGrid /> Terminaler
          </button>
          <button
            className={`dashboard-tab dashboard-tab-modern ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <FiBarChart2 /> Statistik
          </button>
        </div>

        {activeTab === 'type-select' ? (
          <InspectionTypeSelector />
        ) : activeTab === 'terminals' ? (
          <>
            <div className="dashboard-intro">
              <h2>Vælg en terminal - {ANNOTATION_TYPE_LABELS[activeInspectionType]}</h2>
              <p>Klik på en terminal for at se lokationer og tegninger for {ANNOTATION_TYPE_LABELS[activeInspectionType].toLowerCase()}</p>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Indlæser terminaler...</p>
              </div>
            ) : (
              <div className="terminal-grid">
                {terminals.map((terminal) => (
                  <div
                    key={terminal.id}
                    className="terminal-card terminal-card-modern hover-glow"
                    onClick={() => navigate(`/terminal/${terminal.id}`)}
                    style={{ '--terminal-color': getTerminalColor(terminal.code) } as React.CSSProperties}
                  >
                    <div className="terminal-code">{terminal.code}</div>
                    <h3 className="terminal-name">{terminal.name}</h3>
                    {terminal.description && (
                      <p className="terminal-description">{terminal.description}</p>
                    )}
                    <div className="terminal-stats">
                      <div className="stat">
                        <FiMapPin />
                        <span>{terminal.location_count} lokationer</span>
                      </div>
                      <div className="stat">
                        <FiFileText />
                        <span>{terminal.diagram_count} tegninger</span>
                      </div>
                    </div>
                  </div>
                ))}

                {isAdmin && (
                  <div
                    className="terminal-card terminal-card-modern add-card hover-glow"
                    onClick={() => setShowAddModal(true)}
                  >
                    <FiPlus className="add-icon" />
                    <span>Tilføj Terminal</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <DashboardStats />
        )}
      </main>

      {/* Add Terminal Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Tilføj ny terminal</h2>
            <form onSubmit={handleAddTerminal}>
              <div className="form-group">
                <label>Terminal kode</label>
                <input
                  type="text"
                  value={newTerminal.code}
                  onChange={(e) => setNewTerminal({ ...newTerminal, code: e.target.value.toUpperCase() })}
                  placeholder="F.eks. SOT"
                  maxLength={5}
                  required
                />
              </div>
              <div className="form-group">
                <label>Navn</label>
                <input
                  type="text"
                  value={newTerminal.name}
                  onChange={(e) => setNewTerminal({ ...newTerminal, name: e.target.value })}
                  placeholder="F.eks. SOT Terminal"
                  required
                />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea
                  value={newTerminal.description}
                  onChange={(e) => setNewTerminal({ ...newTerminal, description: e.target.value })}
                  placeholder="Valgfri beskrivelse"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Annuller
                </button>
                <button type="submit" className="btn-primary">
                  Opret terminal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
