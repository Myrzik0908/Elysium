import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/UserAgreementPage.module.css';

const UserAgreementPage = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          ← {t('back')}
        </button>
        <h1 className={styles.title}>{t('userAgreement.title')}</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section1')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section2')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section3')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section4Title')}</strong></p>
          <ol className={styles.nestedList}>
            <li>{t('userAgreement.section4Item1')}</li>
            <li>{t('userAgreement.section4Item2')}</li>
            <li>{t('userAgreement.section4Item3')}</li>
          </ol>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section5')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section6')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section7Title')}</strong></p>
          <ol className={styles.nestedList}>
            <li>{t('userAgreement.section7Item1')}</li>
            <li>{t('userAgreement.section7Item2')}</li>
            <li>{t('userAgreement.section7Item3')}</li>
            <li>{t('userAgreement.section7Item4')}</li>
            <li>{t('userAgreement.section7Item5')}</li>
          </ol>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section9')}</strong></p>
        </div>

        <div className={styles.agreementBlock}>
          <p><strong>{t('userAgreement.section10')}</strong></p>
        </div>
      </div>
    </div>
  );
};

export default UserAgreementPage;