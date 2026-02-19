// ─── Sunrise Encryption Module ──────────────────────────────────────────────
// Uses Web Crypto API: PBKDF2 for key derivation, AES-256-GCM for encryption.
// All operations happen client-side. The password never leaves the browser.

const SunriseCrypto = (() => {

  // ── Encoding helpers ──

  function strToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  function bufferToStr(buf) {
    return new TextDecoder().decode(buf);
  }

  function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ── Core functions ──

  function generateSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return bufferToBase64(salt);
  }

  async function deriveKey(password, saltBase64) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      strToBuffer(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const salt = base64ToBuffer(saltBase64);

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 600000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(plaintext, cryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      strToBuffer(plaintext)
    );
    return {
      ciphertext: bufferToBase64(ciphertext),
      iv: bufferToBase64(iv)
    };
  }

  async function decrypt(ciphertextBase64, ivBase64, cryptoKey) {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      ciphertext
    );
    return bufferToStr(decrypted);
  }

  return { generateSalt, deriveKey, encrypt, decrypt };

})();
