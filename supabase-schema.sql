-- Craftifyle CRM Schema
-- Run this in your Supabase SQL Editor

-- LEADS: every inquiry that comes in
create table leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  email text,
  facebook text,
  event_type text, -- wedding, birthday, debut, corporate, christmas_party, reunion, baptism, other
  event_date date,
  venue text,
  guest_count integer,
  package text,
  budget numeric(10,2),
  status text default 'new', -- new, contacted, quoted, negotiating, booked, lost, completed
  source text default 'facebook', -- facebook, instagram, referral, walk-in, website, tiktok, other
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BOOKINGS: confirmed events (converted from leads)
create table bookings (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references leads(id) on delete set null,
  event_name text not null,
  event_date date not null,
  event_time text,
  venue text,
  package_name text,
  package_price numeric(10,2),
  deposit_amount numeric(10,2) default 0,
  deposit_paid boolean default false,
  deposit_paid_date date,
  balance_amount numeric(10,2) default 0,
  balance_paid boolean default false,
  balance_paid_date date,
  status text default 'upcoming', -- upcoming, completed, cancelled
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ACTIVITIES: notes, calls, messages, follow-ups on a lead
create table activities (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references leads(id) on delete cascade,
  type text not null, -- note, call, message, follow_up
  content text not null,
  follow_up_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Auto-update updated_at on leads
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads
  for each row execute function update_updated_at();

create trigger bookings_updated_at before update on bookings
  for each row execute function update_updated_at();

-- Indexes for performance
create index on leads(status);
create index on leads(event_date);
create index on leads(created_at desc);
create index on bookings(event_date);
create index on bookings(status);
create index on activities(lead_id);
