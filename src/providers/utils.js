const enc = new TextEncoder();
const dec = new TextDecoder();

export async function getKeyFromPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = enc.encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
}

export async function decrypt(encryptedData, iv, key) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(encryptedData)
    );
    return dec.decode(decrypted);
  } catch (e) {
    return null;
  }
}

export const filterSensitiveData = (text) => {
  if (!text) return text;
  let filtered = text.replace(/(\+?7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, '🔒');
  filtered = filtered.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '🔒');
  return filtered;
};

export const parseGifUrl = async (link) => {
  if (!link) return null;
  const cacheKey = `gif_${link}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return cached;

  if (link.match(/\.(gif)$/i)) {
    sessionStorage.setItem(cacheKey, link);
    return link;
  }

  if (link.includes('tenor.com/view/') || link.includes('giphy.com/')) {
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(link)}`;
      const res = await fetch(proxy);
      if (!res.ok) return null;
      const data = await res.json();
      const html = data.contents;
      let gifUrl = null;

      if (link.includes('tenor.com')) {
        const match = html.match(/<script id="gif-json" type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (match && match[1]) {
          const json = JSON.parse(match[1]);
          gifUrl = json.contentUrl;
        }
      } else if (link.includes('giphy.com')) {
        const match = html.match(/<meta\s*property="og:image"\s*content="([^"]+)"/i);
        if (match && match[1]) {
          gifUrl = match[1];
        }
      }

      if (gifUrl) {
        sessionStorage.setItem(cacheKey, gifUrl);
        return gifUrl;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const generateId = () => {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export const generateFolderName = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- Key Manager Specific Encryption ---

export const generateSalt = () => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const encryptKMData = async (dataObj, password) => {
  const salt = generateSalt();
  const key = await getKeyFromPassword(password, salt);
  const jsonStr = JSON.stringify(dataObj);
  const { iv, encrypted } = await encrypt(jsonStr, key);
  return JSON.stringify({ salt, iv, encrypted });
};

export const decryptKMData = async (encryptedJsonStr, password) => {
  try {
    const payload = JSON.parse(encryptedJsonStr);
    if (!payload.salt || !payload.iv || !payload.encrypted) return null;
    
    const key = await getKeyFromPassword(password, payload.salt);
    const decryptedStr = await decrypt(payload.encrypted, payload.iv, key);
    if (!decryptedStr) return null;
    return JSON.parse(decryptedStr);
  } catch (e) {
    return null;
  }
};

// --- Ping Measurement ---

export const measurePing = async (url) => {
  if (!url) return null;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  const start = performance.now();
  
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    const end = performance.now();
    clearTimeout(timeoutId);
    return Math.round(end - start);
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
};