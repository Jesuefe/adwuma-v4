import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../../lib/supabase';
import './auth.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <Link to="/auth/login" style={styles.back}>← Back to login</Link>
        <div style={styles.logo}>Adwuma</div>

        {!sent ? (
          <>
            <h2 style={styles.title}>Reset your password</h2>
            <p style={styles.sub}>Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorBox}>{error}</div>}
              <div style={styles.field}>
                <label style={styles.label} htmlFor="email">Email address</label>
                <input id="email" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com" style={styles.input}
                  onFocus={e => e.target.style.borderColor='rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.09)'}
                />
              </div>
              <button type="submit" disabled={loading} style={{...styles.btn, opacity: loading ? 0.7 : 1}}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        ) : (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✉️</div>
            <h2 style={styles.title}>Check your inbox</h2>
            <p style={styles.sub}>We sent a password reset link to <strong style={{color:'#f0f0f0'}}>{email}</strong>. Check your spam folder if you don't see it.</p>
            <Link to="/auth/login" style={styles.btn}>Back to login</Link>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: '#05080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" },
  card: { width: '100%', maxWidth: 400 },
  back: { display: 'inline-block', fontSize: 13, color: '#8b8fa8', textDecoration: 'none', marginBottom: 32 },
  logo: { fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#6366f1', marginBottom: 28 },
  title: { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 24, color: '#f0f0f0', marginBottom: 8 },
  sub: { fontSize: 14, color: '#8b8fa8', lineHeight: 1.6, marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  errorBox: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#ef4444' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 500, color: '#c0c0d0' },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#f0f0f0', outline: 'none', transition: 'border-color 0.15s' },
  btn: { display: 'block', textAlign: 'center', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', width: '100%' },
  successBox: { textAlign: 'center' },
  successIcon: { fontSize: 48, marginBottom: 20 },
};
