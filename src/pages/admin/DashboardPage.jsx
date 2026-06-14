import React from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '../../lib/currency';
import { ShieldIcon, BriefcaseIcon, FileTextIcon, CreditCardIcon, WalletIcon, UsersIcon, ChevronRightIcon, AlertCircleIcon } from '../../components/ui/Icons';
import { formatDistanceToNow } from 'date-fns';

function useAdminStats() {
  return useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const [
        { count: totalSeekers },
        { count: totalAgents },
        { count: activeJobs },
        { count: kycPending },
        { count: jobsPending },
        { count: docsPending },
        { count: withdrawalsPending },
        { data: escrowData },
        { data: recentApps },
        { data: recentPayments },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seeker'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('agent_kyc').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('application_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('amount, currency').eq('escrow_status', 'holding'),
        supabase.from('applications').select('id, applied_at, jobs(title), profiles!applications_seeker_id_fkey(first_name, last_name)').order('applied_at', { ascending: false }).limit(5),
        supabase.from('payments').select('amount, currency, created_at, escrow_status, applications(jobs(title))').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalEscrow = (escrowData || []).reduce((sum, p) => sum + Number(p.amount), 0);
      return { totalSeekers, totalAgents, activeJobs, kycPending, jobsPending, docsPending, withdrawalsPending, totalEscrow, recentApps: recentApps || [], recentPayments: recentPayments || [] };
    },
    refetchInterval: 60000,
  });
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const totalAlerts = (stats?.kycPending || 0) + (stats?.jobsPending || 0) + (stats?.docsPending || 0) + (stats?.withdrawalsPending || 0);

  return (
    <AppShell title="Admin Dashboard">
      <div className="page">
        <div style={styles.pageHeader}>
          <div>
            <div style={styles.pageTitle}>Admin Dashboard</div>
            <div style={styles.pageSub}>Platform overview and action queues</div>
          </div>
          {totalAlerts > 0 && (
            <div style={styles.alertBadge}>
              <AlertCircleIcon size={14} /> {totalAlerts} actions needed
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: 'Job Seekers', value: stats.totalSeekers, icon: UsersIcon, color: '#60a5fa', to: '/admin/users' },
                { label: 'Agents', value: stats.totalAgents, icon: UsersIcon, color: 'var(--gold)', to: '/admin/users' },
                { label: 'Active Jobs', value: stats.activeJobs, icon: BriefcaseIcon, color: '#22c55e', to: '/admin/jobs' },
                { label: 'In Escrow', value: formatMoney(stats.totalEscrow, 'NGN', { compact: true }), icon: CreditCardIcon, color: '#a78bfa', to: '/admin/payments' },
              ].map(s => (
                <Link key={s.label} to={s.to} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <s.icon size={18} style={{ color: s.color }} />
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text-1)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Action queues */}
            <div className="section-header">
              <div className="section-title">Action Queues</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {[
                { to: '/admin/kyc', icon: ShieldIcon, label: 'KYC Verification', count: stats.kycPending, color: '#f97316', desc: 'agents awaiting identity review' },
                { to: '/admin/jobs', icon: BriefcaseIcon, label: 'Job Approvals', count: stats.jobsPending, color: 'var(--gold)', desc: 'jobs pending review' },
                { to: '/admin/documents', icon: FileTextIcon, label: 'Document Review', count: stats.docsPending, color: '#60a5fa', desc: 'documents awaiting approval' },
                { to: '/admin/payments', icon: CreditCardIcon, label: 'Escrow Release', count: 0, color: '#a78bfa', desc: 'payments in holding' },
                { to: '/admin/withdrawals', icon: WalletIcon, label: 'Withdrawals', count: stats.withdrawalsPending, color: '#22c55e', desc: 'withdrawal requests' },
              ].map(q => (
                <Link key={q.to} to={q.to} style={styles.queueCard}>
                  <div style={{ ...styles.queueIcon, background: `${q.color}15`, color: q.color }}>
                    <q.icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.queueLabel}>{q.label}</div>
                    <div style={styles.queueDesc}>{q.count > 0 ? `${q.count} ${q.desc}` : `No pending ${q.desc}`}</div>
                  </div>
                  {q.count > 0 && (
                    <div style={{ ...styles.queueBadge, background: `${q.color}20`, color: q.color }}>{q.count}</div>
                  )}
                  <ChevronRightIcon size={16} style={{ color: 'var(--text-3)' }} />
                </Link>
              ))}
            </div>

            {/* Recent activity */}
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <div className="section-header"><div className="section-title">Recent Applications</div></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.recentApps.map(app => (
                    <div key={app.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={styles.miniAvatar}>{app.profiles?.first_name?.[0]}{app.profiles?.last_name?.[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.miniName}>{app.profiles?.first_name} {app.profiles?.last_name}</div>
                        <div style={styles.miniSub}>{app.jobs?.title}</div>
                      </div>
                      <div style={styles.miniTime}>{formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-header"><div className="section-title">Recent Payments</div></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.recentPayments.map((p, i) => (
                    <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.miniName}>{p.applications?.jobs?.title || 'Job Application'}</div>
                        <div style={styles.miniSub}>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-text)' }}>{formatMoney(p.amount, p.currency)}</div>
                      <div style={{ ...styles.escrowDot, background: p.escrow_status === 'holding' ? '#60a5fa' : p.escrow_status === 'released' ? '#22c55e' : '#ef4444' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 },
  pageTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)' },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginTop: 3 },
  alertBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  queueCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', textDecoration: 'none', transition: 'border-color 0.15s' },
  queueIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  queueLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  queueDesc: { fontSize: 12, color: 'var(--text-2)' },
  queueBadge: { fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  miniAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  miniName: { fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  miniSub: { fontSize: 11, color: 'var(--text-3)' },
  miniTime: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0 },
  escrowDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
};
