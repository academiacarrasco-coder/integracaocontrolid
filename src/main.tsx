import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { GymDataProvider } from './contexts/GymDataContext';
import { HardwareProvider } from './contexts/HardwareContext';
import './index.css';

// Global Error Logger for debugging
window.onerror = (message, source, lineno, colno, error) => {
  fetch('/api/log/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: String(message),
      stack: error?.stack,
      source,
      lineno,
      colno,
      userAgent: navigator.userAgent
    })
  }).catch(() => {});
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <GymDataProvider>
          <HardwareProvider>
            <App />
          </HardwareProvider>
        </GymDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
