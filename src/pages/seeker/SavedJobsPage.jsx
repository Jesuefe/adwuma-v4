import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import { useAuth } from 'context/AuthContext';
import { formatMoney } from 'lib/currency';
import AppShell from 'components/layout/AppShell';
import { BriefcaseIcon, XIcon } from 'components/ui/Icons';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

export default function SavedJobsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedJobs = [], isLoading } = useQuery({
    queryKey: ['saved_jobs', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('saved_jobs')
        .select(`*, jobs(id, title, company_name, service_fee, service_fee_currency, job_type, company_logo_url, cover_image_url, countries(name, code), profiles!jobs_agent_id_fkey(first_name, last_name))`)
        .eq('seeker_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (jobId) => {
      await supabase.from('saved_jobs').delete().eq('seeker_id', user.id).eq('job_id', jobId);
    },
    onSuccess: () => queryClient.invalidateQueries(['saved_jobs', user?.id]),
  });

  return (
    <AppShell title="Saved Jobs">
      <div className="page">
        <div style={styles.pageTitle}>Saved Jobs</div>
        <div style={styles.pageSub}>{savedJobs.length} saved job{savedJobs.length !== 1 ? 's' : ''}</div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : savedJobs.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No saved jobs</div>
            <div className="empty-sub">Tap the heart icon on any job to save it here</div>
            <Link to="/jobs" style={styles.browseBtn}>Browse Jobs</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {savedJobs.map(s => {
              const job = s.jobs;
              if (!job) return null;
              const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
              return (
                <div key={s.id} style={styles.savedCard}>
                  {job.cover_image_url && (
                    <div style={styles.coverThumb}>
                      <img src={job.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={styles.cardBody}>
                    <div style={styles.cardTop}>
                      {job.company_logo_url
                        ? <img src={job.company_logo_url} alt="" style={styles.logo} />
                        : <span style={{ fontSize: 24 }}>{flag}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.jobTitle}>{job.title}</div>
                        <div style={styles.jobMeta}>{job.company_name} · {job.countries?.name}</div>
                        <div style={styles.jobFee}>{formatMoney(job.service_fee, job.service_fee_currency)}</div>
                      </div>
                      <button style={styles.unsaveBtn} onClick={() => unsaveMutation.mutate(job.id)} title="Remove from saved">
                        <XIcon size={14} />
                      </button>
                    </div>
                    <Link to={`/jobs/${job.id}`} style={styles.applyBtn}>View & Apply →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 24 },
  browseBtn: { background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', marginTop: 8 },
  savedCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  coverThumb: { height: 80, overflow: 'hidden' },
  cardBody: { padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 2 },
  jobMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  jobFee: { fontSize: 12, fontWeight: 600, color: 'var(--gold-text)' },
  unsaveBtn: { background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center', flexShrink: 0 },
  applyBtn: { display: 'block', textAlign: 'center', background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 8, textDecoration: 'none' },
};
