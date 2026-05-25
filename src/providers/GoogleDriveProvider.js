import React from 'react';
import { CloudProvider } from './CloudProvider';
import { getKeyFromPassword, encrypt, decrypt, generateId, generateFolderName } from './utils';

export class GoogleDriveProvider extends CloudProvider {
  
  static getOAuthUrl(clientId, redirectUri) {
    return `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/drive&state=google`;
  }

  static linkGetPing() {
    return 'https://www.google.com/favicon.ico';
  }

  static getStyle() {
    return {
      name: 'Google Drive',
      colorClass: 'googleBtn',
    };
  }

  isPublicFolder() { return false; }

  _fetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
    });
  }

  async _findFileId(parentId, fileName) {
    try {
      const query = encodeURIComponent(`name='${fileName}' and '${parentId}' in parents and trashed=false`);
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.files && data.files.length > 0 ? data.files[0].id : null;
    } catch (e) {
      console.error("Find File Error:", e);
      return null;
    }
  }

  async _createFolder(name, parentId = null) {
    try {
      const body = { name, mimeType: 'application/vnd.google-apps.folder' };
      if (parentId) body.parents = [parentId];
      const res = await this._fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async _uploadFileRaw(parentId, name, content, contentType = 'application/json') {
    try {
      const existingId = await this._findFileId(parentId, name);
      if (existingId) {
         const res = await this._fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
             method: 'PATCH', body: content, headers: { 'Content-Type': contentType }
         });
         if (!res.ok) return null;
         return { id: existingId, name };
      }

      const boundary = 'elysium_boundary_' + Math.random().toString(36).substring(2);
      const metadata = { name, parents: [parentId] };
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`, content, `\r\n--${boundary}--`
      ]);
      const res = await this._fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', body: body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return { id: data.id, name };
    } catch (e) { return null; }
  }

  async _downloadFileRaw(fileId) {
    try {
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) { return null; }
  }

  async deleteResource(fileId) {
    if (!fileId) return false;
    try {
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
      return res.ok || res.status === 204;
    } catch (e) { 
      console.error("Delete Error:", e);
      return false; 
    }
  }

  async getUserInfo() {
    const res = await this._fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)');
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.user.emailAddress, name: data.user.displayName };
  }

  async listChats() {
    try {
      let query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents");
      let res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
      if (!res.ok) return [];
      let folders = (await res.json()).files || [];

      query = encodeURIComponent("sharedWithMe=true and mimeType='application/vnd.google-apps.folder' and trashed=false");
      res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
      if (res.ok) folders = [...folders, ...(await res.json()).files || []];

      const chats = [];
      for (const f of folders) {
        const hasMarker = await this._findFileId(f.id, '.elysium.bin');
        if (hasMarker) {
          let name = "Unnamed Chat";
          const nameId = await this._findFileId(f.id, 'name.json');
          if (nameId) {
            try {
              const blob = await this._downloadFileRaw(nameId);
              if (blob) {
                const text = await blob.text();
                const json = JSON.parse(text);
                name = json.name || name;
              }
            } catch(e) {}
          }
          
          let lastMessageTime = null;
          const lastMsgId = await this._findFileId(f.id, 'lastmsg.json');
          if (lastMsgId) {
            try {
              const blob = await this._downloadFileRaw(lastMsgId);
              if (blob) {
                const text = await blob.text();
                const json = JSON.parse(text);
                lastMessageTime = json.timestamp || null;
              }
            } catch(e) {}
          }

          chats.push({ id: f.id, name, lastMessageTime });
        }
      }
      return Array.from(new Map(chats.map(c => [c.id, c])).values());
    } catch (e) { return []; }
  }

  async createChat(name, options = {}) {
    const { password, description, participants, avatar, privateAvatar } = options;
    const folderName = generateFolderName();
    const main = await this._createFolder(folderName);
    if (!main) return null;

    await this._createFolder('messages', main.id);
    await this._createFolder('files', main.id);
    await this._createFolder('users', main.id);
    await this._uploadFileRaw(main.id, '.elysium.bin', '');
    await this._uploadFileRaw(main.id, 'name.json', JSON.stringify({ name }));

    let salt = null;
    if (password) {
      salt = `elysium_${name}_${Date.now()}`;
      const key = await getKeyFromPassword(password, salt);
      const infoPayload = { description: description || '', createdAt: new Date().toISOString() };
      const encInfo = await encrypt(JSON.stringify(infoPayload), key);
      await this._uploadFileRaw(main.id, 'info.json', JSON.stringify({ salt, iv: encInfo.iv, encrypted: encInfo.encrypted }));
    }

    if (avatar) {
      const arr = await avatar.arrayBuffer();
      await this._uploadFileRaw(main.id, `public_avatar.${avatar.name.split('.').pop()}`, new Uint8Array(arr), avatar.type);
    }

    if (privateAvatar && password && salt) {
       const key = await getKeyFromPassword(password, salt);
       const arr = await privateAvatar.arrayBuffer();
       const bytes = new Uint8Array(arr);
       const iv = crypto.getRandomValues(new Uint8Array(12));
       const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
       const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), type: privateAvatar.type, name: privateAvatar.name });
       await this._uploadFileRaw(main.id, 'private_avatar.enc', payload);
    }

    if (participants && participants.length > 0) await this.addParticipant(main.id, participants);
    return { id: main.id, name };
  }

  async deleteChat(chatId) { await this._fetch(`https://www.googleapis.com/drive/v3/files/${chatId}`, { method: 'DELETE' }); return true; }
  
  async renameChat(chatId, newName) {
    await this._uploadFileRaw(chatId, 'name.json', JSON.stringify({ name: newName }));
    return true;
  }

  async getMessages(chatId, key, lastTimestamp) {
    let msgFolderId = await this._findFileId(chatId, 'messages');
    if (!msgFolderId) return [];
    let query = `'${msgFolderId}' in parents and trashed=false`;
    
    try {
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime&fields=files(id)`);
      if (!res.ok) return [];
      const files = (await res.json()).files || [];
      const messages = [];
      
      for (const f of files) {
        try {
          const blob = await this._downloadFileRaw(f.id);
          if (!blob) continue;
          const text = await blob.text();
          const raw = JSON.parse(text);
          if (raw.iv && raw.encrypted) {
            const str = await decrypt(raw.encrypted, raw.iv, key);
            if (str) {
              const msg = JSON.parse(str);
              msg._fileId = f.id;
              messages.push(msg);
            }
          }
        } catch (e) { console.warn("Failed to process message file", f.id, e); }
      }

      let filteredMessages = messages;
      if (lastTimestamp) {
        filteredMessages = messages.filter(m => new Date(m.timestamp) > new Date(lastTimestamp));
      }
      
      return filteredMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (e) { 
      console.error("GetMessages Critical Error:", e);
      return []; 
    }
  }

  async sendMessage(chatId, message, key) {
    let msgFolderId = await this._findFileId(chatId, 'messages');
    if (!msgFolderId) msgFolderId = (await this._createFolder('messages', chatId)).id;
    
    const { iv, encrypted } = await encrypt(JSON.stringify(message), key);
    const safeName = message.id.replace(/:/g, '-') + '.json';
    const result = await this._uploadFileRaw(msgFolderId, safeName, JSON.stringify({ iv, encrypted }));
    
    if (result) {
      await this._uploadFileRaw(chatId, 'lastmsg.json', JSON.stringify({ timestamp: message.timestamp }));
    }
    
    return result ? result.id : null;
  }

  async uploadFile(chatId, file, fileName, key) {
    let filesFolderId = await this._findFileId(chatId, 'files');
    if (!filesFolderId) filesFolderId = (await this._createFolder('files', chatId)).id;
    const arr = await file.arrayBuffer();
    const bytes = new Uint8Array(arr);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), originalName: fileName, mimeType: file.type });
    const encName = `${Date.now()}_${fileName}.enc.json`;
    const result = await this._uploadFileRaw(filesFolderId, encName, payload);
    return result ? { id: result.id, name: encName, originalName: fileName, mimeType: file.type } : null;
  }

  async downloadFile(fileId, key) {
    const blob = await this._downloadFileRaw(fileId);
    if (!blob) return null;
    try {
      const text = await blob.text();
      const raw = JSON.parse(text);
      if (!raw.iv || !raw.encrypted) return null;
      const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
      return new Blob([decBuf], { type: raw.mimeType || 'application/octet-stream' });
    } catch (e) { return null; }
  }

  async getChatInfo(chatId, password) {
    const infoId = await this._findFileId(chatId, 'info.json');
    if (!infoId) return null;
    const blob = await this._downloadFileRaw(infoId);
    if (!blob) return null;
    const text = await blob.text();
    const json = JSON.parse(text);
    if (!json.salt) return null;
    const result = { salt: json.salt, description: '' };
    if (json.iv && json.encrypted) {
      const key = await getKeyFromPassword(password, json.salt);
      const decryptedStr = await decrypt(json.encrypted, json.iv, key);
      if (!decryptedStr) return null;
      try {
        result.description = JSON.parse(decryptedStr).description || '';
      } catch (e) {
        return null;
      }
    }
    return result;
  }

  async updateChatInfo(chatId, password, updates) {
    const infoId = await this._findFileId(chatId, 'info.json');
    if (!infoId) return false;
    const blob = await this._downloadFileRaw(infoId);
    const text = await blob.text();
    const json = JSON.parse(text);
    const key = await getKeyFromPassword(password, json.salt);
    let currentData = {};
    if (json.iv && json.encrypted) {
        const str = await decrypt(json.encrypted, json.iv, key);
        if(str) currentData = JSON.parse(str);
    }
    const updatedData = { ...currentData, ...updates, updatedAt: new Date().toISOString() };
    const encrypted = await encrypt(JSON.stringify(updatedData), key);
    const payload = JSON.stringify({ salt: json.salt, iv: encrypted.iv, encrypted: encrypted.encrypted });
    const res = await this._fetch(`https://www.googleapis.com/upload/drive/v3/files/${infoId}?uploadType=media`, { method: 'PATCH', body: payload, headers: { 'Content-Type': 'application/json' } });
    return res.ok;
  }

  async getPublicAvatar(chatId) {
    try {
      const query = encodeURIComponent(`name contains 'public_avatar.' and '${chatId}' in parents and trashed=false`);
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
      if (!res.ok) return null;
      
      const files = (await res.json()).files;
      if (!files || files.length === 0) return null;
      
      const fileId = files[0].id;
      const blob = await this._downloadFileRaw(fileId);
      if (blob) return URL.createObjectURL(blob);
    } catch (e) { 
      console.error("GetPublicAvatar error:", e);
    }
    return null;
  }
  
  async getPrivateAvatarUrl(chatId, key) {
    const id = await this._findFileId(chatId, 'private_avatar.enc');
    if (!id) return null;
    const blob = await this._downloadFileRaw(id);
    if (!blob) return null;
    try {
        const text = await blob.text();
        const raw = JSON.parse(text);
        const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
        return URL.createObjectURL(new Blob([decBuf], { type: raw.type || 'image/jpeg' }));
    } catch(e) { return null; }
  }

  async updateChatAvatar(chatId, password, file, isPublic) {
    const infoId = await this._findFileId(chatId, 'info.json');
    if (!infoId) return false;
    const infoBlob = await this._downloadFileRaw(infoId);
    const infoText = await infoBlob.text();
    const infoJson = JSON.parse(infoText);
    const key = await getKeyFromPassword(password, infoJson.salt);
    
    if (isPublic) {
      const query = encodeURIComponent(`name contains 'public_avatar.' and '${chatId}' in parents and trashed=false`);
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
      if (res.ok) {
        const files = (await res.json()).files || [];
        for (const f of files) await this.deleteResource(f.id);
      }
    } else {
      const oldPrivId = await this._findFileId(chatId, 'private_avatar.enc');
      if (oldPrivId) await this.deleteResource(oldPrivId);
    }

    const arr = await file.arrayBuffer();
    const bytes = new Uint8Array(arr);
    if (isPublic) {
      await this._uploadFileRaw(chatId, `public_avatar.${file.name.split('.').pop()}`, bytes, file.type);
    } else {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), type: file.type, name: file.name });
      await this._uploadFileRaw(chatId, 'private_avatar.enc', payload);
    }
    return true;
  }

  async addParticipant(chatId, emails) {
    const list = Array.isArray(emails) ? emails : [emails];
    for (const email of list) {
      await this._fetch(`https://www.googleapis.com/drive/v3/files/${chatId}/permissions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email })
      });
    }
    return true;
  }

  async saveUserProfile(chatId, password, email, profileData) {
    const infoId = await this._findFileId(chatId, 'info.json');
    const infoBlob = await this._downloadFileRaw(infoId);
    const { salt } = JSON.parse(await infoBlob.text());
    const key = await getKeyFromPassword(password, salt);

    let usersFolderId = await this._findFileId(chatId, 'users');
    if (!usersFolderId) usersFolderId = (await this._createFolder('users', chatId)).id;

    let registry = {};
    let regFileId = await this._findFileId(usersFolderId, 'users.json');
    if (regFileId) {
      const regBlob = await this._downloadFileRaw(regFileId);
      const regRaw = JSON.parse(await regBlob.text());
      if (regRaw.encrypted) {
        const dec = await decrypt(regRaw.encrypted, regRaw.iv, key);
        if (dec) registry = JSON.parse(dec);
      }
    }

    let userFolderId = registry[email];
    if (!userFolderId) {
      const folder = await this._createFolder(generateId(), usersFolderId);
      userFolderId = folder.id;
      registry[email] = userFolderId;
      const encReg = await encrypt(JSON.stringify(registry), key);
      await this._uploadFileRaw(usersFolderId, 'users.json', JSON.stringify({ iv: encReg.iv, encrypted: encReg.encrypted }));
    }

    if (profileData.name) {
      const encName = await encrypt(profileData.name, key);
      await this._uploadFileRaw(userFolderId, 'name.txt', JSON.stringify({ iv: encName.iv, encrypted: encName.encrypted }));
    }
    if (profileData.avatar) {
      const arr = await profileData.avatar.arrayBuffer();
      const bytes = new Uint8Array(arr);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encAv = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encAv)), type: profileData.avatar.type, name: profileData.avatar.name });
      await this._uploadFileRaw(userFolderId, `icon.${profileData.avatar.name.split('.').pop()}`, payload);
    }
    return true;
  }

  async getAllUserProfiles(chatId, password) {
    const infoId = await this._findFileId(chatId, 'info.json');
    const infoBlob = await this._downloadFileRaw(infoId);
    const { salt } = JSON.parse(await infoBlob.text());
    const key = await getKeyFromPassword(password, salt);

    const usersFolderId = await this._findFileId(chatId, 'users');
    if (!usersFolderId) return {};

    const regFileId = await this._findFileId(usersFolderId, 'users.json');
    if (!regFileId) return {};

    const regBlob = await this._downloadFileRaw(regFileId);
    const regRaw = JSON.parse(await regBlob.text());
    const decryptedText = await decrypt(regRaw.encrypted, regRaw.iv, key);
    if (!decryptedText) return {};
    const registry = JSON.parse(decryptedText);

    const profiles = {};
    for (const email of Object.keys(registry)) {
      const userFolderId = registry[email];
      const profile = { name: email.split('@')[0], avatarUrl: null };
      const nameId = await this._findFileId(userFolderId, 'name.txt');
      if (nameId) {
        const nameBlob = await this._downloadFileRaw(nameId);
        if (nameBlob) {
          const nameRaw = JSON.parse(await nameBlob.text());
          profile.name = await decrypt(nameRaw.encrypted, nameRaw.iv, key);
        }
      }
      const q = encodeURIComponent(`name contains 'icon.' and '${userFolderId}' in parents and trashed=false`);
      const res = await this._fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const iconBlob = await this._downloadFileRaw(data.files[0].id);
        if (iconBlob) {
          const iconRaw = JSON.parse(await iconBlob.text());
          try {
            const decBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iconRaw.iv) }, key, new Uint8Array(iconRaw.encrypted));
            profile.avatarUrl = URL.createObjectURL(new Blob([decBuffer], { type: iconRaw.type || 'image/jpeg' }));
          } catch(e) {}
        }
      }
      profiles[email] = profile;
    }
    return profiles;
  }
}