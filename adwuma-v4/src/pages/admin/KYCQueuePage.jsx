import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { ShieldIcon, CheckCircleIcon, XIcon, EyeIcon, FileTextIcon, AlertCircleIcon } from '../../components/ui/Icons';

const STATUS_COLORS = {
  pending:      { bg: 'rgba(255,255,255,0.06)', color: '#9ca3af', label: 'Pending' },
  under_review: { bg: 'rgba(245,158,11,0.1)',   color: '#f59e0b', label: 'Under Review' },
  approved:     { bg: 'rgba(34,197,94,0.1)',    color: '#22c55e', label: 'Approved' },
  rejected:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', label: 'Rejected' },
};

function RejectModal({ agent, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Reject KYC — {agent.profiles?.first_name} {agent.profiles?.last_name}</div>
        <div style={styles.modalSub}>Provide a reason so the agent knows what to fix and resubmit.</div>
        <textarea style={styles.textarea} rows={4} placeholder="e.g. Business registration certificate is expired. Please resubmit a valid document." value={reason} onChange={e => setReason(e.target.value)} />
        <div style={styles.modalBtns}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Confirm Rejection</button>
        </div>
      </div>
    </div>
  );
}

function AgentKYCCard({ kyc, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_COLORS[kyc.status] || STATUS_COLORS.pending;
  const docs = kyc.kyc_documents || [];

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={styles.agentInfo}>
          <div style={styles.avatar}>{kyc.profiles?.first_name?.[0]}{kyc.profiles?.last_name?.[0]}</div>
          <div>
            <div style={styles.agentName}>{kyc.profiles?.first_name} {kyc.profiles?.last_name}</div>
            <div style={styles.agentEmail}>{kyc.profiles?.phone || 'No phone'}</div>
            {kyc.business_name && <div style={styles.bizName}>{kyc.business_name}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
          <button style={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide' : 'View'} <EyeIcon size={14} />
          </button>
        </div>
      </div>

      <div style={styles.cardMeta}>
        <span>Submitted {format(new Date(kyc.submitted_at), 'MMM d, yyyy')}</span>
        <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
      </div>

      {expanded && (
        <div style={styles.expandedSection}>
          <div style={styles.docsTitle}>Submitted Documents</div>
          {docs.length === 0 ? (
            <div style={styles.noDocs}>No documents uploaded yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map(doc => (
                <div key={doc.id} style={styles.docRow}>
                  <FileTextIcon size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.docName}>{doc.document_name}</div>
                    <div style={styles.docType}>{doc.document_type?.replace(/_/g, ' ')}</div>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={styles.viewDocBtn}>
                    View <EyeIcon size={12} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {(kyc.status === 'under_review' || kyc.status === 'pending') && (
            <div style={styles.actionBtns}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => onAction('reject', kyc)}>
                <XIcon size={15} /> Reject
              </button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => onAction('approve', kyc)}>
                <CheckCircleIcon size={15} /> Approve KYC
              </button>
            </div>
          )}

          {kyc.status === 'rejected' && kyc.rejection_reason && (
            <div style={styles.rejectionNote}>
              <AlertCircleIcon size={14} style={{ flexShrink: 0 }} />
              <div><strong>Rejection reason:</strong> {kyc.rejection_reason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KYCQueuePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('under_review');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: kycList = [], isLoading } = useQuery({
    queryKey: ['admin_kyc', filter],
    queryFn: async () => {
      let q = supabase.from('agent_kyc')
        .select(`*, kyc_documents(*), profiles!agent_kyc_agent_id_fkey(first_name, last_name, phone)`)
        .order('submitted_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (kyc) => {
      await supabase.from('agent_kyc').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', kyc.id);
      await supabase.from('notifications').insert({
        recipient_id: kyc.agent_id, type: 'kyc_approved',
        title: 'KYC Approved!',
        body: 'Your identity verification has been approved. You can now post job listings.',
        link: '/agent/jobs/new',
      });
    },
    onSuccess: () => { toast.success('KYC approved — agent notified'); queryClient.invalidateQueries(['admin_kyc']); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ kyc, reason }) => {
      await supabase.from('agent_kyc').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('id', kyc.id);
      await supabase.from('notifications').insert({
        recipient_id: kyc.agent_id, type: 'kyc_rejected',
        title: 'KYC Rejected',
        body: `Your KYC submission was rejected. Reason: ${reason}`,
        link: '/agent/kyc',
      });
    },
    onSuccess: () => { toast.success('KYC rejected — agent notified'); setRejectTarget(null); queryClient.invalidateQueries(['admin_kyc']); },
    onError: (e) => toast.error(e.message),
  });

  const handleAction = (action, kyc) => {
    if (action === 'approve') approveMutation.mutate(kyc);
    if (action === 'reject') setRejectTarget(kyc);
  };

  const FILTERS = [
    { id: 'under_review', label: 'Under Review' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
  ];

  return (
    <AppShell title="KYC Queue">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>KYC Verification Queue</div>
          <div style={styles.pageSub}>Review agent identity and business documents</div>
        </div>

        {/* Filter tabs */}
        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f.id} style={{ ...styles.filterTab, ...(filter === f.id ? styles.filterTabActive : {}) }} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : kycList.length === 0 ? (
          <div className="empty-state">
            <ShieldIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No {filter === 'all' ? '' : filter.replace('_', ' ')} submissions</div>
            <div className="empty-sub">KYC submissions will appear here when agents register</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {kycList.map(kyc => (
              <AgentKYCCard key={kyc.id} kyc={kyc} onAction={handleAction} />
            ))}
          </div>
        )}

        {rejectTarget && (
          <RejectModal
            agent={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onConfirm={(reason) => rejectMutation.mutate({ kyc: rejectTarget, reason })}
          />
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  filterTabs: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterTabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  agentInfo: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  agentName: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  agentEmail: { fontSize: 12, color: 'var(--text-3)', marginBottom: 2 },
  bizName: { fontSize: 12, color: 'var(--gold-text)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  expandBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  cardMeta: { display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)' },
  expandedSection: { marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 },
  docsTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' },
  noDocs: { fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' },
  docRow: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px' },
  docName: { fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  docType: { fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' },
  viewDocBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gold-text)', background: 'var(--gold-dim)', padding: '5px 10px', borderRadius: 6, textDecoration: 'none', flexShrink: 0 },
  actionBtns: { display: 'flex', gap: 10 },
  rejectionNote: { display: 'flex', gap: 8, background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--error)', lineHeight: 1.5 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: -8 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
