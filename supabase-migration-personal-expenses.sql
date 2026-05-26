-- Personal expenses tracking
-- Run this in Supabase SQL Editor

create table personal_expenses (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric(10,2) not null,
  expense_date date not null,
  category text default 'other', -- food, transport, equipment, bills, personal, other
  notes text,
  created_at timestamptz default now()
);

create index on personal_expenses(expense_date desc);
