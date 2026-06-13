import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAgentKYC } from '../../hooks';
import { formatMoney } from '../../lib/currency';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { PlusIcon, BriefcaseIcon, EditIcon, TrashIcon, AlertCircleIcon, StarIcon } from '../../components/ui/Icons';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

const STATUS_STYLES = {
  pending:  { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',  label: 'Pending Review' },
  active:   { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e',  label: 'Active' },
  rejected: { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444',  label: 'Rejected' },
  expired:  { bg: 'rgba(255,255,255,0.06)',color: '#9ca3af',  label: 'Expired' },
  closed:   { bg: 'rgba(255,255,255,0.06)',color: '#9ca3af',  label: 'Closed' },
};

export default function AgentJobsPage() {
  const { user } = useAuth();
  const { data: kyc } = useAgentKYC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['agent_jobs_full', user?.id, filter],
    queryFn: async () => {
      let q = supabase.from('jobs')
        .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
          job_document_checklist(id, document_name)`)
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!user,
  });

  const closeMutation = useMutation({
    mutationFn: async (jobId) => {
      await supabase.from('jobs').update({ status: 'closed' }).eq('id', jobId);
    },
    onSuccess: () => { toast.success('Job closed'); queryClient.invalidateQueries(['agent_jobs_full']); },
    onError: (e) => toast.error(e.message),
  });

  const kycApproved = kyc?.status === 'approved';
  const FILTERS = ['all', 'pending', 'active', 'rejected', 'closed'];

  return (
    <AppShell title="My Jobs">
      <div className="page">
        {/* KYC warning */}
        {!kycApproved && (
          <div style={styles.kycBanner}>
            <AlertCircleIcon size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>
              KYC not approved. <Link to="/agent/kyc" style={{ color: 'var(--gold-text)' }}>Complete verification</Link> to post jobs.
            </div>
          </div>
        )}

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <div style={styles.pageTitle}>My Job Listings</div>
            <div style={styles.pageSub}>{jobs.length} total listing{jobs.length !== 1 ? 's' : ''}</div>
          </div>
          {kycApproved && (
            <Link to="/agent/jobs/new" style={styles.postBtn}>
              <PlusIcon size={16} /> Post Job
            </Link>
          )}
        </div>

        {/* Filter tabs */}
        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f} style={{ ...styles.filterTab, ...(filter === f ? styles.filterTabActive : {}) }} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : STATUS_STYLES[f]?.label || f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">{filter === 'all' ? 'No jobs yet' : `No ${STATUS_STYLES[filter]?.label || filter} jobs`}</div>
            <div className="empty-sub">{kycApproved ? 'Post your first job to start receiving applications' : 'Complete KYC to start posting'}</div>
            {kycApproved && <Link to="/agent/jobs/new" style={styles.postFirstBtn}><PlusIcon size={15} /> Post your first job</Link>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map(job => {
              const st = STATUS_STYLES[job.status] || STATUS_STYLES.pending;
              const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
              return (
                <div key={job.id} style={styles.jobCard}>
                  <div style={styles.jobCardTop}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{flag}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.jobTitle}>{job.title}</div>
                        <div style={styles.jobMeta}>{job.company_name} · {job.countries?.name}</div>
                        <div style={styles.jobFee}>Service fee: {formatMoney(job.service_fee, job.service_fee_currency)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
                      {job.is_featured && <span style={styles.featuredBadge}><StarIcon size={10} /> Featured</span>}
                    </div>
                  </div>

                  {job.status === 'rejected' && job.rejection_reason && (
                    <div style={styles.rejectionNote}>
                      <AlertCircleIcon size={13} style={{ flexShrink: 0 }} /> {job.rejection_reason}
                    </div>
                  )}

                  <div style={styles.jobCardMeta}>
                    <span>{job.job_type?.replace('_', ' ')}</span>
                    <span>{job.job_document_checklist?.length || 0} docs in checklist</span>
                    <span>Posted {format(new Date(job.created_at), 'MMM d, yyyy')}</span>
                    {job.deadline && <span>Closes {format(new Date(job.deadline), 'MMM d')}</span>}
                  </div>

                  <div style={styles.jobCardActions}>
                    {job.status === 'active' && (
                      <button style={styles.closeBtn} onClick={() => { if (window.confirm('Close this job listing?')) closeMutation.mutate(job.id); }}>
                        <TrashIcon size={13} /> Close
                      </button>
                    )}
                    <Link to={`/agent/jobs/${job.id}/edit`} style={styles.editBtn}>
                      <EditIcon size={13} /> Edit
                    </Link>
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
  kycBanner: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  postBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 8, textDecoration: 'none', flexShrink: 0 },
  filterTabs: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterTabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  jobCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  jobCardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 3 },
  jobMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 3 },
  jobFee: { fontSize: 12, fontWeight: 600, color: 'var(--gold-text)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  featuredBadge: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', padding: '2px 8px', borderRadius: 20 },
  rejectionNote: { display: 'flex', gap: 8, fontSize: 12, color: 'var(--error)', background: 'var(--error-dim)', padding: '8px 12px', borderRadius: 6, alignItems: 'flex-start' },
  jobCardMeta: { display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--text-3)' },
  jobCardActions: { display: 'flex', gap: 8 },
  editBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', textDecoration: 'none' },
  closeBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--error)', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  postFirstBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', marginTop: 8 },
};
