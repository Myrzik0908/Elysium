import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/MasterPasswordPage.module.css';

const MasterPasswordPage = ({ onSuccess, onDisable, providerName }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const success = await onSuccess(password);
    if (!success) {
      setError(t('masterPass.wrongPass'));
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h2 className={styles.title}>{t('masterPass.title')}</h2>
        <p className={styles.subtitle}>
          {t('masterPass.provider')} <strong>{providerName || t('unknown')}</strong>
        </p>
        <p className={styles.subtitle}>{t('masterPass.enterPass')}</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <input 
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('masterPass.enterPass') + "..."}
              className={styles.input}
              autoFocus
              disabled={isLoading}
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {error && <span className={styles.error}>{error}</span>}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? t('masterPass.checking') : t('masterPass.unlock')}
          </button>
        </form>

        <button onClick={onDisable} className={styles.disableBtn}>
          {t('masterPass.disable')}
        </button>
      </div>
    </div>
  );
};

export default MasterPasswordPage;