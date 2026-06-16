-- Migration v12: Support up to 4 images per image proof
-- Adds a content_urls TEXT[] column alongside the existing content_url column.
-- content_url is kept for backward-compat with existing single-image proofs.
-- New submissions will populate content_urls; content_url is set to the first URL.

ALTER TABLE proofs
  ADD COLUMN IF NOT EXISTS content_urls TEXT[] DEFAULT NULL;

COMMENT ON COLUMN proofs.content_urls IS
  'Ordered array of up to 4 public storage URLs for image proofs. '
  'Null for text/link proofs or legacy single-image proofs.';
