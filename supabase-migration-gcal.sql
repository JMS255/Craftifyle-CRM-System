-- Store Google Calendar event ID on bookings for update/delete
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gcal_event_id text;
