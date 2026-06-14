-- Add image fields to jobs table
alter table jobs add column if not exists company_logo_url text;
alter table jobs add column if not exists cover_image_url text;

-- Allow seekers to update their own application steps (needed for auto-completing steps 1&2)
create policy if not exists "Seekers update own app steps" on application_steps for update
  using (exists(select 1 from applications where applications.id = application_id and applications.seeker_id = auth.uid()));
