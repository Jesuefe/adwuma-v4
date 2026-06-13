import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import AppShell from 'components/layout/AppShell';
import { AlertCircleIcon, ShieldIcon, MessageIcon, UserIcon } from 'components/ui/Icons';
import { formatDistanceToNow } from 'date-fns';

export default function FraudPage() {
  const [tab, setTab] = useState('agents');

  const { data } = useQuery({
    queryKey: ['admin_fraud'],
    queryFn: async () => {
      // Suspicious agents: have applications but 0 completed
      const { data: agents } = await supabase.from('profiles')
        .select(`id, first_name, last_name, created_at,
          applications!applications_agent_id_fkey(id, status)`)
        .eq('role', 'agent').eq('is_suspended', false);

      const suspiciousAgents = (agents || [])
        .map(a => ({
          ...a,
          totalApps: a.applications?.length || 0,
          completedApps: a.applications?.filter(ap => ap.status === 'approved').length || 0,
          refundedApps: a.applications?.filter(ap => ap.status === 'refunded').length || 0,
        }))
        .filter(a => a.totalApps >= 3 && a.completedApps === 0)
        .sort((a, b) => b.totalApps - a.totalApps);

      // Suspicious seekers: multiple refunds
      const { data: seekers } = await supabase.from('profiles')
        .select(`id, first_name, last_name, created_at,
          applications!applications_seeker_id_fkey(id, status)`)
        .eq('role', 'seeker').eq('is_suspended', false);

      const suspiciousSeekers = (seekers || [])
        .map(s => ({
          ...s,
          totalApps: s.applications?.length || 0,
          refundedApps: s.applications?.filter(ap => ap.status === 'refunded').length || 0,
        }))
        .filter(s => s.refundedApps >= 2)
        .sort((a, b) => b.refundedApps - a.refundedApps);

      // Flagged messages
      const { data: flagged } = await supabase.from('flagged_messages')
        .select(`*, profiles!flagged_messages_sender_id_fkey(first_name, last_name, role)`)
        .order('created_at', { ascending: false })
        .limit(50);

      return { suspiciousAgents, suspiciousSeekers, flaggedMessages: flagged || [] };
    },
    refetchInterval: 120000,
  });

  const TABS = [
    { id: 'agents', label: `Suspicious Agents (${data?.suspiciousAgents?.length || 0})`, icon: ShieldIcon },
    { id: 'seekers', label: `Suspicious Seekers (${data?.suspiciousSeekers?.length || 0})`, icon: UserIcon },
    { id: 'messages', label: `Flagged Messages (${data?.flaggedMessages?.length || 0})`, icon: MessageIcon },
  ];

  async function suspendUser(userId) {
    if (!window.confirm('Suspend this user?')) return;
    await supabase.from('profiles').update({ is_suspended: true }).eq('id', userId);
    // Log to audit
    await supabase.from('audit_logs').insert({ action: 'suspend_user', entity_type: 'profile', entity_id: userId });
    window.location.reload();
  }

  return (
    <AppShell title="Fraud Detection">
      <div className="page">
        <div style={styles.pageTitle}>Fraud Detection</div>
        <div style={styles.pageSub}>Monitor suspicious activity across the platform</div>

        <div style={styles.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!data?.suspiciousAgents?.length ? (
              <div className="empty-state">
                <ShieldIcon size={36} style={{ color: 'var(--text-3)' }} />
                <div className="empty-title">No suspicious agents detected</div>
                <div className="empty-sub">Agents with 3+ applications and 0 completions will appear here</div>
              </div>
            ) : data.suspiciousAgents.map(a => (
              <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.avatar}>{a.first_name?.[0]}{a.last_name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.userName}>{a.first_name} {a.last_name}</div>
                  <div style={styles.userMeta}>
                    <span style={{ color: '#f97316' }}>{a.totalApps} applications</span> ·
                    <span style={{ color: 'var(--error)' }}> {a.completedApps} completed</span> ·
                    <span style={{ color: 'var(--text-3)' }}> {a.refundedApps} refunds</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Joined {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                </div>
                <div style={styles.riskBadge}>High Risk</div>
                <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => suspendUser(a.id)}>Suspend</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'seekers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!data?.suspiciousSeekers?.length ? (
              <div className="empty-state">
                <UserIcon size={36} style={{ color: 'var(--text-3)' }} />
                <div className="empty-title">No suspicious seekers detected</div>
                <div className="empty-sub">Seekers with 2+ refund requests will appear here</div>
              </div>
            ) : data.suspiciousSeekers.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.avatar}>{s.first_name?.[0]}{s.last_name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.userName}>{s.first_name} {s.last_name}</div>
                  <div style={styles.userMeta}>
                    <span>{s.totalApps} total applications</span> ·
                    <span style={{ color: 'var(--error)' }}> {s.refundedApps} refunds</span>
                  </div>
                </div>
                <div style={{ ...styles.riskBadge, background: 'rgba(239,68,68,0.08)', color: 'var(--error)' }}>Refund Pattern</div>
                <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => suspendUser(s.id)}>Suspend</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!data?.flaggedMessages?.length ? (
              <div className="empty-state">
                <MessageIcon size={36} style={{ color: 'var(--text-3)' }} />
                <div className="empty-title">No flagged messages</div>
                <div className="empty-sub">Messages containing contact details or external links will appear here</div>
              </div>
            ) : data.flaggedMessages.map(m => (
              <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={styles.avatar}>{m.profiles?.first_name?.[0]}{m.profiles?.last_name?.[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.userName}>{m.profiles?.first_name} {m.profiles?.last_name} <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({m.profiles?.role})</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
                  </div>
                  <div style={{ ...styles.riskBadge, background: 'rgba(239,68,68,0.08)', color: 'var(--error)' }}>{m.flagged_pattern}</div>
                  <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => suspendUser(m.sender_id)}>Suspend Sender</button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8, fontFamily: 'monospace' }}>
                  "{m.original_body}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 24 },
  tabs: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  tabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--error)', flexShrink: 0 },
  userName: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  userMeta: { fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 4, flexWrap: 'wrap' },
  riskBadge: { fontSize: 10, fontWeight: 700, background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
};
