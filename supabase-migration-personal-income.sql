-- Personal income tracking (separate from Craftifyle business income)
-- Run this in Supabase SQL Editor

create table personal_income (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric(10,2) not null,
  income_date date not null,
  category text default 'other', -- tips, personal_gig, salary, freelance, other
  notes text,
  created_at timestamptz default now()
);

create index on personal_income(income_date desc);
