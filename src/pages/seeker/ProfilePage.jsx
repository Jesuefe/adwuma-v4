import React, { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { UserIcon, ShieldIcon, AlertCircleIcon } from '../../components/ui/Icons';

export default function SeekerProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    dob: profile?.dob || '',
    passport_number: profile?.passport_number || '',
    nationality: profile?.nationality || 'Ghanaian',
  });
  const [saving, setSaving] = useState(false);

  const isProfileComplete = form.first_name && form.last_name && form.phone && form.dob && form.passport_number;

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        dob: form.dob || null,
        passport_number: form.passport_number || null,
        nationality: form.nationality || null,
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth/login'); };

  return (
    <AppShell title="My Profile">
      <div className="page" style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* Profile header */}
        <div style={styles.header}>
          <div style={styles.avatar}>
            {form.first_name?.[0]?.toUpperCase()}{form.last_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={styles.name}>{form.first_name} {form.last_name}</div>
            <div style={styles.role}>Job Seeker · Ghana</div>
          </div>
        </div>

        {/* Completeness banner */}
        {!isProfileComplete && (
          <div style={styles.incompleteBanner}>
            <AlertCircleIcon size={16} style={{ flexShrink: 0, color: 'var(--gold)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>Complete your profile to apply</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Agents need your full details to process your application. Add your date of birth and passport number to unlock applications.</div>
            </div>
          </div>
        )}

        {/* Personal Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={styles.sectionTitle}><UserIcon size={15} /> Personal Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div>
                <label className="input-label">First Name *</label>
                <input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="e.g. Kwame" />
              </div>
              <div>
                <label className="input-label">Last Name *</label>
                <input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="e.g. Mensah" />
              </div>
            </div>
            <div>
              <label className="input-label">Phone Number *</label>
              <input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 50 000 0000" inputMode="tel" />
            </div>
            <div>
              <label className="input-label">Date of Birth *</label>
              <input className="input" type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Must be 18 or older</div>
            </div>
            <div>
              <label className="input-label">Nationality</label>
              <input className="input" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="e.g. Ghanaian" />
            </div>
          </div>
        </div>

        {/* Passport */}
        <div className="card" style={{ marginBottom: 16, borderColor: form.passport_number ? 'var(--green-border)' : 'var(--border)' }}>
          <div style={styles.sectionTitle}><ShieldIcon size={15} /> Passport Information</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
            Your passport number is required by agents to begin processing your international placement. This information is kept secure and only shared with your chosen agent.
          </div>
          <div>
            <label className="input-label">Passport Number *</label>
            <input className="input" value={form.passport_number} onChange={e => setForm(f => ({ ...f, passport_number: e.target.value.toUpperCase() }))} placeholder="e.g. G1234567" style={{ letterSpacing: '0.05em', fontWeight: 500 }} />
          </div>
          {form.passport_number && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--green)' }}>
              <ShieldIcon size={12} /> Passport number saved
            </div>
          )}
        </div>

        <button className="btn btn-brand btn-full btn-lg" onClick={handleSave} disabled={saving} style={{ marginBottom: 12 }}>
          {saving ? <span className="spinner spinner-sm" /> : null}
          Save Profile
        </button>

        <button onClick={handleSignOut} style={styles.signOutBtn}>
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' },
  avatar: { width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-dim)', border: '2px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--brand-text)', flexShrink: 0 },
  name: { fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 3 },
  role: { fontSize: 13, color: 'var(--text-3)' },
  incompleteBanner: { display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  signOutBtn: { width: '100%', padding: '12px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' },
};
