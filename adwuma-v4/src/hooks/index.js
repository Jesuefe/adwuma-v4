import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getNotifications, markNotificationsRead, subscribeToNotifications } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToNotifications(user.id, (payload) => {
      queryClient.setQueryData(['notifications', user.id], (old) =>
        [payload.new, ...(old || [])]
      );
    });
    return () => supabase.removeChannel(channel);
  }, [user, queryClient]);

  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(user.id),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', user.id], (old) =>
        (old || []).map(n => ({ ...n, is_read: true }))
      );
    },
  });

  const unreadCount = (query.data || []).filter(n => !n.is_read).length;
  return { ...query, unreadCount, markRead: markRead.mutate };
}

// ─── Agent Wallet ─────────────────────────────────────────────────────────────

export function useWallet(currency = 'NGN') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet', user?.id, currency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', user.id)
        .eq('currency', currency)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useWalletTransactions(currency = 'NGN') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet_transactions', user?.id, currency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('agent_id', user.id)
        .eq('currency', currency)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function useSeekerApplications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['seeker_applications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          jobs(id, title, company_name, service_fee, service_fee_currency,
            countries(name, code),
            currencies!jobs_service_fee_currency_fkey(symbol)
          ),
          application_steps(step_number, step_name, status),
          payments(amount, currency, escrow_status)
        `)
        .eq('seeker_id', user.id)
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAgentApplications(statusFilter = null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agent_applications', user?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('applications')
        .select(`
          *,
          jobs(id, title, company_name),
          profiles!applications_seeker_id_fkey(first_name, last_name, avatar_url),
          application_steps(step_number, step_name, status),
          payments(amount, currency, escrow_status)
        `)
        .eq('agent_id', user.id)
        .order('applied_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export function useAgentKYC() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agent_kyc', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_kyc')
        .select('*, kyc_documents(*)')
        .eq('agent_id', user.id)
        .single();
      // If no KYC record exists, create one
      if (error && error.code === 'PGRST116') {
        const { data: newKyc } = await supabase
          .from('agent_kyc')
          .insert({ agent_id: user.id, status: 'pending' })
          .select('*, kyc_documents(*)')
          .single();
        return newKyc;
      }
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// ─── File upload ──────────────────────────────────────────────────────────────

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file, bucket, path) => {
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const fullPath = path ? `${path}/${fileName}` : fileName;

    const { error } = await supabase.storage.from(bucket).upload(fullPath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    setUploading(false);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fullPath);
    return publicUrl;
  }, []);

  return { upload, uploading };
}
