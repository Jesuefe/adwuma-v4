import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, subscribeToMessages } from '../../lib/supabase';
import { useFileUpload } from 'hooks';
import { formatMoney } from '../../lib/currency';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { ArrowLeftIcon, UploadIcon, SendIcon, CheckIcon, FileTextIcon, XIcon, AlertCircleIcon } from '../../components/ui/Icons';

const STEP_NAMES = ['Application Received', 'Payment Secured', 'Document Review', 'Employer Processing', 'Offer / Decision', 'Relocation Support'];
const STEP_STATUSES = ['pending', 'in_progress', 'completed'];

export default function AgentApplicationDetailPage() {
  const { applicationId } = useParams();
  const { user } = useAuth();
  const { upload, uploading } = useFileUpload();
  const [app, setApp] = useState(null);
  const [steps, setSteps] = useState([]);
  const [agentDocs, setAgentDocs] = useState([]);
  const [seekerDocs, setSeekerDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [docName, setDocName] = useState('');
  const [tab, setTab] = useState('steps');
  const [rejectModal, setRejectModal] = useState(null); // { docId, docName }
  const [rejectReason, setRejectReason] = useState('');
  const fileRef = useRef(null);
  const msgEndRef = useRef(null);

  useEffect(() => { loadApp(); }, [applicationId]);

  useEffect(() => {
    if (!thread) return;
    loadMessages();
    const ch = subscribeToMessages(thread.id, (p) => {
      setMessages(m => m.find(msg => msg.id === p.new.id) ? m : [...m, p.new]);
    });
    const poll = setInterval(async () => {
      const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
      if (data) setMessages(prev => data.length !== prev.length ? data : prev);
    }, 2000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [thread?.id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadApp() {
    const { data } = await supabase.from('applications')
      .select(`*,
        jobs(title, company_name, service_fee, service_fee_currency, delivery_days,
          job_document_checklist(id, document_name, is_seeker_doc, required_from_seeker)
        ),
        profiles!applications_seeker_id_fkey(first_name, last_name, phone),
        application_steps(*), payments(*),
        application_documents(*), agent_notes(*)`)
      .eq('id', applicationId).single();
    if (!data) return;
    setApp(data);
    setSteps([...(data.application_steps || [])].sort((a, b) => a.step_number - b.step_number));
    setAgentDocs(data.application_documents || []);
    const { data: t } = await supabase.from('message_threads').select('*').eq('application_id', applicationId).maybeSingle();
    if (t) setThread(t);
    const { data: sdocs } = await supabase.from('seeker_documents').select('*').eq('application_id', applicationId);
    setSeekerDocs(sdocs || []);
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
    setMessages(data || []);
  }

  async function updateStep(stepId, status) {
    await supabase.from('application_steps').update({ status, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', stepId);
    await supabase.from('notifications').insert({ recipient_id: app.seeker_id, type: 'step_updated', title: 'Application Updated', body: `Your application for "${app.jobs?.title}" has been updated.`, link: `/dashboard/applications/${applicationId}` });
    loadApp();
    toast.success('Step updated — seeker notified');
  }

  async function uploadAgentDoc(file) {
    if (!docName.trim()) { toast.error('Enter a document name first'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    try {
      const url = await upload(file, 'documents', `applications/${applicationId}`);
      await supabase.from('application_documents').insert({ application_id: applicationId, agent_id: user.id, document_name: docName.trim(), file_url: url, status: 'pending' });
      await supabase.from('notifications').insert({ recipient_id: (await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single()).data?.id ||  '00000000-0000-0000-0000-000000000000', type: 'document_approved', title: 'Document Pending Review', body: `Agent uploaded "${docName}" for review.`, link: '/admin/documents' });
      toast.success('Document uploaded — pending admin review');
      setDocName('');
      loadApp();
    } catch (err) { toast.error(err.message); }
  }

  async function rejectSeekerDoc() {
    if (!rejectModal || !rejectReason.trim()) return;
    await supabase.from('seeker_documents').update({ status: 'rejected', rejection_reason: rejectReason.trim() }).eq('id', rejectModal.docId);
    await supabase.from('notifications').insert({
      recipient_id: app.seeker_id,
      type: 'document_approved',
      title: 'Document Rejected',
      body: `Your "${rejectModal.docName}" was rejected: ${rejectReason.trim()}. Please reupload.`,
      link: `/dashboard/applications/${applicationId}`,
    });
    toast.success('Document rejected — seeker notified');
    setRejectModal(null);
    setRejectReason('');
    const { data } = await supabase.from('seeker_documents').select('*').eq('application_id', applicationId);
    setSeekerDocs(data || []);
  }

  async function approveSeekerDoc(docId) {
    await supabase.from('seeker_documents').update({ status: 'approved' }).eq('id', docId);
    toast.success('Document approved');
    const { data } = await supabase.from('seeker_documents').select('*').eq('application_id', applicationId);
    setSeekerDocs(data || []);
  }

  async function saveNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    await supabase.from('agent_notes').insert({ application_id: applicationId, agent_id: user.id, note: note.trim() });
    toast.success('Note saved');
    setNote('');
    loadApp();
    setSavingNote(false);
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    let threadId = thread?.id;
    if (!threadId) {
      const { data: t } = await supabase.from('message_threads').insert({ application_id: applicationId, seeker_id: app.seeker_id, agent_id: user.id }).select().single();
      setThread(t); threadId = t.id;
    }
    await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, body: newMsg.trim() });
    setNewMsg('');
    setSending(false);
  }

  if (!app) return <AppShell title="Application"><div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div></AppShell>;

  const payment = app.payments?.[0];
  const notes = app.agent_notes || [];
  const seekerDocReqs = (app.jobs?.job_document_checklist || []).filter(d => d.is_seeker_doc);
  const daysRemaining = app.delivery_deadline ? differenceInDays(new Date(app.delivery_deadline), new Date()) : null;
  const deadlineMissed = daysRemaining !== null && daysRemaining < 0;

  const TABS = [
    { id: 'steps', label: 'Steps' },
    { id: 'seeker_docs', label: `Seeker Docs (${seekerDocs.length}/${seekerDocReqs.length})` },
    { id: 'my_docs', label: `My Docs (${agentDocs.length})` },
    { id: 'chat', label: 'Chat' },
    { id: 'notes', label: `Notes (${notes.length})` },
  ];

  return (
    <AppShell title="Manage Application">
      <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/agent/applications" style={styles.back}><ArrowLeftIcon size={16} /> All Applications</Link>

        {/* Header */}
        <div className="card-gold" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={styles.seekerAvatar}>{app.profiles?.first_name?.[0]}{app.profiles?.last_name?.[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={styles.seekerName}>{app.profiles?.first_name} {app.profiles?.last_name}</div>
              <div style={styles.jobName}>{app.jobs?.title} · {app.jobs?.company_name}</div>
              {app.profiles?.phone && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{app.profiles.phone}</div>}
            </div>
            {payment && <div style={styles.payAmount}>{formatMoney(payment.amount, payment.currency)}</div>}
          </div>

          {/* Delivery deadline */}
          {app.delivery_deadline && (
            <div style={{ background: deadlineMissed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${deadlineMissed ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: deadlineMissed ? 'var(--error)' : 'var(--gold-text)' }}>
                 Delivery Deadline: {format(new Date(app.delivery_deadline), 'MMM d, yyyy')}
                {' · '}
                {deadlineMissed
                  ? <span style={{ color: 'var(--error)' }}>OVERDUE — penalty applied</span>
                  : <span>{daysRemaining} days left</span>}
              </div>
            </div>
          )}

          {app.cover_message && <div style={styles.coverMsg}>"{app.cover_message}"</div>}
          {app.cv_url && <a href={app.cv_url} target="_blank" rel="noopener noreferrer" style={styles.cvLink}><FileTextIcon size={13} /> View CV</a>}
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Steps */}
        {tab === 'steps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => (
              <div key={step.id} style={{ ...styles.stepCard, background: step.status === 'completed' ? 'rgba(34,197,94,0.04)' : step.status === 'in_progress' ? 'rgba(245,158,11,0.04)' : 'var(--card)', borderColor: step.status === 'completed' ? 'rgba(34,197,94,0.15)' : step.status === 'in_progress' ? 'var(--gold-border)' : 'var(--border)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: step.status === 'completed' ? '#22c55e' : step.status === 'in_progress' ? 'var(--gold)' : 'rgba(255,255,255,0.15)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{STEP_NAMES[i] || step.step_name}</div>
                  {step.updated_at && step.status !== 'pending' && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDistanceToNow(new Date(step.updated_at), { addSuffix: true })}</div>}
                </div>
                {step.step_number > 2 ? (
                  <select style={styles.stepSelect} value={step.status} onChange={e => updateStep(step.id, e.target.value)}>
                    {STEP_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20 }}>Auto</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Seeker docs — view, approve, reject */}
        {tab === 'seeker_docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Documents uploaded by the seeker. Review each one and approve or reject with a reason.
            </div>

            {seekerDocReqs.length === 0 ? (
              <div className="empty-state"><div className="empty-title">No documents required from seeker for this job</div></div>
            ) : seekerDocReqs.map(req => {
              const uploaded = seekerDocs.find(s => s.document_name === req.document_name);
              const statusColor = !uploaded ? 'var(--text-3)' : uploaded.status === 'approved' ? '#22c55e' : uploaded.status === 'rejected' ? 'var(--error)' : 'var(--gold)';
              const statusLabel = !uploaded ? 'Not uploaded' : uploaded.status === 'approved' ? 'Approved' : uploaded.status === 'rejected' ? 'Rejected' : 'Awaiting review';

              return (
                <div key={req.id} style={{ background: 'var(--card)', border: `1px solid ${statusColor}30`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>
                        {req.document_name}
                        <span style={{ marginLeft: 8, fontSize: 10, color: req.required_from_seeker ? 'var(--error)' : 'var(--text-3)', fontWeight: 600 }}>
                          {req.required_from_seeker ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{statusLabel}</div>
                      {uploaded?.rejection_reason && <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>Reason: {uploaded.rejection_reason}</div>}
                    </div>

                    {uploaded && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <a href={uploaded.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--gold-text)', background: 'var(--gold-dim)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none' }}>
                          View
                        </a>
                        {uploaded.status !== 'approved' && (
                          <button style={{ fontSize: 12, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
                            onClick={() => approveSeekerDoc(uploaded.id)}>
                            ✓ Approve
                          </button>
                        )}
                        {uploaded.status !== 'rejected' && (
                          <button style={{ fontSize: 12, background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
                            onClick={() => { setRejectModal({ docId: uploaded.id, docName: req.document_name }); setRejectReason(''); }}>
                            ✗ Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Agent docs — upload */}
        {tab === 'my_docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div style={styles.sectionTitle}>Upload Document for Seeker</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Document name (e.g. Offer Letter)" />
                {app.jobs?.job_document_checklist?.filter(d => !d.is_seeker_doc).length > 0 && (
                  <div style={styles.checklistHints}>
                    {app.jobs.job_document_checklist.filter(d => !d.is_seeker_doc).map((d, i) => (
                      <button key={i} style={styles.hintBtn} onClick={() => setDocName(d.document_name)}>{d.document_name}</button>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => uploadAgentDoc(e.target.files[0])} />
                <button className="btn btn-gold btn-full" onClick={() => fileRef.current?.click()} disabled={uploading || !docName.trim()}>
                  {uploading ? <span className="spinner spinner-sm" /> : <UploadIcon size={15} />}
                  {uploading ? 'Uploading…' : 'Choose File & Upload'}
                </button>
              </div>
            </div>

            {agentDocs.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}><div className="empty-title">No documents uploaded yet</div></div>
            ) : agentDocs.map(doc => {
              const DS = { pending: { color: 'var(--gold)', label: 'Pending Admin Review' }, approved: { color: '#22c55e', label: 'Approved — visible to seeker' }, rejected: { color: 'var(--error)', label: 'Rejected' } };
              const ds = DS[doc.status] || DS.pending;
              return (
                <div key={doc.id} style={styles.docRow}>
                  <FileTextIcon size={16} style={{ color: ds.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.docName}>{doc.document_name}</div>
                    <div style={{ fontSize: 11, color: ds.color, fontWeight: 600 }}>{ds.label}</div>
                    {doc.rejection_reason && <div style={styles.docRejectNote}>{doc.rejection_reason}</div>}
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={styles.viewDocBtn}>View</a>
                </div>
              );
            })}
          </div>
        )}

        {/* Chat */}
        {tab === 'chat' && (
          <div style={styles.chatWrap}>
            <div style={styles.messages}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>No messages yet</div>
              ) : messages.map(m => {
                const isMine = m.sender_id === user.id;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
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
              <input style={styles.msgInputField} value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Message seeker…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
              <button style={styles.sendBtn} onClick={sendMessage} disabled={sending || !newMsg.trim()}><SendIcon size={17} /></button>
            </div>
          </div>
        )}

        {/* Notes */}
        {tab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div style={styles.sectionTitle}>Add Private Note</div>
              <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Private notes — only you can see these" style={{ resize: 'vertical', marginBottom: 10 }} />
              <button className="btn btn-gold" onClick={saveNote} disabled={savingNote || !note.trim()}>
                {savingNote ? <span className="spinner spinner-sm" /> : null} Save Note
              </button>
            </div>
            {notes.slice().reverse().map(n => (
              <div key={n.id} className="card" style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'var(--gold-border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 6 }}>{n.note}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{format(new Date(n.created_at), 'MMM d, yyyy · HH:mm')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reject modal */}
        {rejectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setRejectModal(null)}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 8 }}>Reject Document</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Rejecting "<strong>{rejectModal.docName}</strong>". The seeker will be notified and asked to reupload.
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Reason for rejection *</label>
                <textarea
                  className="input"
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Image is blurry, please rescan and upload again"
                  style={{ resize: 'none' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setRejectModal(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={rejectSeekerDoc} disabled={!rejectReason.trim()}>
                  Reject & Notify
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 20 },
  seekerAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  seekerName: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 3 },
  jobName: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  payAmount: { fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--gold-text)', flexShrink: 0 },
  coverMsg: { fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, borderLeft: '2px solid var(--gold-border)' },
  cvLink: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gold-text)', marginTop: 8, textDecoration: 'none' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 2, overflowX: 'auto' },
  tab: { padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)' },
  stepCard: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid', borderRadius: 10, padding: '12px 14px' },
  stepSelect: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 },
  sectionTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 12 },
  checklistHints: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  hintBtn: { fontSize: 11, color: 'var(--gold-text)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  docRow: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' },
  docName: { fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 },
  docRejectNote: { fontSize: 11, color: 'var(--error)', marginTop: 4 },
  viewDocBtn: { fontSize: 12, color: 'var(--gold-text)', textDecoration: 'none', flexShrink: 0, padding: '4px 10px', background: 'var(--gold-dim)', borderRadius: 6 },
  chatWrap: { display: 'flex', flexDirection: 'column', height: 480, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-2)' },
  bubble: { maxWidth: '75%', padding: '8px 12px', borderRadius: 12 },
  bubbleText: { fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'right' },
  msgInput: { display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--card)' },
  msgInputField: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' },
  sendBtn: { width: 44, height: 44, borderRadius: 8, background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 },
};
