import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signIn } from '../../lib/supabase';
import { getRoleDashboard } from '../../components/shared/RouteGuards';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const from = location.state?.from?.pathname;

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const { user } = await signIn({ email: form.email, password: form.password });
      refreshProfile();
      const { supabase } = await import('../../lib/supabase');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      navigate(from || getRoleDashboard(profile?.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #05080f; }
        .login-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: #05080f;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
        }
        /* Mobile: single column stacked */
        .login-hero {
          background: linear-gradient(135deg, #0d0f1a 0%, #080b14 100%);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 32px 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .login-logo {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 20px;
          color: #6366f1;
          letter-spacing: -0.5px;
        }
        .login-tagline {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 22px;
          line-height: 1.25;
          color: #f0f0f0;
          letter-spacing: -0.5px;
        }
        .login-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }
        .login-pill {
          font-size: 11px;
          color: #a5b4fc;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 20px;
          padding: 4px 10px;
          white-space: nowrap;
        }
        /* Form area */
        .login-form-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 32px 24px 40px;
        }
        .login-card-title {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 24px;
          color: #f0f0f0;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .login-card-sub {
          font-size: 14px;
          color: #8b8fa8;
          margin-bottom: 28px;
        }
        .login-form { display: flex; flex-direction: column; gap: 18px; }
        .login-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13px;
          color: #ef4444;
          line-height: 1.5;
        }
        .login-field { display: flex; flex-direction: column; gap: 7px; }
        .login-label-row { display: flex; justify-content: space-between; align-items: center; }
        .login-label { font-size: 13px; font-weight: 500; color: #c0c0d0; }
        .login-forgot { font-size: 12px; color: #6366f1; text-decoration: none; }
        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 13px 14px;
          font-size: 15px;
          color: #f0f0f0;
          outline: none;
          transition: border-color 0.15s;
          -webkit-appearance: none;
          font-family: 'Inter', sans-serif;
        }
        .login-input:focus { border-color: rgba(99,102,241,0.6); }
        .login-input::placeholder { color: #4a4d5e; }
        .login-pw-wrap { position: relative; }
        .login-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; font-size: 18px;
          line-height: 1; padding: 4px; color: #8b8fa8;
          -webkit-tap-highlight-color: transparent;
        }
        .login-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #6366f1; color: #fff; border: none; border-radius: 10px;
          padding: 14px 20px; font-size: 15px; font-weight: 600; cursor: pointer;
          width: 100%; font-family: 'Inter', sans-serif;
          transition: background 0.15s; -webkit-tap-highlight-color: transparent;
          min-height: 48px;
        }
        .login-submit:active { background: #4f46e5; }
        .login-submit:disabled { opacity: 0.65; }
        .login-divider {
          display: flex; align-items: center; gap: 12px; margin: 8px 0;
        }
        .login-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .login-divider-text { font-size: 12px; color: #4a4d5e; white-space: nowrap; }
        .login-register-btn {
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.09); border-radius: 10px;
          padding: 14px 20px; font-size: 15px; font-weight: 500; color: #c0c0d0;
          text-decoration: none; transition: border-color 0.15s;
          min-height: 48px; font-family: 'Inter', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        .login-register-btn:active { border-color: rgba(255,255,255,0.2); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        /* Tablet/Desktop: side by side */
        @media (min-width: 768px) {
          .login-root { flex-direction: row; }
          .login-hero {
            flex: 1; border-bottom: none;
            border-right: 1px solid rgba(255,255,255,0.05);
            padding: 60px 56px; justify-content: center;
            min-height: 100vh; min-height: 100dvh;
          }
          .login-tagline { font-size: 36px; }
          .login-form-wrap {
            flex: 1; padding: 48px 40px;
            max-width: 520px;
          }
          .login-card-title { font-size: 28px; }
        }
        @media (min-width: 1024px) {
          .login-hero { padding: 60px 64px; }
          .login-form-wrap { padding: 60px 64px; }
          .login-tagline { font-size: 42px; }
        }
      `}</style>

      <div className="login-root">
        {/* Hero / branding */}
        <div className="login-hero">
          <div className="login-logo">Ajuma Link</div>
          <h1 className="login-tagline">Work, verified.<br />Payments, protected.</h1>
          <div className="login-pills">
            <span className="login-pill">✓ KYC-verified agents</span>
            <span className="login-pill">✓ Escrow payments</span>
            <span className="login-pill">✓ Live tracker</span>
            <span className="login-pill">✓ Document gatekeeping</span>
          </div>
        </div>

        {/* Form */}
        <div className="login-form-wrap">
          <h2 className="login-card-title">Sign in</h2>
          <p className="login-card-sub">Welcome back to Adwuma</p>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label" htmlFor="email">Email address</label>
              <input className="login-input" id="email" name="email" type="email"
                autoComplete="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" inputMode="email" />
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label" htmlFor="password">Password</label>
                <Link to="/auth/forgot-password" className="login-forgot">Forgot password?</Link>
              </div>
              <div className="login-pw-wrap">
                <input className="login-input" id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" value={form.password}
                  onChange={handleChange} placeholder="••••••••"
                  style={{ paddingRight: 48 }} />
                <button type="button" className="login-eye"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="login-divider">
              <span className="login-divider-line" />
              <span className="login-divider-text">New to Adwuma?</span>
              <span className="login-divider-line" />
            </div>

            <Link to="/auth/register" className="login-register-btn">
              Create an account
            </Link>
          </form>
        </div>
      </div>
    </>
  );
}
