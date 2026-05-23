// src/context/AuthContext.js

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { saveTokenToIDB, clearTokenFromIDB, saveTokenToCache } from '../utils/authIDB';
import { authService } from '../services/apiServices';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try { return JSON.parse(localStorage.getItem('user')) || null; }
    catch { return null; }
  });

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearTokenFromIDB();
    setUser(null);
  }, []);

  // Validate session once on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('user');
      setUser(null);
      return;
    }
    authService.getMe()
      .then(({ data }) => {
        if (data?.user) {
          const fresh = {
            id      : data.user._id,
            name    : data.user.name,
            email   : data.user.email,
            role    : data.user.role,
            sid     : data.user.sid,
            college : data.user.college,
            semester: data.user.semester,
          };
          setUser(fresh);
          localStorage.setItem('user', JSON.stringify(fresh));
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) logout();
      });
  }, [logout]);

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
   if (token) {
  saveTokenToIDB(token);
  saveTokenToCache(token);
  // Auto-register FCM token silently on every login
  import('../firebase').then(({ getFCMToken }) => {
    getFCMToken().then(fcmToken => {
      if (fcmToken) {
        fetch(`${process.env.REACT_APP_API_URL}/user/save-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ token: fcmToken })
        }).catch(() => {});
      }
    }).catch(() => {});
  }).catch(() => {});
}
    setUser(userData);
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
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
      isLoggedIn: Boolean(user && localStorage.getItem('token')),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);