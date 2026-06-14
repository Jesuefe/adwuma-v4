import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { supabase, subscribeToMessages } from '../../lib/supabase';
import { useFileUpload } from '../../hooks';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import { formatMoney } from '../../lib/currency';
import { toast } from 'react-toastify';
import { CheckIcon, ClockIcon, ArrowLeftIcon, DownloadIcon, SendIcon, UploadIcon, XIcon } from '../../components/ui/Icons';

const STEPS = [
  { n: 1, label: 'Application Received', desc: 'Your application has been submitted to the agent.' },
  { n: 2, label: 'Payment Secured', desc: 'Your service fee is held in escrow — protected until milestones are met.' },
  { n: 3, label: 'Document Review', desc: 'The agent is reviewing your profile and preparing your documents.' },
  { n: 4, label: 'Employer Processing', desc: 'Your application is being processed with the employer.' },
  { n: 5, label: 'Offer / Decision', desc: 'The employer has made a decision on your application.' },
  { n: 6, label: 'Relocation Support', desc: 'Final documents and relocation support are being arranged.' },
];

const STEP_STATUS = {
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: '#22c55e' },
  in_progress: { color: 'var(--gold)', bg: 'var(--gold-dim)', border: 'var(--gold)' },
  pending: { color: 'var(--text-3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
};

export default function ApplicationDetailPage() {
  const { applicationId } = useParams();
  const { user } = useAuth();
  const { upload, uploading } = useFileUpload();
  const [app, setApp] = useState(null);
  const [agentDocs, setAgentDocs] = useState([]);
  const [seekerDocs, setSeekerDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('tracker');
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [activeDocName, setActiveDocName] = useState(null);
  const docInputRef = useRef(null);
  const msgEndRef = useRef(null);

  useEffect(() => { loadApp(); }, [applicationId]);

  useEffect(() => {
    if (!thread) return;
    loadMessages();
    const channel = subscribeToMessages(thread.id, (payload) => {
      setMessages(m => m.find(msg => msg.id === payload.new.id) ? m : [...m, payload.new]);
    });
    const poll = setInterval(async () => {
      const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
      if (data) setMessages(prev => data.length !== prev.length ? data : prev);
    }, 2000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [thread?.id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadApp() {
    const { data } = await supabase.from('applications')
      .select(`*,
        jobs(title, company_name, service_fee, service_fee_currency, delivery_days,
          countries(name, code),
          job_document_checklist(id, document_name, is_seeker_doc, required_from_seeker, sort_order)
        ),
        application_steps(step_number, step_name, status, updated_at),
        profiles!applications_agent_id_fkey(first_name, last_name),
        payments(amount, currency, escrow_status),
        application_documents(id, document_name, file_url, status, uploaded_at, rejection_reason)`)
      .eq('id', applicationId).single();

    if (!data) return;
    setApp(data);
    setAgentDocs((data.application_documents || []).filter(d => d.status === 'approved'));

    const { data: sdocs } = await supabase.from('seeker_documents').select('*').eq('application_id', applicationId);
    setSeekerDocs(sdocs || []);

    const { data: t } = await supabase.from('message_threads').select('*').eq('application_id', applicationId).maybeSingle();
    if (t) setThread(t);
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
    setMessages(data || []);
    await supabase.from('messages').update({ is_read: true }).eq('thread_id', thread.id).neq('sender_id', user.id);
  }

  async function uploadSeekerDoc(file, docName) {
    if (!file) return;
    setUploadingDoc(docName);
    try {
      const url = await upload(file, 'documents', `seeker-docs/${user.id}`);
      const reqDoc = app?.jobs?.job_document_checklist?.find(d => d.document_name === docName && d.is_seeker_doc);

      // Upsert — replace if already exists
      const existing = seekerDocs.find(s => s.document_name === docName);
      if (existing) {
        await supabase.from('seeker_documents').update({ file_url: url, status: 'uploaded' }).eq('id', existing.id);
      } else {
        await supabase.from('seeker_documents').insert({
          application_id: applicationId,
          seeker_id: user.id,
          document_name: docName,
          file_url: url,
          is_required: reqDoc?.required_from_seeker || false,
        });
      }

      // Notify agent
      await supabase.from('notifications').insert({
        recipient_id: app.agent_id,
        type: 'document_approved',
        title: 'Seeker Uploaded Document',
        body: `Seeker uploaded "${docName}" for application: ${app.jobs?.title}`,
        link: `/agent/applications/${applicationId}`,
      });

      toast.success(`${docName} uploaded successfully`);
      const { data } = await supabase.from('seeker_documents').select('*').eq('application_id', applicationId);
      setSeekerDocs(data || []);
    } catch (err) { toast.error(err.message); }
    setUploadingDoc(null);
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    let threadId = thread?.id;
    if (!threadId) {
      const { data: t } = await supabase.from('message_threads').insert({
        application_id: applicationId, seeker_id: user.id, agent_id: app.agent_id
      }).select().single();
      setThread(t);
      threadId = t.id;
    }
    await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, body: newMsg.trim() });
    setNewMsg('');
    setSending(false);
  }

  if (!app) return (
    <AppShell title="Application">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
    </AppShell>
  );

  const steps = [...(app.application_steps || [])].sort((a, b) => a.step_number - b.step_number);
  const payment = app.payments?.[0];
  const seekerDocRequirements = (app.jobs?.job_document_checklist || []).filter(d => d.is_seeker_doc).sort((a, b) => a.sort_order - b.sort_order);
  const daysRemaining = app.delivery_deadline ? differenceInDays(new Date(app.delivery_deadline), new Date()) : null;
  const deadlineMissed = daysRemaining !== null && daysRemaining < 0;

  const TABS = [
    { id: 'tracker', label: 'Tracker' },
    ...(seekerDocRequirements.length > 0 ? [{ id: 'my_docs', label: `My Documents (${seekerDocs.length}/${seekerDocRequirements.length})` }] : []),
    { id: 'agent_docs', label: `Agent Docs (${agentDocs.length})` },
    { id: 'chat', label: 'Chat' },
  ];

  return (
    <AppShell title="Application Tracker">
      <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link to="/dashboard/applications" style={styles.back}>
          <ArrowLeftIcon size={16} /> All Applications
        </Link>

        {/* Job info */}
        <div className="card-gold" style={{ marginBottom: 20 }}>
          <div style={styles.jobTitle}>{app.jobs?.title}</div>
          <div style={styles.jobMeta}>{app.jobs?.company_name} · {app.jobs?.countries?.name}</div>

          {/* Delivery countdown */}
          {app.delivery_deadline && app.status !== 'approved' && (
            <div style={{ background: deadlineMissed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${deadlineMissed ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: deadlineMissed ? 'var(--error)' : 'var(--gold-text)', marginBottom: 3 }}>
                ⏱ Delivery Deadline
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-1)' }}>
                {format(new Date(app.delivery_deadline), 'MMMM d, yyyy')}
                {' · '}
                {deadlineMissed
                  ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>Overdue — 10% refund pending</span>
                  : <span style={{ color: 'var(--gold-text)', fontWeight: 600 }}>{daysRemaining} days remaining</span>}
              </div>
            </div>
          )}

          {payment && (
            <div style={styles.paymentInfo}>
              <div>
                <div style={styles.payLabel}>Paid</div>
                <div style={styles.payAmount}>{formatMoney(payment.amount, payment.currency)}</div>
              </div>
              <div style={{ ...styles.escrowBadge, background: payment.escrow_status === 'holding' ? 'rgba(96,165,250,0.1)' : 'rgba(34,197,94,0.1)', color: payment.escrow_status === 'holding' ? '#60a5fa' : '#22c55e' }}>
                {payment.escrow_status === 'holding' ? '🔒 In Escrow' : '✓ Released'}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            Agent: {app.profiles?.first_name} {app.profiles?.last_name}
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tracker ── */}
        {tab === 'tracker' && (
          <div style={styles.timeline}>
            {STEPS.map((info, idx) => {
              const step = steps.find(s => s.step_number === info.n) || { status: 'pending' };
              const st = STEP_STATUS[step.status] || STEP_STATUS.pending;
              const isLast = idx === STEPS.length - 1;
              return (
                <div key={info.n} style={styles.timelineItem}>
                  {!isLast && <div style={{ ...styles.timelineLine, background: step.status === 'completed' ? '#22c55e' : 'rgba(255,255,255,0.07)' }} />}
                  <div style={{ ...styles.timelineDot, background: st.bg, border: `2px solid ${st.border}` }}>
                    {step.status === 'completed'
                      ? <CheckIcon size={14} style={{ color: st.color }} />
                      : <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{info.n}</span>}
                  </div>
                  <div style={styles.timelineContent}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={styles.stepLabel}>{info.label}</span>
                      <span style={{ ...styles.stepStatus, color: st.color }}>{step.status?.replace('_', ' ')}</span>
                    </div>
                    <div style={styles.stepDesc}>{info.desc}</div>
                    {step.updated_at && step.status !== 'pending' && (
                      <div style={styles.stepTime}><ClockIcon size={11} /> {formatDistanceToNow(new Date(step.updated_at), { addSuffix: true })}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── My Documents (seeker uploads) ── */}
        {tab === 'my_docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 4 }}>
              Upload the documents required by your agent. Required items must be uploaded before your application can be processed.
            </div>

            {seekerDocRequirements.map(doc => {
              const uploaded = seekerDocs.find(s => s.document_name === doc.document_name);
              const isRejected = uploaded?.status === 'rejected';
              return (
                <div key={doc.id} style={{ background: 'var(--card)', border: `1px solid ${isRejected ? 'rgba(239,68,68,0.3)' : uploaded ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: uploaded ? 10 : 0 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>
                        {doc.document_name}
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: doc.required_from_seeker ? 'var(--error)' : 'var(--text-3)', background: doc.required_from_seeker ? 'var(--error-dim)' : 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
                          {doc.required_from_seeker ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      {uploaded && !isRejected && <div style={{ fontSize: 12, color: '#22c55e' }}>✓ Uploaded successfully</div>}
                      {isRejected && (
                        <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>
                          ✗ Rejected — {uploaded.rejection_reason || 'Please reupload a correct version'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {uploaded && (
                        <a href={uploaded.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--gold-text)', background: 'var(--gold-dim)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none' }}>
                          View
                        </a>
                      )}
                      <button
                        style={{ fontSize: 12, background: isRejected ? 'var(--error)' : 'var(--gold)', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, opacity: uploadingDoc === doc.document_name ? 0.7 : 1 }}
                        onClick={() => { setActiveDocName(doc.document_name); docInputRef.current?.click(); }}
                        disabled={uploadingDoc === doc.document_name}
                      >
                        {uploadingDoc === doc.document_name ? '…' : uploaded ? (isRejected ? 'Reupload' : 'Replace') : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0] && activeDocName) { uploadSeekerDoc(e.target.files[0], activeDocName); e.target.value = ''; } }}
            />

            {seekerDocRequirements.length === 0 && (
              <div className="empty-state">
                <div className="empty-title">No documents required</div>
                <div className="empty-sub">The agent hasn't specified any documents from you</div>
              </div>
            )}
          </div>
        )}

        {/* ── Agent Docs (what agent delivers) ── */}
        {tab === 'agent_docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agentDocs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">No documents yet</div>
                <div className="empty-sub">Documents your agent delivers will appear here after admin approval.</div>
              </div>
            ) : agentDocs.map(doc => (
              <div key={doc.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{doc.document_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gold-text)', background: 'var(--gold-dim)', padding: '7px 12px', borderRadius: 8, textDecoration: 'none' }}>
                  <DownloadIcon size={14} /> Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── Chat ── */}
        {tab === 'chat' && (
          <div style={styles.chatWrap}>
            <div style={styles.safetyBanner}>
              🔒 Contact details and external links are blocked for your safety.
            </div>
            <div style={styles.messages}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  No messages yet. Say hello to your agent!
                </div>
              ) : messages.map(m => {
                const isMine = m.sender_id === user.id;
                return (
                  <div key={m.id} style={{ ...styles.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...styles.bubble, background: isMine ? '#1a5c3a' : 'var(--card-2)', borderBottomRightRadius: isMine ? 4 : 12, borderBottomLeftRadius: isMine ? 12 : 4 }}>
                      <div style={styles.bubbleText}>{m.body}</div>
                      <div style={styles.bubbleTime}>{format(new Date(m.created_at), 'HH:mm')}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
            <div style={styles.msgInput}>
              <input style={styles.msgInputField} value={newMsg} onChange={e => setNewMsg(e.target.value)}
                placeholder="Type a message…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
              <button style={styles.sendBtn} onClick={sendMessage} disabled={sending || !newMsg.trim()}>
                <SendIcon size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 20 },
  jobTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 4 },
  jobMeta: { fontSize: 13, color: 'var(--text-2)', marginBottom: 4 },
  paymentInfo: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--gold-border)', marginTop: 12 },
  payLabel: { fontSize: 12, color: 'var(--text-3)', marginBottom: 2 },
  payAmount: { fontSize: 16, fontWeight: 700, color: 'var(--gold-text)', flex: 1 },
  escrowBadge: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 2, overflowX: 'auto' },
  tab: { padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)' },
  timeline: { display: 'flex', flexDirection: 'column', position: 'relative' },
  timelineItem: { display: 'flex', gap: 16, paddingBottom: 28, position: 'relative' },
  timelineLine: { position: 'absolute', left: 15, top: 32, width: 2, bottom: 0, borderRadius: 1 },
  timelineDot: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  timelineContent: { flex: 1, paddingTop: 4 },
  stepLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)' },
  stepStatus: { fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  stepDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 4 },
  stepTime: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' },
  safetyBanner: { fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.06)', padding: '7px 14px', borderBottom: '1px solid rgba(99,102,241,0.1)', flexShrink: 0 },
  chatWrap: { display: 'flex', flexDirection: 'column', height: 480, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-2)' },
  msgRow: { display: 'flex' },
  bubble: { maxWidth: '75%', padding: '8px 12px', borderRadius: 12 },
  bubbleText: { fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'right' },
  msgInput: { display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--card)' },
  msgInputField: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' },
  sendBtn: { width: 44, height: 44, borderRadius: 8, background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 },
};
