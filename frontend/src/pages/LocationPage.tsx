import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi';
import { locationApi, diagramApi, authApi } from '../api/client';
import type { User } from '../types';

interface DiagramInfo {
  id: string;
  name: string;
  pdf_filename: string;
  annotation_count: number;
  created_at: string;
}

export function LocationPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<{ id: string; terminalId: string; name: string; description: string | null; terminal_name: string; terminal_code: string; createdAt: string; updatedAt: string } | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (locationId) {
      loadData();
    }
  }, [locationId]);

  const loadData = async () => {
    if (!locationId) return;

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

    // Load location
    const { data } = await locationApi.getOne(locationId);
    if (data) {
      setLocation({
        id: data.id,
        terminalId: data.terminal_id,
        name: data.name,
        description: data.description,
        terminal_name: data.terminal_name,
        terminal_code: data.terminal_code,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
      setDiagrams(data.diagrams || []);
    }
    setIsLoading(false);
  };

  const loadLocation = async () => {
    if (!locationId) return;
    const { data } = await locationApi.getOne(locationId);
    if (data) {
      setLocation({
        id: data.id,
        terminalId: data.terminal_id,
        name: data.name,
        description: data.description,
        terminal_name: data.terminal_name,
        terminal_code: data.terminal_code,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
      setDiagrams(data.diagrams || []);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !locationId) return;

    setIsUploading(true);
    const { data } = await diagramApi.create(file, undefined, locationId);
    if (data) {
      loadLocation();
    }
    setIsUploading(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDiagram = async (diagramId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Er du sikker på at du vil slette denne tegning og alle tilhørende markeringer?')) {
      return;
    }

    await diagramApi.delete(diagramId);
    loadLocation();
  };

  const handleOpenDiagram = (diagramId: string) => {
    navigate(`/diagram/${diagramId}`);
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Indlæser lokation...</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="page-error">
        <p>Lokation ikke fundet</p>
        <button onClick={() => navigate('/')}>Tilbage til oversigt</button>
      </div>
    );
  }

  return (
    <div className="location-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/terminal/${location.terminalId}`)}>
          <FiArrowLeft />
          <span>Tilbage</span>
        </button>
        <div className="header-title">
          <span className="terminal-badge">{location.terminal_code}</span>
          <h1>{location.name}</h1>
        </div>
      </header>

      <main className="page-content">
        <div className="section-header">
          <h2>Tegninger</h2>
          {isAdmin && (
            <button className="btn-primary" onClick={handleUploadClick} disabled={isUploading}>
              <FiUpload />
              <span>{isUploading ? 'Uploader...' : 'Upload tegning'}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {diagrams.length === 0 ? (
          <div className="empty-state">
            <p>Ingen tegninger uploadet endnu</p>
            {isAdmin && (
              <button className="btn-primary" onClick={handleUploadClick}>
                Upload første tegning
              </button>
            )}
          </div>
        ) : (
          <div className="diagram-grid">
            {diagrams.map((diagram) => (
              <div
                key={diagram.id}
                className="diagram-card"
                onClick={() => handleOpenDiagram(diagram.id)}
              >
                <div className="diagram-preview">
                  <FiPlus className="preview-icon" />
                </div>
                <div className="diagram-info">
                  <h3>{diagram.name}</h3>
                  <p>{diagram.annotation_count} rør-markeringer</p>
                </div>
                {isAdmin && (
                  <button
                    className="btn-delete"
                    onClick={(e) => handleDeleteDiagram(diagram.id, e)}
                    title="Slet tegning"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
