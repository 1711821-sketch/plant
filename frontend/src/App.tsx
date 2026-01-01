import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TerminalPage } from './pages/TerminalPage';
import { LocationPage } from './pages/LocationPage';
import { DiagramPage } from './pages/DiagramPage';
import { SikringsplanerPage } from './pages/SikringsplanerPage';
import './App.css';

// Simple auth check without zustand initially
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Indlæser...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/terminal/:terminalId"
          element={isAuthenticated ? <TerminalPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/location/:locationId"
          element={isAuthenticated ? <LocationPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/diagram/:diagramId"
          element={isAuthenticated ? <DiagramPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/sikringsplaner"
          element={isAuthenticated ? <SikringsplanerPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
