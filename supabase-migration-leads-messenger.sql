-- Add messenger_sender_id to leads for linking Messenger chats to CRM leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS messenger_sender_id text UNIQUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_ref text;

CREATE INDEX IF NOT EXISTS idx_leads_messenger_sender ON leads(messenger_sender_id);
