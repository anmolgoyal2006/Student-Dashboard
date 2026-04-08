// src/context/AuthContext.js

import { createContext, useContext, useState, useCallback } from 'react';
import { saveTokenToIDB, clearTokenFromIDB } from '../utils/authIDB';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; }
    catch { return null; }
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (token) saveTokenToIDB(token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    clearTokenFromIDB();
    setUser(null);
  }, []);

  const updateUser = useCallback((userData, newToken) => {
    setUser(prev => {
      const merged = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
    if (newToken) {
      localStorage.setItem('token', newToken);
      saveTokenToIDB(newToken);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);