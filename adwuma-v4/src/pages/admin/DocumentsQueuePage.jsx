import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { FileTextIcon, CheckCircleIcon, XIcon, EyeIcon, AlertCircleIcon } from '../../components/ui/Icons';

function RejectModal({ doc, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Reject Document</div>
        <div style={styles.modalSub}>"{doc.document_name}" — tell the agent what needs to be fixed.</div>
        <textarea style={styles.textarea} rows={3} placeholder="e.g. Document is blurry. Please reupload a clear scan." value={reason} onChange={e => setReason(e.target.value)} />
        <div style={styles.modalBtns}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Reject Document</button>
        </div>
      </div>
    </div>
  );
}

function DocCard({ doc, onApprove, onReject }) {
  const ST = {
    pending:  { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'Pending Review' },
    approved: { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', label: 'Approved' },
    rejected: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', label: 'Rejected' },
  };
  const st = ST[doc.status] || ST.pending;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={styles.docIconWrap}>
            <FileTextIcon size={18} style={{ color: 'var(--gold)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.docName}>{doc.document_name}</div>
            <div style={styles.docMeta}>
              {doc.applications?.jobs?.title} · {doc.profiles?.first_name} {doc.profiles?.last_name}
            </div>
            <div style={styles.docTime}>{formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true })}</div>
            {doc.resubmit_count > 0 && (
              <div style={styles.resubmitBadge}>
                <AlertCircleIcon size={11} /> Resubmission #{doc.resubmit_count}
              </div>
            )}
          </div>
        </div>
        <span style={{ ...styles.badge, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
      </div>

      <div style={styles.cardActions}>
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={styles.viewBtn}>
          <EyeIcon size={13} /> View Document
        </a>
        {doc.status === 'pending' && (
          <>
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => onReject(doc)}>
              <XIcon size={13} /> Reject
            </button>
            <button className="btn btn-gold" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => onApprove(doc)}>
              <CheckCircleIcon size={13} /> Approve
            </button>
          </>
        )}
      </div>

      {doc.status === 'rejected' && doc.rejection_reason && (
        <div style={styles.rejectionNote}>
          <AlertCircleIcon size={13} style={{ flexShrink: 0 }} />
          {doc.rejection_reason}
        </div>
      )}
    </div>
  );
}

export default function DocumentsQueuePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['admin_docs', filter],
    queryFn: async () => {
      let q = supabase.from('application_documents')
        .select(`*, profiles!application_documents_agent_id_fkey(first_name, last_name),
          applications(id, jobs(title))`)
        .order('uploaded_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (doc) => {
      await supabase.from('application_documents').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', doc.id);
      // Get seeker ID from application
      const { data: app } = await supabase.from('applications').select('seeker_id, jobs(title)').eq('id', doc.application_id).single();
      await supabase.from('notifications').insert({
        recipient_id: app.seeker_id, type: 'document_approved',
        title: 'Document Available',
        body: `A new document "${doc.document_name}" is ready for download on your application for ${app.jobs?.title}.`,
        link: `/dashboard/applications/${doc.application_id}`,
      });
    },
    onSuccess: () => { toast.success('Document approved — seeker notified'); queryClient.invalidateQueries(['admin_docs']); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ doc, reason }) => {
      await supabase.from('application_documents').update({
        status: 'rejected', rejection_reason: reason,
        resubmit_count: (doc.resubmit_count || 0) + 1,
        reviewed_at: new Date().toISOString()
      }).eq('id', doc.id);
      await supabase.from('notifications').insert({
        recipient_id: doc.agent_id, type: 'document_rejected',
        title: 'Document Rejected',
        body: `"${doc.document_name}" was rejected. Reason: ${reason}. Please reupload a corrected version.`,
        link: `/agent/applications/${doc.application_id}`,
      });
    },
    onSuccess: () => { toast.success('Document rejected — agent notified'); setRejectTarget(null); queryClient.invalidateQueries(['admin_docs']); },
    onError: (e) => toast.error(e.message),
  });

  const FILTERS = ['pending', 'approved', 'rejected', 'all'];

  return (
    <AppShell title="Documents Queue">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>Document Review Queue</div>
          <div style={styles.pageSub}>Review documents uploaded by agents for seekers</div>
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
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <FileTextIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No {filter} documents</div>
            <div className="empty-sub">Documents uploaded by agents will appear here for review</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docs.map(doc => (
              <DocCard key={doc.id} doc={doc}
                onApprove={(d) => approveMutation.mutate(d)}
                onReject={(d) => setRejectTarget(d)}
              />
            ))}
          </div>
        )}

        {rejectTarget && (
          <RejectModal doc={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={(reason) => rejectMutation.mutate({ doc: rejectTarget, reason })} />
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
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  docIconWrap: { width: 40, height: 40, borderRadius: 10, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docName: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 },
  docMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  docTime: { fontSize: 11, color: 'var(--text-3)' },
  resubmitBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 20, marginTop: 4 },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', textDecoration: 'none' },
  rejectionNote: { display: 'flex', gap: 8, fontSize: 12, color: 'var(--error)', background: 'var(--error-dim)', padding: '8px 12px', borderRadius: 6, alignItems: 'flex-start' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: -8 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
