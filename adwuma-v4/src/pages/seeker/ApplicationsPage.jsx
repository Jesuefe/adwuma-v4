import React from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useSeekerApplications } from '../../hooks';
import { formatMoney } from '../../lib/currency';
import { formatDistanceToNow } from 'date-fns';
import { BriefcaseIcon, ChevronRightIcon, SearchIcon } from '../../components/ui/Icons';

const STATUS_STYLES = {
  in_escrow:    { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa',  label: 'In Escrow' },
  under_review: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',  label: 'Under Review' },
  approved:     { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e',  label: 'Approved' },
  refunded:     { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444',  label: 'Refunded' },
};

function MiniProgress({ steps = [] }) {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const completed = sorted.filter(s => s.status === 'completed').length;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 8 }}>
      {sorted.map((s, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: s.status === 'completed' ? 'var(--gold)' : s.status === 'in_progress' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)' }} />
      ))}
      <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginLeft: 4 }}>{completed}/6</span>
    </div>
  );
}

export default function SeekerApplicationsPage() {
  const { data: applications = [], isLoading } = useSeekerApplications();

  return (
    <AppShell title="My Applications">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>My Applications</div>
          <div style={styles.pageSub}>{applications.length} total application{applications.length !== 1 ? 's' : ''}</div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No applications yet</div>
            <div className="empty-sub">Browse jobs and apply to start tracking your progress here</div>
            <Link to="/jobs" style={styles.browseBtn}><SearchIcon size={15} /> Browse Jobs</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.map(app => {
              const st = STATUS_STYLES[app.status] || STATUS_STYLES.in_escrow;
              const payment = app.payments?.[0];
              return (
                <Link key={app.id} to={`/dashboard/applications/${app.id}`} style={styles.appCard}>
                  <div style={styles.appCardTop}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.jobTitle}>{app.jobs?.title}</div>
                      <div style={styles.jobMeta}>{app.jobs?.company_name} · {app.jobs?.countries?.name}</div>
                      {payment && (
                        <div style={styles.fee}>Fee: {formatMoney(payment.amount, payment.currency)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
                      <ChevronRightIcon size={15} style={{ color: 'var(--text-3)' }} />
                    </div>
                  </div>
                  <MiniProgress steps={app.application_steps || []} />
                  <div style={styles.appTime}>Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}</div>
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
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  browseBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', marginTop: 8 },
  appCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none' },
  appCardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 3 },
  jobMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 3 },
  fee: { fontSize: 12, fontWeight: 600, color: 'var(--gold-text)' },
  badge: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20 },
  appTime: { fontSize: 11, color: 'var(--text-3)', marginTop: 4 },
};
