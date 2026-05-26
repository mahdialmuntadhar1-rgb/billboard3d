-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country);
CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON businesses(is_active);
CREATE INDEX IF NOT EXISTS idx_businesses_rating ON businesses(rating);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);

-- Sample data (optional - for testing)
INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES 
('admin-123', 'admin@billboard3d.com', 'admin-hash', 'admin', datetime('now'), datetime('now'))
ON CONFLICT(email) DO NOTHING;

INSERT INTO businesses (
  id, name, description, category, city, country, website, email, phone, address, 
  rating, review_count, is_active, created_at, updated_at
) VALUES 
(
  'biz-001', 
  'Billboard Advertising Co.', 
  'Professional billboard advertising services across Iraq',
  'Advertising', 
  'Baghdad', 
  'Iraq',
  'https://billboard3d.com',
  'info@billboard3d.com',
  '+964-1-234-5678',
  'Main Street, Baghdad',
  4.5,
  127,
  1,
  datetime('now'),
  datetime('now')
),
(
  'biz-002', 
  'Digital Media Solutions', 
  'Digital and traditional advertising solutions',
  'Marketing', 
  'Erbil', 
  'Iraq',
  'https://digitalmedia.iq',
  'contact@digitalmedia.iq',
  '+964-66-123-4567',
  'Erbil Business District',
  4.2,
  89,
  1,
  datetime('now'),
  datetime('now')
)
ON CONFLICT(id) DO NOTHING;
