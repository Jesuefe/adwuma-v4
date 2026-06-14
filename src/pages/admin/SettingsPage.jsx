import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { SettingsIcon, CheckIcon } from '../../components/ui/Icons';

function SettingField({ label, hint, settingKey, value, type = 'text', prefix, suffix, onChange }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {hint && <div style={styles.fieldHint}>{hint}</div>}
      <div style={styles.inputWrap}>
        {prefix && <span style={styles.inputAddon}>{prefix}</span>}
        <input
          style={{ ...styles.input, borderRadius: prefix ? '0 8px 8px 0' : suffix ? '8px 0 0 8px' : 8 }}
          type={type}
          value={value}
          onChange={e => onChange(settingKey, e.target.value)}
        />
        {suffix && <span style={styles.inputAddon}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['admin_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*');
      return data || [];
    },
  });

  useEffect(() => {
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    setLocalSettings(map);
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(localSettings).map(([key, value]) => ({ key, value }));
      for (const u of updates) {
        await supabase.from('settings').update({ value: u.value, updated_at: new Date().toISOString() }).eq('key', u.key);
      }
      queryClient.invalidateQueries(['admin_settings']);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const SECTIONS = [
    {
      title: 'Platform Fees',
      desc: 'Configure how the platform earns revenue',
      fields: [
        { key: 'platform_fee_pct', label: 'Platform Fee', hint: 'Percentage of each service fee Ajuma Link keeps', suffix: '%' },
        { key: 'posting_fee_pct', label: 'Job Posting Fee', hint: 'Percentage of service fee charged to agent when job is approved', suffix: '% of service fee' },
      ],
    },
    {
      title: 'Paystack',
      desc: 'Payment gateway configuration',
      fields: [
        { key: 'paystack_public_key', label: 'Paystack Public Key', hint: 'Starts with pk_live_ or pk_test_' },
        { key: 'default_currency', label: 'Default Currency', hint: 'NGN or GHS (Paystack supported)' },
      ],
    },
    {
      title: 'Site Info',
      desc: 'General platform settings',
      fields: [
        { key: 'site_name', label: 'Site Name' },
        { key: 'site_tagline', label: 'Tagline' },
        { key: 'contact_email', label: 'Contact Email' },
        { key: 'contact_phone', label: 'Contact Phone' },
      ],
    },
    {
      title: 'Social Links',
      desc: 'Footer social media URLs',
      fields: [
        { key: 'twitter_url', label: 'Twitter / X URL' },
        { key: 'facebook_url', label: 'Facebook URL' },
        { key: 'linkedin_url', label: 'LinkedIn URL' },
        { key: 'instagram_url', label: 'Instagram URL' },
      ],
    },
    {
      title: 'Platform Features',
      desc: 'Toggle platform-wide features',
      fields: [
        { key: 'registrations_open', label: 'Allow Registrations', hint: '"true" or "false"' },
        { key: 'maintenance_mode', label: 'Maintenance Mode', hint: '"true" to show maintenance page to visitors' },
        { key: 'max_file_size_mb', label: 'Max Upload Size (MB)', hint: 'Maximum file size for uploads' },
      ],
    },
  ];

  return (
    <AppShell title="Settings">
      <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={styles.pageHeader}>
          <div>
            <div style={styles.pageTitle}>Platform Settings</div>
            <div style={styles.pageSub}>Configure fees, payment keys, and site behaviour</div>
          </div>
          <button className="btn btn-gold" onClick={saveSettings} disabled={saving || isLoading}>
            {saving ? <span className="spinner spinner-sm" /> : saved ? <CheckIcon size={15} /> : <SettingsIcon size={15} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All'}
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {SECTIONS.map(section => (
              <div key={section.title} className="card">
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionTitle}>{section.title}</div>
                  <div style={styles.sectionDesc}>{section.desc}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {section.fields.map(f => (
                    <SettingField
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      settingKey={f.key}
                      value={localSettings[f.key] || ''}
                      prefix={f.prefix}
                      suffix={f.suffix}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Danger zone */}
            <div style={styles.dangerZone}>
              <div style={styles.sectionTitle}>Danger Zone</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={styles.dangerRow}>
                  <div>
                    <div style={styles.dangerLabel}>Enable Maintenance Mode</div>
                    <div style={styles.dangerDesc}>Sets maintenance_mode to "true" — visitors see a maintenance page</div>
                  </div>
                  <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => handleChange('maintenance_mode', localSettings.maintenance_mode === 'true' ? 'false' : 'true')}>
                    {localSettings.maintenance_mode === 'true' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <div style={styles.dangerRow}>
                  <div>
                    <div style={styles.dangerLabel}>Close Registrations</div>
                    <div style={styles.dangerDesc}>Sets registrations_open to "false" — no new signups allowed</div>
                  </div>
                  <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => handleChange('registrations_open', localSettings.registrations_open === 'true' ? 'false' : 'true')}>
                    {localSettings.registrations_open === 'true' ? 'Close' : 'Open'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 },
  pageTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  sectionHeader: { marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 3 },
  sectionDesc: { fontSize: 12, color: 'var(--text-3)' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: 500, color: '#c0c0d0' },
  fieldHint: { fontSize: 11, color: 'var(--text-3)' },
  inputWrap: { display: 'flex', alignItems: 'stretch' },
  input: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', padding: '10px 12px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', minHeight: 42 },
  inputAddon: { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', padding: '10px 12px', fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
  dangerZone: { background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: 16 },
  dangerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  dangerLabel: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 },
  dangerDesc: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 },
};
