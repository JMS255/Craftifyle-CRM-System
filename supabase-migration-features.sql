-- Takeover toggle: James can mute Crafty per lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crafty_active boolean DEFAULT true;

-- Track when last follow-up was sent (for auto follow-up cron)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_followup_sent timestamptz;
