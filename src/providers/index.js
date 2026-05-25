import { GoogleDriveProvider } from './GoogleDriveProvider';
import { YandexDiskProvider } from './YandexDiskProvider';
import { OneDriveProvider } from './OneDriveProvider';
import { parseGifUrl, filterSensitiveData } from './utils'; // Re-export utils

export function getProvider(providerName, token) {
  switch (providerName) {
    case 'google':
      return new GoogleDriveProvider(token);
    case 'yandex':
      return new YandexDiskProvider(token);
    case 'onedrive':
      return new OneDriveProvider(token);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

// Helper to get OAuth URL without instantiating the provider (since we need it before token)
export function getOAuthUrl(providerName, clientId, redirectUri) {
  switch (providerName) {
    case 'google':
      return GoogleDriveProvider.getOAuthUrl(clientId, redirectUri);
    case 'yandex':
      return YandexDiskProvider.getOAuthUrl(clientId, redirectUri);
    case 'onedrive':
      return OneDriveProvider.getOAuthUrl(clientId, redirectUri);
    default:
      return null;
  }
}

export const config = {
  google: { name: 'Google Drive', links: { register: 'https://console.cloud.google.com/apis/credentials' } },
  yandex: { name: 'Yandex Drive', links: { register: 'https://oauth.yandex.ru/client/new' } },
  onedrive: { name: 'One Drive', links: { register: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps' } }
};

export { parseGifUrl, filterSensitiveData };