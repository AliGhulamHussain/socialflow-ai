-- SocialFlow AI schema

CREATE TABLE IF NOT EXISTS content_pieces (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter')),
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'rejected')),
  auto_publish BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  published_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_status ON content_pieces (status);
CREATE INDEX IF NOT EXISTS idx_content_platform ON content_pieces (platform);