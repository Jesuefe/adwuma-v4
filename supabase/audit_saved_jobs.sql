-- ============================================================
-- Audit Logs Table
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  actor_role user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip text,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
create policy "Admins read all audit logs" on audit_logs for select using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "System insert audit logs" on audit_logs for insert with check (true);

create index idx_audit_logs_actor on audit_logs(actor_id, created_at desc);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_action on audit_logs(action, created_at desc);

-- ============================================================
-- Saved Jobs Table  
-- ============================================================
create table if not exists saved_jobs (
  id uuid primary key default uuid_generate_v4(),
  seeker_id uuid not null references profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(seeker_id, job_id)
);

alter table saved_jobs enable row level security;
create policy "Seekers manage own saved jobs" on saved_jobs for all using (auth.uid() = seeker_id);

create index idx_saved_jobs_seeker on saved_jobs(seeker_id, created_at desc);

-- ============================================================
-- Flagged Messages Table (for fraud detection)
-- ============================================================
create table if not exists flagged_messages (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages(id),
  thread_id uuid references message_threads(id),
  sender_id uuid references profiles(id),
  original_body text,
  flagged_pattern text,
  created_at timestamptz not null default now()
);

alter table flagged_messages enable row level security;
create policy "Admins read flagged messages" on flagged_messages for select using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "System insert flagged messages" on flagged_messages for insert with check (true);
