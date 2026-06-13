import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';

export default function SuspendedPage() {
  const { signOut } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: '#05080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: '#f0f0f0', marginBottom: 12 }}>Account Suspended</div>
        <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7, marginBottom: 28 }}>
          Your account has been suspended. Please contact support at <a href="mailto:hello@adwuma.com" style={{ color: '#f59e0b' }}>hello@adwuma.com</a> for assistance.
        </div>
        <button onClick={signOut} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
