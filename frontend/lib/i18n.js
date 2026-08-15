import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  ru: {
    settings: 'Настройки',
    save: 'Сохранить',
    cancel: 'Отмена',
    language: 'Язык интерфейса',
    russian: 'Русский',
    english: 'English',
    profile: 'Профиль',
    security: 'Безопасность',
    notifications: 'Уведомления',
    privacy: 'Приватность',
    logout: 'Выйти',
    login: 'Войти',
    register: 'Регистрация',
    send: 'Отправить',
    delete: 'Удалить',
    block: 'Заблокировать',
    unblock: 'Разблокировать',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    balance: 'Баланс',
    chats: 'Чаты',
    newPost: 'Новая запись',
    publish: 'Опубликовать',
    attach: 'Прикрепить',
    noPostsYet: 'Записей пока нет.',
    privateProfile: 'Этот профиль приватный.',
    comments: 'комментариев',
    shares: 'репостов',
    whatsOnYourMind: 'Что у вас нового?',
    shareUpdate: 'Новая запись',
    maxFiles: 'Максимум 5 файлов на публикацию.',
    maxSize: 'Общий размер файлов не должен превышать 100 МБ.',
  },
  en: {
    settings: 'Settings',
    save: 'Save',
    cancel: 'Cancel',
    language: 'Interface language',
    russian: 'Русский',
    english: 'English',
    profile: 'Profile',
    security: 'Security',
    notifications: 'Notifications',
    privacy: 'Privacy',
    logout: 'Log out',
    login: 'Log in',
    register: 'Register',
    send: 'Send',
    delete: 'Delete',
    block: 'Block',
    unblock: 'Unblock',
    close: 'Close',
    confirm: 'Confirm',
    balance: 'Balance',
    chats: 'Chats',
    newPost: 'New post',
    publish: 'Publish',
    attach: 'Attach',
    noPostsYet: 'No posts yet.',
    privateProfile: 'This profile is private.',
    comments: 'comments',
    shares: 'shares',
    whatsOnYourMind: "What's on your mind?",
    shareUpdate: 'Share an update',
    maxFiles: 'Maximum 5 files per post.',
    maxSize: 'Total file size must not exceed 100 MB.',
  },
};

export const I18nContext = createContext({ lang: 'ru', t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('ru');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved && translations[saved]) setLang(saved);
  }, []);

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  const t = (key) => translations[lang]?.[key] || translations.ru[key] || key;

  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
