import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import styles from './styles/WarningPage.module.css';

const progressMap = {
  0: 0, 6: 10, 12: 20, 18: 35, 24: 45, 30: 55, 36: 70, 42: 85, 48: 90, 54: 95, 60: 100
};

const WarningPage = ({ onAccept, onCancel }) => {
  const { t } = useTranslation();

  const slogansArray = t('warningPage.slogans', { returnObjects: true });
  const systemMessagesArray = t('warningPage.systemMessages', { returnObjects: true });

  const [shuffledSlogans] = useState(() => {
    const array = Array.isArray(slogansArray) ? [...slogansArray] : [];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  });

  const [timeLeft, setTimeLeft] = useState(60);
  const [progress, setProgress] = useState(0);
  const [systemMessage, setSystemMessage] = useState(systemMessagesArray[0] || '');
  const [currentSloganIndex, setCurrentSloganIndex] = useState(0);
  
  const hasShownDialog = useRef(false);
  const dialogTimeoutRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (dialogTimeoutRef.current) {
        clearTimeout(dialogTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentSecond = 60 - timeLeft;
    
    const msgIndex = Math.min(Math.floor(currentSecond / 6), systemMessagesArray.length - 1);
    if (systemMessagesArray[msgIndex]) {
      setSystemMessage(systemMessagesArray[msgIndex]);
    }

    let currentProgress = 0;
    for (const [sec, prog] of Object.entries(progressMap)) {
      if (currentSecond >= parseInt(sec)) currentProgress = prog;
    }
    setProgress(currentProgress);

    if (timeLeft === 0 && !hasShownDialog.current) {
      hasShownDialog.current = true;
      dialogTimeoutRef.current = setTimeout(() => {
        const isSure = window.confirm(t('warningPage.confirmMessage'));
        if (isSure) {
          onAccept();
        } else {
          onCancel();
        }
      }, 200);
    }
  }, [timeLeft, onAccept, onCancel, systemMessagesArray, t]);

  useEffect(() => {
    const sloganInterval = setInterval(() => {
      setCurrentSloganIndex(prev => (prev + 1) % shuffledSlogans.length);
    }, 3000);

    return () => clearInterval(sloganInterval);
  }, [shuffledSlogans.length]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onCancel}>←</button>
        <h1 className={styles.title}>{t('warningPage.title')}</h1>
        <div style={{ width: '24px' }}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.icon}>🛡️</div>
        
        <div className={styles.sloganContainer}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSloganIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={styles.sloganText}
            >
              {shuffledSlogans[currentSloganIndex]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.form}>
          <div className={styles.systemInfo}>
            <div className={styles.spinner}></div>
            <div className={styles.systemText}>{systemMessage}</div>
          </div>
          
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarFill} style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className={styles.progressPercent}>{progress}%</div>
        </div>
      </div>
    </div>
  );
};

export default WarningPage;