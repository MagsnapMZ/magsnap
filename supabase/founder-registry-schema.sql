-- MAGSNAP REGISTRY V1.3
-- Run this once in Supabase SQL Editor.
-- Registry Numbers come from physical QC/Test Cards, not order numbers or registration order.

create table if not exists public.registry_records (
  registry_number text primary key check (registry_number ~ '^[0-9]{4}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  country text not null check (char_length(trim(country)) between 1 and 80),
  role text not null default 'Player' check (role in ('Founder', 'Player', 'Creator', 'Explorer', 'Athlete')),
  configuration text not null check (char_length(trim(configuration)) between 1 and 120),
  status text not null default 'Active' check (status in ('Origin', 'Manufactured', 'Assigned', 'Shipped', 'Activated', 'Active', 'Legacy', 'Hidden')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_private_details (
  registry_number text primary key references public.registry_records(registry_number) on delete cascade,
  city text,
  industry text,
  sport_tags text[] not null default '{}',
  device_tags text[] not null default '{}',
  contact_method text,
  contact_detail text,
  social_media text,
  profile_photo_url text,
  short_intro text,
  phone text,
  email text,
  address text,
  tracking_number text,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registry_records enable row level security;
alter table public.registry_private_details enable row level security;

drop view if exists public.public_registry_records;
create view public.public_registry_records as
select
  registry_number,
  display_name,
  country,
  role,
  configuration,
  status
from public.registry_records
where status <> 'Hidden'
order by registry_number asc;

revoke all on public.registry_records from anon, authenticated;
revoke all on public.registry_private_details from anon, authenticated;
grant select on public.public_registry_records to anon, authenticated;

create or replace function public.activate_registry_record(registration jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  registry_digits text;
  registry_no integer;
  registry_id text;
  sports text[];
  devices text[];
  display_name_clean text;
  country_clean text;
  city_clean text;
  role_clean text;
  configuration_clean text;
begin
  registry_digits := regexp_replace(coalesce(registration->>'registry_number', ''), '[^0-9]', '', 'g');

  if registry_digits = '' then
    raise exception 'Registry Number is required.';
  end if;

  registry_no := registry_digits::integer;

  if registry_no < 1 or registry_no > 9999 then
    raise exception 'Registry Number must be a four-digit QC/Test Card number.';
  end if;

  registry_id := lpad(registry_no::text, 4, '0');
  display_name_clean := nullif(trim(coalesce(registration->>'display_name', '')), '');
  country_clean := nullif(trim(coalesce(registration->>'country', '')), '');
  city_clean := nullif(trim(coalesce(registration->>'city', '')), '');
  role_clean := nullif(trim(coalesce(registration->>'role', '')), '');
  configuration_clean := nullif(trim(coalesce(registration->>'configuration', '')), '');

  if display_name_clean is null then
    raise exception 'Display Name is required.';
  end if;

  if country_clean is null then
    raise exception 'Country is required.';
  end if;

  if city_clean is null then
    raise exception 'City is required.';
  end if;

  if role_clean is null then
    raise exception 'Role is required.';
  end if;

  if configuration_clean is null then
    raise exception 'Configuration is required.';
  end if;

  select coalesce(array_agg(value), '{}')
  into sports
  from jsonb_array_elements_text(coalesce(registration->'sport_tags', '[]'::jsonb)) as value;

  select coalesce(array_agg(value), '{}')
  into devices
  from jsonb_array_elements_text(coalesce(registration->'device_tags', '[]'::jsonb)) as value;

  insert into public.registry_records (
    registry_number,
    display_name,
    country,
    role,
    configuration,
    status,
    activated_at
  )
  values (
    registry_id,
    display_name_clean,
    country_clean,
    role_clean,
    configuration_clean,
    'Active',
    now()
  );

  insert into public.registry_private_details (
    registry_number,
    city,
    industry,
    sport_tags,
    device_tags,
    contact_method,
    contact_detail,
    social_media,
    profile_photo_url,
    short_intro
  )
  values (
    registry_id,
    city_clean,
    nullif(trim(coalesce(registration->>'industry', '')), ''),
    sports,
    devices,
    nullif(trim(coalesce(registration->>'contact_method', '')), ''),
    nullif(trim(coalesce(registration->>'contact_detail', '')), ''),
    nullif(trim(coalesce(registration->>'social_media', '')), ''),
    nullif(trim(coalesce(registration->>'profile_photo_url', '')), ''),
    nullif(trim(coalesce(registration->>'short_intro', '')), '')
  );

  return jsonb_build_object(
    'registry_number', registry_id,
    'status', 'Active'
  );
exception
  when unique_violation then
    raise exception 'This Registry Number has already been activated.';
end;
$$;

revoke all on function public.activate_registry_record(jsonb) from public;
grant execute on function public.activate_registry_record(jsonb) to anon, authenticated;

insert into public.registry_records (
  registry_number,
  display_name,
  country,
  role,
  configuration,
  status,
  activated_at
)
values (
  '0171',
  'MZ',
  'China',
  'Founder',
  'Type A / Blue Lens',
  'Origin',
  now()
)
on conflict (registry_number) do nothing;
