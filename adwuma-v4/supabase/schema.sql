-- ============================================================
-- ADWUMA v4 — Supabase Schema
-- Stack: React + Supabase + Paystack + Cloudflare Pages
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('seeker', 'agent', 'admin');
create type kyc_status as enum ('pending', 'under_review', 'approved', 'rejected');
create type job_status as enum ('pending', 'active', 'rejected', 'expired', 'closed');
create type application_status as enum ('in_escrow', 'under_review', 'approved', 'refunded');
create type escrow_status as enum ('holding', 'released', 'refunded');
create type document_status as enum ('pending', 'approved', 'rejected');
create type withdrawal_status as enum ('pending', 'approved', 'processed', 'rejected');
create type notification_type as enum (
  'application_received', 'job_approved', 'job_rejected',
  'kyc_approved', 'kyc_rejected', 'document_approved', 'document_rejected',
  'step_updated', 'escrow_released', 'withdrawal_submitted',
  'withdrawal_approved', 'withdrawal_processed', 'withdrawal_rejected',
  'new_message'
);
create type job_type as enum ('full_time', 'part_time', 'contract', 'internship');
create type step_status as enum ('pending', 'in_progress', 'completed');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'seeker',
  first_name text not null,
  last_name text not null,
  phone text,
  avatar_url text,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- COUNTRIES
-- ============================================================

create table countries (
  id serial primary key,
  code char(2) not null unique,
  name text not null,
  currency_code char(3) not null default 'USD',
  sort_order int not null default 0
);

insert into countries (code, name, currency_code, sort_order) values
  ('DE', 'Germany', 'EUR', 1),
  ('GB', 'United Kingdom', 'GBP', 2),
  ('CA', 'Canada', 'CAD', 3),
  ('AE', 'United Arab Emirates', 'AED', 4),
  ('PL', 'Poland', 'PLN', 5),
  ('NL', 'Netherlands', 'EUR', 6),
  ('US', 'United States', 'USD', 7),
  ('AU', 'Australia', 'AUD', 8),
  ('BE', 'Belgium', 'EUR', 9),
  ('IE', 'Ireland', 'EUR', 10),
  ('NG', 'Nigeria', 'NGN', 11),
  ('GH', 'Ghana', 'GHS', 12);

-- ============================================================
-- CURRENCIES (for multi-currency support)
-- ============================================================

create table currencies (
  code char(3) primary key,
  name text not null,
  symbol text not null,
  paystack_supported boolean not null default false
);

insert into currencies (code, name, symbol, paystack_supported) values
  ('NGN', 'Nigerian Naira', '₦', true),
  ('GHS', 'Ghanaian Cedi', 'GH₵', true),
  ('USD', 'US Dollar', '$', false),
  ('GBP', 'British Pound', '£', false),
  ('EUR', 'Euro', '€', false),
  ('CAD', 'Canadian Dollar', 'CA$', false),
  ('AED', 'UAE Dirham', 'AED', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('PLN', 'Polish Zloty', 'zł', false);

-- ============================================================
-- SETTINGS
-- ============================================================

create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('site_name', 'Adwuma'),
  ('site_tagline', 'Verified International Jobs for Africa'),
  ('contact_email', 'hello@adwuma.com'),
  ('contact_phone', ''),
  ('platform_fee_pct', '10'),
  ('posting_fee_pct', '1'),
  ('default_currency', 'NGN'),
  ('max_file_size_mb', '10'),
  ('session_days', '30'),
  ('registrations_open', 'true'),
  ('maintenance_mode', 'false'),
  ('paystack_public_key', ''),
  ('twitter_url', ''),
  ('facebook_url', ''),
  ('linkedin_url', ''),
  ('instagram_url', '');

-- ============================================================
-- AGENT KYC
-- ============================================================

create table agent_kyc (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id) on delete cascade,
  status kyc_status not null default 'pending',
  business_name text,
  business_reg_number text,
  country_of_operation text,
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id)
);

create table kyc_documents (
  id uuid primary key default uuid_generate_v4(),
  kyc_id uuid not null references agent_kyc(id) on delete cascade,
  document_type text not null, -- 'national_id', 'passport', 'business_reg', 'recruitment_licence', 'other'
  document_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- JOBS
-- ============================================================

create table jobs (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  company_name text not null,
  destination_country_id int references countries(id),
  industry text not null,
  job_type job_type not null default 'full_time',
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency char(3) references currencies(code),
  salary_period text default 'monthly', -- monthly, yearly, hourly
  description text not null,
  requirements text,
  service_fee numeric(12,2) not null,
  service_fee_currency char(3) not null references currencies(code),
  deadline date,
  status job_status not null default 'pending',
  is_featured boolean not null default false,
  rejection_reason text,
  posting_fee_charged boolean not null default false,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_document_checklist (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  document_name text not null,
  sort_order int not null default 0
);

-- ============================================================
-- APPLICATIONS
-- ============================================================

create table applications (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id),
  seeker_id uuid not null references profiles(id),
  agent_id uuid not null references profiles(id),
  cover_message text,
  cv_url text,
  status application_status not null default 'in_escrow',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, seeker_id)
);

create table application_steps (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  step_number int not null check (step_number between 1 and 6),
  step_name text not null,
  status step_status not null default 'pending',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique(application_id, step_number)
);

create table agent_notes (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  agent_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS & ESCROW
-- ============================================================

create table payments (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id),
  seeker_id uuid not null references profiles(id),
  agent_id uuid not null references profiles(id),
  amount numeric(12,2) not null,
  currency char(3) not null references currencies(code),
  paystack_reference text unique,
  paystack_transaction_id text,
  escrow_status escrow_status not null default 'holding',
  platform_fee_pct numeric(5,2) not null,
  platform_fee_amount numeric(12,2),
  agent_payout_amount numeric(12,2),
  released_by uuid references profiles(id),
  released_at timestamptz,
  refunded_by uuid references profiles(id),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AGENT WALLET
-- ============================================================

create table agent_wallets (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  currency char(3) not null references currencies(code) default 'NGN',
  updated_at timestamptz not null default now(),
  unique(agent_id, currency)
);

create table wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id),
  currency char(3) not null references currencies(code),
  type text not null, -- 'credit', 'debit'
  amount numeric(12,2) not null,
  description text not null,
  reference_id uuid, -- payment_id or withdrawal_id
  balance_after numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WITHDRAWALS
-- ============================================================

create table withdrawals (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id),
  amount numeric(12,2) not null,
  currency char(3) not null references currencies(code),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  bank_code text,
  status withdrawal_status not null default 'pending',
  rejection_reason text,
  processed_by uuid references profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table application_documents (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  agent_id uuid not null references profiles(id),
  document_name text not null,
  file_url text not null,
  status document_status not null default 'pending',
  rejection_reason text,
  resubmit_count int not null default 0,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================

create table message_threads (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  seeker_id uuid not null references profiles(id),
  agent_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique(application_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_profiles_role on profiles(role);
create index idx_jobs_status on jobs(status);
create index idx_jobs_agent on jobs(agent_id);
create index idx_jobs_featured on jobs(is_featured) where is_featured = true;
create index idx_applications_seeker on applications(seeker_id);
create index idx_applications_agent on applications(agent_id);
create index idx_applications_job on applications(job_id);
create index idx_payments_escrow on payments(escrow_status);
create index idx_notifications_recipient on notifications(recipient_id, is_read);
create index idx_messages_thread on messages(thread_id, created_at);
create index idx_wallet_tx_agent on wallet_transactions(agent_id, created_at desc);
create index idx_withdrawals_status on withdrawals(status);

-- ============================================================
-- TRIGGERS — auto-create application_steps on new application
-- ============================================================

create or replace function create_application_steps()
returns trigger as $$
begin
  insert into application_steps (application_id, step_number, step_name) values
    (new.id, 1, 'Application Received'),
    (new.id, 2, 'Payment Secured'),
    (new.id, 3, 'Document Review'),
    (new.id, 4, 'Employer Processing'),
    (new.id, 5, 'Offer / Decision'),
    (new.id, 6, 'Relocation Support');

  -- Steps 1 and 2 auto-complete on creation (payment already verified)
  update application_steps set status = 'completed' 
  where application_id = new.id and step_number in (1, 2);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_application_created
  after insert on applications
  for each row execute procedure create_application_steps();

-- ============================================================
-- TRIGGERS — auto-create wallet for new agent
-- ============================================================

create or replace function create_agent_wallet()
returns trigger as $$
begin
  if new.role = 'agent' then
    insert into agent_wallets (agent_id, currency, balance)
    values (new.id, 'NGN', 0)
    on conflict (agent_id, currency) do nothing;
    
    insert into agent_kyc (agent_id, status)
    values (new.id, 'pending')
    on conflict (agent_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_agent_profile_created
  after insert on profiles
  for each row execute procedure create_agent_wallet();

-- ============================================================
-- TRIGGERS — updated_at timestamps
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles for each row execute procedure update_updated_at();
create trigger trg_jobs_updated before update on jobs for each row execute procedure update_updated_at();
create trigger trg_applications_updated before update on applications for each row execute procedure update_updated_at();
create trigger trg_payments_updated before update on payments for each row execute procedure update_updated_at();
create trigger trg_withdrawals_updated before update on withdrawals for each row execute procedure update_updated_at();
create trigger trg_agent_kyc_updated before update on agent_kyc for each row execute procedure update_updated_at();
create trigger trg_documents_updated before update on application_documents for each row execute procedure update_updated_at();
create trigger trg_wallets_updated before update on agent_wallets for each row execute procedure update_updated_at();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table agent_kyc enable row level security;
alter table kyc_documents enable row level security;
alter table jobs enable row level security;
alter table job_document_checklist enable row level security;
alter table applications enable row level security;
alter table application_steps enable row level security;
alter table agent_notes enable row level security;
alter table payments enable row level security;
alter table agent_wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table withdrawals enable row level security;
alter table application_documents enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- Helper: get current user role
create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: is admin
create or replace function is_admin()
returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

-- PROFILES
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Admins read all profiles" on profiles for select using (is_admin());
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Profiles insert on signup" on profiles for insert with check (auth.uid() = id);

-- JOBS (public read for active, agents manage own, admins manage all)
create policy "Anyone reads active jobs" on jobs for select using (status = 'active');
create policy "Agents read own jobs" on jobs for select using (auth.uid() = agent_id);
create policy "Admins read all jobs" on jobs for select using (is_admin());
create policy "Agents insert jobs" on jobs for insert with check (
  auth.uid() = agent_id and get_my_role() = 'agent'
);
create policy "Agents update own jobs" on jobs for update using (auth.uid() = agent_id);
create policy "Admins update any job" on jobs for update using (is_admin());

-- JOB CHECKLIST
create policy "Anyone reads checklist for active jobs" on job_document_checklist for select
  using (exists(select 1 from jobs where jobs.id = job_id and jobs.status = 'active'));
create policy "Agents manage own job checklists" on job_document_checklist for all
  using (exists(select 1 from jobs where jobs.id = job_id and jobs.agent_id = auth.uid()));
create policy "Admins manage all checklists" on job_document_checklist for all using (is_admin());

-- AGENT KYC
create policy "Agents read own KYC" on agent_kyc for select using (auth.uid() = agent_id);
create policy "Agents update own KYC" on agent_kyc for update using (auth.uid() = agent_id);
create policy "Admins manage all KYC" on agent_kyc for all using (is_admin());

-- KYC DOCUMENTS
create policy "Agents read own KYC docs" on kyc_documents for select
  using (exists(select 1 from agent_kyc where agent_kyc.id = kyc_id and agent_kyc.agent_id = auth.uid()));
create policy "Agents upload KYC docs" on kyc_documents for insert
  with check (exists(select 1 from agent_kyc where agent_kyc.id = kyc_id and agent_kyc.agent_id = auth.uid()));
create policy "Admins manage all KYC docs" on kyc_documents for all using (is_admin());

-- APPLICATIONS
create policy "Seekers read own applications" on applications for select using (auth.uid() = seeker_id);
create policy "Agents read their applications" on applications for select using (auth.uid() = agent_id);
create policy "Admins read all applications" on applications for select using (is_admin());
create policy "Seekers create applications" on applications for insert
  with check (auth.uid() = seeker_id and get_my_role() = 'seeker');

-- APPLICATION STEPS
create policy "Seeker reads own app steps" on application_steps for select
  using (exists(select 1 from applications where applications.id = application_id and applications.seeker_id = auth.uid()));
create policy "Agent reads their app steps" on application_steps for select
  using (exists(select 1 from applications where applications.id = application_id and applications.agent_id = auth.uid()));
create policy "Agent updates steps" on application_steps for update
  using (exists(select 1 from applications where applications.id = application_id and applications.agent_id = auth.uid()));
create policy "Admins manage all steps" on application_steps for all using (is_admin());

-- AGENT NOTES
create policy "Agents manage own notes" on agent_notes for all using (auth.uid() = agent_id);
create policy "Admins read all notes" on agent_notes for select using (is_admin());

-- PAYMENTS
create policy "Seekers read own payments" on payments for select using (auth.uid() = seeker_id);
create policy "Agents read their payments" on payments for select using (auth.uid() = agent_id);
create policy "Admins manage all payments" on payments for all using (is_admin());
create policy "Seekers create payment record" on payments for insert with check (auth.uid() = seeker_id);

-- WALLETS
create policy "Agents read own wallet" on agent_wallets for select using (auth.uid() = agent_id);
create policy "Admins read all wallets" on agent_wallets for select using (is_admin());

-- WALLET TRANSACTIONS
create policy "Agents read own transactions" on wallet_transactions for select using (auth.uid() = agent_id);
create policy "Admins read all transactions" on wallet_transactions for select using (is_admin());

-- WITHDRAWALS
create policy "Agents manage own withdrawals" on withdrawals for all using (auth.uid() = agent_id);
create policy "Admins manage all withdrawals" on withdrawals for all using (is_admin());

-- DOCUMENTS
create policy "Seeker reads approved docs for own apps" on application_documents for select
  using (
    status = 'approved' and
    exists(select 1 from applications where applications.id = application_id and applications.seeker_id = auth.uid())
  );
create policy "Agent manages docs for own apps" on application_documents for all
  using (auth.uid() = agent_id);
create policy "Admins manage all documents" on application_documents for all using (is_admin());

-- MESSAGES
create policy "Seeker reads own threads" on message_threads for select using (auth.uid() = seeker_id);
create policy "Agent reads own threads" on message_threads for select using (auth.uid() = agent_id);
create policy "Admins read all threads" on message_threads for select using (is_admin());
create policy "Thread auto-created" on message_threads for insert
  with check (auth.uid() = seeker_id or auth.uid() = agent_id);

create policy "Read messages in own threads" on messages for select
  using (
    exists(select 1 from message_threads mt
      where mt.id = thread_id
      and (mt.seeker_id = auth.uid() or mt.agent_id = auth.uid()))
    or is_admin()
  );
create policy "Send messages in own threads" on messages for insert
  with check (
    auth.uid() = sender_id and
    exists(select 1 from message_threads mt
      where mt.id = thread_id
      and (mt.seeker_id = auth.uid() or mt.agent_id = auth.uid()))
  );

-- NOTIFICATIONS
create policy "Users read own notifications" on notifications for select using (auth.uid() = recipient_id);
create policy "Users mark own notifications read" on notifications for update using (auth.uid() = recipient_id);
create policy "Admins manage all notifications" on notifications for all using (is_admin());

-- Settings (public read, admin write)
alter table settings enable row level security;
create policy "Anyone reads settings" on settings for select using (true);
create policy "Admins update settings" on settings for update using (is_admin());

-- Countries & currencies (public read)
alter table countries enable row level security;
alter table currencies enable row level security;
create policy "Anyone reads countries" on countries for select using (true);
create policy "Anyone reads currencies" on currencies for select using (true);
