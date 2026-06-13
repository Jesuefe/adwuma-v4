import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__spinner" />
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
