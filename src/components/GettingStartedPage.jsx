import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/GettingStartedPage.module.css';

const GettingStartedPage = () => {
  const { t } = useTranslation();
  
  const desktopRef = useRef(null);
  const androidRef = useRef(null);
  const iosRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('gettingStarted.title')}</h1>
          <p className={styles.subtitle}>{t('gettingStarted.subtitle')}</p>
          <p className={styles.description}>
            {t('gettingStarted.description')}
          </p>
        </header>

        <nav className={styles.tabs}>
          <button className={styles.tabBtn} onClick={() => scrollToSection(desktopRef)}>
            {t('gettingStarted.tabs.desktop')}
          </button>
          <button className={styles.tabBtn} onClick={() => scrollToSection(androidRef)}>
            {t('gettingStarted.tabs.android')}
          </button>
          <button className={styles.tabBtn} onClick={() => scrollToSection(iosRef)}>
            {t('gettingStarted.tabs.ios')}
          </button>
        </nav>

        <div className={styles.sections}>

          {/* --- Desktop Section --- */}
          <section ref={desktopRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('gettingStarted.tabs.desktop')}</h2>
            
            <div className={styles.card}>
              <h3>{t('gettingStarted.whyTitle')}</h3>
              <p>{t('gettingStarted.whyText')}</p>
            </div>

            <div className={styles.card}>
              <h3>{t('gettingStarted.winTitle')}</h3>
              <p><strong>{t('gettingStarted.winOpt1')}</strong></p>
              <ol>
                <li>{t('gettingStarted.winStep1')}</li>
                <li>{t('gettingStarted.winStep2')}</li>
                <li>{t('gettingStarted.winStep3')}</li>
              </ol>
              <div className={styles.codeBlock}>
                <code>python -m http.server 8000</code>
              </div>
              
              <p style={{marginTop: '20px'}}><strong>{t('gettingStarted.winOpt2')}</strong></p>
              <ol>
                <li>{t('gettingStarted.winOpt2Step1')}</li>
                <li>{t('gettingStarted.winOpt2Step2')}</li>
                <li>{t('gettingStarted.winOpt2Step3')}</li>
              </ol>
            </div>

            <div className={styles.card}>
              <h3>macOS / Linux</h3>
              <p>{t('gettingStarted.macText')}</p>
              <div className={styles.codeBlock}>
                <code>python3 -m http.server 8000</code>
              </div>
              <p>{t('gettingStarted.macHint')}</p>
            </div>
          </section>

          {/* --- Android Section --- */}
          <section ref={androidRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('gettingStarted.tabs.android')}</h2>
            
            <div className={styles.card}>
              <p>{t('gettingStarted.androidRec')}</p>
              <a href="https://play.google.com/store/apps/details?id=com.phlox.simpleserver" target="_blank" rel="noreferrer" className={styles.storeLink}>
                Download on Google Play
              </a>
              
              <h3>{t('gettingStarted.androidInst')}</h3>
              <ol>
                <li>{t('gettingStarted.androidInst1')}</li>
                <li>{t('gettingStarted.androidInst2')}</li>
                <li>{t('gettingStarted.androidInst3')}</li>
                <li>{t('gettingStarted.androidInst4')}</li>
                <li>{t('gettingStarted.androidInst5')}</li>
              </ol>
            </div>
          </section>

          {/* --- iOS Section --- */}
          <section ref={iosRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('gettingStarted.tabs.ios')}</h2>
            
            <div className={styles.card}>
              <p>{t('gettingStarted.iosRec')}</p>
              <a href="https://apps.apple.com/app/documents-file-manager-docs/id364901807" target="_blank" rel="noreferrer" className={styles.storeLink}>
                Download on App Store
              </a>

              <h3>{t('gettingStarted.androidInst')}</h3>
              <ol>
                <li>{t('gettingStarted.iosInst1')}</li>
                <li>{t('gettingStarted.iosInst2')}</li>
                <li>{t('gettingStarted.iosInst3')}</li>
                <li>{t('gettingStarted.iosInst4')}</li>
                <li>{t('gettingStarted.iosInst5')}</li>
              </ol>
            </div>
          </section>

        </div>

        <footer className={styles.footer}>
          {t('gettingStarted.footer')}
        </footer>
      </div>
    </div>
  );
};

export default GettingStartedPage;