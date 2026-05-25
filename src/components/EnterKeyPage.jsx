import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/EnterKeyPage.module.css';

const EnterKeyPage = ({ chatName, onBack, onSubmit }) => {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!key.trim()) {
      setError(t('addProviderPage.clientId')); 
      return;
    }
    onSubmit(key);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          ←
        </button>
        <h1 className={styles.title}>{t('chatPage.enterKey')}</h1>
        <div style={{ width: '24px' }}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.icon}>🔑</div>
        <p className={styles.message}>
          {t('chatPage.keyForChat')}<br />
          <strong>{chatName || t('chatPage.selectedChat')}</strong>
        </p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.warning}>{t('chatPage.visitVerified')}</p>
          
          <input
            type="password"
            className={styles.input}
            placeholder={t('chatPage.encryptionKey')}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
          {error && <span className={styles.error}>{error}</span>}
          
          <button type="submit" className={styles.button}>
            {t('chatPage.decrypt')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnterKeyPage;