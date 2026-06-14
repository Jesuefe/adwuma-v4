import React from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useSeekerApplications } from 'hooks';
import { formatMoney } from '../../lib/currency';
import { BriefcaseIcon, CheckCircleIcon, ClockIcon, ChevronRightIcon, SearchIcon } from '../../components/ui/Icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const STEP_NAMES = ['Received', 'Payment', 'Docs Review', 'Processing', 'Offer', 'Relocation'];

const STATUS_COLORS = {
  in_escrow: { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', label: 'In Escrow' },
  under_review: { bg: 'rgba(245,158,11,0.1)', color: 'var(--brand)', label: 'Under Review' },
  approved: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Approved' },
  refunded: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Refunded' },
};

function MiniTracker({ steps = [] }) {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const completed = sorted.filter(s => s.status === 'completed').length;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8 }}>
      {sorted.map((s, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: s.status === 'completed' ? 'var(--gold)' : s.status === 'in_progress' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)' }} />
      ))}
      <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6, flexShrink: 0 }}>{completed}/6</span>
    </div>
  );
}

export default function SeekerDashboard() {
  const { profile } = useAuth();
  const { data: applications = [], isLoading } = useSeekerApplications();

  const { data: featuredJobs = [] } = useQuery({
    queryKey: ['featured_jobs_dash'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs')
        .select('id, title, company_name, service_fee, service_fee_currency, company_logo_url, countries(name, code)')
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .limit(4);
      return data || [];
    },
  });

  const active = applications.filter(a => a.status !== 'refunded');
  const recent = active.slice(0, 3);

  return (
    <AppShell title="Dashboard">
      <div className="page">
        {/* Greeting */}
        <div style={styles.greeting}>
          <div>
            <div style={styles.greetTitle}>Hi, {profile?.first_name} 👋</div>
            <div style={styles.greetSub}>Track your international job applications</div>
          </div>
          <Link to="/jobs" style={styles.findJobsBtn}>
            <SearchIcon size={16} /> Find Jobs
          </Link>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Applied', value: applications.length, icon: BriefcaseIcon, color: 'var(--gold)' },
            { label: 'Active', value: active.length, icon: ClockIcon, color: '#60a5fa' },
            { label: 'Approved', value: applications.filter(a => a.status === 'approved').length, icon: CheckCircleIcon, color: '#22c55e' },
            { label: 'In Escrow', value: applications.filter(a => a.status === 'in_escrow').length, icon: BriefcaseIcon, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <s.icon size={18} style={{ color: s.color }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Applications */}
        <div className="section-header">
          <div className="section-title">Recent Applications</div>
          {applications.length > 3 && (
            <Link to="/dashboard/applications" style={styles.seeAll}>See all</Link>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No applications yet</div>
            <div className="empty-sub">Browse available jobs and apply to start tracking your progress</div>
            <Link to="/jobs" style={styles.browseBtn}>Browse Jobs</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recent.map(app => {
              const st = STATUS_COLORS[app.status] || STATUS_COLORS.in_escrow;
              return (
                <Link key={app.id} to={`/dashboard/applications/${app.id}`} style={styles.appCard}>
                  <div style={styles.appCardTop}>
                    <div>
                      <div style={styles.appJobTitle}>{app.jobs?.title}</div>
                      <div style={styles.appCompany}>{app.jobs?.company_name} · {app.jobs?.countries?.name}</div>
                    </div>
                    <div style={{ ...styles.statusBadge, background: st.bg, color: st.color }}>{st.label}</div>
                  </div>
                  <div style={styles.appFee}>
                    Fee: {formatMoney(app.payments?.[0]?.amount || app.jobs?.service_fee, app.payments?.[0]?.currency || app.jobs?.service_fee_currency)}
                  </div>
                  <MiniTracker steps={app.application_steps || []} />
                  <div style={styles.appCardArrow}><ChevronRightIcon size={16} style={{ color: 'var(--text-3)' }} /></div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Featured Jobs */}
        {featuredJobs.length > 0 && (
          <>
            <div className="section-header" style={{ marginTop: 28 }}>
              <div className="section-title">Available Jobs</div>
              <Link to="/jobs" style={styles.seeAll}>See all</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
              {featuredJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} style={styles.featuredJobRow}>
                  {job.company_logo_url
                    ? <img src={job.company_logo_url} alt={job.company_name} style={styles.jobLogo} />
                    : <div style={styles.jobLogoPlaceholder}>{job.countries?.code || ''}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.featJobTitle}>{job.title}</div>
                    <div style={styles.featJobMeta}>{job.company_name} · {job.countries?.name}</div>
                  </div>
                  <div style={styles.featJobFee}>{formatMoney(job.service_fee, job.service_fee_currency, { compact: true })}</div>
                  <ChevronRightIcon size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Quick links */}
        <div className="section-header" style={{ marginTop: 28 }}>
          <div className="section-title">Quick Links</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { to: '/jobs', label: 'Browse all jobs', sub: 'Find your next opportunity' },
            { to: '/dashboard/inbox', label: 'Messages', sub: 'Chat with your agents' },
            { to: '/dashboard/profile', label: 'My Profile', sub: 'Update your information' },
          ].map(l => (
            <Link key={l.to} to={l.to} style={styles.quickLink}>
              <div>
                <div style={styles.quickLinkLabel}>{l.label}</div>
                <div style={styles.quickLinkSub}>{l.sub}</div>
              </div>
              <ChevronRightIcon size={18} style={{ color: 'var(--text-3)' }} />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

const styles = {
  greeting: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  greetTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)' },
  greetSub: { fontSize: 13, color: 'var(--text-2)', marginTop: 3 },
  findJobsBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  seeAll: { fontSize: 13, color: 'var(--gold-text)', textDecoration: 'none' },
  appCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', position: 'relative' },
  appCardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  appJobTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 },
  appCompany: { fontSize: 12, color: 'var(--text-2)' },
  statusBadge: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, flexShrink: 0 },
  appFee: { fontSize: 12, color: 'var(--text-3)' },
  appCardArrow: { position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' },
  browseBtn: { background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', marginTop: 8 },
  featuredJobRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none' },
  jobLogo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 },
  jobLogoPlaceholder: { width: 36, height: 36, borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  featJobTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  featJobMeta: { fontSize: 11, color: 'var(--text-2)' },
  featJobFee: { fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  quickLink: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textDecoration: 'none' },
  quickLinkLabel: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  quickLinkSub: { fontSize: 12, color: 'var(--text-3)' },
};
