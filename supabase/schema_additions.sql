-- Add image fields to jobs table
alter table jobs add column if not exists company_logo_url text;
alter table jobs add column if not exists cover_image_url text;
