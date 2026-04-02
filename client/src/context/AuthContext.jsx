import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; }
    catch { return null; }
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  // ── NEW: called after a successful profile update ────────
  // Merges updated fields (name, email) into the existing
  // user object so the sidebar/topbar reflect changes
  // immediately without requiring a re-login.
  // If the backend returned a new JWT (email changed),
  // it gets stored here too.
  const updateUser = useCallback((userData, newToken) => {
    setUser(prev => {
      const merged = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
    if (newToken) {
      localStorage.setItem('token', newToken);
    }
  }, []);

  return (
    // ── CHANGED: added updateUser to the context value ───
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);