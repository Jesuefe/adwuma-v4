import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();

  const home = !isAuthenticated ? '/' : profile?.role === 'admin' ? '/admin' : profile?.role === 'agent' ? '/agent' : '/dashboard';

  return (
    <div style={{ minHeight: '100vh', background: '#05080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 80, color: 'rgba(245,158,11,0.2)', letterSpacing: '-4px', marginBottom: 8 }}>404</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: '#f0f0f0', marginBottom: 12 }}>Page not found</div>
        <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7, marginBottom: 28 }}>The page you're looking for doesn't exist or has been moved.</div>
        <Link to={home} style={{ background: 'var(--brand)', color: '#000', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Go Home
        </Link>
      </div>
    </div>
  );
}
