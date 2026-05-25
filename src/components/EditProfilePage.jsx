import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/EditProfilePage.module.css';
import { useChatCache } from '../context/ChatCacheContext';

const EditProfilePage = ({ onBack, api, chatId, decryptionKey, userEmail }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const fileInputRef = useRef(null);
  const { getCache, updateCache } = useChatCache(); 

  useEffect(() => {
    const loadProfile = async () => {
      if (!chatId || !userEmail) return;

      const cachedData = getCache(chatId);
      if (cachedData && cachedData.userProfiles && cachedData.userProfiles[userEmail]) {
        console.log("EditProfile: Data taken from cache");
        const profile = cachedData.userProfiles[userEmail];
        setName(profile.name || '');
        if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
        setIsLoading(false);
        return; 
      }

      console.log("EditProfile: Loading from server");
      if (!api || !decryptionKey) {
        setIsLoading(false);
        return;
      }
      
      try {
        const profile = await api.getUserProfile(chatId, decryptionKey, userEmail);
        if (profile) {
          setName(profile.name || '');
          if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [api, chatId, decryptionKey, userEmail, getCache]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert(t('editProfile.alertName'));
      return;
    }

    setIsSaving(true);
    try {
      const success = await api.saveUserProfile(chatId, decryptionKey, userEmail, {
        name: name.trim(),
        avatar: avatarFile
      });

      if (success) {
        updateCache(chatId, { userProfiles: null });
        onBack();
      }
      else alert(t('app.alertFailedSave'));
    } catch (err) {
      console.error(err);
      alert(t('app.alertError') + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={onBack}>← {t('back')}</button>
          <h2 className={styles.title}>{t('editProfile.title')}</h2>
        </div>

        {isLoading ? (
          <div className={styles.loading}>{t('loading')}</div>
        ) : (
          <div className={styles.form}>
            <div className={styles.avatarSection}>
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleAvatarChange} className={styles.hiddenInput} />
              <div className={styles.avatarPlaceholder} onClick={() => fileInputRef.current?.click()}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className={styles.avatarImage} />
                ) : (
                  <span>📷</span>
                )}
                <div className={styles.editOverlay}><span>+</span></div>
              </div>
              <span className={styles.hint}>{t('editProfile.changeAvatar')}</span>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{t('editProfile.displayName')}</label>
              <input type="text" className={styles.input} placeholder={t('editProfile.enterName')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{t('editProfile.email')}</label>
              <div className={styles.emailDisplay}>
                <span className={styles.emailIcon}>📧</span>
                <span>{userEmail}</span>
              </div>
              <small className={styles.smallText}>{t('editProfile.emailHint')}</small>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onBack} disabled={isSaving}>{t('cancel')}</button>
          <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleSave} disabled={isSaving || isLoading}>{isSaving ? t('loading') : t('save')}</button>
        </div>
      </div>
    </div>
  );
};

export default EditProfilePage;