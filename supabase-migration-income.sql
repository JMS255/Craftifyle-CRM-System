-- Add income tracking columns to bookings
-- Run this in Supabase SQL Editor

alter table bookings
  add column if not exists craftifyle_income numeric(10,2) default 0,
  add column if not exists personal_income numeric(10,2) default 0;
