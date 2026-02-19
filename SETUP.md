# Sunrise — Security Setup Guide

This guide walks you through setting up Supabase for authentication and encrypted cloud storage.

---

## 1. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) and sign in (or create a free account)
2. Click **New Project**
3. Choose your organization, give it a name (e.g. "sunrise"), and set a database password
4. Wait for the project to finish provisioning (~1 minute)

## 2. Create the Database Tables

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New query** and paste the following SQL:

```sql
-- Journal entries (stores encrypted data only)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date_key TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date_key)
);

-- User encryption profile (stores the salt used to derive the encryption key)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encryption_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security: users can only access their own data
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries"
  ON entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Performance index
CREATE INDEX idx_entries_user_date ON entries(user_id, date_key);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

3. Click **Run** — you should see "Success" for each statement

## 3. Get Your API Credentials

1. Go to **Settings** > **API** (in the left sidebar under Configuration)
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
3. Copy the **anon public** key (the long string under "Project API keys")

## 4. Add Credentials to the App

1. Open `supabase-client.js` in a text editor
2. Replace the placeholder values at the top:

```javascript
const SUPABASE_URL  = 'https://your-project-id.supabase.co';
const SUPABASE_ANON = 'your-anon-key-here';
```

These are safe to include in your code — Row Level Security protects your data.

## 5. Create Your User Account

1. In Supabase, go to **Authentication** > **Users**
2. Click **Add user** > **Create new user**
3. Enter your email and a strong password
4. Uncheck "Auto Confirm User" if you want email verification, or leave it checked for immediate access
5. Click **Create user**

This is the only account for the app. The app only has a sign-in form (no sign-up), so no one else can create accounts.

## 6. (Optional) Disable Email Confirmations

If you want to skip email verification (since you're the only user):

1. Go to **Authentication** > **Providers** > **Email**
2. Toggle off **Confirm email**
3. Click **Save**

## 7. Deploy

Push your changes to GitHub and deploy via GitHub Pages (or Vercel) as before. The app will now show a login screen before granting access to your journal.

---

## How the Encryption Works

- Your password is used to derive an encryption key (PBKDF2 with 600,000 iterations)
- Each journal entry is encrypted with AES-256-GCM before being sent to Supabase
- A unique random IV (initialization vector) is generated per entry
- The encryption key only exists in your browser's memory — it is never stored or transmitted
- Even Supabase admins cannot read your journal entries
- On page refresh, you re-enter your password to re-derive the key

## Troubleshooting

**"Invalid login credentials"** — Check your email and password. Ensure the user exists in Supabase Authentication > Users.

**"Failed to fetch"** — Check that your `SUPABASE_URL` is correct and your internet connection is active.

**Entries not loading after refresh** — You need to re-enter your password. This is by design — the encryption key is not persisted for security.
