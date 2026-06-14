import React, { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { LogOutIcon } from '../../components/ui/Icons';
import { useNavigate } from 'react-router-dom';

export default function AgentProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: profile?.first_name || '', last_name: profile?.last_name || '', phone: profile?.phone || '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({ first_name: form.first_name, last_name: form.last_name, phone: form.phone }).eq('id', user.id);
      refreshProfile();
      toast.success('Profile updated');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth/login'); };

  return (
    <AppShell title="Profile">
      <div className="page" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={styles.avatarSection}>
          <div style={styles.avatar}>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
          <div>
            <div style={styles.name}>{profile?.first_name} {profile?.last_name}</div>
            <div style={styles.role}>Recruitment Agent</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={styles.sectionTitle}>Personal Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div>
                <label className="input-label">First name</label>
                <input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Last name</label>
                <input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <button className="btn btn-gold btn-full" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner spinner-sm" /> : null}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={styles.sectionTitle}>Account</div>
          <div style={styles.infoRow}><span style={styles.infoLabel}>Email</span><span style={styles.infoValue}>{user?.email}</span></div>
          <div style={styles.infoRow}><span style={styles.infoLabel}>Role</span><span style={styles.infoValue}>Agent</span></div>
        </div>

        <button className="btn btn-outline btn-full" onClick={handleSignOut} style={{ color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <LogOutIcon size={16} /> Sign Out
        </button>
      </div>
    </AppShell>
  );
}

const styles = {
  avatarSection: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar: { width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-dim)', border: '2px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--gold-text)' },
  name: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 3 },
  role: { fontSize: 13, color: 'var(--text-3)' },
  sectionTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  infoRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-2)' },
  infoLabel: { fontSize: 13, color: 'var(--text-3)' },
  infoValue: { fontSize: 13, color: 'var(--text-1)', fontWeight: 500 },
};
