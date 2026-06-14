import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from 'components/layout/AppShell';
import { FileTextIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, AlertCircleIcon } from 'components/ui/Icons';

function ApplicationDocGroup({ appGroup, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(appGroup.hasPending);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingCount = appGroup.docs.filter(d => d.status === 'pending').length;

  return (
    <div className="card" style={{ marginBottom: 12, borderColor: appGroup.hasPending ? 'var(--gold-border)' : 'var(--border)' }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={styles.agentAvatar}>{appGroup.agentName?.[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
            {appGroup.jobTitle}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Agent: {appGroup.agentName} · Seeker: {appGroup.seekerName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {appGroup.docs.length} document{appGroup.docs.length !== 1 ? 's' : ''}
            {pendingCount > 0 && <span style={{ color: 'var(--gold)', marginLeft: 8, fontWeight: 600 }}>• {pendingCount} pending review</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pendingCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '3px 8px', borderRadius: 999 }}>
              {pendingCount} pending
            </span>
          )}
          {expanded ? <ChevronUpIcon size={16} style={{ color: 'var(--text-3)' }} /> : <ChevronDownIcon size={16} style={{ color: 'var(--text-3)' }} />}
        </div>
      </div>

      {/* Document list */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appGroup.docs.map(doc => {
            const DS = {
              pending:  { color: 'var(--gold)',  label: 'Pending Review', bg: 'var(--gold-dim)' },
              approved: { color: 'var(--green)', label: 'Approved',       bg: 'var(--green-dim)' },
              rejected: { color: 'var(--error)', label: 'Rejected',       bg: 'var(--error-dim)' },
            };
            const ds = DS[doc.status] || DS.pending;
            const isRejecting = rejectId === doc.id;

            return (
              <div key={doc.id} style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <FileTextIcon size={16} style={{ color: ds.color, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{doc.document_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                      Uploaded {formatDistanceToNow(new Date(doc.uploaded_at || doc.created_at), { addSuffix: true })}
                    </div>
                    {doc.rejection_reason && (
                      <div style={{ fontSize: 12, color: 'var(--error)', background: 'var(--error-dim)', padding: '6px 10px', borderRadius: 8, marginBottom: 6 }}>
                        Rejection reason: {doc.rejection_reason}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, background: ds.bg, color: ds.color, padding: '3px 10px', borderRadius: 999, flexShrink: 0 }}>
                    {ds.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--brand)', background: 'var(--brand-dim)', padding: '8px 12px', borderRadius: 8, textDecoration: 'none' }}>
                    View Document
                  </a>
                  {doc.status !== 'approved' && (
                    <button style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                      onClick={() => onApprove(doc)}>
                      ✓ Approve
                    </button>
                  )}
                  {doc.status !== 'rejected' && (
                    <button style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                      onClick={() => { setRejectId(doc.id); setRejectReason(''); }}>
                      ✗ Reject
                    </button>
                  )}
                </div>

                {isRejecting && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="input" style={{ fontSize: 13 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection…" autoFocus />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setRejectId(null)}>Cancel</button>
                      <button className="btn btn-danger btn-sm" style={{ flex: 1 }} disabled={!rejectReason.trim()} onClick={() => { onReject(doc, rejectReason); setRejectId(null); }}>
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DocumentsQueuePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['admin_documents', filter],
    queryFn: async () => {
      let q = supabase.from('application_documents')
        .select(`*, applications(id, seeker_id, agent_id, jobs(title),
          profiles!applications_seeker_id_fkey(first_name, last_name),
          agent:profiles!applications_agent_id_fkey(first_name, last_name))`)
        .order('uploaded_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  // Group docs by application
  const grouped = docs.reduce((acc, doc) => {
    const appId = doc.application_id;
    if (!acc[appId]) {
      acc[appId] = {
        appId,
        jobTitle: doc.applications?.jobs?.title || 'Application',
        agentName: `${doc.applications?.agent?.first_name || ''} ${doc.applications?.agent?.last_name || ''}`.trim(),
        seekerName: `${doc.applications?.profiles?.first_name || ''} ${doc.applications?.profiles?.last_name || ''}`.trim(),
        docs: [],
        hasPending: false,
      };
    }
    acc[appId].docs.push(doc);
    if (doc.status === 'pending') acc[appId].hasPending = true;
    return acc;
  }, {});

  const approveMutation = useMutation({
    mutationFn: async (doc) => {
      await supabase.from('application_documents').update({ status: 'approved' }).eq('id', doc.id);
      // Notify seeker
      const { data: app } = await supabase.from('applications').select('seeker_id, jobs(title)').eq('id', doc.application_id).single();
      await supabase.from('notifications').insert({
        recipient_id: app?.seeker_id,
        type: 'document_approved',
        title: 'Document Available',
        body: `"${doc.document_name}" is now available for your application: ${app?.jobs?.title}`,
        link: `/dashboard/applications/${doc.application_id}`,
      });
      await supabase.from('audit_logs').insert({ action: 'approve_document', entity_type: 'application_document', entity_id: doc.id, new_value: { document_name: doc.document_name } });
    },
    onSuccess: () => { toast.success('Document approved — seeker notified'); queryClient.invalidateQueries(['admin_documents']); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ doc, reason }) => {
      await supabase.from('application_documents').update({ status: 'rejected', rejection_reason: reason }).eq('id', doc.id);
      const { data: app } = await supabase.from('applications').select('agent_id, jobs(title)').eq('id', doc.application_id).single();
      await supabase.from('notifications').insert({
        recipient_id: app?.agent_id,
        type: 'document_approved',
        title: 'Document Rejected',
        body: `"${doc.document_name}" was rejected: ${reason}. Please reupload.`,
        link: `/agent/applications/${doc.application_id}`,
      });
    },
    onSuccess: () => { toast.success('Document rejected — agent notified'); queryClient.invalidateQueries(['admin_documents']); },
    onError: (e) => toast.error(e.message),
  });

  const appGroups = Object.values(grouped);
  const pendingCount = docs.filter(d => d.status === 'pending').length;

  return (
    <AppShell title="Documents">
      <div className="page">
        <div style={styles.pageTitle}>Document Review</div>
        <div style={styles.pageSub}>Agent-uploaded documents grouped by application</div>

        <div style={styles.filterTabs}>
          {[['pending', `Pending (${pendingCount})`], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([id, label]) => (
            <button key={id} style={{ ...styles.filterTab, ...(filter === id ? styles.filterTabActive : {}) }} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : appGroups.length === 0 ? (
          <div className="empty-state">
            <FileTextIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No documents to review</div>
          </div>
        ) : (
          appGroups.map(group => (
            <ApplicationDocGroup
              key={group.appId}
              appGroup={group}
              onApprove={(doc) => approveMutation.mutate(doc)}
              onReject={(doc, reason) => rejectMutation.mutate({ doc, reason })}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageTitle: { fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4, fontFamily: 'Inter, sans-serif' },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 24 },
  filterTabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: { padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterTabActive: { background: 'var(--brand-dim)', borderColor: 'var(--brand-border)', color: 'var(--brand)' },
  agentAvatar: { width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 },
};
