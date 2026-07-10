import React, { createContext, useContext, useState } from 'react';
import { vi } from '../i18n/vi';
import { en } from '../i18n/en';

type Language = 'vi' | 'en';
type Translations = Record<string, string>;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'vi',
  setLang: () => {},
  t: (key: string) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('oliver_lang') as Language) || 'vi';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('oliver_lang', newLang);
  };

  const getTranslation = (key: string): string => {
    const translations: Translations = lang === 'vi' ? vi : en;
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: getTranslation }}>
      {children}
    </LanguageContext.Provider>
  );
};
