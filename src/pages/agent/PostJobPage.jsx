import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useFileUpload } from 'hooks';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { PlusIcon, XIcon, ArrowLeftIcon, UploadIcon } from '../../components/ui/Icons';

const JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship'];
const SALARY_PERIODS = ['monthly', 'yearly', 'hourly'];
const CURRENCIES = ['NGN', 'GHS', 'USD', 'GBP', 'EUR', 'CAD', 'AED', 'AUD'];

function ImageUpload({ label, hint, preview, onFile, accept = '.jpg,.jpeg,.png,.webp' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    const url = URL.createObjectURL(file);
    onFile(file, url);
  };

  return (
    <div>
      <label style={styles.fieldLabel}>{label}</label>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{hint}</div>
      {preview ? (
        <div style={styles.imagePreview}>
          <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
          <button style={styles.removeImgBtn} onClick={() => onFile(null, '')}>
            <XIcon size={14} />
          </button>
        </div>
      ) : (
        <div
          style={{ ...styles.imgDropZone, borderColor: dragging ? 'var(--gold)' : 'rgba(255,255,255,0.1)', background: dragging ? 'var(--gold-dim)' : 'rgba(255,255,255,0.02)' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <UploadIcon size={20} style={{ color: 'var(--text-3)' }} />
          <div style={styles.dropText}>Tap to upload or drag & drop</div>
          <div style={styles.dropHint}>JPG, PNG, WEBP · Max 5MB</div>
        </div>
      )}
    </div>
  );
}

export default function PostJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const queryClient = useQueryClient();
  const { upload, uploading } = useFileUpload();
  const isEdit = !!jobId;

  const [form, setForm] = useState({
    title: '', company_name: '', destination_country_id: '', industry: '',
    job_type: 'full_time', salary_min: '', salary_max: '',
    salary_currency: 'USD', salary_period: 'monthly',
    description: '', requirements: '',
    service_fee: '', service_fee_currency: 'NGN', deadline: '',
    delivery_days: '30',
  });
  const [checklist, setChecklist] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newSeekerDoc, setNewSeekerDoc] = useState('');
  const [seekerDocs, setSeekerDocs] = useState([]);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => { const { data } = await supabase.from('countries').select('*').order('sort_order'); return data || []; },
  });

  useEffect(() => {
    if (!isEdit) return;
    supabase.from('jobs').select('*, job_document_checklist(*)').eq('id', jobId).single().then(({ data }) => {
      if (!data) return;
      setForm({
        title: data.title || '', company_name: data.company_name || '',
        destination_country_id: data.destination_country_id || '',
        industry: data.industry || '', job_type: data.job_type || 'full_time',
        salary_min: data.salary_min || '', salary_max: data.salary_max || '',
        salary_currency: data.salary_currency || 'USD', salary_period: data.salary_period || 'monthly',
        description: data.description || '', requirements: data.requirements || '',
        service_fee: data.service_fee || '', service_fee_currency: data.service_fee_currency || 'NGN',
        deadline: data.deadline || '',
        delivery_days: data.delivery_days || '30',
      });
      setChecklist(data.job_document_checklist?.filter(d => !d.is_seeker_doc).map(d => d.document_name) || []);
      setSeekerDocs(data.job_document_checklist?.filter(d => d.is_seeker_doc).map(d => ({ label: d.document_name, required: d.required_from_seeker })) || []);
      if (data.company_logo_url) setLogoPreview(data.company_logo_url);
      if (data.cover_image_url) setCoverPreview(data.cover_image_url);
    });
  }, [jobId, isEdit]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const addCheckItem = () => { if (!newCheckItem.trim()) return; setChecklist(c => [...c, newCheckItem.trim()]); setNewCheckItem(''); };
  const addSeekerDoc = () => { if (!newCheckItem.trim()) return; setSeekerDocs(d => [...d, { label: newCheckItem.trim(), required: true }]); setNewCheckItem(''); };
  const removeCheckItem = (i) => setChecklist(c => c.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.company_name || !form.destination_country_id || !form.description || !form.service_fee) {
      toast.error('Fill in all required fields'); return;
    }
    setSaving(true);
    try {
      // Upload images if new ones selected
      let companyLogoUrl = logoPreview || null;
      let coverImageUrl = coverPreview || null;

      if (companyLogoFile) {
        companyLogoUrl = await upload(companyLogoFile, 'documents', `job-images/${user.id}`);
      }
      if (coverImageFile) {
        coverImageUrl = await upload(coverImageFile, 'documents', `job-images/${user.id}`);
      }

      const jobData = {
        agent_id: user.id,
        title: form.title, company_name: form.company_name,
        destination_country_id: Number(form.destination_country_id),
        industry: form.industry, job_type: form.job_type,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        salary_currency: form.salary_currency, salary_period: form.salary_period,
        description: form.description, requirements: form.requirements || null,
        service_fee: Number(form.service_fee), service_fee_currency: form.service_fee_currency,
        deadline: form.deadline || null, status: 'pending',
        delivery_days: Number(form.delivery_days) || 30,
        company_logo_url: companyLogoUrl,
        cover_image_url: coverImageUrl,
      };

      let savedJobId = jobId;
      if (isEdit) {
        await supabase.from('jobs').update(jobData).eq('id', jobId);
        await supabase.from('job_document_checklist').delete().eq('job_id', jobId);
      } else {
        const { data } = await supabase.from('jobs').insert(jobData).select().single();
        savedJobId = data.id;
      }

      if (checklist.length > 0) {
        await supabase.from('job_document_checklist').insert(
          checklist.map((name, i) => ({ job_id: savedJobId, document_name: name, sort_order: i, is_seeker_doc: false }))
        );
      }
      if (seekerDocs.length > 0) {
        await supabase.from('job_document_checklist').insert(
          seekerDocs.map((doc, i) => ({ job_id: savedJobId, document_name: doc.label, sort_order: checklist.length + i, is_seeker_doc: true, required_from_seeker: doc.required, seeker_doc_label: doc.label }))
        );
      }

      toast.success(isEdit ? 'Job updated — pending admin review' : 'Job submitted for review!');
      queryClient.invalidateQueries(['agent_jobs_full']);
      navigate('/agent/jobs');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <AppShell title={isEdit ? 'Edit Job' : 'Post a Job'}>
      <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
        <button style={styles.back} onClick={() => navigate('/agent/jobs')}>
          <ArrowLeftIcon size={16} /> Back to Jobs
        </button>

        <div style={styles.pageTitle}>{isEdit ? 'Edit Job Listing' : 'Post a New Job'}</div>
        <div style={styles.pageSub}>
          {isEdit ? 'Changes will require admin re-approval.' : 'Submit for admin review. A posting fee (1% of service fee) is charged on approval.'}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Images */}
          <div className="card">
            <div style={styles.sectionTitle}>Job Images</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ImageUpload
                label="Company Logo"
                hint="Square image recommended · Shown on job card"
                preview={logoPreview}
                onFile={(file, url) => { setCompanyLogoFile(file); setLogoPreview(url); }}
              />
              <ImageUpload
                label="Cover Image"
                hint="Wide image recommended (16:9) · Shown on job detail page"
                preview={coverPreview}
                onFile={(file, url) => { setCoverImageFile(file); setCoverPreview(url); }}
              />
            </div>
          </div>

          {/* Basic info */}
          <div className="card">
            <div style={styles.sectionTitle}>Job Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Job Title *</label>
                <input className="input" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Registered Nurse" />
              </div>
              <div>
                <label className="input-label">Company / Employer Name *</label>
                <input className="input" name="company_name" value={form.company_name} onChange={handleChange} placeholder="e.g. NHS Trust Hospital" />
              </div>
              <div className="grid-2">
                <div>
                  <label className="input-label">Destination Country *</label>
                  <select className="input" name="destination_country_id" value={form.destination_country_id} onChange={handleChange} style={{ cursor: 'pointer' }}>
                    <option value="">Select country…</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Job Type *</label>
                  <select className="input" name="job_type" value={form.job_type} onChange={handleChange} style={{ cursor: 'pointer' }}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Industry *</label>
                <input className="input" name="industry" value={form.industry} onChange={handleChange} placeholder="e.g. Healthcare, Construction, IT" />
              </div>
            </div>
          </div>

          {/* Salary */}
          <div className="card">
            <div style={styles.sectionTitle}>Salary Range</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid-2">
                <div>
                  <label className="input-label">Minimum Salary</label>
                  <input className="input" name="salary_min" type="number" value={form.salary_min} onChange={handleChange} placeholder="3000" inputMode="numeric" />
                </div>
                <div>
                  <label className="input-label">Maximum Salary</label>
                  <input className="input" name="salary_max" type="number" value={form.salary_max} onChange={handleChange} placeholder="5000" inputMode="numeric" />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="input-label">Currency</label>
                  <select className="input" name="salary_currency" value={form.salary_currency} onChange={handleChange} style={{ cursor: 'pointer' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Period</label>
                  <select className="input" name="salary_period" value={form.salary_period} onChange={handleChange} style={{ cursor: 'pointer' }}>
                    {SALARY_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <div style={styles.sectionTitle}>Job Description</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Description *</label>
                <textarea className="input" name="description" value={form.description} onChange={handleChange} rows={6} placeholder="Role, responsibilities, working environment…" style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label className="input-label">Requirements</label>
                <textarea className="input" name="requirements" value={form.requirements} onChange={handleChange} rows={3} placeholder="Education, certifications, language requirements…" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Service fee */}
          <div className="card">
            <div style={styles.sectionTitle}>Service Fee</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              Held in escrow until you complete the placement. A 1% posting fee is deducted from your wallet on approval.
            </div>
            <div className="grid-2">
              <div>
                <label className="input-label">Amount *</label>
                <input className="input" name="service_fee" type="number" value={form.service_fee} onChange={handleChange} placeholder="150000" inputMode="numeric" />
              </div>
              <div>
                <label className="input-label">Currency</label>
                <select className="input" name="service_fee_currency" value={form.service_fee_currency} onChange={handleChange} style={{ cursor: 'pointer' }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {form.service_fee && (
              <div style={styles.feePreview}>
                Posting fee (1%): <strong style={{ color: 'var(--gold-text)' }}>{(Number(form.service_fee) * 0.01).toFixed(2)} {form.service_fee_currency}</strong>
              </div>
            )}
          </div>

          {/* Document checklist */}
          <div className="card">
            <div style={styles.sectionTitle}>Document Checklist</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
              Documents you will deliver to the seeker. Seekers see this before applying.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input" style={{ flex: 1 }} value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="e.g. Offer Letter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }} />
              <button type="button" className="btn btn-gold" onClick={addCheckItem} style={{ flexShrink: 0 }}><PlusIcon size={15} /> Add</button>
            </div>
            {checklist.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {checklist.map((item, i) => (
                  <div key={i} style={styles.checkItem}>
                    <span style={{ fontSize: 13, color: 'var(--text-1)' }}>• {item}</span>
                    <button type="button" style={styles.removeBtn} onClick={() => removeCheckItem(i)}><XIcon size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No documents added yet</div>
            )}
          </div>

          {/* Deadline */}
          <div className="card">
            <div style={styles.sectionTitle}>Application Deadline</div>
            <div>
              <label className="input-label">Closing Date (optional)</label>
              <input className="input" name="deadline" type="date" value={form.deadline} onChange={handleChange} />
            </div>
          </div>

          {/* Delivery Timeline */}
          <div className="card" style={{ borderColor: 'var(--gold-border)' }}>
            <div style={styles.sectionTitle}>Delivery Timeline *</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              How many days from payment to complete this placement? If you miss the deadline, the seeker receives a <strong style={{ color: 'var(--gold-text)' }}>10% automatic refund</strong> deducted from your wallet. Maximum is 90 days.
            </div>
            <div>
              <label className="input-label">Delivery Timeline *</label>
              <select className="input" name="delivery_days" value={form.delivery_days} onChange={handleChange} style={{ cursor: 'pointer' }}>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="21">21 days</option>
                <option value="30">30 days (recommended)</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days (maximum)</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, background: 'var(--gold-dim)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--gold-border)' }}>
              ⚠️ This is a binding commitment. If you do not complete the placement within {form.delivery_days} days of payment, 10% of the service fee is automatically refunded to the seeker from your wallet.
            </div>
          </div>

          {/* Seeker required documents */}
          <div className="card">
            <div style={styles.sectionTitle}>Documents Required from Seeker</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
              List documents the seeker must upload after payment (e.g. Passport, Degree Certificate). Mark required ones — seekers must upload all required docs before you begin processing.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <input className="input" style={{ flex: 1 }} value={newSeekerDoc} onChange={e => setNewSeekerDoc(e.target.value)} placeholder="e.g. International Passport" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newSeekerDoc.trim()) { setSeekerDocs(d => [...d, { label: newSeekerDoc.trim(), required: true }]); setNewSeekerDoc(''); } } }} />
              <button type="button" className="btn btn-gold" onClick={() => { if (!newSeekerDoc.trim()) return; setSeekerDocs(d => [...d, { label: newSeekerDoc.trim(), required: true }]); setNewSeekerDoc(''); }} style={{ flexShrink: 0 }}><PlusIcon size={15} /> Add</button>
            </div>
            {seekerDocs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {seekerDocs.map((item, i) => (
                  <div key={i} style={{ ...styles.checkItem, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1 }}>📄 {item.label}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}>
                      <input type="checkbox" checked={item.required} onChange={() => setSeekerDocs(d => d.map((x, idx) => idx === i ? { ...x, required: !x.required } : x))} />
                      Required
                    </label>
                    <button type="button" style={styles.removeBtn} onClick={() => setSeekerDocs(d => d.filter((_, idx) => idx !== i))}><XIcon size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No seeker documents added</div>
            )}
          </div>

          <button type="submit" className="btn btn-gold btn-full btn-lg" disabled={saving || uploading}>
            {saving || uploading ? <span className="spinner spinner-sm" /> : null}
            {saving ? 'Submitting…' : uploading ? 'Uploading images…' : isEdit ? 'Save Changes' : 'Submit for Review'}
          </button>

          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
            Your listing will be reviewed by admin before going live.
          </div>
        </form>
      </div>
    </AppShell>
  );
}

const styles = {
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px 0', fontFamily: 'Inter, sans-serif' },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 6 },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  fieldLabel: { fontSize: 13, fontWeight: 500, color: '#c0c0d0', marginBottom: 6, display: 'block' },
  imgDropZone: { border: '1.5px dashed', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', gap: 6, minHeight: 100 },
  dropText: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)' },
  dropHint: { fontSize: 11, color: 'var(--text-3)' },
  imagePreview: { position: 'relative', width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' },
  removeImgBtn: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' },
  feePreview: { fontSize: 13, color: 'var(--text-2)', marginTop: 10, padding: '8px 12px', background: 'var(--gold-dim)', borderRadius: 6, border: '1px solid var(--gold-border)' },
  checkItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center', fontFamily: 'Inter, sans-serif' },
};
