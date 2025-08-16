-- Enable uuid generator for future IDs via gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Case-insensitive text (useful later for emails/usernames)
CREATE EXTENSION IF NOT EXISTS "citext";
