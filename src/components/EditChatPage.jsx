import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/EditChatPage.module.css';
import { getKeyFromPassword } from '../providers/utils';
import { useChatCache } from '../context/ChatCacheContext';

const EditChatPage = ({ chatData, api, decryptionKey, onSave, onDelete, onCancel, isKeyInKM, addKeyToKM, removeKeyFromKM }) => {
  const { t } = useTranslation();
  const [chatName, setChatName] = useState('');
  const [description, setDescription] = useState('');
  
  const [publicAvatar, setPublicAvatar] = useState(null);
  const [publicAvatarPreview, setPublicAvatarPreview] = useState(null);
  const [privateAvatar, setPrivateAvatar] = useState(null);
  const [privateAvatarPreview, setPrivateAvatarPreview] = useState(null);

  const [isPublicAvatarLoading, setIsPublicAvatarLoading] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  
  const [quickLogin, setQuickLogin] = useState(false);
  
  const [inviteLink, setInviteLink] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { getCache, updateCache } = useChatCache();

  useEffect(() => {
    const loadData = async () => {
      if (!chatData) return;
      
      setChatName(chatData.name || '');
      setParticipants([]);
      
      if (chatData.avatarUrl) setPublicAvatarPreview(chatData.avatarUrl);

      const cachedData = getCache(chatData.id);
      
      if (cachedData) {
        console.log("EditChat: Data taken from cache");
        if (cachedData.description) setDescription(cachedData.description);
        if (cachedData.privateAvatarUrl) setPrivateAvatarPreview(cachedData.privateAvatarUrl);
      }

      const needsServerFetch = !cachedData || cachedData.description === undefined;

      if (needsServerFetch) {
        setIsLoading(true);
        try {
          console.log("EditChat: Loading from server (fallback)");
          
          const [pubUrl, info] = await Promise.all([
            api.getPublicAvatar(chatData.id).catch(() => null),
            api.getChatInfo(chatData.id, decryptionKey).catch(() => null)
          ]);

          if (pubUrl) setPublicAvatarPreview(pubUrl);

          if (info) {
            if (info.description) setDescription(info.description);
            if (!cachedData?.privateAvatarUrl && info.salt) {
              const key = await getKeyFromPassword(decryptionKey, info.salt);
              try {
                const privUrl = await api.getPrivateAvatarUrl(chatData.id, key);
                if (privUrl) {
                  setPrivateAvatarPreview(privUrl);
                  updateCache(chatData.id, { privateAvatarUrl: privUrl });
                }
              } catch (e) { console.warn("Private avatar load failed", e); }
            }
          }
        } catch (e) {
          console.error('Failed to load chat info for editing', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
        
        setIsPublicAvatarLoading(true);
        api.getPublicAvatar(chatData.id)
          .then(url => { if (url) setPublicAvatarPreview(url); })
          .catch(e => console.warn("Public avatar load error", e))
          .finally(() => setIsPublicAvatarLoading(false));
      }
    };

    loadData();
  }, [chatData, api, decryptionKey, getCache, updateCache]);

  useEffect(() => {
    if (chatData?.id) {
      setQuickLogin(isKeyInKM(chatData.id));
    }
  }, [chatData, isKeyInKM]);

  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'public') {
          setPublicAvatar(file);
          setPublicAvatarPreview(reader.result);
          setIsPublicAvatarLoading(false); 
        } else {
          setPrivateAvatar(file);
          setPrivateAvatarPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmAddUser = () => {
    if (newUserEmail.trim() && !participants.includes(newUserEmail.trim())) {
      setParticipants([...participants, newUserEmail.trim()]);
      setNewUserEmail('');
      setShowAddUser(false);
    }
  };

  const handleRemoveParticipant = (email) => setParticipants(participants.filter(p => p !== email));
  
  const handleGetInviteLink = async () => {
    if(!api || !chatData) return;
    setLinkLoading(true);
    try {
        const result = await api.addParticipant(chatData.id);
        if(result && result.inviteLink) setInviteLink(result.inviteLink);
        else alert(t('editChat.alertLinkFailed'));
    } catch(e) { alert(t('app.alertError') + e.message); } 
    finally { setLinkLoading(false); }
  };

  const handleToggleQuickLogin = async () => {
    const newState = !quickLogin;
    if (newState) {
      if (decryptionKey) {
        await addKeyToKM(chatData.id, decryptionKey);
        setQuickLogin(true);
      } else {
        alert(t('editChat.alertKeyNotFound'));
      }
    } else {
      await removeKeyFromKM(chatData.id);
      setQuickLogin(false);
    }
  };

  const handleSave = async () => {
    if (!chatName.trim()) { alert(t('app.alertName')); return; }
    setIsSaving(true);
    
    const success = await onSave({
      name: chatName.trim(),
      description: description.trim(),
      publicAvatar,
      privateAvatar,
      participants
    });
    
    if (success) {
        updateCache(chatData.id, { description: description.trim() });
        onCancel();
    }
    else alert(t('app.alertFailedSave'));
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (window.confirm(t('editChat.deleteConfirm'))) {
      setIsDeleting(true);
      await onDelete();
      setIsDeleting(false);
    }
  };

  if (isLoading) return <div className={styles.container}><div className={styles.contentWrapper}><h2>{t('loading')}</h2></div></div>;

  const isPublicMode = api ? api.isPublicFolder() : false;

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={onCancel}>← {t('back')}</button>
          <h2 className={styles.title}>{t('editChat.title')}</h2>
        </div>

        <div className={styles.formSection}>
          <div className={styles.avatarsSection}>
            <div className={styles.avatarItem}>
              <input type="file" id="publicAvatarInput" accept="image/*" onChange={(e) => handleImageChange(e, 'public')} className={styles.hiddenInput} />
              <label htmlFor="publicAvatarInput" className={styles.avatarLabel}>
                {publicAvatarPreview ? <img src={publicAvatarPreview} alt="Public" className={styles.avatarImage} /> : <div className={styles.avatarPlaceholder}><span>🌍</span></div>}
                
                {isPublicAvatarLoading && (
                    <div className={styles.avatarLoadingOverlay}>
                        <div className={styles.spinner}></div>
                    </div>
                )}
              </label>
              <span className={styles.avatarText}>{t('createChat.publicAvatar')}</span>
            </div>
            <div className={styles.avatarItem}>
              <input type="file" id="privateAvatarInput" accept="image/*" onChange={(e) => handleImageChange(e, 'private')} className={styles.hiddenInput} />
              <label htmlFor="privateAvatarInput" className={styles.avatarLabel}>
                {privateAvatarPreview ? <img src={privateAvatarPreview} alt="Private" className={styles.avatarImage} /> : <div className={styles.avatarPlaceholder}><span>🔒</span></div>}
              </label>
              <span className={styles.avatarText}>{t('createChat.privateAvatar')}</span>
            </div>
          </div>

          <div className={styles.inputsColumn}>
            <input type="text" className={styles.input} placeholder={t('createChat.namePlaceholder')} value={chatName} onChange={(e) => setChatName(e.target.value)} />
            <textarea className={styles.textarea} placeholder={t('createChat.descPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <button 
            className={`${styles.quickLoginBtn} ${quickLogin ? styles.quickLoginActive : styles.quickLoginInactive}`}
            onClick={handleToggleQuickLogin}
          >
            {t('createChat.quickLogin')}: {quickLogin ? t('yes') : t('no')}
          </button>

          {isPublicMode ? (
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('editChat.inviteLink')}</label>
              {inviteLink ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" className={styles.input} value={inviteLink} readOnly style={{ flex: 1 }} />
                  <button className={`${styles.button} ${styles.primaryBtn}`} onClick={() => {navigator.clipboard.writeText(inviteLink); alert(t('copied'));}}>📋</button>
                </div>
              ) : (
                <button className={styles.button} onClick={handleGetInviteLink} disabled={linkLoading}>
                  {linkLoading ? t('editChat.generating') : t('editChat.getLink')}
                </button>
              )}
              <small style={{ color: '#666', fontSize: '12px' }}>{t('editChat.yandexLinkHint')}</small>
            </div>
          ) : (
            <div className={styles.participantsSection}>
              <label className={styles.label}>{t('createChat.participants')}</label>
              {participants.length > 0 && (
                <div className={styles.participantsList}>
                  {participants.map((email, idx) => (
                    <div key={idx} className={styles.participantTag}>
                      <span>{email}</span>
                      <button className={styles.removeParticipant} onClick={() => handleRemoveParticipant(email)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {!showAddUser ? (
                <button className={styles.addUserBtn} onClick={() => setShowAddUser(true)}>{t('createChat.addUser')}</button>
              ) : (
                <div className={styles.addUserForm}>
                  <input type="email" className={styles.input} placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                  <div className={styles.addUserActions}>
                    <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={() => setShowAddUser(false)}>{t('cancel')}</button>
                    <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleConfirmAddUser}>{t('confirm')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={`${styles.button} ${styles.deleteBtn}`} onClick={handleDelete} disabled={isDeleting || isSaving}> {isDeleting ? t('loading') : t('delete')} </button>
          <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onCancel} disabled={isSaving || isDeleting}> {t('cancel')} </button>
          <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleSave} disabled={isSaving || isDeleting}> {isSaving ? t('loading') : t('save')} </button>
        </div>
      </div>
    </div>
  );
};

export default EditChatPage;