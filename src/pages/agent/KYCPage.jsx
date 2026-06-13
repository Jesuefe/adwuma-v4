import React, { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useAgentKYC, useFileUpload } from 'hooks';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { UploadIcon, CheckCircleIcon, AlertCircleIcon, FileTextIcon, ShieldIcon } from '../../components/ui/Icons';

const DOC_TYPES = [
  { id: 'national_id',          label: 'National ID / Voter Card',           required: true,  hint: 'Clear photo or scan — JPG, PNG, or PDF' },
  { id: 'passport',             label: 'International Passport',              required: false, hint: 'Bio-data page only' },
  { id: 'business_reg',         label: 'Business Registration Certificate',   required: true,  hint: 'CAC certificate or equivalent' },
  { id: 'recruitment_licence',  label: 'Recruitment / Agency Licence',        required: true,  hint: 'Government-issued recruitment licence' },
  { id: 'other',                label: 'Other Supporting Documents',          required: false, hint: 'Any additional documentation' },
];

const REQUIRED_DOCS = DOC_TYPES.filter(d => d.required).map(d => d.id);

function DocUploadZone({ docType, existingDocs, kycId, agentId, onUploaded, disabled }) {
  const { upload, uploading } = useFileUpload();
  const inputRef = React.useRef(null);
  const [dragging, setDragging] = useState(false);
  const existing = existingDocs.find(d => d.document_type === docType.id);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    try {
      const url = await upload(file, 'kyc', `${agentId}`);
      // Remove old doc of same type if exists
      if (existing) {
        await supabase.from('kyc_documents').delete().eq('id', existing.id);
      }
      await supabase.from('kyc_documents').insert({
        kyc_id: kycId,
        document_type: docType.id,
        document_name: file.name,
        file_url: url,
      });
      toast.success(`${docType.label} uploaded`);
      onUploaded();
    } catch (err) { toast.error(err.message || 'Upload failed'); }
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div style={{ ...styles.docZoneWrap, opacity: disabled ? 0.5 : 1 }}>
      <div style={styles.docZoneHeader}>
        <div>
          <div style={styles.docTypeLabel}>
            {docType.label}
            {docType.required && <span style={{ color: 'var(--error)' }}> *</span>}
          </div>
          <div style={styles.docTypeHint}>{docType.hint}</div>
        </div>
        {existing && <div style={styles.uploadedBadge}><CheckCircleIcon size={12} /> Uploaded</div>}
      </div>

      {existing ? (
        <div style={styles.existingFile}>
          <FileTextIcon size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <span style={styles.fileName}>{existing.document_name}</span>
          <a href={existing.file_url} target="_blank" rel="noopener noreferrer" style={styles.viewLink}>View</a>
          {!disabled && (
            <button style={styles.replaceBtn} onClick={() => inputRef.current?.click()}>Replace</button>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div
          style={{ ...styles.dropZone, borderColor: dragging ? 'var(--gold)' : 'rgba(255,255,255,0.1)', background: dragging ? 'var(--gold-dim)' : 'rgba(255,255,255,0.02)', pointerEvents: disabled ? 'none' : 'auto' }}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div className="spinner" />
              <span style={styles.dropHint}>Uploading…</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <UploadIcon size={22} style={{ color: 'var(--text-3)' }} />
              <div style={styles.dropText}>Tap to select or drag & drop</div>
              <div style={styles.dropHint}>PDF, JPG, PNG · Max 10MB</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KYCPage() {
  const { user } = useAuth();
  const { data: kyc, isLoading } = useAgentKYC();
  const queryClient = useQueryClient();
  const [bizName, setBizName] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (kyc?.business_name) setBizName(kyc.business_name);
  }, [kyc?.business_name]);

  const reload = () => queryClient.invalidateQueries(['agent_kyc', user?.id]);

  const saveBusinessInfo = async () => {
    if (!bizName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('agent_kyc').update({ business_name: bizName.trim() }).eq('id', kyc.id);
      toast.success('Business info saved');
      reload();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const submitForReview = async () => {
    const docs = kyc?.kyc_documents || [];
    const uploadedTypes = docs.map(d => d.document_type);
    const missing = REQUIRED_DOCS.filter(r => !uploadedTypes.includes(r));

    if (missing.length > 0) {
      const missingLabels = missing.map(id => DOC_TYPES.find(d => d.id === id)?.label).join(', ');
      toast.error(`Please upload: ${missingLabels}`);
      return;
    }

    if (!kyc?.business_name) {
      toast.error('Please save your business name first');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from('agent_kyc').update({
        status: 'under_review',
        submitted_at: new Date().toISOString(),
      }).eq('id', kyc.id);
      toast.success('KYC submitted for review! You\'ll be notified within 1–2 business days.');
      reload();
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  const STATUS_INFO = {
    pending:      { color: 'var(--text-2)', bg: 'rgba(255,255,255,0.06)', icon: null,             label: 'Not Submitted',  desc: 'Upload all required documents below, then click "Submit for Review".' },
    under_review: { color: 'var(--gold)',   bg: 'var(--gold-dim)',        icon: AlertCircleIcon,   label: 'Under Review',   desc: 'Your documents are being reviewed by our team. This usually takes 1–2 business days.' },
    approved:     { color: '#22c55e',       bg: 'rgba(34,197,94,0.1)',    icon: CheckCircleIcon,   label: 'Approved ✓',     desc: 'Your KYC is verified. You can now post job listings.' },
    rejected:     { color: 'var(--error)',  bg: 'var(--error-dim)',       icon: AlertCircleIcon,   label: 'Rejected',       desc: `Reason: ${kyc?.rejection_reason || 'See below'}. Please fix and resubmit.` },
  };

  if (isLoading) return (
    <AppShell title="KYC Verification">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
    </AppShell>
  );

  if (!kyc) return (
    <AppShell title="KYC Verification">
      <div className="page"><div style={{ color: 'var(--text-2)', fontSize: 14 }}>KYC record not found. Please contact support.</div></div>
    </AppShell>
  );

  const currentStatus = kyc?.status || 'pending';
  const status = STATUS_INFO[currentStatus];
  const docs = kyc?.kyc_documents || [];
  const uploadedRequiredCount = REQUIRED_DOCS.filter(r => docs.find(d => d.document_type === r)).length;
  const allRequiredUploaded = uploadedRequiredCount === REQUIRED_DOCS.length;
  const isLocked = currentStatus === 'under_review' || currentStatus === 'approved';
  const StatusIcon = status.icon;

  return (
    <AppShell title="KYC Verification">
      <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={styles.pageTitle}>Identity Verification</div>
        <div style={styles.pageSub}>Complete all steps below to unlock job posting on Adwuma.</div>

        {/* Status banner */}
        <div style={{ ...styles.statusBanner, background: status.bg, borderColor: status.color + '40' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {StatusIcon && <StatusIcon size={16} style={{ color: status.color }} />}
            <span style={{ fontSize: 14, fontWeight: 700, color: status.color }}>{status.label}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{status.desc}</div>
        </div>

        {/* Step 1 — Business info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={styles.stepHeader}>
            <div style={styles.stepNum}>1</div>
            <div style={styles.sectionTitle}>Business Information</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input" style={{ flex: 1 }}
              value={bizName}
              onChange={e => setBizName(e.target.value)}
              placeholder="e.g. Acme Recruitment Ltd"
              disabled={isLocked}
            />
            {!isLocked && (
              <button className="btn btn-gold" onClick={saveBusinessInfo} disabled={saving || !bizName.trim()}>
                {saving ? '…' : 'Save'}
              </button>
            )}
          </div>
          {kyc?.business_name && (
            <div style={styles.savedNote}><CheckCircleIcon size={12} style={{ color: '#22c55e' }} /> Saved: {kyc.business_name}</div>
          )}
        </div>

        {/* Step 2 — Documents */}
        <div style={styles.stepHeader}>
          <div style={styles.stepNum}>2</div>
          <div style={styles.sectionTitle}>Upload Documents</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Items marked <span style={{ color: 'var(--error)' }}>*</span> are required. Upload all required documents before submitting.
          {!isLocked && <span style={{ color: 'var(--gold-text)', marginLeft: 6 }}>{uploadedRequiredCount}/{REQUIRED_DOCS.length} required uploaded</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {DOC_TYPES.map(dt => (
            <DocUploadZone
              key={dt.id}
              docType={dt}
              existingDocs={docs}
              kycId={kyc.id}
              agentId={user.id}
              onUploaded={reload}
              disabled={isLocked}
            />
          ))}
        </div>

        {/* Step 3 — Submit */}
        {!isLocked && (
          <div className="card" style={{ background: allRequiredUploaded ? 'rgba(245,158,11,0.04)' : 'var(--card)', borderColor: allRequiredUploaded ? 'var(--gold-border)' : 'var(--border)' }}>
            <div style={styles.stepHeader}>
              <div style={{ ...styles.stepNum, background: allRequiredUploaded ? 'var(--gold)' : 'rgba(255,255,255,0.08)', color: allRequiredUploaded ? '#000' : 'var(--text-3)' }}>3</div>
              <div style={styles.sectionTitle}>Submit for Review</div>
            </div>

            {!allRequiredUploaded ? (
              <div style={styles.submitBlock}>
                <div style={styles.submitHint}>
                  Upload all {REQUIRED_DOCS.length} required documents above to enable submission.
                  <br />Missing: {REQUIRED_DOCS.filter(r => !docs.find(d => d.document_type === r)).map(id => DOC_TYPES.find(d => d.id === id)?.label).join(', ')}
                </div>
                <button className="btn btn-full" disabled style={{ opacity: 0.4, background: 'var(--gold)', color: '#000', fontWeight: 700, minHeight: 48 }}>
                  <ShieldIcon size={16} /> Submit for Review
                </button>
              </div>
            ) : (
              <div style={styles.submitBlock}>
                <div style={{ ...styles.submitHint, color: 'var(--text-1)' }}>
                  All required documents uploaded. By submitting, you confirm that all documents are genuine and up to date.
                </div>
                <button className="btn btn-gold btn-full btn-lg" onClick={submitForReview} disabled={submitting}>
                  {submitting ? <span className="spinner spinner-sm" /> : <ShieldIcon size={16} />}
                  {submitting ? 'Submitting…' : 'Submit for Review'}
                </button>
              </div>
            )}
          </div>
        )}

        {currentStatus === 'rejected' && (
          <div style={styles.rejectNote}>
            <AlertCircleIcon size={14} style={{ flexShrink: 0 }} />
            <div>
              <strong>Rejection reason:</strong> {kyc.rejection_reason}
              <br />Fix the issues above and click "Submit for Review" again.
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 6 },
  pageSub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 },
  statusBanner: { border: '1px solid', borderRadius: 12, padding: 16, marginBottom: 20 },
  stepHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' },
  savedNote: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22c55e', marginTop: 8 },
  docZoneWrap: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 },
  docZoneHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  docTypeLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  docTypeHint: { fontSize: 12, color: 'var(--text-3)' },
  uploadedBadge: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  dropZone: { border: '1.5px dashed', borderRadius: 10, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', minHeight: 90 },
  dropText: { fontSize: 14, fontWeight: 500, color: 'var(--text-2)', textAlign: 'center' },
  dropHint: { fontSize: 12, color: 'var(--text-3)', textAlign: 'center' },
  existingFile: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '10px 12px' },
  fileName: { fontSize: 13, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viewLink: { fontSize: 12, color: 'var(--gold-text)', fontWeight: 500, textDecoration: 'none', flexShrink: 0 },
  replaceBtn: { fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 },
  submitBlock: { display: 'flex', flexDirection: 'column', gap: 14 },
  submitHint: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
  rejectNote: { display: 'flex', gap: 10, background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--error)', lineHeight: 1.6, marginTop: 16 },
};
