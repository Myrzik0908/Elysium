export class CloudProvider {
  constructor(token) {
    this.token = token;
  }

  static getOAuthUrl(clientId, redirectUri) { throw new Error('Static method getOAuthUrl must be implemented'); }
  
  // Must return a URL string for ping measurement
  static linkGetPing() { throw new Error('Static method linkGetPing must be implemented'); }

  // Must return an object: { name, colorClass, icon }
  static getStyle() { throw new Error('Static method getStyle must be implemented'); }

  isPublicFolder() { throw new Error('Method isPublicFolder must be implemented'); }

  // --- Core ---
  async getUserInfo() { throw new Error('Method getUserInfo must be implemented'); }
  async listChats() { throw new Error('Method listChats must be implemented'); }
  async createChat(name, options) { throw new Error('Method createChat must be implemented'); }
  async deleteChat(chatId) { throw new Error('Method deleteChat must be implemented'); }
  async renameChat(chatId, newName) { throw new Error('Method renameChat must be implemented'); }

  // --- Messaging ---
  async getMessages(chatId, key, lastTimestamp) { throw new Error('Method getMessages must be implemented'); }
  async sendMessage(chatId, message, key) { throw new Error('Method sendMessage must be implemented'); }
  async uploadFile(chatId, file, fileName, key) { throw new Error('Method uploadFile must be implemented'); }
  async downloadFile(fileId, key) { throw new Error('Method downloadFile must be implemented'); }
  async deleteResource(fileId) { throw new Error('Method deleteResource must be implemented'); }

  // --- Chat Data ---
  async getChatInfo(chatId, password) { throw new Error('Method getChatInfo must be implemented'); }
  async updateChatInfo(chatId, password, updates) { throw new Error('Method updateChatInfo must be implemented'); }
  async getPublicAvatar(chatId) { throw new Error('Method getPublicAvatar must be implemented'); }
  async getPrivateAvatarUrl(chatId, key) { throw new Error('Method getPrivateAvatarUrl must be implemented'); }
  async updateChatAvatar(chatId, password, file, isPublic) { throw new Error('Method updateChatAvatar must be implemented'); }

  // --- Participants ---
  async addParticipant(chatId, email) { throw new Error('Method addParticipant must be implemented'); }

  // --- Profiles ---
  async saveUserProfile(chatId, password, email, profileData) { throw new Error('Method saveUserProfile must be implemented'); }
  async getAllUserProfiles(chatId, password) { throw new Error('Method getAllUserProfiles must be implemented'); }
  
  async getUserProfile(chatId, password, email) {
    const profiles = await this.getAllUserProfiles(chatId, password);
    return profiles[email] || null;
  }
}