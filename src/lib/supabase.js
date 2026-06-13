import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signUp({ email, password, firstName, lastName, phone, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, phone: phone || null, role },
    },
  });
  if (error) throw error;
  // Profile is created automatically by the on_auth_user_created trigger
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.REACT_APP_APP_URL}/auth/reset-password`,
  });
  if (error) throw error;
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Jobs helpers ─────────────────────────────────────────────────────────────

export async function getActiveJobs({ search = '', countryId = null, jobType = null, page = 0, pageSize = 12 } = {}) {
  let query = supabase
    .from('jobs')
    .select(`
      *,
      countries(name, code),
      currencies!jobs_service_fee_currency_fkey(symbol, code),
      profiles!jobs_agent_id_fkey(first_name, last_name, avatar_url),
      agent_kyc!inner(business_name)
    `, { count: 'exact' })
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (countryId) query = query.eq('destination_country_id', countryId);
  if (jobType) query = query.eq('job_type', jobType);

  const { data, error, count } = await query;
  if (error) throw error;
  return { jobs: data, total: count };
}

export async function getJobById(jobId) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      countries(name, code),
      currencies!jobs_service_fee_currency_fkey(symbol, code, name),
      profiles!jobs_agent_id_fkey(id, first_name, last_name, avatar_url),
      agent_kyc(business_name),
      job_document_checklist(id, document_name, sort_order)
    `)
    .eq('id', jobId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Notifications helpers ────────────────────────────────────────────────────

export async function getNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

// ─── Realtime subscription helpers ───────────────────────────────────────────

export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${userId}`,
    }, callback)
    .subscribe();
}

export function subscribeToMessages(threadId, callback) {
  return supabase
    .channel(`messages:${threadId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `thread_id=eq.${threadId}`,
    }, callback)
    .subscribe();
}
