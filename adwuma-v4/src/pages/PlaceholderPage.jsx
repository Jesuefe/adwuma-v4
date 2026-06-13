import React from 'react';

export default function PlaceholderPage({ title = 'Coming Soon' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0f1e',
      color: '#fff',
      fontFamily: 'sans-serif',
      gap: '12px'
    }}>
      <div style={{ fontSize: 48 }}>🚧</div>
      <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
      <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>This page is being built</p>
    </div>
  );
}
