import { useState } from 'react';
import { authApi } from '../api/client';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: loginError } = await authApi.login(username, password);

    if (loginError) {
      setError(loginError);
      setIsLoading(false);
      return;
    }

    if (data?.token) {
      // Refresh page to update auth state
      window.location.href = '/';
    } else {
      setError('Login fejlede');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>AnlægsPortalen</h1>
          <p>Log ind for at fortsætte</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Brugernavn</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Indtast brugernavn"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Adgangskode</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Indtast adgangskode"
              required
            />
          </div>

          <button type="submit" className="btn-login btn-modern" disabled={isLoading}>
            {isLoading ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>

        <div className="login-footer">
          <p>Standard login:</p>
          <p><strong>Admin:</strong> admin / admin123</p>
          <p><strong>Bruger:</strong> bruger / user123</p>
        </div>
      </div>
    </div>
  );
}
