import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/RegisterPage.module.css';

import { GoogleDriveProvider } from '../providers/GoogleDriveProvider';
import { YandexDiskProvider } from '../providers/YandexDiskProvider';
import { OneDriveProvider } from '../providers/OneDriveProvider';

const PROVIDERS_MAP = {
  google: { class: GoogleDriveProvider, link: 'https://console.cloud.google.com/apis/credentials' },
  yandex: { class: YandexDiskProvider, link: 'https://oauth.yandex.ru/client/new' },
  onedrive: { class: OneDriveProvider, link: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps' }
};

const RegisterPage = ({ onSave, onBack, providerLinks, errorMessage }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState('select');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');

  const handleSelectProvider = (key) => {
    setSelectedProvider(key);
    setStep('input');
    const url = providerLinks[key] || PROVIDERS_MAP[key].link;
    window.open(url, '_blank');
  };

  const handleSave = () => {
    if (!clientId.trim()) {
      setError(t('addProviderPage.clientId')); // Reusing key logic
      return;
    }
    onSave(selectedProvider, clientId.trim());
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {step === 'select' ? t('registerPage.createApp') : `${t('register')} ${selectedProvider ? PROVIDERS_MAP[selectedProvider].class.getStyle().name : ''}`}
          </h2>
          <p className={styles.subtitle}>
            {step === 'select' ? t('registerPage.selectProvider') : t('registerPage.pasteId')}
          </p>
        </div>

        {errorMessage && (
          <div className={styles.authError}>
            ⚠️ {errorMessage}
          </div>
        )}

        {step === 'select' ? (
          <div className={styles.buttonGroup}>
            {Object.entries(PROVIDERS_MAP).map(([key, config]) => {
               const styleConfig = config.class.getStyle();
               const colorClass = styles[styleConfig.colorClass] || '';
               return (
                <button 
                  key={key} 
                  className={`${styles.button} ${colorClass}`}
                  onClick={() => handleSelectProvider(key)}
                >
                  {styleConfig.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                className={styles.input}
                placeholder={t('registerPage.enterId')}
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setError(''); }}
              />
              {error && <span className={styles.error}>{error}</span>}
            </div>
            
            <button className={`${styles.button} ${styles.primaryBtn}`} onClick={handleSave}>
              {t('registerPage.saveAndLogin')}
            </button>
            <button className={`${styles.button} ${styles.outlineBtn}`} onClick={() => setStep('select')}>
              {t('registerPage.backToList')}
            </button>
          </div>
        )}

        <button className={styles.backLink} onClick={onBack}>
          ← {t('registerPage.backToWelcome')}
        </button>
      </div>
    </div>
  );
};

export default RegisterPage;