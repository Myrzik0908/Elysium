import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/SettingsPage.module.css';
import LanguageSwitcher from './LanguageSwitcher';

const SettingsPage = ({ 
  onBack, onExit, onOpenUserAgreement, 
  api, token, providerName, 
  kmKeysList, saveKeyToKM, removeKeyFromKM, isKMEnabled,
  chats, toggleKeyManager, userEmail
}) => {
  const { t } = useTranslation();
  
  const [showAllKeys, setShowAllKeys] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isAwaitingActivation, setIsAwaitingActivation] = useState(false);
  const [displayKeys, setDisplayKeys] = useState([]);

  useEffect(() => {
    if (!providerName || !userEmail) return;
    const keys = { session: `elysium_km_session_${providerName}_${userEmail}` };
    const sessionPass = sessionStorage.getItem(keys.session);
    if (sessionPass) setMasterPassword(sessionPass);
  }, [providerName, userEmail]);

  useEffect(() => {
    if (!kmKeysList || kmKeysList.length === 0) {
      setDisplayKeys([]);
      return;
    }
    if (!chats || chats.length === 0) {
       setDisplayKeys(kmKeysList.map(k => ({ ...k, name: k.folderId, visible: false })));
       return;
    }
    const resolved = kmKeysList.map(k => {
      const chat = chats.find(c => c.id === k.folderId);
      return { ...k, name: chat ? chat.name : k.folderId, visible: false };
    });
    setDisplayKeys(resolved);
  }, [kmKeysList, chats]);

  useEffect(() => {
    if (isKMEnabled) setIsAwaitingActivation(false);
  }, [isKMEnabled]);

  const handleToggleKeyManager = () => {
    if (isKMEnabled) {
      if (window.confirm(t('editChat.deleteConfirm'))) {
        toggleKeyManager(false);
        setMasterPassword(''); 
        setPasswordError('');
      }
    } else {
      if (isAwaitingActivation) {
        setIsAwaitingActivation(false);
        setMasterPassword('');
        setPasswordError('');
      } else {
        setIsAwaitingActivation(true);
        setPasswordError('');
      }
    }
  };

  const handleConfirmActivation = () => {
    if (masterPassword.length < 12) {
      setPasswordError(t('settings.setMasterPass').replace('(min 12 chars)', ''));
      return;
    }
    toggleKeyManager(true, masterPassword);
  };

  const handleMasterPasswordChange = (e) => {
    const value = e.target.value;
    setMasterPassword(value);
    if (value.length > 0 && value.length < 12) setPasswordError('Min length 12 chars');
    else setPasswordError('');
  };

  const toggleKeyVisibility = (id) => {
    setDisplayKeys(displayKeys.map(k => k.folderId === id ? { ...k, visible: !k.visible } : k));
  };

  const handleDeleteKey = async (folderId) => {
    await removeKeyFromKM(folderId);
  };
  
  const showContent = isKMEnabled || isAwaitingActivation;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
      </div>

      <div className={styles.content}>
        
        <div className={styles.section}>
          <label className={styles.sectionTitle}>{t('settings.language')}</label>
          <div style={{ marginTop: '10px' }}>
            <LanguageSwitcher />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{t('settings.keyManager')}</span>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={isKMEnabled} 
                onChange={handleToggleKeyManager} 
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          {showContent && (
            <div className={styles.keyManagerContent}>
              <div className={styles.lockScreen}>
                <div className={styles.passwordInputWrapper}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder={isKMEnabled ? t('settings.enterMasterPass') : t('settings.setMasterPass')} 
                    value={masterPassword} 
                    onChange={handleMasterPasswordChange} 
                    className={styles.inputField}
                    autoFocus={isAwaitingActivation}
                  />
                  <button className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordError && <span className={styles.errorText}>{passwordError}</span>}
                
                {isAwaitingActivation && !isKMEnabled && (
                  <button 
                    className={styles.unlockBtn} 
                    onClick={handleConfirmActivation}
                    disabled={masterPassword.length < 12}
                  >
                    {t('confirm')}
                  </button>
                )}
              </div>

              {isKMEnabled && (
                <>
                  <div className={styles.allKeysToggleRow}>
                    <span>{t('settings.showAllKeys')}</span>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={showAllKeys} onChange={() => setShowAllKeys(!showAllKeys)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  {showAllKeys && (
                    <div className={styles.keyList}>
                      {displayKeys.length === 0 ? (
                        <div className={styles.emptyMessage}>{t('settings.noKeys')}</div>
                      ) : (
                        displayKeys.map(item => (
                          <div key={item.folderId} className={styles.keyItem}>
                            <div className={styles.keyInfo}>
                              <span className={styles.chatName}>{item.name}</span>
                              <div className={styles.keyRow}>
                                <code className={styles.keyValue}>
                                  {item.visible ? item.key : '••••••••••••••••'}
                                </code>
                                <button className={styles.iconBtn} onClick={() => toggleKeyVisibility(item.folderId)}>
                                  {item.visible ? '👁️' : '👁️‍🗨️'}
                                </button>
                              </div>
                            </div>
                            <button className={styles.deleteBtn} onClick={() => handleDeleteKey(item.folderId)}>{t('delete')}</button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onOpenUserAgreement}>{t('settings.userAgreement')}</button>
        <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onBack}>{t('back')}</button>
        <button className={`${styles.button} ${styles.exitBtn}`} onClick={onExit}>{t('settings.exit')}</button>
      </div>
    </div>
  );
};

export default SettingsPage;