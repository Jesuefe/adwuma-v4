import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05080f' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

// ─── Requires login ───────────────────────────────────────────────────────────
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, isSuspended } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  if (isSuspended) return <Navigate to="/suspended" replace />;

  return children;
}

// ─── Requires specific role ───────────────────────────────────────────────────
export function RoleRoute({ role, children, redirectTo }) {
  const { isAuthenticated, loading, profile, isSuspended } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  if (isSuspended) return <Navigate to="/suspended" replace />;

  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(profile?.role)) {
    const fallback = redirectTo || getRoleDashboard(profile?.role);
    return <Navigate to={fallback} replace />;
  }

  return children;
}

// ─── Redirect authenticated users away from auth pages ───────────────────────
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (isAuthenticated && profile) {
    return <Navigate to={getRoleDashboard(profile.role)} replace />;
  }

  return children;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function getRoleDashboard(role) {
  switch (role) {
    case 'seeker': return '/dashboard';
    case 'agent': return '/agent';
    case 'admin': return '/admin';
    default: return '/';
  }
}
