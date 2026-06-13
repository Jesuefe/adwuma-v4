-- Add delivery timeline to jobs
alter table jobs add column if not exists delivery_days integer default 30;

-- Add seeker document requirements to job_document_checklist
alter table job_document_checklist add column if not exists required_from_seeker boolean default false;
alter table job_document_checklist add column if not exists seeker_doc_label text;
alter table job_document_checklist add column if not exists is_seeker_doc boolean default false;

-- Seeker uploaded documents table (separate from agent documents)
create table if not exists seeker_documents (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  seeker_id uuid not null references profiles(id),
  document_name text not null,
  file_url text not null,
  is_required boolean default false,
  status text default 'uploaded',
  created_at timestamptz default now()
);
alter table seeker_documents enable row level security;
create policy "Seeker manages own docs" on seeker_documents for all using (auth.uid() = seeker_id);
create policy "Agent reads application docs" on seeker_documents for select using (
  exists(select 1 from applications where id = application_id and agent_id = auth.uid())
);
create policy "Admin reads all seeker docs" on seeker_documents for select using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- Add delivery tracking to applications
alter table applications add column if not exists payment_date timestamptz;
alter table applications add column if not exists delivery_deadline timestamptz;
alter table applications add column if not exists delivery_days integer;
alter table applications add column if not exists deadline_missed boolean default false;
alter table applications add column if not exists penalty_refunded boolean default false;
alter table applications add column if not exists penalty_amount numeric default 0;

-- Add admin intervention to message threads
alter table message_threads add column if not exists admin_invited boolean default false;
alter table message_threads add column if not exists admin_invited_at timestamptz;
alter table message_threads add column if not exists admin_invited_by uuid references profiles(id);
alter table message_threads add column if not exists dispute_reason text;
