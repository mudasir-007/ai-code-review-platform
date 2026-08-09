import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, registerUser, getMe } from '../api/authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  //* On mount, if a token exists in localStorage validate it against the
  //* backend. If invalid/expired → clear and show login. If the backend is
  //* unreachable (network error) → also clear and show login so the user
  //* can still authenticate once the backend is up.
  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await getMe(token);
        setUser(data.user);
      } catch {
        // Token stale, invalid, or backend unreachable — clear and show login.
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email, password) {
    const data = await loginUser({ email, password });
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password) {
    const data = await registerUser({ name, email, password });
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
