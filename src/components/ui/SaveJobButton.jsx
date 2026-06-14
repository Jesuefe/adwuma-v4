import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function SaveJobButton({ jobId, size = 'md' }) {
  const { user, isSeeker } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isSeeker) return;
    supabase.from('saved_jobs').select('id').eq('seeker_id', user.id).eq('job_id', jobId).single()
      .then(({ data }) => setSaved(!!data));
  }, [user, jobId, isSeeker]);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/auth/register'); return; }
    if (!isSeeker) return;
    setLoading(true);
    if (saved) {
      await supabase.from('saved_jobs').delete().eq('seeker_id', user.id).eq('job_id', jobId);
      setSaved(false);
    } else {
      await supabase.from('saved_jobs').insert({ seeker_id: user.id, job_id: jobId });
      setSaved(true);
    }
    setLoading(false);
  };

  const sz = size === 'lg' ? 20 : 16;
  const pad = size === 'lg' ? '8px 14px' : '5px 10px';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: saved ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${saved ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer', padding: pad,
        color: saved ? '#ef4444' : 'var(--text-3)',
        fontSize: 12, fontFamily: 'Inter, sans-serif',
        transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
      }}
      title={saved ? 'Remove from saved' : 'Save job'}
    >
      <span style={{ fontSize: sz }}>{saved ? '❤️' : '🤍'}</span>
      {size === 'lg' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
