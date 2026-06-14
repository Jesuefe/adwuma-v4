import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '../../lib/supabase';
import { getRoleDashboard } from '../../components/shared/RouteGuards';

const ROLES = [
  { id: 'seeker', label: 'Job Seeker', desc: 'Browse & apply for international jobs', icon: '🌍' },
  { id: 'agent', label: 'Recruitment Agent', desc: 'Post jobs and place candidates abroad', icon: '🏢' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const handleRoleSelect = (r) => { setRole(r); setStep(2); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName || !form.lastName || !form.email || !form.password) { setError('Please fill in all required fields.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await signUp({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, phone: form.phone, role });
      navigate(getRoleDashboard(role), { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
        .reg-root {
          min-height: 100vh; min-height: 100dvh;
          background: #05080f; font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .reg-header {
          background: linear-gradient(135deg, #0d0f1a, #080b14);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 20px 24px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .reg-logo { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 20px; color: #6366f1; letter-spacing: -0.5px; }
        .reg-signin-link { font-size: 13px; color: #8b8fa8; text-decoration: none; }
        .reg-signin-link span { color: #6366f1; }
        .reg-body { padding: 28px 24px 48px; max-width: 480px; margin: 0 auto; }
        /* Steps */
        .reg-steps { display: flex; align-items: center; gap: 6px; margin-bottom: 28px; }
        .reg-step { display: flex; align-items: center; gap: 6px; }
        .reg-step-dot {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; flex-shrink: 0;
        }
        .reg-step-dot.active { background: #6366f1; color: #fff; }
        .reg-step-dot.done { background: rgba(99,102,241,0.2); color: #6366f1; }
        .reg-step-dot.inactive { background: rgba(255,255,255,0.06); color: #4a4d5e; }
        .reg-step-label { font-size: 12px; }
        .reg-step-label.active { color: #c0c0d0; }
        .reg-step-label.inactive { color: #4a4d5e; }
        .reg-step-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); max-width: 40px; }
        /* Role cards */
        .reg-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 22px; color: #f0f0f0; letter-spacing: -0.5px; margin-bottom: 6px; }
        .reg-sub { font-size: 14px; color: #8b8fa8; margin-bottom: 24px; line-height: 1.5; }
        .reg-roles { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
        .reg-role-card {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px; border-radius: 12px; border: 1.5px solid;
          cursor: pointer; text-align: left; width: 100%;
          transition: all 0.15s; background: rgba(255,255,255,0.02);
          -webkit-tap-highlight-color: transparent;
          min-height: 72px;
        }
        .reg-role-card.selected { border-color: #6366f1; background: rgba(99,102,241,0.08); }
        .reg-role-card.unselected { border-color: rgba(255,255,255,0.08); }
        .reg-role-icon { font-size: 28px; flex-shrink: 0; }
        .reg-role-label { font-size: 15px; font-weight: 600; color: #f0f0f0; margin-bottom: 3px; }
        .reg-role-desc { font-size: 13px; color: #8b8fa8; }
        .reg-role-check {
          width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid;
          display: flex; align-items: center; justify-content: center;
          margin-left: auto; flex-shrink: 0; font-size: 10px;
        }
        .reg-role-check.selected { background: #6366f1; border-color: #6366f1; color: #fff; }
        .reg-role-check.unselected { border-color: rgba(255,255,255,0.15); }
        /* Form */
        .reg-back { background: none; border: none; color: #8b8fa8; font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 4px; font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
        .reg-form { display: flex; flex-direction: column; gap: 16px; }
        .reg-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #ef4444; line-height: 1.5; }
        .reg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .reg-field { display: flex; flex-direction: column; gap: 7px; }
        .reg-label { font-size: 13px; font-weight: 500; color: #c0c0d0; }
        .reg-label-hint { color: #4a4d5e; font-weight: 400; }
        .reg-input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09); border-radius: 10px;
          padding: 13px 14px; font-size: 15px; color: #f0f0f0; outline: none;
          transition: border-color 0.15s; -webkit-appearance: none;
          font-family: 'Inter', sans-serif;
        }
        .reg-input:focus { border-color: rgba(99,102,241,0.6); }
        .reg-input::placeholder { color: #4a4d5e; }
        .reg-pw-wrap { position: relative; }
        .reg-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; font-size: 18px;
          line-height: 1; padding: 4px; color: #8b8fa8;
          -webkit-tap-highlight-color: transparent;
        }
        .reg-notice {
          background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #a5b4fc; line-height: 1.6;
        }
        .reg-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #6366f1; color: #fff; border: none; border-radius: 10px;
          padding: 14px 20px; font-size: 15px; font-weight: 600; cursor: pointer;
          width: 100%; font-family: 'Inter', sans-serif; min-height: 48px;
          transition: background 0.15s; -webkit-tap-highlight-color: transparent;
        }
        .reg-submit:active { background: #4f46e5; }
        .reg-submit:disabled { opacity: 0.65; }
        .reg-terms { font-size: 12px; color: #4a4d5e; text-align: center; line-height: 1.6; }
        .reg-terms a { color: #6366f1; text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        @media (min-width: 640px) {
          .reg-body { padding: 40px 32px 64px; }
          .reg-title { font-size: 26px; }
        }
        @media (min-width: 1024px) {
          .reg-header { padding: 24px 48px; }
          .reg-body { padding: 56px 0; max-width: 500px; margin: 0 auto; }
        }
      `}</style>

      <div className="reg-root">
        {/* Top bar */}
        <div className="reg-header">
          <div className="reg-logo">Ajuma Link</div>
          <Link to="/auth/login" className="reg-signin-link">
            Already have an account? <span>Sign in</span>
          </Link>
        </div>

        <div className="reg-body">
          {/* Step indicator */}
          <div className="reg-steps">
            <div className="reg-step">
              <div className={`reg-step-dot ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? '✓' : '1'}</div>
              <span className={`reg-step-label ${step >= 1 ? 'active' : 'inactive'}`}>Choose role</span>
            </div>
            <div className="reg-step-line" />
            <div className="reg-step">
              <div className={`reg-step-dot ${step === 2 ? 'active' : 'inactive'}`}>2</div>
              <span className={`reg-step-label ${step === 2 ? 'active' : 'inactive'}`}>Your details</span>
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <>
              <h2 className="reg-title">I am a…</h2>
              <p className="reg-sub">Choose how you'll use Ajuma Link</p>
              <div className="reg-roles">
                {ROLES.map(r => (
                  <button key={r.id} onClick={() => handleRoleSelect(r.id)}
                    className={`reg-role-card ${role === r.id ? 'selected' : 'unselected'}`}>
                    <span className="reg-role-icon">{r.icon}</span>
                    <div>
                      <div className="reg-role-label">{r.label}</div>
                      <div className="reg-role-desc">{r.desc}</div>
                    </div>
                    <div className={`reg-role-check ${role === r.id ? 'selected' : 'unselected'}`}>
                      {role === r.id && '✓'}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <button className="reg-back" onClick={() => setStep(1)}>← Back</button>
              <h2 className="reg-title">Create your account</h2>
              <p className="reg-sub">
                Registering as a <strong style={{color:'#6366f1'}}>{ROLES.find(r => r.id === role)?.label}</strong>
              </p>

              <form className="reg-form" onSubmit={handleSubmit}>
                {error && <div className="reg-error">{error}</div>}

                <div className="reg-row">
                  <div className="reg-field">
                    <label className="reg-label" htmlFor="firstName">First name *</label>
                    <input className="reg-input" id="firstName" name="firstName" type="text"
                      autoComplete="given-name" value={form.firstName} onChange={handleChange} placeholder="John" />
                  </div>
                  <div className="reg-field">
                    <label className="reg-label" htmlFor="lastName">Last name *</label>
                    <input className="reg-input" id="lastName" name="lastName" type="text"
                      autoComplete="family-name" value={form.lastName} onChange={handleChange} placeholder="Doe" />
                  </div>
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="email">Email address *</label>
                  <input className="reg-input" id="email" name="email" type="email"
                    autoComplete="email" inputMode="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="phone">Phone <span className="reg-label-hint">(optional)</span></label>
                  <input className="reg-input" id="phone" name="phone" type="tel"
                    autoComplete="tel" inputMode="tel" value={form.phone} onChange={handleChange} placeholder="+234 800 000 0000" />
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="password">Password * <span className="reg-label-hint">min. 8 chars</span></label>
                  <div className="reg-pw-wrap">
                    <input className="reg-input" id="password" name="password"
                      type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                      value={form.password} onChange={handleChange} placeholder="••••••••"
                      style={{paddingRight: 48}} />
                    <button type="button" className="reg-eye" onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="confirmPassword">Confirm password *</label>
                  <input className="reg-input" id="confirmPassword" name="confirmPassword"
                    type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={form.confirmPassword} onChange={handleChange} placeholder="••••••••" />
                </div>

                {role === 'agent' && (
                  <div className="reg-notice">
                    🔒 <strong>KYC required</strong> — After registering you'll submit your identity and recruitment licence documents. Your account is locked until admin approves your KYC.
                  </div>
                )}

                <button type="submit" className="reg-submit" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>

                <p className="reg-terms">
                  By creating an account you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
