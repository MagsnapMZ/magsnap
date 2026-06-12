-- MAGSNAP Founder Registry Phase 1
-- Run this once in Supabase SQL Editor.

create table if not exists public.founder_profiles (
  founder_number integer primary key check (founder_number between 1 and 1000),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  country text not null check (char_length(trim(country)) between 1 and 80),
  city text not null check (char_length(trim(city)) between 1 and 80),
  sport_tags text[] not null default '{}',
  industry text,
  device_tags text[] not null default '{}',
  profile_photo_url text,
  short_intro text,
  status text not null default 'active' check (status in ('active', 'hidden')),
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_private_contacts (
  founder_number integer primary key references public.founder_profiles(founder_number) on delete cascade,
  contact_method text,
  contact_detail text,
  social_media text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.founder_profiles enable row level security;
alter table public.founder_private_contacts enable row level security;

drop view if exists public.public_founder_registry;
create view public.public_founder_registry as
select
  founder_number,
  display_name,
  country,
  sport_tags,
  activated_at
from public.founder_profiles
where status = 'active'
order by founder_number asc;

revoke all on public.founder_profiles from anon, authenticated;
revoke all on public.founder_private_contacts from anon, authenticated;
grant select on public.public_founder_registry to anon, authenticated;

create or replace function public.activate_founder(registration jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  founder_digits text;
  founder_no integer;
  sports text[];
  devices text[];
  display_name_clean text;
  country_clean text;
  city_clean text;
begin
  founder_digits := regexp_replace(coalesce(registration->>'founder_number', ''), '[^0-9]', '', 'g');

  if founder_digits = '' then
    raise exception 'Founder Number is required.';
  end if;

  founder_no := founder_digits::integer;

  if founder_no < 1 or founder_no > 1000 then
    raise exception 'Founder Number must be between 0001 and 1000.';
  end if;

  display_name_clean := nullif(trim(coalesce(registration->>'display_name', '')), '');
  country_clean := nullif(trim(coalesce(registration->>'country', '')), '');
  city_clean := nullif(trim(coalesce(registration->>'city', '')), '');

  if display_name_clean is null then
    raise exception 'Name or Nickname is required.';
  end if;

  if country_clean is null then
    raise exception 'Country is required.';
  end if;

  if city_clean is null then
    raise exception 'City is required.';
  end if;

  select coalesce(array_agg(value), '{}')
  into sports
  from jsonb_array_elements_text(coalesce(registration->'sport_tags', '[]'::jsonb)) as value;

  if array_length(sports, 1) is null then
    raise exception 'Select at least one sport or activity.';
  end if;

  select coalesce(array_agg(value), '{}')
  into devices
  from jsonb_array_elements_text(coalesce(registration->'device_tags', '[]'::jsonb)) as value;

  insert into public.founder_profiles (
    founder_number,
    display_name,
    country,
    city,
    sport_tags,
    industry,
    device_tags,
    profile_photo_url,
    short_intro
  )
  values (
    founder_no,
    display_name_clean,
    country_clean,
    city_clean,
    sports,
    nullif(trim(coalesce(registration->>'industry', '')), ''),
    devices,
    nullif(trim(coalesce(registration->>'profile_photo_url', '')), ''),
    nullif(trim(coalesce(registration->>'short_intro', '')), '')
  );

  insert into public.founder_private_contacts (
    founder_number,
    contact_method,
    contact_detail,
    social_media
  )
  values (
    founder_no,
    nullif(trim(coalesce(registration->>'contact_method', '')), ''),
    nullif(trim(coalesce(registration->>'contact_detail', '')), ''),
    nullif(trim(coalesce(registration->>'social_media', '')), '')
  );

  return jsonb_build_object(
    'founder_number', '#' || lpad(founder_no::text, 4, '0'),
    'status', 'activated'
  );
exception
  when unique_violation then
    raise exception 'This Founder Number has already been activated.';
end;
$$;

revoke all on function public.activate_founder(jsonb) from public;
grant execute on function public.activate_founder(jsonb) to anon, authenticated;
