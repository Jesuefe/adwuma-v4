import React from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useAgentApplications, useAgentKYC, useWallet } from 'hooks';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '../../lib/currency';
import { BriefcaseIcon, FileTextIcon, WalletIcon, ShieldIcon, PlusIcon, ChevronRightIcon, AlertCircleIcon } from '../../components/ui/Icons';

function StatCard({ icon: Ico, label, value, color, to }) {
  const inner = (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none' }}>
      <Ico size={18} style={{ color }} />
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-1)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function AgentDashboard() {
  const { user, profile } = useAuth();
  const { data: kyc } = useAgentKYC();
  const { data: applications = [] } = useAgentApplications();
  const { data: wallet } = useWallet('NGN');

  const { data: jobs = [] } = useQuery({
    queryKey: ['agent_jobs', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('id, title, status, created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const kycApproved = kyc?.status === 'approved';
  const pending = applications.filter(a => a.status === 'in_escrow').length;
  const activeJobs = jobs.filter(j => j.status === 'active').length;

  return (
    <AppShell title="Agent Dashboard">
      <div className="page">
        {/* KYC Banner */}
        {!kycApproved && (
          <div style={styles.kycBanner}>
            <AlertCircleIcon size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={styles.kycBannerTitle}>KYC verification required</div>
              <div style={styles.kycBannerSub}>Submit your documents to unlock job posting. Status: <strong>{kyc?.status || 'pending'}</strong></div>
            </div>
            <Link to="/agent/kyc" style={styles.kycBannerBtn}>Submit KYC</Link>
          </div>
        )}

        {/* Greeting */}
        <div style={styles.greeting}>
          <div>
            <div style={styles.greetTitle}>Hi, {profile?.first_name} 👋</div>
            <div style={styles.greetSub}>Manage your jobs and placements</div>
          </div>
          {kycApproved && (
            <Link to="/agent/jobs/new" style={styles.postJobBtn}>
              <PlusIcon size={16} /> Post Job
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <StatCard icon={BriefcaseIcon} label="Active Jobs" value={activeJobs} color="var(--gold)" to="/agent/jobs" />
          <StatCard icon={FileTextIcon} label="Applications" value={applications.length} color="#60a5fa" to="/agent/applications" />
          <StatCard icon={FileTextIcon} label="Pending Review" value={pending} color="#f97316" to="/agent/applications" />
          <StatCard icon={WalletIcon} label="Wallet" value={formatMoney(wallet?.balance || 0, 'NGN', { compact: true })} color="#22c55e" to="/agent/wallet" />
        </div>

        {/* Wallet snapshot */}
        {wallet && (
          <div className="card-gold" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Available balance</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: wallet.balance < 0 ? 'var(--error)' : 'var(--gold-text)' }}>
                {formatMoney(wallet.balance, 'NGN')}
              </div>
              {wallet.balance < 0 && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>Negative balance — will be recovered from next payment</div>}
            </div>
            <Link to="/agent/wallet" style={styles.walletBtn}>Withdraw</Link>
          </div>
        )}

        {/* Recent applications */}
        <div className="section-header">
          <div className="section-title">Recent Applications</div>
          <Link to="/agent/applications" style={styles.seeAll}>See all</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {applications.slice(0, 4).map(app => {
            const completed = (app.application_steps || []).filter(s => s.status === 'completed').length;
            return (
              <Link key={app.id} to={`/agent/applications/${app.id}`} style={styles.appRow}>
                <div style={styles.appRowAvatar}>
                  {app.profiles?.first_name?.[0]}{app.profiles?.last_name?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.appRowName}>{app.profiles?.first_name} {app.profiles?.last_name}</div>
                  <div style={styles.appRowJob}>{app.jobs?.title}</div>
                  <div style={styles.appRowProgress}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < completed ? 'var(--gold)' : 'rgba(255,255,255,0.08)' }} />
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{completed}/6</span>
                  </div>
                </div>
                <ChevronRightIcon size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </Link>
            );
          })}
          {applications.length === 0 && (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-title">No applications yet</div>
              <div className="empty-sub">Applications will appear here when seekers apply to your jobs</div>
            </div>
          )}
        </div>

        {/* Recent jobs */}
        <div className="section-header">
          <div className="section-title">My Jobs</div>
          <Link to="/agent/jobs" style={styles.seeAll}>See all</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map(job => (
            <div key={job.id} style={styles.jobRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.jobRowTitle}>{job.title}</div>
                <div style={styles.jobRowStatus}>{job.status}</div>
              </div>
              <div style={{ ...styles.jobStatusDot, background: job.status === 'active' ? 'var(--success)' : job.status === 'pending' ? 'var(--gold)' : 'var(--error)' }} />
            </div>
          ))}
          {jobs.length === 0 && kycApproved && (
            <Link to="/agent/jobs/new" style={styles.postFirstJob}>
              <PlusIcon size={16} /> Post your first job
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const styles = {
  kycBanner: { display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)', borderRadius: 12, padding: 16, marginBottom: 20 },
  kycBannerTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  kycBannerSub: { fontSize: 12, color: 'var(--text-2)' },
  kycBannerBtn: { background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  greeting: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  greetTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)' },
  greetSub: { fontSize: 13, color: 'var(--text-2)', marginTop: 3 },
  postJobBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  seeAll: { fontSize: 13, color: 'var(--gold-text)', textDecoration: 'none' },
  walletBtn: { background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 8, textDecoration: 'none', flexShrink: 0 },
  appRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none' },
  appRowAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  appRowName: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  appRowJob: { fontSize: 12, color: 'var(--text-2)', marginBottom: 6 },
  appRowProgress: { display: 'flex', gap: 3, alignItems: 'center' },
  jobRow: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' },
  jobRowTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  jobRowStatus: { fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' },
  jobStatusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  postFirstJob: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--gold-dim)', border: '1px dashed var(--gold-border)', borderRadius: 10, padding: 16, fontSize: 14, fontWeight: 500, color: 'var(--gold-text)', textDecoration: 'none' },
};
