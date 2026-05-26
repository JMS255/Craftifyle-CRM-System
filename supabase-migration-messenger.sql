-- Stores Messenger conversation history per sender
CREATE TABLE IF NOT EXISTS messenger_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messenger_sender ON messenger_conversations(sender_id, created_at);
