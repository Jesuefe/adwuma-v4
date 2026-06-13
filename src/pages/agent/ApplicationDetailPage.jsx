import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, subscribeToMessages } from '../../lib/supabase';
import { useFileUpload } from 'hooks';
import { formatMoney } from '../../lib/currency';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { ArrowLeftIcon, UploadIcon, SendIcon, CheckIcon, EditIcon, FileTextIcon } from '../../components/ui/Icons';

const STEP_NAMES = ['Application Received', 'Payment Secured', 'Document Review', 'Employer Processing', 'Offer / Decision', 'Relocation Support'];
const STEP_STATUSES = ['pending', 'in_progress', 'completed'];

export default function AgentApplicationDetailPage() {
  const { applicationId } = useParams();
  const { user } = useAuth();
  const { upload, uploading } = useFileUpload();
  const [app, setApp] = useState(null);
  const [steps, setSteps] = useState([]);
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [docName, setDocName] = useState('');
  const [tab, setTab] = useState('steps');
  const fileRef = useRef(null);
  const msgEndRef = useRef(null);

  useEffect(() => { loadApp(); }, [applicationId]);
  useEffect(() => {
    if (!thread) return;
    loadMessages();
    // Realtime
    const ch = subscribeToMessages(thread.id, (p) => {
      setMessages(m => m.find(msg => msg.id === p.new.id) ? m : [...m, p.new]);
    });
    // 2-second polling fallback
    const poll = setInterval(async () => {
      const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
      if (data) setMessages(prev => data.length !== prev.length ? data : prev);
    }, 2000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [thread?.id]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadApp() {
    const { data } = await supabase.from('applications')
      .select(`*, jobs(title, company_name, service_fee, service_fee_currency, job_document_checklist(document_name)),
        profiles!applications_seeker_id_fkey(first_name, last_name, phone),
        application_steps(*), payments(*),
        application_documents(*), agent_notes(*)`)
      .eq('id', applicationId).single();
    if (!data) return;
    setApp(data);
    setSteps([...(data.application_steps || [])].sort((a, b) => a.step_number - b.step_number));
    setDocs(data.application_documents || []);
    const { data: t } = await supabase.from('message_threads').select('*').eq('application_id', applicationId).single();
    if (t) setThread(t);
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
    setMessages(data || []);
  }

  async function updateStep(stepId, status) {
    await supabase.from('application_steps').update({ status, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', stepId);
    // Notify seeker
    await supabase.from('notifications').insert({ recipient_id: app.seeker_id, type: 'step_updated', title: 'Application Updated', body: `Your application for "${app.jobs?.title}" has been updated.`, link: `/dashboard/applications/${applicationId}` });
    loadApp();
    toast.success('Step updated — seeker notified');
  }

  async function uploadDoc(file) {
    if (!docName.trim()) { toast.error('Enter a document name first'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    try {
      const url = await upload(file, 'documents', `applications/${applicationId}`);
      await supabase.from('application_documents').insert({ application_id: applicationId, agent_id: user.id, document_name: docName.trim(), file_url: url, status: 'pending' });
      // Notify admin
      await supabase.from('notifications').insert({ recipient_id: null, type: 'document_approved', title: 'Document Pending Review', body: `Agent uploaded "${docName}" for review on application ${applicationId}.`, link: '/admin/documents' });
      toast.success('Document uploaded — pending admin review');
      setDocName('');
      loadApp();
    } catch (err) { toast.error(err.message); }
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
              {app.profiles?.phone && <div style={styles.seekerPhone}>{app.profiles.phone}</div>}
            </div>
            {payment && <div style={styles.payAmount}>{formatMoney(payment.amount, payment.currency)}</div>}
          </div>
          {app.cover_message && (
            <div style={styles.coverMsg}>"{app.cover_message}"</div>
          )}
          {app.cv_url && (
            <a href={app.cv_url} target="_blank" rel="noopener noreferrer" style={styles.cvLink}><FileTextIcon size={13} /> View CV</a>
          )}
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {[{ id: 'steps', label: 'Steps' }, { id: 'docs', label: `Documents (${docs.length})` }, { id: 'chat', label: 'Chat' }, { id: 'notes', label: `Notes (${notes.length})` }].map(t => (
            <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Steps */}
        {tab === 'steps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => (
              <div key={step.id} style={{ ...styles.stepCard, background: step.status === 'completed' ? 'rgba(34,197,94,0.04)' : step.status === 'in_progress' ? 'rgba(245,158,11,0.04)' : 'var(--card)', borderColor: step.status === 'completed' ? 'rgba(34,197,94,0.15)' : step.status === 'in_progress' ? 'var(--gold-border)' : 'var(--border)' }}>
                <div style={styles.stepDot(step.status)} />
                <div style={{ flex: 1 }}>
                  <div style={styles.stepName}>{STEP_NAMES[i] || step.step_name}</div>
                  {step.updated_at && step.status !== 'pending' && (
                    <div style={styles.stepTime}>{formatDistanceToNow(new Date(step.updated_at), { addSuffix: true })}</div>
                  )}
                </div>
                {/* Step 1 & 2 are auto — don't show controls */}
                {step.step_number > 2 && (
                  <select
                    style={styles.stepSelect}
                    value={step.status}
                    onChange={e => updateStep(step.id, e.target.value)}
                  >
                    {STEP_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                )}
                {step.step_number <= 2 && (
                  <span style={styles.autoTag}>Auto</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documents */}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Upload section */}
            <div className="card">
              <div style={styles.sectionTitle}>Upload Document</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Document name (e.g. Offer Letter)" />
                {app.jobs?.job_document_checklist?.length > 0 && (
                  <div style={styles.checklistHints}>
                    {app.jobs.job_document_checklist.map((d, i) => (
                      <button key={i} style={styles.hintBtn} onClick={() => setDocName(d.document_name)}>{d.document_name}</button>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => uploadDoc(e.target.files[0])} />
                <button className="btn btn-gold btn-full" onClick={() => fileRef.current?.click()} disabled={uploading || !docName.trim()}>
                  {uploading ? <span className="spinner spinner-sm" /> : <UploadIcon size={15} />}
                  {uploading ? 'Uploading…' : 'Choose File & Upload'}
                </button>
              </div>
            </div>

            {/* Uploaded docs list */}
            {docs.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-title">No documents uploaded</div>
              </div>
            ) : docs.map(doc => {
              const DS = { pending: { color: 'var(--gold)', label: 'Pending Review' }, approved: { color: '#22c55e', label: 'Approved' }, rejected: { color: 'var(--error)', label: 'Rejected' } };
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
            {notes.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}><div className="empty-title">No notes yet</div></div>
            ) : notes.slice().reverse().map(n => (
              <div key={n.id} className="card" style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'var(--gold-border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 6 }}>{n.note}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{format(new Date(n.created_at), 'MMM d, yyyy · HH:mm')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 20 },
  seekerAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  seekerName: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 3 },
  jobName: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  seekerPhone: { fontSize: 12, color: 'var(--text-3)' },
  payAmount: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--gold-text)', flexShrink: 0 },
  coverMsg: { fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, borderLeft: '2px solid var(--gold-border)' },
  cvLink: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gold-text)', marginTop: 8, textDecoration: 'none' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 4, overflowX: 'auto' },
  tab: { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)' },
  stepCard: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid', borderRadius: 10, padding: '12px 14px' },
  stepDot: (status) => ({ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: status === 'completed' ? '#22c55e' : status === 'in_progress' ? 'var(--gold)' : 'rgba(255,255,255,0.15)' }),
  stepName: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  stepTime: { fontSize: 11, color: 'var(--text-3)' },
  stepSelect: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 },
  autoTag: { fontSize: 10, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 12 },
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
