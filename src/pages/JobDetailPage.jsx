import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney, toPaystackAmount } from '../lib/currency';
import { openPaystackPopup, generatePaystackRef } from '../lib/paystack';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { MapPinIcon, BriefcaseIcon, DollarIcon, ClockIcon, CheckIcon, ArrowLeftIcon, ShieldIcon, LockIcon } from '../components/ui/Icons';
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
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverMessage, setCoverMessage] = useState('');
  const [cvFile, setCvFile] = useState(null);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  useEffect(() => {
    if (user && isSeeker) checkApplied();
  }, [user, jobId]);

  async function loadJob() {
    const { data } = await supabase.from('jobs')
      .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
        profiles!jobs_agent_id_fkey(first_name, last_name),
        job_document_checklist(id, document_name, sort_order)`)
      .eq('id', jobId).single();
    setJob(data);
    setLoading(false);
  }

  async function checkApplied() {
    const { data } = await supabase.from('applications')
      .select('id').eq('job_id', jobId).eq('seeker_id', user.id).single();
    setHasApplied(!!data);
  }

  async function handleApply() {
    if (!isAuthenticated) { navigate('/auth/register'); return; }
    if (!isSeeker) { toast.error('Only job seekers can apply'); return; }
    setShowApplyForm(true);
  }

  async function handlePayAndApply() {
    if (!job) return;
    setApplying(true);

    try {
      // Upload CV if provided
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

      // Create application first (pending payment)
      const { data: app, error: appError } = await supabase.from('applications').insert({
        job_id: job.id,
        seeker_id: user.id,
        agent_id: job.agent_id,
        cover_message: coverMessage || null,
        cv_url: cvUrl,
        status: 'in_escrow',
      }).select().single();

      if (appError) throw appError;

      // Get user email for Paystack
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Open Paystack popup
      const ref = generatePaystackRef();
      await openPaystackPopup({
        email: authUser.email,
        amount: job.service_fee,
        currency: job.service_fee_currency,
        reference: ref,
        metadata: { application_id: app.id, agent_id: job.agent_id, job_title: job.title },
        onSuccess: async (response) => {
          // Verify payment via edge function
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: { reference: response.reference },
            });
            if (verifyError) throw verifyError;
            toast.success('Application submitted! Your payment is held in escrow.');
            setHasApplied(true);
            setShowApplyForm(false);
            navigate(`/dashboard/applications/${app.id}`);
          } catch (err) {
            // Payment went through but verify failed — still navigate
            toast.success('Application submitted! Payment processing...');
            navigate(`/dashboard/applications/${app.id}`);
          }
        },
        onClose: async () => {
          // Payment popup closed without paying — delete the application
          await supabase.from('applications').delete().eq('id', app.id);
          toast.info('Application cancelled — payment not completed.');
          setApplying(false);
        },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to submit application');
      setApplying(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!job) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-2)' }}>
      Job not found. <Link to="/jobs" style={{ color: 'var(--gold)', marginLeft: 8 }}>Browse all jobs</Link>
    </div>
  );

  const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
  const checklist = [...(job.job_document_checklist || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/jobs" style={styles.backBtn}><ArrowLeftIcon size={16} /> All Jobs</Link>
          <Link to="/" style={styles.logo}>Adwuma</Link>
          <div style={{ width: 80 }} />
        </div>
      </div>

      <div style={styles.body}>
        {/* Cover image */}
        {job.cover_image_url && (
          <div style={styles.coverImageWrap}>
            <img src={job.cover_image_url} alt={job.title} style={styles.coverImage} />
          </div>
        )}
        <div style={styles.layout}>
          {/* Left — job details */}
          <div style={styles.main}>
            {/* Job header */}
            <div style={styles.jobHeader}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {job.company_logo_url
                  ? <img src={job.company_logo_url} alt={job.company_name} style={styles.companyLogoLg} />
                  : <span style={{ fontSize: 40 }}>{flag}</span>}
                <div>
                  <h1 style={styles.jobTitle}>{job.title}</h1>
                  <div style={styles.jobCompany}>{job.company_name}</div>
                  <div style={styles.jobTags}>
                    <span style={styles.tag}><MapPinIcon size={12} /> {job.countries?.name}</span>
                    <span style={styles.tag}><BriefcaseIcon size={12} /> {job.job_type?.replace('_', ' ')}</span>
                    {job.salary_min && <span style={styles.tag}><DollarIcon size={12} /> {formatMoney(job.salary_min, job.salary_currency, { compact: true })}–{formatMoney(job.salary_max, job.salary_currency, { compact: true })}/{job.salary_period}</span>}
                    {job.deadline && <span style={styles.tag}><ClockIcon size={12} /> Closes {format(new Date(job.deadline), 'MMM d, yyyy')}</span>}
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

            {checklist.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={styles.sectionTitle}>Documents You Will Receive</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {checklist.map(d => (
                    <div key={d.id} style={styles.checklistItem}>
                      <CheckIcon size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                      {d.document_name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent info */}
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
              </div>
            </div>
          </div>

          {/* Right — apply card */}
          <div style={styles.sidebar}>
            <div style={styles.applyCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={styles.feeLabel}>Service Fee</div>
                <SaveJobButton jobId={job.id} size="lg" />
              </div>
              <div style={styles.feeAmount}>{formatMoney(job.service_fee, job.service_fee_currency)}</div>
              <div style={styles.escrowNote}>
                <LockIcon size={13} style={{ flexShrink: 0 }} />
                Held in escrow — only released after your documents are delivered
              </div>

              {hasApplied ? (
                <div style={styles.appliedNote}>
                  <CheckIcon size={15} style={{ color: '#22c55e' }} />
                  You've already applied
                  <Link to="/dashboard/applications" style={{ color: 'var(--gold-text)', fontSize: 12, display: 'block', marginTop: 4 }}>Track your application →</Link>
                </div>
              ) : !showApplyForm ? (
                <button style={styles.applyBtn} onClick={handleApply}>
                  {isAuthenticated ? 'Apply Now' : 'Sign up to Apply'}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    {applying ? 'Processing…' : `Pay ${formatMoney(job.service_fee, job.service_fee_currency)} & Apply`}
                  </button>
                  <button style={styles.cancelBtn} onClick={() => setShowApplyForm(false)}>Cancel</button>
                </div>
              )}

              <div style={styles.trustPoints}>
                {['KYC-verified agent', 'Escrow-protected payment', 'Live progress tracking', 'Document gatekeeping'].map(t => (
                  <div key={t} style={styles.trustPoint}><CheckIcon size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} /> {t}</div>
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
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', textDecoration: 'none' },
  body: { maxWidth: 1200, margin: '0 auto', padding: '32px 16px' },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexDirection: 'column' },
  main: { flex: 1, width: '100%' },
  sidebar: { width: '100%' },
  jobHeader: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text-1)', marginBottom: 6, letterSpacing: '-0.5px' },
  jobCompany: { fontSize: 15, color: 'var(--text-2)', marginBottom: 10 },
  jobTags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 20 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 12 },
  bodyText: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-line' },
  checklistItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-1)' },
  agentAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--gold-text)' },
  applyCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  feeLabel: { fontSize: 12, color: 'var(--text-3)' },
  feeAmount: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: 'var(--gold-text)', letterSpacing: '-0.5px' },
  escrowNote: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-2)', background: 'var(--gold-dim)', padding: '8px 12px', borderRadius: 8, lineHeight: 1.5 },
  applyBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: '100%', minHeight: 48 },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: '100%' },
  appliedNote: { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 14, fontSize: 14, color: '#22c55e', display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  trustPoints: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid var(--border)' },
  trustPoint: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' },
  coverImageWrap: { width: '100%', maxHeight: 300, overflow: 'hidden', marginBottom: 0 },
  coverImage: { width: '100%', height: 280, objectFit: 'cover' },
  companyLogoLg: { width: 60, height: 60, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 },
  '@media (minWidth: 768px)': { layout: { flexDirection: 'row' }, sidebar: { width: 320, flexShrink: 0 } },
};
