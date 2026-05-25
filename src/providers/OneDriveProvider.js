import React from 'react';
import { CloudProvider } from './CloudProvider';
import { getKeyFromPassword, encrypt, decrypt, generateId, generateFolderName } from './utils';

export class OneDriveProvider extends CloudProvider {
  static getOAuthUrl(clientId, redirectUri) { 
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=Files.ReadWrite&state=onedrive`; 
  }
  
  static linkGetPing() {
    return 'https://login.microsoftonline.com/favicon.ico';
  }

  static getStyle() {
    return {
      name: 'One Drive',
      colorClass: 'oneDriveBtn',
    };
  }

  isPublicFolder() { return false; }
  
  _fetch(url, options = {}) { 
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${this.token}` } }); 
  }

  _getItemUrl(id) {
    if (!id || id === 'root') return 'https://graph.microsoft.com/v1.0/me/drive/items/root';
    if (typeof id === 'string' && id.includes('|')) {
      const [driveId, itemId] = id.split('|');
      return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`;
    }
    return `https://graph.microsoft.com/v1.0/me/drive/items/${id}`;
  }

  async _findFileId(parentId, fileName) {
    const target = parentId || 'root';
    try {
      const res = await this._fetch(`${this._getItemUrl(target)}/children?$filter=name eq '${fileName}'&select=id`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.value?.[0]?.id || null;
    } catch (e) { return null; }
  }

  async _createFolder(name, parentId = null) {
    const endpoint = parentId 
      ? `${this._getItemUrl(parentId)}/children` 
      : `https://graph.microsoft.com/v1.0/me/drive/root/children`;
    
    try {
      const res = await this._fetch(endpoint, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ name, folder: {} }) 
      });
      
      if (res.status === 409) {
        const id = await this._findFileId(parentId || 'root', name);
        return id ? { id, name } : null;
      }
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async _uploadFileRaw(parentId, name, content, contentType = 'application/json') {
    try {
      const res = await this._fetch(`${this._getItemUrl(parentId)}:/${name}:/content`, { 
        method: 'PUT', 
        body: content, 
        headers: { 'Content-Type': contentType } 
      });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async _downloadFileRaw(fileId) {
    if (!fileId) return null;
    try {
      const res = await this._fetch(`${this._getItemUrl(fileId)}/content`);
      return res.ok ? await res.blob() : null;
    } catch (e) { return null; }
  }
  
  async _listChildren(parentId) {
    try {
      const target = parentId || 'root';
      const res = await this._fetch(`${this._getItemUrl(target)}/children`);
      if (!res.ok) return [];
      return (await res.json()).value || [];
    } catch(e) { return []; }
  }

  async deleteResource(fileId) {
    if (!fileId) return false;
    try {
      const res = await this._fetch(`${this._getItemUrl(fileId)}`, { method: 'DELETE' });
      return res.ok || res.status === 204;
    } catch (e) { return false; }
  }

  async getUserInfo() { 
    const res = await this._fetch('https://graph.microsoft.com/v1.0/me'); 
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.userPrincipalName, name: data.displayName }; 
  }
  
  async listChats() {
    const chats = [];
    try {
      const rootRes = await this._fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children`);
      if (rootRes.ok) {
        const rootItems = (await rootRes.json()).value || [];
        const folders = rootItems.filter(f => f.folder);
        for (const f of folders) {
          const checkRes = await this._fetch(`${this._getItemUrl(f.id)}/children?$filter=name eq '.elysium.bin'`);
          if (checkRes.ok && (await checkRes.json()).value?.length > 0) {
            let name = "Unnamed Chat";
            try {
              const nameId = await this._findFileId(f.id, 'name.json');
              if (nameId) {
                const blob = await this._downloadFileRaw(nameId);
                if (blob) {
                  const json = JSON.parse(await blob.text());
                  name = json.name || name;
                }
              }
            } catch(e) {}

            let lastMessageTime = null;
            try {
              const lastMsgId = await this._findFileId(f.id, 'lastmsg.json');
              if (lastMsgId) {
                const blob = await this._downloadFileRaw(lastMsgId);
                if (blob) {
                  const json = JSON.parse(await blob.text());
                  lastMessageTime = json.timestamp || null;
                }
              }
            } catch(e) {}

            chats.push({ id: f.id, name, lastMessageTime });
          }
        }
      }

      const sharedRes = await this._fetch(`https://graph.microsoft.com/v1.0/me/drive/shared`);
      if (sharedRes.ok) {
        const sharedItems = (await sharedRes.json()).value || [];
        const sharedFolders = sharedItems.filter(f => f.folder || f.remoteItem?.folder);
        
        for (const item of sharedFolders) {
          const itemId = item.remoteItem ? item.remoteItem.id : item.id;
          const driveId = item.remoteItem ? item.remoteItem.parentReference?.driveId : null;
          if (!itemId) continue;
          
          const chatId = driveId ? `${driveId}|${itemId}` : itemId;
          
          const checkRes = await this._fetch(`${this._getItemUrl(chatId)}/children?$filter=name eq '.elysium.bin'`);
          if (checkRes.ok && (await checkRes.json()).value?.length > 0) {
            let name = item.name || "Unnamed Shared Chat";
            const nameId = await this._findFileId(chatId, 'name.json');
            if (nameId) {
                try {
                    const blob = await this._downloadFileRaw(nameId);
                    if (blob) name = JSON.parse(await blob.text()).name || name;
                } catch(e) {}
            }

            let lastMessageTime = null;
            try {
              const lastMsgId = await this._findFileId(chatId, 'lastmsg.json');
              if (lastMsgId) {
                const blob = await this._downloadFileRaw(lastMsgId);
                if (blob) {
                  const json = JSON.parse(await blob.text());
                  lastMessageTime = json.timestamp || null;
                }
              }
            } catch(e) {}

            chats.push({ id: chatId, name, lastMessageTime });
          }
        }
      }
    } catch (e) { console.error(e); }
    
    return Array.from(new Map(chats.map(c => [c.id, c])).values());
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
    await this._fetch(`${this._getItemUrl(chatId)}`, { method: 'DELETE' }); 
    return true; 
  }
  
  async renameChat(chatId, newName) {
    await this._uploadFileRaw(chatId, 'name.json', JSON.stringify({ name: newName }));
    return true;
  }
  
  async getMessages(chatId, key, lastTimestamp) {
    const msgFolderId = await this._findFileId(chatId, 'messages');
    if (!msgFolderId) return [];

    const res = await this._fetch(`${this._getItemUrl(msgFolderId)}/children?$orderby=createdDateTime`);
    if (!res.ok) return [];
    const items = (await res.json()).value || [];
    const messages = [];
    
    for (const item of items) {
      if (!item.file || !item.name.endsWith('.json')) continue;
      try { 
        const fileRes = await this._fetch(`${this._getItemUrl(item.id)}/content`);
        if (!fileRes.ok) continue;
        const text = await fileRes.text();
        const raw = JSON.parse(text); 
        if (raw.iv && raw.encrypted) {
          const str = await decrypt(raw.encrypted, raw.iv, key); 
          if (str) {
            const msg = JSON.parse(str);
            msg._fileId = item.id;
            messages.push(msg);
          }
        }
      } catch (e) {}
    }

    let filteredMessages = messages;
    if (lastTimestamp) {
      filteredMessages = messages.filter(m => new Date(m.timestamp) > new Date(lastTimestamp));
    }

    return filteredMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async sendMessage(chatId, message, key) {
    let msgFolderId = await this._findFileId(chatId, 'messages');
    if (!msgFolderId) {
      const folder = await this._createFolder('messages', chatId);
      if(!folder) return null;
      msgFolderId = folder.id;
    }

    const { iv, encrypted } = await encrypt(JSON.stringify(message), key);
    const fileName = `${message.id.replace(/:/g, '-')}.json`;
    const res = await this._uploadFileRaw(msgFolderId, fileName, JSON.stringify({ iv, encrypted }));
    
    if (res) {
      await this._uploadFileRaw(chatId, 'lastmsg.json', JSON.stringify({ timestamp: message.timestamp }));
    }
    
    return res ? res.id : null;
  }

  async uploadFile(chatId, file, fileName, key) {
    let filesFolderId = await this._findFileId(chatId, 'files');
    if (!filesFolderId) {
      const folder = await this._createFolder('files', chatId);
      if(!folder) return null;
      filesFolderId = folder.id;
    }
    
    const bytes = new Uint8Array(await file.arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    const payload = JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), originalName: fileName, mimeType: file.type });
    const result = await this._uploadFileRaw(filesFolderId, `${Date.now()}_${fileName}.enc.json`, payload);
    return result ? { id: result.id, name: result.name, originalName: fileName, mimeType: file.type } : null;
  }

  async downloadFile(fileId, key) {
    const blob = await this._downloadFileRaw(fileId); 
    if(!blob) return null;
    try {
      const raw = JSON.parse(await blob.text());
      if(!raw.iv || !raw.encrypted) return null;
      const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
      return new Blob([decBuf], { type: raw.mimeType });
    } catch(e) { return null; }
  }

  async getChatInfo(chatId, password) {
    const infoId = await this._findFileId(chatId, 'info.json');
    if(!infoId) return null;
    const blob = await this._downloadFileRaw(infoId);
    if(!blob) return null;
    
    try {
      const json = JSON.parse(await blob.text());
      if(!json.salt) return null;
      const result = { salt: json.salt, description: '' };
      if(json.iv && json.encrypted) { 
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
    const infoId = await this._findFileId(chatId, 'info.json'); 
    if(!infoId) return false;
    
    const blob = await this._downloadFileRaw(infoId);
    if(!blob) return false;

    try {
      const json = JSON.parse(await blob.text());
      const key = await getKeyFromPassword(password, json.salt);
      let data = json.iv ? JSON.parse(await decrypt(json.encrypted, json.iv, key) || '{}') : {};
      const updated = { ...data, ...updates, updatedAt: new Date().toISOString() };
      const enc = await encrypt(JSON.stringify(updated), key);
      await this._uploadFileRaw(chatId, 'info.json', JSON.stringify({ salt: json.salt, iv: enc.iv, encrypted: enc.encrypted }));
      return true;
    } catch(e) { return false; }
  }

  async getPublicAvatar(chatId) {
    try {
      const children = await this._listChildren(chatId);
      const avatarFile = children.find(f => f.name && f.name.startsWith('public_avatar.'));
      
      if (avatarFile) {
        const blob = await this._downloadFileRaw(avatarFile.id);
        if (blob) return URL.createObjectURL(blob);
      }
    } catch (e) { 
      console.error("GetPublicAvatar OneDrive error:", e);
    }
    return null;
  }

  async getPrivateAvatarUrl(chatId, key) {
    const id = await this._findFileId(chatId, 'private_avatar.enc');
    if(!id) return null;
    const blob = await this._downloadFileRaw(id); 
    if(!blob) return null;
    try {
      const raw = JSON.parse(await blob.text());
      const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(raw.iv) }, key, new Uint8Array(raw.encrypted));
      return URL.createObjectURL(new Blob([decBuf], { type: raw.type || 'image/jpeg' }));
    } catch(e) { return null; }
  }

  async updateChatAvatar(chatId, password, file, isPublic) {
    const infoId = await this._findFileId(chatId, 'info.json');
    let key = null;
    
    if (infoId && password) {
      const blob = await this._downloadFileRaw(infoId);
      if (blob) {
        try {
          const { salt } = JSON.parse(await blob.text());
          key = await getKeyFromPassword(password, salt);
        } catch(e) {}
      }
    }
    
    // Remove old avatars before uploading new ones
    if (isPublic) {
      const children = await this._listChildren(chatId);
      for (const f of children) {
        if (f.name && f.name.startsWith('public_avatar.')) await this.deleteResource(f.id);
      }
    } else {
      const oldPrivId = await this._findFileId(chatId, 'private_avatar.enc');
      if (oldPrivId) await this.deleteResource(oldPrivId);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isPublic) await this._uploadFileRaw(chatId, `public_avatar.${file.name.split('.').pop()}`, bytes, file.type);
    else if (key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      await this._uploadFileRaw(chatId, 'private_avatar.enc', JSON.stringify({ iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), type: file.type }));
    }
    return true;
  }

  async addParticipant(chatId, emails) {
    const list = Array.isArray(emails) ? emails : [emails];
    await this._fetch(`${this._getItemUrl(chatId)}/invite`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ requireSignIn: true, sendInvitation: true, roles: ["write"], recipients: list.map(email => ({ email })) }) 
    });
    return true;
  }

  async saveUserProfile(chatId, password, email, profileData) {
    const infoId = await this._findFileId(chatId, 'info.json');
    if(!infoId || !password) return false;
    
    const infoBlob = await this._downloadFileRaw(infoId);
    if(!infoBlob) return false;
    
    let salt;
    try { salt = JSON.parse(await infoBlob.text()).salt; } catch(e) { return false; }
    const key = await getKeyFromPassword(password, salt);
    
    let usersId = await this._findFileId(chatId, 'users') || (await this._createFolder('users', chatId))?.id;
    if (!usersId) return false;

    let registry = {};
    let regId = await this._findFileId(usersId, 'users.json');
    if (regId) { 
      try {
        const raw = JSON.parse(await (await this._downloadFileRaw(regId)).text()); 
        if(raw.encrypted) {
            const dec = await decrypt(raw.encrypted, raw.iv, key); 
            if(dec) registry = JSON.parse(dec); 
        }
      } catch(e) { registry = {}; }
    }
    
    let userFolderId = registry[email];
    if (!userFolderId) {
      const folder = await this._createFolder(generateId(), usersId);
      if(!folder) return false;
      userFolderId = folder.id;
      registry[email] = userFolderId;
      const encReg = await encrypt(JSON.stringify(registry), key);
      await this._uploadFileRaw(usersId, 'users.json', JSON.stringify({ iv: encReg.iv, encrypted: encReg.encrypted }));
    }
    
    if (profileData.name) { const enc = await encrypt(profileData.name, key); await this._uploadFileRaw(userFolderId, 'name.txt', JSON.stringify({ iv: enc.iv, encrypted: enc.encrypted })); }
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
    const infoId = await this._findFileId(chatId, 'info.json');
    if(!infoId) return {};
    
    const infoBlob = await this._downloadFileRaw(infoId);
    if(!infoBlob) return {};
    
    let salt;
    try { salt = JSON.parse(await infoBlob.text()).salt; } catch(e) { return {}; }
    const key = await getKeyFromPassword(password, salt);
    
    const usersId = await this._findFileId(chatId, 'users'); 
    if(!usersId) return {};
    
    const regId = await this._findFileId(usersId, 'users.json'); 
    if(!regId) return {};
    
    const regFile = await this._downloadFileRaw(regId);
    if(!regFile) return {};
    
    let registry = {};
    try {
      const raw = JSON.parse(await regFile.text());
      if(!raw.encrypted) return {};
      const dec = await decrypt(raw.encrypted, raw.iv, key); 
      if(!dec) return {};
      registry = JSON.parse(dec);
    } catch(e) { return {}; }
    
    const profiles = {};
    for (const email of Object.keys(registry)) {
      const userFolderId = registry[email];
      const profile = { name: email.split('@')[0], avatarUrl: null };
      
      try {
        const nameId = await this._findFileId(userFolderId, 'name.txt');
        if (nameId) { 
            const nameFile = await this._downloadFileRaw(nameId);
            if (nameFile) {
                const nameRaw = JSON.parse(await nameFile.text()); 
                if(nameRaw.encrypted) profile.name = await decrypt(nameRaw.encrypted, nameRaw.iv, key); 
            }
        }
        
        const files = await this._listChildren(userFolderId);
        const iconFile = files.find(f => f.name.startsWith('icon.'));
        if(iconFile) {
            const iconBlob = await this._downloadFileRaw(iconFile.id);
            if(iconBlob) {
                try {
                    const iconRaw = JSON.parse(await iconBlob.text());
                    const decBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iconRaw.iv) }, key, new Uint8Array(iconRaw.encrypted));
                    profile.avatarUrl = URL.createObjectURL(new Blob([decBuffer], { type: iconRaw.type || 'image/jpeg' }));
                } catch(e) {}
            }
        }
      } catch(e) {}
      
      profiles[email] = profile;
    }
    return profiles;
  }
}