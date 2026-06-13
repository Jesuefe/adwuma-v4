import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { EyeIcon, EyeOffIcon } from '../../components/ui/Icons';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — listen for session
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated! Please sign in.');
      navigate('/auth/login');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #05080f; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.logo}>Adwuma</div>
          <h2 style={styles.title}>Set new password</h2>
          <p style={styles.sub}>Enter your new password below.</p>

          {!ready ? (
            <div style={styles.waiting}>
              <div style={{ width: 24, height: 24, border: '2px solid rgba(245,158,11,0.2)', borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#8b8fa8', textAlign: 'center' }}>Verifying reset link…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorBox}>{error}</div>}
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <div style={styles.pwWrap}>
                  <input style={styles.input} type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(s => !s)}>
                    {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input style={styles.input} type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
              </div>
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const styles = {
  root: { minHeight: '100vh', minHeight: '100dvh', background: '#05080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" },
  card: { width: '100%', maxWidth: 400 },
  logo: { fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: '#f59e0b', marginBottom: 28 },
  title: { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 24, color: '#f0f0f0', marginBottom: 8 },
  sub: { fontSize: 14, color: '#8b8fa8', marginBottom: 28 },
  waiting: { padding: '24px 0' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  errorBox: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#ef4444' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 500, color: '#c0c0d0' },
  pwWrap: { position: 'relative' },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '13px 14px', fontSize: 15, color: '#f0f0f0', outline: 'none', fontFamily: 'Inter, sans-serif', WebkitAppearance: 'none' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8b8fa8', display: 'flex', alignItems: 'center' },
  btn: { background: '#f59e0b', color: '#000', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', minHeight: 48 },
};
