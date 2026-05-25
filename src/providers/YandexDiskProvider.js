import React from 'react';
import { CloudProvider } from './CloudProvider';
import { getKeyFromPassword, encrypt, decrypt, generateId, generateFolderName } from './utils';

export class YandexDiskProvider extends CloudProvider {
  static getOAuthUrl(clientId, redirectUri) {
    const scope = 'cloud_api:disk.read cloud_api:disk.write';
    return `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=yandex`;
  }

  static linkGetPing() {
    return 'https://yandex.ru/favicon.ico';
  }

  static getStyle() {
    return {
      name: 'Yandex Disk',
      colorClass: 'yandexBtn',
    };
  }

  isPublicFolder() { return true; }

  _fetch(url, options = {}) { return fetch(url, { ...options, headers: { ...options.headers, Authorization: `OAuth ${this.token}` } }); }

  _normalizePath(path) {
    if (!path) return '/';
    let p = path.replace(/^(disk:|app:)/, ''); 
    p = p.replace(/\/+/g, '/');
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  }

  async _findFileId(parentId, fileName) {
    const path = this._normalizePath(`${parentId}/${fileName}`);
    const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`);
    return res.status === 200 ? path : null;
  }
  
  async _createFolder(name, parentId = null) {
    let path = parentId ? `${parentId}/${name}` : name;
    path = this._normalizePath(path);
    try {
      const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`, { method: 'PUT' });
      if (res.ok || res.status === 409) return { id: path, name };
      return null;
    } catch (e) { return null; }
  }

  async _uploadFileRaw(parentId, name, content, contentType = 'application/json') {
    const path = this._normalizePath(`${parentId}/${name}`);
    try {
      const uplRes = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`);
      if (!uplRes.ok) return null;
      const { href } = await uplRes.json();
      const res = await fetch(href, { method: 'PUT', body: content, headers: { 'Content-Type': contentType } });
      return (res.ok || res.status === 201) ? { id: path, name } : null;
    } catch(e) { return null; }
  }

  async _downloadFileRaw(fileId) {
    if (!fileId) return null;
    try {
      const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(fileId)}`);
      if (!res.ok) return null;
      const { href } = await res.json();
      return await (await fetch(href)).blob();
    } catch(e) { return null; }
  }
  
  async _listFiles(folderPath) {
    try {
      const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}&limit=100`);
      if (!res.ok) return [];
      return (await res.json())._embedded?.items || [];
    } catch(e) { return []; }
  }

  async deleteResource(fileId) {
    if (!fileId) return false;
    try {
      const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(fileId)}&permanently=true`, { method: 'DELETE' });
      return res.ok || res.status === 202 || res.status === 204;
    } catch (e) { return false; }
  }

  async getUserInfo() {
    const res = await this._fetch('https://cloud-api.yandex.net/v1/disk');
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.user.login, name: data.user.display_name || data.user.login };
  }

  async listChats() {
    try {
      const res = await this._fetch('https://cloud-api.yandex.net/v1/disk/resources?path=/&limit=1000');
      if (!res.ok) return [];
      const items = (await res.json())._embedded?.items || [];
      const chats = [];
      
      for (const item of items) {
        if (item.type !== 'dir') continue;
        const cleanPath = this._normalizePath(item.path);
        
        const markerCheck = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(cleanPath + '/.elysium.bin')}`);
        if (markerCheck.status === 200) {
          let name = "Unnamed Chat";
          try {
            const nameBlob = await this._downloadFileRaw(`${cleanPath}/name.json`);
            if(nameBlob) {
              const json = JSON.parse(await nameBlob.text());
              name = json.name || name;
            }
          } catch(e) {}

          let lastMessageTime = null;
          try {
            const lastMsgBlob = await this._downloadFileRaw(`${cleanPath}/lastmsg.json`);
            if (lastMsgBlob) {
              const json = JSON.parse(await lastMsgBlob.text());
              lastMessageTime = json.timestamp || null;
            }
          } catch(e) {}

          chats.push({ id: cleanPath, name, lastMessageTime });
        }
      }
      return chats;
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
      const encInfo = await encrypt(JSON.stringify({ description: description || '', createdAt: new Date().toISOString() }), key);
      await this._uploadFileRaw(main.id, 'info.json', JSON.stringify({ salt, iv: encInfo.iv, encrypted: encInfo.encrypted }));
    }
    if (avatar) await this._uploadFileRaw(main.id, `public_avatar.${avatar.name.split('.').pop()}`, new Uint8Array(await avatar.arrayBuffer()), avatar.type);
    if (privateAvatar && password && salt) {
       const key = await getKeyFromPassword(password, salt);
       const bytes = new Uint8Array(await privateAvatar.arrayBuffer());
       const iv = crypto.getRandomValues(new Uint8Array(12));
       const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
       await this._uploadFileRaw(main.id, 'private_avatar.enc', JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), type: privateAvatar.type }));
    }

    if (participants && participants.length > 0) await this.addParticipant(main.id, participants);
    return { id: main.id, name };
  }

  async deleteChat(chatId) { 
    await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(chatId)}&permanently=true`, { method: 'DELETE' }); 
    return true; 
  }
  
  async renameChat(chatId, newName) {
    await this._uploadFileRaw(chatId, 'name.json', JSON.stringify({ name: newName }));
    return true;
  }

  async getMessages(chatId, key, lastTimestamp) {
    try {
      const res = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(chatId + '/messages')}&limit=1000&sort=created`);
      if (!res.ok) return [];
      const items = (await res.json())._embedded?.items || [];
      const messages = [];
      for (const item of items) {
        if (item.type !== 'file' || !item.name.endsWith('.json')) continue;
        
        const blob = await this._downloadFileRaw(item.path);
        if(!blob) continue;
        try {
          const raw = JSON.parse(await blob.text());
          if (raw.iv && raw.encrypted) {
            const str = await decrypt(raw.encrypted, raw.iv, key);
            if (str) {
              const msg = JSON.parse(str);
              msg._fileId = item.path;
              messages.push(msg);
            }
          }
        } catch(e) { /* skip corrupt message */ }
      }

      let filteredMessages = messages;
      if (lastTimestamp) {
        filteredMessages = messages.filter(m => new Date(m.timestamp) > new Date(lastTimestamp));
      }
      
      return filteredMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch(e) { return []; }
  }

  async sendMessage(chatId, message, key) {
    let msgPath = await this._findFileId(chatId, 'messages');
    if (!msgPath) {
       const folder = await this._createFolder('messages', chatId);
       if(!folder) return null;
       msgPath = folder.id;
    }

    const { iv, encrypted } = await encrypt(JSON.stringify(message), key);
    const res = await this._uploadFileRaw(chatId, `messages/${message.id.replace(/:/g, '-')}.json`, JSON.stringify({ iv, encrypted }));
    
    if (res) {
      await this._uploadFileRaw(chatId, 'lastmsg.json', JSON.stringify({ timestamp: message.timestamp }));
    }
    
    return res ? res.id : null;
  }

  async uploadFile(chatId, file, fileName, key) {
    let filesPath = await this._findFileId(chatId, 'files');
    if (!filesPath) {
      const folder = await this._createFolder('files', chatId);
      if(!folder) return null;
      filesPath = folder.id;
    }
    
    const bytes = new Uint8Array(await file.arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), originalName: fileName, mimeType: file.type });
    const res = await this._uploadFileRaw(chatId, `files/${Date.now()}_${fileName}.enc.json`, payload);
    return res ? { id: res.id, name: res.name, originalName: fileName, mimeType: file.type } : null;
  }

  async downloadFile(fileId, key) {
    const blob = await this._downloadFileRaw(fileId);
    if (!blob) return null;
    try {
      const raw = JSON.parse(await blob.text());
      if(!raw.iv || !raw.encrypted) return null;
      const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
      return new Blob([decBuf], { type: raw.mimeType || 'application/octet-stream' });
    } catch(e) { return null; }
  }

  async getChatInfo(chatId, password) {
    const blob = await this._downloadFileRaw(`${chatId}/info.json`);
    if (!blob) return null;
    try {
      const json = JSON.parse(await blob.text());
      if (!json.salt) return null;
      const result = { salt: json.salt, description: '' };
      if (json.iv && json.encrypted) {
        const key = await getKeyFromPassword(password, json.salt);
        const str = await decrypt(json.encrypted, json.iv, key);
        if (!str) return null;
        try {
          result.description = JSON.parse(str).description || '';
        } catch (e) {
          return null;
        }
      }
      return result;
    } catch(e) { return null; }
  }

  async updateChatInfo(chatId, password, updates) {
    const infoBlob = await this._downloadFileRaw(`${chatId}/info.json`);
    if(!infoBlob) return false;
    
    const json = JSON.parse(await infoBlob.text());
    const key = await getKeyFromPassword(password, json.salt);
    let data = json.iv ? JSON.parse(await decrypt(json.encrypted, json.iv, key) || '{}') : {};
    const updated = { ...data, ...updates, updatedAt: new Date().toISOString() };
    const enc = await encrypt(JSON.stringify(updated), key);
    await this._uploadFileRaw(chatId, 'info.json', JSON.stringify({ salt: json.salt, iv: enc.iv, encrypted: enc.encrypted }));
    return true;
  }

  async getPublicAvatar(chatId) {
    try {
      const files = await this._listFiles(chatId);
      const avatarFile = files.find(f => f.name && f.name.startsWith('public_avatar.'));
      
      if (avatarFile) {
        const blob = await this._downloadFileRaw(avatarFile.path);
        if (blob) return URL.createObjectURL(blob);
      }
    } catch (e) { 
      console.error("GetPublicAvatar Yandex error:", e);
    }
    return null;
  }

  async getPrivateAvatarUrl(chatId, key) {
    const id = await this._findFileId(chatId, 'private_avatar.enc');
    if (!id) return null;
    const blob = await this._downloadFileRaw(id);
    if (!blob) return null;
    try {
      const raw = JSON.parse(await blob.text());
      const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
      return URL.createObjectURL(new Blob([decBuf], { type: raw.type || 'image/jpeg' }));
    } catch(e) { return null; }
  }

  async updateChatAvatar(chatId, password, file, isPublic) {
    const infoBlob = await this._downloadFileRaw(`${chatId}/info.json`);
    let key = null;
    if (infoBlob) {
       const { salt } = JSON.parse(await infoBlob.text());
       if (password && salt) key = await getKeyFromPassword(password, salt);
    }
    
    // Remove old avatars before uploading new ones
    const files = await this._listFiles(chatId);
    if (isPublic) {
      for (const f of files) {
        if (f.name.startsWith('public_avatar.')) await this.deleteResource(f.path);
      }
    } else {
      const encFile = files.find(f => f.name === 'private_avatar.enc');
      if (encFile) await this.deleteResource(encFile.path);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isPublic) {
      await this._uploadFileRaw(chatId, `public_avatar.${file.name.split('.').pop()}`, bytes, file.type);
    } else if (key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      await this._uploadFileRaw(chatId, 'private_avatar.enc', JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), type: file.type }));
    }
    return true;
  }

  async addParticipant(chatId, emails) {
    await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(chatId)}`, { method: 'PUT' });
    const meta = await this._fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(chatId)}`);
    return { inviteLink: (await meta.json()).public_url };
  }

  async saveUserProfile(chatId, password, email, profileData) {
    const infoBlob = await this._downloadFileRaw(`${chatId}/info.json`);
    if (!infoBlob || !password) return false;
    
    let salt;
    try {
       salt = JSON.parse(await infoBlob.text()).salt;
    } catch(e) { return false; }
    
    const key = await getKeyFromPassword(password, salt);
    
    let usersId = await this._findFileId(chatId, 'users');
    if (!usersId) {
      const folder = await this._createFolder('users', chatId);
      if(!folder) return false;
      usersId = folder.id;
    }
    
    let registry = {};
    const regPath = `${usersId}/users.json`;
    const existingReg = await this._findFileId(usersId, 'users.json');
    if (existingReg) {
      try {
        const regRaw = JSON.parse(await (await this._downloadFileRaw(regPath)).text());
        if (regRaw.encrypted) {
          const dec = await decrypt(regRaw.encrypted, regRaw.iv, key);
          if (dec) registry = JSON.parse(dec);
        }
      } catch(e) { registry = {}; }
    }
    
    let userFolderId = registry[email];
    if (!userFolderId) {
      const newFolderName = generateId();
      const folder = await this._createFolder(newFolderName, usersId); 
      userFolderId = folder.id; // Get id from response
      registry[email] = userFolderId;
      const encReg = await encrypt(JSON.stringify(registry), key);
      await this._uploadFileRaw(usersId, 'users.json', JSON.stringify({ iv: encReg.iv, encrypted: encReg.encrypted }));
    }
    
    if (profileData.name) {
      const enc = await encrypt(profileData.name, key);
      await this._uploadFileRaw(userFolderId, 'name.txt', JSON.stringify({ iv: enc.iv, encrypted: enc.encrypted }));
    }
    if (profileData.avatar) {
      const bytes = new Uint8Array(await profileData.avatar.arrayBuffer());
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encAv = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      await this._uploadFileRaw(userFolderId, `icon.${profileData.avatar.name.split('.').pop()}`, JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encAv)), type: profileData.avatar.type }));
    }
    return true;
  }

  async getAllUserProfiles(chatId, password) {
    if (!password) return {};
    
    const infoBlob = await this._downloadFileRaw(`${chatId}/info.json`);
    if (!infoBlob) return {};
    
    let salt;
    try { salt = JSON.parse(await infoBlob.text()).salt; } catch(e) { return {}; }
    
    const key = await getKeyFromPassword(password, salt);
    const usersId = await this._findFileId(chatId, 'users');
    if (!usersId) return {};
    
    const regPath = `${usersId}/users.json`;
    const regFile = await this._downloadFileRaw(regPath);
    if (!regFile) return {};
    
    let registry = {};
    try {
        const regRaw = JSON.parse(await regFile.text());
        const dec = await decrypt(regRaw.encrypted, regRaw.iv, key);
        if (!dec) return {};
        registry = JSON.parse(dec);
    } catch(e) { return {}; }
    
    const profiles = {};
    for (const email of Object.keys(registry)) {
      const userFolderId = registry[email];
      const profile = { name: email.split('@')[0], avatarUrl: null };
      
      try {
        const namePath = `${userFolderId}/name.txt`;
        const nameFile = await this._downloadFileRaw(namePath);
        if (nameFile) {
          const nameRaw = JSON.parse(await nameFile.text());
          if(nameRaw.encrypted) profile.name = await decrypt(nameRaw.encrypted, nameRaw.iv, key);
        }
        
        const files = await this._listFiles(userFolderId);
        const iconFile = files.find(i => i.name.startsWith('icon.'));
        if(iconFile) {
           const iconBlob = await this._downloadFileRaw(iconFile.path);
           if(iconBlob) {
             try {
               const iconRaw = JSON.parse(await iconBlob.text());
               const decBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iconRaw.iv) }, key, new Uint8Array(iconRaw.encrypted));
               profile.avatarUrl = URL.createObjectURL(new Blob([decBuffer], { type: iconRaw.type || 'image/jpeg' }));
             } catch(e) {}
           }
        }
      } catch(e) { /* Continue with default data */ }
      
      profiles[email] = profile;
    }
    return profiles;
  }
}