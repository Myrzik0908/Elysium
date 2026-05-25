import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/CreateChatPage.module.css';

const CreateChatPage = ({ onCreate, onCancel, api }) => {
  const { t } = useTranslation();
  const [chatName, setChatName] = useState('');
  const [description, setDescription] = useState('');
  
  const [publicAvatar, setPublicAvatar] = useState(null);
  const [publicAvatarPreview, setPublicAvatarPreview] = useState(null);
  const [privateAvatar, setPrivateAvatar] = useState(null);
  const [privateAvatarPreview, setPrivateAvatarPreview] = useState(null);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [participants, setParticipants] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  
  const [quickLogin, setQuickLogin] = useState(false);

  useEffect(() => {
    generatePassword();
  }, []);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let pass = '';
    for (let i = 0; i < 32; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const preventClipboardActions = (e) => {
    e.preventDefault();
  };

  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'public') {
          setPublicAvatar(file);
          setPublicAvatarPreview(reader.result);
        } else {
          setPrivateAvatar(file);
          setPrivateAvatarPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddUserClick = () => setShowAddUser(true);

  const handleConfirmAddUser = () => {
    if (newUserEmail.trim() && !participants.includes(newUserEmail.trim())) {
      setParticipants([...participants, newUserEmail.trim()]);
      setNewUserEmail('');
      setShowAddUser(false);
    }
  };

  const handleRemoveParticipant = (email) => {
    setParticipants(participants.filter(p => p !== email));
  };

  const handleCreate = async () => {
    if (!chatName.trim()) {
      alert(t('app.alertName'));
      return;
    }
    
    if (!password || password.length < 32) {
      alert(t('createChat.alertEncKey'));
      return;
    }
    
    setIsCreating(true);
    try {
      const success = await onCreate({
        name: chatName.trim(),
        description: description.trim(),
        avatar: publicAvatar,
        privateAvatar: privateAvatar,
        password,
        participants,
        quickLogin
      });
      
      if (success) {
        onCancel();
      } else {
        alert(t('app.alertFailedCreate'));
      }
    } catch (err) {
      alert(t('app.alertError') + err.message);
    } finally {
      setIsCreating(false);
    }
  };
  
  const isPublicMode = api ? api.isPublicFolder() : false;

  const passwordLabelClass = password.length >= 32 
    ? `${styles.label} ${styles.labelGreen}` 
    : `${styles.label} ${styles.labelRed}`;

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={onCancel}>← {t('back')}</button>
          <h2 className={styles.title}>{t('createChat.title')}</h2>
        </div>

        <div className={styles.formSection}>
          
          <div className={styles.avatarsSection}>
             <div className={styles.avatarItem}>
              <input type="file" id="publicAvatarInput" accept="image/*" onChange={(e) => handleImageChange(e, 'public')} className={styles.hiddenInput} />
              <label htmlFor="publicAvatarInput" className={styles.avatarLabel}>
                {publicAvatarPreview ? <img src={publicAvatarPreview} alt="Public" className={styles.avatarImage} /> : <div className={styles.avatarPlaceholder}><span>🌍</span></div>}
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

          <div className={styles.formGroup}>
            <label className={passwordLabelClass}>{t('createChat.encKeyLabel')}</label>
            <div className={styles.keyInputWrapper}>
              <input 
                type={showPassword ? "text" : "password"} 
                className={styles.input} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                onCopy={preventClipboardActions}
                onCut={preventClipboardActions}
                onPaste={preventClipboardActions}
                autoComplete="new-password"
              />
              <button className={styles.copyBtn} onClick={handleTogglePasswordVisibility}>
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
              <button className={styles.copyBtn} onClick={generatePassword}>🔄</button>
            </div>
          </div>

          <button 
            className={`${styles.quickLoginBtn} ${quickLogin ? styles.quickLoginActive : styles.quickLoginInactive}`}
            onClick={() => setQuickLogin(!quickLogin)}
          >
            {t('createChat.quickLogin')}: {quickLogin ? t('yes') : t('no')}
          </button>

          <div className={styles.participantsSection}>
            <label className={styles.label}>{t('createChat.participants')}</label>
            
            {!isPublicMode ? (
              <>
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
                  <button className={styles.addUserBtn} onClick={handleAddUserClick}>{t('createChat.addUser')}</button>
                ) : (
                  <div className={styles.addUserForm}>
                    <input type="email" className={styles.input} placeholder="user@email.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                    <div className={styles.addUserActions}>
                      <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={() => setShowAddUser(false)}>{t('cancel')}</button>
                      <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleConfirmAddUser}>{t('confirm')}</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px', marginTop: '10px' }}>
                <small style={{ color: '#666' }}>
                  {t('createChat.yandexHint')}
                </small>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onCancel} disabled={isCreating}>{t('cancel')}</button>
          <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleCreate} disabled={isCreating}>
            {isCreating ? t('loading') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateChatPage;