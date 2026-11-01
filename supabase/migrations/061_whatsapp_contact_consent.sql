-- A saved phone number is not proof that the person agreed to receive
-- business-initiated WhatsApp messages. Existing contacts start without
-- recorded permission and must be reviewed before a campaign can send.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source TEXT;

COMMENT ON COLUMN contacts.whatsapp_opted_in_at IS
  'When staff recorded the person''s permission for business-initiated WhatsApp messages. NULL means no recorded permission.';
COMMENT ON COLUMN contacts.whatsapp_opted_out_at IS
  'When the person asked to stop business-initiated WhatsApp messages. Any non-NULL value blocks campaigns until fresh permission is recorded.';
COMMENT ON COLUMN contacts.whatsapp_consent_source IS
  'Staff-entered description of where explicit WhatsApp permission was obtained.';
