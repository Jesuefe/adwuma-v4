import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgentApplications } from 'hooks';
import { formatMoney } from '../../lib/currency';
import { formatDistanceToNow } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { FileTextIcon, ChevronRightIcon } from '../../components/ui/Icons';

const STATUS_STYLES = {
  in_escrow:    { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa',  label: 'In Escrow' },
  under_review: { bg: 'rgba(245,158,11,0.1)',  color: 'var(--brand)',  label: 'Under Review' },
  approved:     { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e',  label: 'Approved' },
  refunded:     { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444',  label: 'Refunded' },
};

function MiniProgress({ steps = [] }) {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const completed = sorted.filter(s => s.status === 'completed').length;
  const inProgress = sorted.filter(s => s.status === 'in_progress').length;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {sorted.map((s, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: s.status === 'completed' ? 'var(--gold)' : s.status === 'in_progress' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)' }} />
      ))}
      <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginLeft: 4 }}>{completed}/6</span>
    </div>
  );
}

export default function AgentApplicationsPage() {
  const [filter, setFilter] = useState('all');
  const { data: applications = [], isLoading } = useAgentApplications(filter === 'all' ? null : filter);

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'in_escrow', label: 'In Escrow' },
    { id: 'under_review', label: 'Under Review' },
    { id: 'approved', label: 'Approved' },
    { id: 'refunded', label: 'Refunded' },
  ];

  return (
    <AppShell title="Applications">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>Applications</div>
          <div style={styles.pageSub}>{applications.length} total</div>
        </div>

        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f.id} style={{ ...styles.filterTab, ...(filter === f.id ? styles.filterTabActive : {}) }} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <FileTextIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No applications</div>
            <div className="empty-sub">Applications will appear here when seekers apply to your jobs</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.map(app => {
              const st = STATUS_STYLES[app.status] || STATUS_STYLES.in_escrow;
              const payment = app.payments?.[0];
              const completed = (app.application_steps || []).filter(s => s.status === 'completed').length;
              return (
                <Link key={app.id} to={`/agent/applications/${app.id}`} style={styles.appCard}>
                  <div style={styles.appCardTop}>
                    {/* Seeker avatar */}
                    <div style={styles.avatar}>
                      {app.profiles?.first_name?.[0]}{app.profiles?.last_name?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.seekerName}>{app.profiles?.first_name} {app.profiles?.last_name}</div>
                      <div style={styles.jobName}>{app.jobs?.title} · {app.jobs?.company_name}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
                      <ChevronRightIcon size={14} style={{ color: 'var(--text-3)' }} />
                    </div>
                  </div>

                  <MiniProgress steps={app.application_steps || []} />

                  <div style={styles.appCardBottom}>
                    {payment && (
                      <span style={styles.feeTag}>{formatMoney(payment.amount, payment.currency)}</span>
                    )}
                    <span style={styles.stepTag}>{completed} of 6 steps done</span>
                    <span style={styles.timeTag}>{formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  filterTabs: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterTabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  appCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', transition: 'border-color 0.15s' },
  appCardTop: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  seekerName: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 },
  jobName: { fontSize: 12, color: 'var(--text-2)' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  appCardBottom: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  feeTag: { fontSize: 12, fontWeight: 600, color: 'var(--gold-text)' },
  stepTag: { fontSize: 11, color: 'var(--text-3)' },
  timeTag: { fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' },
};
