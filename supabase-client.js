// ─── Sunrise Supabase Client ────────────────────────────────────────────────
// Handles authentication, encrypted entry storage, and data sync.
// Requires: supabase.min.js (UMD), crypto.js (SunriseCrypto)

// ⚠️  Replace these with your Supabase project credentials (see SETUP.md)
const SUPABASE_URL  = 'https://devunbqmfjbtdpinfcav.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldnVuYnFtZmpidGRwaW5mY2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDM0NzQsImV4cCI6MjA4NzAxOTQ3NH0.76WY1L8h83McZw3YNOG4YUC1jQRWue-VOvt3mKG7HTM';

const SunriseDB = (() => {

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // In-memory state — never persisted to disk
  let _cryptoKey = null;
  let _entriesCache = {};
  let _user = null;

  // ── Auth ──

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    _user = data.user;

    // Fetch or create encryption profile
    const salt = await getOrCreateProfile(_user.id);
    _cryptoKey = await SunriseCrypto.deriveKey(password, salt);

    // Load all entries into memory
    await fetchAllEntries();
    return _user;
  }

  async function signOut() {
    await supabase.auth.signOut();
    _cryptoKey = null;
    _entriesCache = {};
    _user = null;
  }

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      _user = data.session.user;
    }
    return data.session;
  }

  async function unlockWithPassword(password) {
    const session = await getSession();
    if (!session) throw new Error('No active session');

    _user = session.user;
    const salt = await getOrCreateProfile(_user.id);
    _cryptoKey = await SunriseCrypto.deriveKey(password, salt);

    await fetchAllEntries();
  }

  function getUser() { return _user; }
  function getCryptoKey() { return _cryptoKey; }

  // ── Profile (encryption salt) ──

  async function getOrCreateProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('encryption_salt')
      .eq('id', userId)
      .single();

    if (data && data.encryption_salt) {
      return data.encryption_salt;
    }

    // First login — generate a new salt
    const salt = SunriseCrypto.generateSalt();
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({ id: userId, encryption_salt: salt });

    if (insertError) throw insertError;
    return salt;
  }

  // ── Entries ──

  async function fetchAllEntries() {
    const { data, error } = await supabase
      .from('entries')
      .select('date_key, encrypted_data, iv')
      .eq('user_id', _user.id)
      .order('date_key', { ascending: false });

    if (error) throw error;

    _entriesCache = {};
    for (const row of (data || [])) {
      try {
        const json = await SunriseCrypto.decrypt(row.encrypted_data, row.iv, _cryptoKey);
        _entriesCache[row.date_key] = JSON.parse(json);
      } catch (e) {
        console.warn('Failed to decrypt entry for', row.date_key, e);
      }
    }
  }

  function getEntries() {
    return Object.assign({}, _entriesCache);
  }

  async function saveEntry(dateKey, entryData) {
    const json = JSON.stringify(entryData);
    const { ciphertext, iv } = await SunriseCrypto.encrypt(json, _cryptoKey);

    const { error } = await supabase
      .from('entries')
      .upsert({
        user_id: _user.id,
        date_key: dateKey,
        encrypted_data: ciphertext,
        iv: iv,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,date_key' });

    if (error) throw error;
    _entriesCache[dateKey] = entryData;
  }

  async function deleteAllEntries() {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('user_id', _user.id);

    if (error) throw error;
    _entriesCache = {};
  }

  // ── Migration from localStorage ──

  function hasLocalStorageEntries() {
    try {
      const raw = localStorage.getItem('sunrise_entries');
      if (!raw) return { found: false, count: 0 };
      const entries = JSON.parse(raw);
      const count = Object.keys(entries).length;
      return { found: count > 0, count: count };
    } catch {
      return { found: false, count: 0 };
    }
  }

  async function importLocalStorageEntries() {
    const raw = localStorage.getItem('sunrise_entries');
    if (!raw) return 0;

    const entries = JSON.parse(raw);
    const keys = Object.keys(entries);

    for (const dateKey of keys) {
      await saveEntry(dateKey, entries[dateKey]);
    }

    localStorage.removeItem('sunrise_entries');
    return keys.length;
  }

  return {
    signIn, signOut, getSession, getUser, getCryptoKey,
    unlockWithPassword,
    getEntries, saveEntry, deleteAllEntries,
    hasLocalStorageEntries, importLocalStorageEntries
  };

})();
