import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { formatMoney, calculatePostingFee } from '../../lib/currency';
import { BriefcaseIcon, CheckCircleIcon, XIcon, StarIcon, EyeIcon, MapPinIcon, DollarIcon } from '../../components/ui/Icons';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

function RejectModal({ job, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Reject Job — {job.title}</div>
        <div style={styles.modalSub}>Tell the agent why this listing was rejected.</div>
        <textarea style={styles.textarea} rows={3} placeholder="e.g. Salary range is missing. Please provide a complete salary range and resubmit." value={reason} onChange={e => setReason(e.target.value)} />
        <div style={styles.modalBtns}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Reject Listing</button>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onApprove, onReject, onToggleFeature }) {
  const [expanded, setExpanded] = useState(false);
  const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
  const postingFee = calculatePostingFee(job.service_fee, 1);

  const STATUS_STYLES = {
    pending:  { bg: 'rgba(245,158,11,0.1)',  color: 'var(--brand)' },
    active:   { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444' },
    expired:  { bg: 'rgba(255,255,255,0.06)',color: '#9ca3af' },
    closed:   { bg: 'rgba(255,255,255,0.06)',color: '#9ca3af' },
  };
  const st = STATUS_STYLES[job.status] || STATUS_STYLES.pending;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{flag}</span>
          <div style={{ minWidth: 0 }}>
            <div style={styles.jobTitle}>{job.title}</div>
            <div style={styles.jobMeta}>{job.company_name} · {job.countries?.name}</div>
            <div style={styles.jobAgent}>By: {job.profiles?.first_name} {job.profiles?.last_name} ({job.agent_kyc?.business_name || 'Agent'})</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{job.status}</span>
          {job.is_featured && <span style={styles.featuredBadge}><StarIcon size={10} /> Featured</span>}
        </div>
      </div>

      <div style={styles.jobStats}>
        <span><DollarIcon size={12} /> Fee: {formatMoney(job.service_fee, job.service_fee_currency)}</span>
        <span>Posting fee: {formatMoney(postingFee, job.service_fee_currency)}</span>
        <span>{job.job_type?.replace('_', ' ')}</span>
        <span>Submitted {format(new Date(job.created_at), 'MMM d')}</span>
      </div>

      <div style={styles.cardActions}>
        <button style={styles.viewBtn} onClick={() => setExpanded(e => !e)}>
          <EyeIcon size={13} /> {expanded ? 'Hide' : 'Preview'}
        </button>
        {job.status === 'active' && (
          <button style={{ ...styles.featureBtn, background: job.is_featured ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: job.is_featured ? 'var(--gold-text)' : 'var(--text-2)' }} onClick={() => onToggleFeature(job)}>
            <StarIcon size={13} /> {job.is_featured ? 'Unfeature' : 'Feature'}
          </button>
        )}
        {job.status === 'pending' && (
          <>
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => onReject(job)}>
              <XIcon size={13} /> Reject
            </button>
            <button className="btn btn-gold" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => onApprove(job)}>
              <CheckCircleIcon size={13} /> Approve
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div style={styles.preview}>
          {/* Images */}
          {(job.cover_image_url || job.company_logo_url) && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {job.company_logo_url && (
                <div>
                  <div style={styles.previewLabel}>Company Logo</div>
                  <img src={job.company_logo_url} alt="logo" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', marginTop: 4 }} />
                </div>
              )}
              {job.cover_image_url && (
                <div style={{ flex: 1 }}>
                  <div style={styles.previewLabel}>Cover Image</div>
                  <img src={job.cover_image_url} alt="cover" style={{ width: '100%', height: 100, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', marginTop: 4 }} />
                </div>
              )}
            </div>
          )}
          <div style={styles.previewSection}>
            <div style={styles.previewLabel}>Description</div>
            <div style={styles.previewText}>{job.description}</div>
          </div>
          {job.requirements && (
            <div style={styles.previewSection}>
              <div style={styles.previewLabel}>Requirements</div>
              <div style={styles.previewText}>{job.requirements}</div>
            </div>
          )}
          {job.salary_min && (
            <div style={styles.previewSection}>
              <div style={styles.previewLabel}>Salary</div>
              <div style={styles.previewText}>{formatMoney(job.salary_min, job.salary_currency)} – {formatMoney(job.salary_max, job.salary_currency)} / {job.salary_period}</div>
            </div>
          )}
          {job.job_document_checklist?.length > 0 && (
            <div style={styles.previewSection}>
              <div style={styles.previewLabel}>Document Checklist</div>
              {job.job_document_checklist.map(d => <div key={d.id} style={styles.checklistItem}>• {d.document_name}</div>)}
            </div>
          )}
          {job.status === 'rejected' && job.rejection_reason && (
            <div style={styles.rejectionNote}>Rejection reason: {job.rejection_reason}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsQueuePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin_jobs', filter],
    queryFn: async () => {
      let q = supabase.from('jobs')
        .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
          profiles!jobs_agent_id_fkey(first_name, last_name),
          job_document_checklist(id, document_name)`)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (job) => {
      // Approve job
      await supabase.from('jobs').update({ status: 'active', reviewed_at: new Date().toISOString(), posting_fee_charged: true }).eq('id', job.id);
      // Deduct posting fee from agent wallet
      const postingFee = calculatePostingFee(job.service_fee, 1);
      const { data: wallet } = await supabase.from('agent_wallets').select('balance').eq('agent_id', job.agent_id).eq('currency', job.service_fee_currency).single();
      const newBalance = (wallet?.balance || 0) - postingFee;
      await supabase.from('agent_wallets').upsert({ agent_id: job.agent_id, currency: job.service_fee_currency, balance: newBalance });
      await supabase.from('wallet_transactions').insert({ agent_id: job.agent_id, currency: job.service_fee_currency, type: 'debit', amount: postingFee, description: `Posting fee — ${job.title}`, reference_id: job.id, balance_after: newBalance });
      // Notify agent
      await supabase.from('notifications').insert({ recipient_id: job.agent_id, type: 'job_approved', title: 'Job Approved!', body: `"${job.title}" is now live. Posting fee of ${formatMoney(postingFee, job.service_fee_currency)} has been deducted.`, link: '/agent/jobs' });
    },
    onSuccess: () => { toast.success('Job approved and live!'); queryClient.invalidateQueries(['admin_jobs']); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ job, reason }) => {
      await supabase.from('jobs').update({ status: 'rejected', rejection_reason: reason }).eq('id', job.id);
      await supabase.from('notifications').insert({ recipient_id: job.agent_id, type: 'job_rejected', title: 'Job Listing Rejected', body: `"${job.title}" was rejected. Reason: ${reason}`, link: '/agent/jobs' });
    },
    onSuccess: () => { toast.success('Job rejected'); setRejectTarget(null); queryClient.invalidateQueries(['admin_jobs']); },
    onError: (e) => toast.error(e.message),
  });

  const featureMutation = useMutation({
    mutationFn: async (job) => { await supabase.from('jobs').update({ is_featured: !job.is_featured }).eq('id', job.id); },
    onSuccess: () => { toast.success('Updated'); queryClient.invalidateQueries(['admin_jobs']); },
  });

  const FILTERS = ['pending','active','rejected','expired','closed','all'];

  return (
    <AppShell title="Jobs Queue">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>Job Listings Queue</div>
          <div style={styles.pageSub}>Review and approve agent job submissions</div>
        </div>

        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f} style={{ ...styles.filterTab, ...(filter === f ? styles.filterTabActive : {}) }} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No {filter} jobs</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map(job => (
              <JobCard key={job.id} job={job}
                onApprove={(j) => approveMutation.mutate(j)}
                onReject={(j) => setRejectTarget(j)}
                onToggleFeature={(j) => featureMutation.mutate(j)}
              />
            ))}
          </div>
        )}

        {rejectTarget && (
          <RejectModal job={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={(reason) => rejectMutation.mutate({ job: rejectTarget, reason })} />
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
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  jobTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 3 },
  jobMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  jobAgent: { fontSize: 11, color: 'var(--text-3)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' },
  featuredBadge: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', padding: '2px 8px', borderRadius: 20 },
  jobStats: { display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--text-3)' },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  featureBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, border: '1px solid var(--gold-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  preview: { background: 'var(--bg-2)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 },
  previewSection: { display: 'flex', flexDirection: 'column', gap: 4 },
  previewLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  previewText: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-line' },
  checklistItem: { fontSize: 13, color: 'var(--text-2)' },
  rejectionNote: { fontSize: 13, color: 'var(--error)', background: 'var(--error-dim)', padding: 10, borderRadius: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: -8 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
