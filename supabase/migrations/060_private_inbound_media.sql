-- Keep newly received customer attachments out of the public chat-media bucket.
-- The webhook writes with the service role; authenticated users read through
-- /api/whatsapp/media/stored after their account membership is checked.
-- Existing objects in chat-media are not moved by this migration.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'inbound-media', 'inbound-media', FALSE, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'chat-media'
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
