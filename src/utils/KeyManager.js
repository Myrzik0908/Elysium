import { useState, useEffect, useCallback } from 'react';
import { decryptKMData, encryptKMData } from '../providers/utils';

const KM_ENABLED_PREFIX = 'elysium_km_enabled_';
const KM_DATA_PREFIX = 'elysium_km_data_';

export const useKeyManager = (providerName, token, userEmail) => {
  const [isKMEnabled, setIsKMEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [kmKeysList, setKmKeysList] = useState([]);
  const [isInitialized, setIsInitialized] = useState(true);
  
  const [masterPassword, setMasterPassword] = useState(null); 

  const getKMKeys = useCallback(() => {
    if (!providerName || !userEmail) return null;
    const suffix = `${providerName}_${userEmail}`;
    return {
      enabled: KM_ENABLED_PREFIX + suffix,
      data: KM_DATA_PREFIX + suffix,
    };
  }, [providerName, userEmail]);

  useEffect(() => {
    if (!providerName || !userEmail) {
      setIsKMEnabled(false);
      setIsLocked(false);
      return;
    }

    const keys = getKMKeys();
    if (!keys) return;

    const enabled = localStorage.getItem(keys.enabled) === 'true';
    setIsKMEnabled(enabled);

    if (enabled) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [providerName, userEmail, getKMKeys]);

  const performUnlock = async (password) => {
    const keys = getKMKeys();
    if (!keys) return false;

    const encryptedData = localStorage.getItem(keys.data);
    
    if (encryptedData) {
      const decrypted = await decryptKMData(encryptedData, password);
      if (decrypted) {
        setMasterPassword(password);
        setKmKeysList(decrypted);
        setIsLocked(false);
        return true;
      } else {
        return false;
      }
    } else {
      setMasterPassword(password);
      setKmKeysList([]);
      setIsLocked(false);
      return true;
    }
  };

  const toggleKeyManager = async (enable, masterPass) => {
    const keys = getKMKeys();
    if (!keys) return;

    if (enable) {
      if (!masterPass || masterPass.length < 12) return false;
      localStorage.setItem(keys.enabled, 'true');
      
      if (!localStorage.getItem(keys.data)) {
          const empty = await encryptKMData([], masterPass);
          localStorage.setItem(keys.data, empty);
      }
      
      setMasterPassword(masterPass);
      setIsKMEnabled(true);
      setIsLocked(false);
      setKmKeysList([]);
    } else {
      localStorage.removeItem(keys.enabled);
      localStorage.removeItem(keys.data);
      setMasterPassword(null);
      setIsKMEnabled(false);
      setKmKeysList([]);
    }
  };

  const saveKeyToKM = async (folderId, key) => {
    if (!masterPassword) return;

    let keysList = [...kmKeysList];
    const existingIndex = keysList.findIndex(k => k.folderId === folderId);
    
    if (existingIndex >= 0) {
      keysList[existingIndex].key = key;
    } else {
      keysList.push({ folderId, key });
    }

    const newEncrypted = await encryptKMData(keysList, masterPassword);
    const keys = getKMKeys();
    if (keys) localStorage.setItem(keys.data, newEncrypted);
    setKmKeysList(keysList);
  };

  const removeKeyFromKM = async (folderId) => {
    if (!masterPassword) return;

    let keysList = kmKeysList.filter(k => k.folderId !== folderId);
    
    const newEncrypted = await encryptKMData(keysList, masterPassword);
    const keys = getKMKeys();
    if (keys) localStorage.setItem(keys.data, newEncrypted);
    setKmKeysList(keysList);
  };

  const isKeyInKM = useCallback((folderId) => {
    return kmKeysList.some(k => k.folderId === folderId);
  }, [kmKeysList]);

  const resetKM = () => {
    setMasterPassword(null);
    setIsLocked(true);
    setKmKeysList([]);
  };

  return {
    isKMEnabled,
    isLocked,
    kmKeysList,
    isInitialized,
    performUnlock,
    toggleKeyManager,
    saveKeyToKM,
    removeKeyFromKM,
    isKeyInKM,
    resetKM
  };
};