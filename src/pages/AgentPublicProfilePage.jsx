import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import { formatMoney } from 'lib/currency';
import { ShieldIcon, BriefcaseIcon, CheckCircleIcon, MapPinIcon, ArrowLeftIcon } from 'components/ui/Icons';
import { useAuth } from 'context/AuthContext';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

export default function AgentPublicProfilePage() {
  const { agentId } = useParams();
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['agent_public', agentId],
    queryFn: async () => {
      const [
        { data: profile },
        { data: kyc },
        { data: jobs },
        { data: completedApps },
      ] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, avatar_url, created_at').eq('id', agentId).single(),
        supabase.from('agent_kyc').select('business_name, status, reviewed_at').eq('agent_id', agentId).single(),
        supabase.from('jobs').select('id, title, company_name, service_fee, service_fee_currency, job_type, company_logo_url, countries(name, code)').eq('agent_id', agentId).eq('status', 'active'),
        supabase.from('applications').select('id').eq('agent_id', agentId).eq('status', 'approved'),
      ]);
      return { profile, kyc, jobs: jobs || [], completedApps: completedApps?.length || 0 };
    },
  });

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!data?.profile) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
      Agent not found
    </div>
  );

  const { profile, kyc, jobs, completedApps } = data;
  const isVerified = kyc?.status === 'approved';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/jobs" style={styles.backBtn}><ArrowLeftIcon size={16} /> Browse Jobs</Link>
          <Link to="/" style={styles.logo}>Adwuma</Link>
          <div style={{ width: 80 }} />
        </div>
      </div>

      <div style={styles.body}>
        {/* Agent hero */}
        <div className="card-gold" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div style={styles.agentAvatar}>{profile.first_name?.[0]}{profile.last_name?.[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={styles.agentName}>{profile.first_name} {profile.last_name}</div>
              {kyc?.business_name && <div style={styles.bizName}>{kyc.business_name}</div>}
              {isVerified ? (
                <div style={styles.verifiedBadge}><ShieldIcon size={13} /> KYC Verified Agent</div>
              ) : (
                <div style={styles.unverifiedBadge}>Verification Pending</div>
              )}
            </div>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{jobs.length}</div>
              <div style={styles.statLabel}>Active Jobs</div>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <div style={styles.statValue}>{completedApps}</div>
              <div style={styles.statLabel}>Placements</div>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <div style={styles.statValue}>{completedApps > 0 ? '100%' : 'N/A'}</div>
              <div style={styles.statLabel}>Success Rate</div>
            </div>
          </div>

          {isVerified && kyc?.reviewed_at && (
            <div style={styles.verifiedSince}>
              Verified since {new Date(kyc.reviewed_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Active jobs */}
        <div style={styles.sectionTitle}>Active Job Listings ({jobs.length})</div>
        {jobs.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={36} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No active jobs</div>
          </div>
        ) : (
          <div style={styles.jobsGrid}>
            {jobs.map(job => {
              const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
              return (
                <Link key={job.id} to={isAuthenticated ? `/jobs/${job.id}` : '/auth/register'} style={styles.jobCard}>
                  <div style={styles.jobCardTop}>
                    {job.company_logo_url
                      ? <img src={job.company_logo_url} alt="" style={styles.companyLogo} />
                      : <span style={{ fontSize: 24 }}>{flag}</span>}
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.jobTitle}>{job.title}</div>
                      <div style={styles.jobMeta}>{job.company_name} · {job.countries?.name}</div>
                    </div>
                  </div>
                  <div style={styles.jobFee}>{formatMoney(job.service_fee, job.service_fee_currency)} service fee</div>
                  <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginTop: 4 }}>
                    {isAuthenticated ? 'View & Apply →' : 'Sign up to Apply →'}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 900, margin: '0 auto' },
  backBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', textDecoration: 'none' },
  body: { maxWidth: 900, margin: '0 auto', padding: '28px 16px 48px' },
  agentAvatar: { width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-dim)', border: '2px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  agentName: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  bizName: { fontSize: 14, color: 'var(--text-2)', marginBottom: 8 },
  verifiedBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 12px', borderRadius: 20 },
  unverifiedBadge: { display: 'inline-flex', fontSize: 12, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 20 },
  statsRow: { display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden' },
  statItem: { flex: 1, padding: '14px 16px', textAlign: 'center' },
  statValue: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--gold-text)', marginBottom: 3 },
  statLabel: { fontSize: 11, color: 'var(--text-3)' },
  statDivider: { width: 1, height: 40, background: 'var(--border)' },
  verifiedSince: { fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 16 },
  jobsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 },
  jobCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8 },
  jobCardTop: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  companyLogo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 2 },
  jobMeta: { fontSize: 11, color: 'var(--text-2)' },
  jobFee: { fontSize: 12, fontWeight: 600, color: 'var(--gold-text)' },
};
