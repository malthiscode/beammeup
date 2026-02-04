import { ReactNode, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.js';
import { LoginPage } from './pages/LoginPage.js';
import { SetupPage } from './pages/SetupPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ConfigPage } from './pages/ConfigPage.js';
import { ModsPage } from './pages/ModsPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditPage } from './pages/AuditPage.js';
import './index.css';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function RouteSelector() {
  const { isAuthenticated } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if setup is needed (only if not authenticated)
    if (!isAuthenticated) {
      import('./lib/api.js').then(({ api }) => {
        api.getSetupStatus().then((status) => setNeedsSetup(status.needsSetup));
      });
    }
  }, [isAuthenticated]);

  if (needsSetup === null && !isAuthenticated) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
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
    <Router>
      <AuthProvider>
        <RouteSelector />
      </AuthProvider>
    </Router>
  );
}

export default App;
