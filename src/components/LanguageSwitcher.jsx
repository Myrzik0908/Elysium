import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const languages = [
    { code: 'en', name: 'EN', flag: '🇬🇧' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ru', name: 'RU', flag: '🇷🇺' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'es', name: 'ES', flag: '🇪🇸' },
    { code: 'fr', name: 'FR', flag: '🇫🇷' },
    { code: 'ar', name: 'AR', flag: '🇸🇦' },
    { code: 'bn', name: 'BN', flag: '🇧🇩' },
    { code: 'pt', name: 'PT', flag: '🇧🇷' },
    { code: 'ur', name: 'UR', flag: '🇵🇰' }
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          style={{
            cursor: 'pointer',
            padding: '5px 8px',
            border: i18n.language === lang.code ? '2px solid #000' : '1px solid #ccc',
            background: i18n.language === lang.code ? '#FFF9C4' : 'transparent',
            borderRadius: '4px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {lang.flag} {lang.name}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;