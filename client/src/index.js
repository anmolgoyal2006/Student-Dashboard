import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GlobalDataProvider } from './context/GlobalDataContext';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <ErrorBoundary>
    <AuthProvider>
      <GlobalDataProvider>
        <App />
      </GlobalDataProvider>
    </AuthProvider>
  </ErrorBoundary>
);