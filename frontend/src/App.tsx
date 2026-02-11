import { ReactNode, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.js';
import { NotificationProvider } from './lib/notifications.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import { LoginPage } from './pages/LoginPage.js';
import { SetupPage } from './pages/SetupPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ConfigPage } from './pages/ConfigPage.js';
import { ModsPage } from './pages/ModsPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { api } from './lib/api.js';
import './index.css';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function RouteSelector() {
  const { isAuthenticated } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      api.getSetupStatus()
        .then((status) => {
          setNeedsSetup(status.needsSetup);
        })
        .catch(() => {
          setNeedsSetup(false);
        });
    }
  }, [isAuthenticated]);

  if (needsSetup === null && !isAuthenticated) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {needsSetup && <Route path="/setup" element={<SetupPage />} />}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/config"
        element={
          <ProtectedRoute>
            <ConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mods"
        element={
          <ProtectedRoute>
            <ModsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <AuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/dashboard' : needsSetup ? '/setup' : '/login'} />}
      />
    </Routes>
  );
}

function App() {
  return (
    <NotificationProvider>
      <Router>
        <AuthProvider>
          <NotificationCenter />
          <RouteSelector />
        </AuthProvider>
      </Router>
    </NotificationProvider>
  );
}

export default App;
