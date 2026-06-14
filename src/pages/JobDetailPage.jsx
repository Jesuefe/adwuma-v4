import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/currency';
import { openPaystackPopup, generatePaystackRef } from '../lib/paystack';
import { toast } from 'react-toastify';
import { format, addDays } from 'date-fns';
import { MapPinIcon, BriefcaseIcon, DollarIcon, ClockIcon, CheckIcon, ArrowLeftIcon, ShieldIcon, LockIcon, AlertCircleIcon, UploadIcon } from '../components/ui/Icons';
import SaveJobButton from '../components/ui/SaveJobButton';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { isAuthenticated, user, isSeeker } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState('view'); // view | checklist | form | paying
  const [coverMessage, setCoverMessage] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => { loadJob(); }, [jobId]);
  useEffect(() => { if (user && isSeeker) checkApplied(); }, [user, jobId]);

  async function loadJob() {
    const { data } = await supabase.from('jobs')
      .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
        profiles!jobs_agent_id_fkey(id, first_name, last_name),
        job_document_checklist(id, document_name, sort_order, is_seeker_doc, required_from_seeker, seeker_doc_label)`)
      .eq('id', jobId).single();
    setJob(data);
    setLoading(false);
  }

  async function checkApplied() {
    const { data } = await supabase.from('applications')
      .select('id').eq('job_id', jobId).eq('seeker_id', user.id).maybeSingle();
    setHasApplied(!!data);
  }

  async function createPaymentRecord({ applicationId, agentId, amount, currency, reference, transactionId }) {
    const { data: settingRow } = await supabase.from('settings').select('value').eq('key', 'platform_fee_pct').maybeSingle();
    const platformFeePct = parseFloat(settingRow?.value ?? '10');
    const platformFee = (amount * platformFeePct) / 100;
    const agentPayout = amount - platformFee;

    const paymentDate = new Date();
    const deliveryDeadline = addDays(paymentDate, job.delivery_days || 30);

    const { error } = await supabase.from('payments').insert({
      application_id: applicationId,
      seeker_id: user.id,
      agent_id: agentId,
      amount,
      currency: currency || 'NGN',
      paystack_reference: reference,
      paystack_transaction_id: transactionId ? String(transactionId) : null,
      escrow_status: 'holding',
      platform_fee_pct: platformFeePct,
      platform_fee_amount: platformFee,
      agent_payout_amount: agentPayout,
    });
    if (error && error.code !== '23505') throw error;

    // Update application with delivery deadline
    await supabase.from('applications').update({
      status: 'in_escrow',
      payment_date: paymentDate.toISOString(),
      delivery_deadline: deliveryDeadline.toISOString(),
      delivery_days: job.delivery_days || 30,
    }).eq('id', applicationId);

    // Log to audit
    await supabase.from('audit_logs').insert({
      action: 'payment_received',
      entity_type: 'payment',
      entity_id: applicationId,
      new_value: { amount, currency, reference, delivery_deadline: deliveryDeadline.toISOString() }
    });

    // Notify agent
    await supabase.from('notifications').insert({
      recipient_id: agentId,
      type: 'application_received',
      title: 'New Paid Application',
      body: `A seeker has paid and applied for "${job?.title}". Delivery deadline: ${format(deliveryDeadline, 'MMM d, yyyy')}.`,
      link: `/agent/applications/${applicationId}`,
    });
  }

  async function handlePayAndApply() {
    if (!job) return;
    setApplying(true);
    setStep('paying');

    try {
      let cvUrl = null;
      if (cvFile) {
        const fileExt = cvFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(`cvs/${user.id}/${fileName}`, cvFile);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`cvs/${user.id}/${fileName}`);
          cvUrl = publicUrl;
        }
      }

      const { data: app, error: appError } = await supabase.from('applications').insert({
        job_id: job.id,
        seeker_id: user.id,
        agent_id: job.agent_id,
        cover_message: coverMessage || null,
        cv_url: cvUrl,
        status: 'in_escrow',
      }).select().single();

      if (appError) throw appError;

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const ref = generatePaystackRef();

      await openPaystackPopup({
        email: authUser.email,
        amount: job.service_fee,
        currency: 'NGN', // Force NGN for test mode
        reference: ref,
        metadata: { application_id: app.id, agent_id: job.agent_id, job_title: job.title },

        onSuccess: async (response) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: { reference: response.reference },
            });
            if (verifyError) throw verifyError;
            await supabase.from('applications').update({
              status: 'in_escrow',
              payment_date: new Date().toISOString(),
              delivery_deadline: addDays(new Date(), job.delivery_days || 30).toISOString(),
              delivery_days: job.delivery_days || 30,
            }).eq('id', app.id);
          } catch {
            // Fallback
            await createPaymentRecord({
              applicationId: app.id,
              agentId: job.agent_id,
              amount: job.service_fee,
              currency: job.service_fee_currency || 'NGN',
              reference: response.reference,
              transactionId: response.transaction,
            });
          }
          toast.success('Payment successful! Now upload your documents.');
          setHasApplied(true);
          setApplying(false);
          navigate(`/dashboard/applications/${app.id}`);
        },

        onClose: async () => {
          await supabase.from('applications').delete().eq('id', app.id);
          toast.info('Payment cancelled.');
          setApplying(false);
          setStep('form');
        },
      });

    } catch (err) {
      toast.error(err.message || 'Failed to submit application');
      setApplying(false);
      setStep('form');
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!job) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-2)' }}>
      Job not found. <Link to="/jobs" style={{ color: 'var(--brand)', marginLeft: 8 }}>Browse all jobs</Link>
    </div>
  );

  const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
  const agentDocs = (job.job_document_checklist || []).filter(d => !d.is_seeker_doc).sort((a, b) => a.sort_order - b.sort_order);
  const seekerDocs = (job.job_document_checklist || []).filter(d => d.is_seeker_doc).sort((a, b) => a.sort_order - b.sort_order);
  const requiredSeekerDocs = seekerDocs.filter(d => d.required_from_seeker);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/jobs" style={styles.backBtn}><ArrowLeftIcon size={16} /> All Jobs</Link>
          <Link to="/" style={styles.logo}>Ajuma Link</Link>
          <div style={{ width: 80 }} />
        </div>
      </div>

      <div style={styles.body}>
        {job.cover_image_url && (
          <div style={styles.coverWrap}>
            <img src={job.cover_image_url} alt={job.title} style={styles.coverImg} />
          </div>
        )}

        <div style={styles.layout}>
          {/* Left */}
          <div style={styles.main}>
            <div style={styles.jobHeader}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {job.company_logo_url
                  ? <img src={job.company_logo_url} alt={job.company_name} style={styles.companyLogo} />
                  : <span style={{ fontSize: 40 }}>{flag}</span>}
                <div>
                  <h1 style={styles.jobTitle}>{job.title}</h1>
                  <div style={styles.jobCompany}>{job.company_name}</div>
                  <div style={styles.tags}>
                    <span style={styles.tag}><MapPinIcon size={12} /> {job.countries?.name}</span>
                    <span style={styles.tag}><BriefcaseIcon size={12} /> {job.job_type?.replace('_', ' ')}</span>
                    {job.salary_min && <span style={styles.tag}><DollarIcon size={12} /> {formatMoney(job.salary_min, job.salary_currency, { compact: true })}–{formatMoney(job.salary_max, job.salary_currency, { compact: true })}/{job.salary_period}</span>}
                    {job.deadline && <span style={styles.tag}><ClockIcon size={12} /> Closes {format(new Date(job.deadline), 'MMM d, yyyy')}</span>}
                    <span style={{ ...styles.tag, color: 'var(--brand)', borderColor: 'var(--gold-border)' }}>⏱ {job.delivery_days || 30}-day delivery</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={styles.sectionTitle}>Job Description</div>
              <div style={styles.bodyText}>{job.description}</div>
            </div>

            {job.requirements && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={styles.sectionTitle}>Requirements</div>
                <div style={styles.bodyText}>{job.requirements}</div>
              </div>
            )}

            {/* What agent will deliver */}
            {agentDocs.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={styles.sectionTitle}>Documents You Will Receive</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {agentDocs.map(d => (
                    <div key={d.id} style={styles.docItem}>
                      <CheckIcon size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{d.document_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What seeker must provide */}
            {seekerDocs.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderColor: 'var(--gold-border)' }}>
                <div style={styles.sectionTitle}>📋 Documents You Must Provide</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                  You will be required to upload these documents after payment. Make sure you have them ready before applying.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {seekerDocs.map(d => (
                    <div key={d.id} style={styles.seekerDocItem}>
                      <UploadIcon size={13} style={{ color: d.required_from_seeker ? 'var(--gold)' : 'var(--text-3)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{d.document_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: d.required_from_seeker ? 'var(--error)' : 'var(--text-3)', background: d.required_from_seeker ? 'var(--error-dim)' : 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
                        {d.required_from_seeker ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery timeline info */}
            <div className="card" style={{ marginBottom: 16, background: 'rgba(245,158,11,0.03)' }}>
              <div style={styles.sectionTitle}>⏱ Delivery Timeline</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                This agent commits to completing your placement within <strong style={{ color: 'var(--gold-text)' }}>{job.delivery_days || 30} days</strong> of payment.
                <br />If they miss this deadline, you automatically receive a <strong style={{ color: '#22c55e' }}>10% refund</strong> ({formatMoney((job.service_fee * 0.1), job.service_fee_currency)}) deducted from the agent's wallet.
              </div>
            </div>

            {/* Agent */}
            <div className="card">
              <div style={styles.sectionTitle}>Recruitment Agent</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={styles.agentAvatar}>{job.profiles?.first_name?.[0]}{job.profiles?.last_name?.[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{job.profiles?.first_name} {job.profiles?.last_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22c55e', marginTop: 2 }}>
                    <ShieldIcon size={12} /> KYC Verified
                  </div>
                </div>
                <Link to={`/agents/${job.agent_id}`} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gold-text)', textDecoration: 'none' }}>View profile →</Link>
              </div>
            </div>
          </div>

          {/* Right — apply card */}
          <div style={styles.sidebar}>
            <div style={styles.applyCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Service Fee</div>
                <SaveJobButton jobId={job.id} size="lg" />
              </div>
              <div style={styles.feeAmount}>{formatMoney(job.service_fee, job.service_fee_currency)}</div>

              <div style={styles.escrowNote}>
                <LockIcon size={13} style={{ flexShrink: 0 }} />
                Held in escrow — released only after documents delivered within {job.delivery_days || 30} days
              </div>

              {hasApplied ? (
                <div style={styles.appliedBox}>
                  <CheckIcon size={15} style={{ color: '#22c55e' }} />
                  You've applied
                  <Link to="/dashboard/applications" style={{ color: 'var(--gold-text)', fontSize: 12, display: 'block', marginTop: 4 }}>Track your application →</Link>
                </div>
              ) : step === 'view' ? (
                <>
                  {!isAuthenticated ? (
                    <Link to="/auth/register" style={styles.applyBtn}>Sign up to Apply</Link>
                  ) : !isSeeker ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>Only job seekers can apply</div>
                  ) : (
                    <button style={styles.applyBtn} onClick={() => setStep('checklist')}>Apply Now</button>
                  )}
                </>
              ) : step === 'checklist' ? (
                /* Pre-application checklist */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Before You Apply</div>

                  {seekerDocs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Documents you'll need to upload:</div>
                      {seekerDocs.map(d => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <span style={{ fontSize: 14 }}>{d.required_from_seeker ? '🔴' : '🟡'}</span>
                          <span style={{ color: 'var(--text-1)' }}>{d.document_name}</span>
                          <span style={{ fontSize: 10, color: d.required_from_seeker ? 'var(--error)' : 'var(--text-3)' }}>{d.required_from_seeker ? '(required)' : '(optional)'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    ⏱ Agent commits to deliver within <strong style={{ color: 'var(--gold-text)' }}>{job.delivery_days || 30} days</strong> of payment. If missed, you receive a 10% refund automatically.
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                    I have read and understood the requirements, documents needed, and delivery timeline. I confirm I have all required documents ready.
                  </label>

                  <button style={{ ...styles.applyBtn, opacity: acknowledged ? 1 : 0.5 }} disabled={!acknowledged} onClick={() => setStep('form')}>
                    Continue to Apply
                  </button>
                  <button style={styles.cancelBtn} onClick={() => setStep('view')}>Back</button>
                </div>
              ) : step === 'form' || step === 'paying' ? (
                /* Application form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Your Application</div>
                  <div>
                    <label style={styles.fieldLabel}>Cover message (optional)</label>
                    <textarea style={styles.textarea} rows={3} value={coverMessage} onChange={e => setCoverMessage(e.target.value)} placeholder="Tell the agent why you're a good fit…" />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Upload CV (optional)</label>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} style={{ fontSize: 13, color: 'var(--text-2)' }} />
                  </div>
                  <button style={styles.applyBtn} onClick={handlePayAndApply} disabled={applying}>
                    {applying ? <span className="spinner spinner-sm" /> : <LockIcon size={15} />}
                    {applying ? 'Opening payment…' : `Pay ${formatMoney(job.service_fee, job.service_fee_currency)} & Apply`}
                  </button>
                  <button style={styles.cancelBtn} onClick={() => { setStep('checklist'); setApplying(false); }}>Back</button>
                </div>
              ) : null}

              <div style={styles.trustPoints}>
                {['KYC-verified agent', 'Escrow-protected payment', `${job.delivery_days || 30}-day delivery guarantee`, '10% refund if deadline missed'].map(t => (
                  <div key={t} style={styles.trustPoint}><CheckIcon size={11} style={{ color: 'var(--brand)', flexShrink: 0 }} /> {t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" },
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' },
  backBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--brand)', textDecoration: 'none' },
  body: { maxWidth: 1200, margin: '0 auto', padding: '0 0 48px' },
  coverWrap: { width: '100%', height: 280, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  layout: { display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 16px' },
  main: { flex: 1 },
  sidebar: { width: '100%' },
  jobHeader: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text-1)', marginBottom: 6, letterSpacing: '-0.5px' },
  jobCompany: { fontSize: 15, color: 'var(--text-2)', marginBottom: 10 },
  companyLogo: { width: 60, height: 60, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 20 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 12 },
  bodyText: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-line' },
  docItem: { display: 'flex', alignItems: 'center', gap: 8 },
  seekerDocItem: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px' },
  agentAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--gold-text)' },
  applyCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 70 },
  feeAmount: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: 'var(--gold-text)', letterSpacing: '-0.5px' },
  escrowNote: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-2)', background: 'var(--gold-dim)', padding: '8px 12px', borderRadius: 8, lineHeight: 1.5 },
  applyBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--brand)', color: '#000', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: '100%', minHeight: 48, textDecoration: 'none' },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: '100%' },
  appliedBox: { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 14, fontSize: 14, color: '#22c55e', display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  trustPoints: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid var(--border)' },
  trustPoint: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' },
};
