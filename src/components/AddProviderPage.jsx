import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/AddProviderPage.module.css';

const AddProviderPage = ({ onSave, onBack, errorMessage }) => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState('google');
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!clientId.trim()) {
      setError(t('addProviderPage.clientId'));
      return;
    }
    onSave(provider, clientId.trim());
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('addProviderPage.title')}</h2>
          <p className={styles.subtitle}>{t('addProviderPage.subtitle')}</p>
        </div>

        {errorMessage && (
          <div className={styles.authError}>
            ⚠️ {errorMessage}
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('addProviderPage.selectProvider')}</label>
          <select 
            className={styles.select} 
            value={provider} 
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="google">Google Drive</option>
            <option value="yandex">Yandex Drive</option>
            <option value="onedrive">One Drive</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('addProviderPage.clientId')}</label>
          <input
            type="text"
            className={styles.input}
            placeholder={t('addProviderPage.pasteHere')}
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setError(''); }}
          />
          {error && <span className={styles.error}>{error}</span>}
        </div>

        <div className={styles.buttonGroup}>
          <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleConfirm}>
            {t('confirm')}
          </button>
          <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={onBack}>
            {t('back')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProviderPage;