import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import GettingStartedPage from './components/GettingStartedPage'; 
import RegisterPage from './components/RegisterPage';
import AddProviderPage from './components/AddProviderPage';
import ChatsPage from './components/ChatsPage';
import CreateChatPage from './components/CreateChatPage';
import SettingsPage from './components/SettingsPage';
import UserAgreementPage from './components/UserAgreementPage';
import ChatPage from './components/ChatPage';
import EnterKeyPage from './components/EnterKeyPage';
import EditProfilePage from './components/EditProfilePage';
import EditChatPage from './components/EditChatPage';
import MasterPasswordPage from './components/MasterPasswordPage';
import WarningPage from './components/WarningPage';
import { ChatCacheProvider } from './context/ChatCacheContext';

import styles from './App.module.css';
import { getProvider, getOAuthUrl, config } from './providers';
import { useKeyManager } from './utils/KeyManager';

import { useAuthSession } from './hooks/useAuthSession';

import { GoogleDriveProvider } from './providers/GoogleDriveProvider';
import { YandexDiskProvider } from './providers/YandexDiskProvider';
import { OneDriveProvider } from './providers/OneDriveProvider';
import { measurePing } from './providers/utils';

const PROVIDERS_MAP = {
  google: GoogleDriveProvider,
  yandex: YandexDiskProvider,
  onedrive: OneDriveProvider
};

const pageVariants = {
  initial: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0, position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }),
  animate: { x: 0, opacity: 1, position: 'relative', width: '100%', height: 'auto', top: 'auto', left: 'auto', transition: { duration: 0.09, ease: 'easeOut' } },
  exit: (direction) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0, position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, transition: { duration: 0.08, ease: 'easeIn' } })
};

function AppContent() {
  const { t } = useTranslation();
  
  const [clientIds, setClientIds] = useState({});
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [token, setToken] = useState(null);
  const [api, setApi] = useState(null);
  const [providerName, setProviderName] = useState(null);
  const [chats, setChats] = useState([]);
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const isInitializing = useRef(false);

  const [activeChat, setActiveChat] = useState(null);
  const [decryptionKey, setDecryptionKey] = useState('');
  const [userEmail, setUserEmail] = useState(null);
  
  const [pings, setPings] = useState({});
  const [cachedAvatars, setCachedAvatars] = useState({});

  const {
    isKMEnabled,
    isLocked,
    kmKeysList,
    isInitialized,
    performUnlock,
    toggleKeyManager,
    saveKeyToKM,
    removeKeyFromKM,
    isKeyInKM,
    resetKM
  } = useKeyManager(providerName, token, userEmail);

  const [direction, setDirection] = useState(1);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('elysium_client_ids');
      if (stored) setClientIds(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('elysium_access_token');
    const storedProvider = sessionStorage.getItem('elysium_provider');
    if (storedToken && storedProvider && !isInitializing.current && !api && !isLocked) {
      initializeCloud(storedProvider, storedToken);
    }
  }, [isLocked, api]);

  useEffect(() => {
    const updatePings = async () => {
      const newPings = {};
      const providersToCheck = Object.keys(clientIds);
      
      for (const key of providersToCheck) {
        if (PROVIDERS_MAP[key]) {
          const ProviderClass = PROVIDERS_MAP[key];
          const url = ProviderClass.linkGetPing();
          const time = await measurePing(url);
          newPings[key] = time;
        }
      }
      setPings(newPings);
    };

    updatePings();
    const interval = setInterval(updatePings, 5000);
    return () => clearInterval(interval);
  }, [clientIds]);

  const initializeCloud = async (provider, currentToken) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setIsLoading(true);
    setToken(currentToken);
    setProviderName(provider);
    
    const apiInstance = getProvider(provider, currentToken);
    setApi(apiInstance);
    
    setCurrentScreen('chats');

    try {
      const userInfo = await apiInstance.getUserInfo();
      if (userInfo) setUserEmail(userInfo.email);
      
      const loadedChats = await apiInstance.listChats();
      setChats(loadedChats);
    } catch (error) {
      console.error('Cloud initialization failed:', error);
      alert(t('error'));
      setCurrentScreen('welcome');
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  };

  const saveClientId = (idProvider, id) => {
    setClientIds(prev => {
      const updated = { ...prev, [idProvider]: id };
      localStorage.setItem('elysium_client_ids', JSON.stringify(updated));
      return updated;
    });
  };

  const revokeAvatars = (avatarsObj) => {
    Object.values(avatarsObj).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  };

  const resetAllIds = () => {
    revokeAvatars(cachedAvatars);
    localStorage.removeItem('elysium_client_ids');
    sessionStorage.removeItem('elysium_access_token');
    sessionStorage.removeItem('elysium_provider');
    sessionStorage.removeItem('elysium_expires_at');
    setClientIds({});
    setToken(null); setApi(null); setChats([]);
    setCurrentScreen('welcome');
    setAuthError(null); setUserEmail(null);
    setProviderName(null);
    setCachedAvatars({});
    resetKM();
  };

  const handleLogin = (loginProvider) => {
    const clientId = clientIds[loginProvider];
    if (!clientId) return;
    setAuthError(null);
    const redirectUri = window.location.origin;
    const url = getOAuthUrl(loginProvider, clientId, redirectUri);
    if (url) window.location.href = url;
  };

  const handleSaveAndLogin = (saveProvider, clientId) => {
    saveClientId(saveProvider, clientId);
    setAuthError(null);
    const redirectUri = window.location.origin;
    const url = getOAuthUrl(saveProvider, clientId, redirectUri);
    if (url) setTimeout(() => { window.location.href = url; }, 100);
  };

  const handleCreateChat = async (chatData) => {
    if (!api) { alert(t('app.alertCloud')); return false; }
    if (!chatData?.name?.trim()) { alert(t('app.alertName')); return false; }
    try {
      const result = await api.createChat(chatData.name, {
          description: chatData.description,
          password: chatData.password,
          participants: chatData.participants,
          avatar: chatData.avatar,
          privateAvatar: chatData.privateAvatar
      });
      
      if (result) {
        if (userEmail && result.id) {
          const warningKey = `elysium_warning_shown_${result.id}_${userEmail}`;
          localStorage.setItem(warningKey, 'true');
        }

        if (isKMEnabled && chatData.quickLogin && chatData.password) {
           await saveKeyToKM(result.id, chatData.password);
        }
        const loadedChats = await api.listChats();
        setChats(loadedChats);
        return true;
      }
      return false;
    } catch (err) { alert(t('app.alertError') + err.message); return false; }
  };
  
  const handleRefreshChats = async () => {
    if (!api) return;
    setIsLoading(true);
    try {
      const loadedChats = await api.listChats();
      setChats(loadedChats);
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExit = () => {
    revokeAvatars(cachedAvatars);
    sessionStorage.removeItem('elysium_access_token');
    sessionStorage.removeItem('elysium_provider');
    sessionStorage.removeItem('elysium_expires_at');
    setToken(null); setApi(null); setChats([]);
    setCurrentScreen('welcome'); setUserEmail(null);
    setCachedAvatars({});
    resetKM();
  };

  const handleSessionExpired = () => {
    alert(t('app.sessionExpired'));
    handleExit();
  };

  useAuthSession(handleSessionExpired);

  const handleCacheAvatar = useCallback((chatId, url) => {
    setCachedAvatars(prev => {
      if (prev[chatId] === url) return prev;
      return { ...prev, [chatId]: url };
    });
  }, []);

  const clearError = () => setAuthError(null);

  const goForward = (screen) => { setDirection(1); setCurrentScreen(screen); };
  const goBack = (screen) => { setDirection(-1); setCurrentScreen(screen); };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    if (isKMEnabled && isKeyInKM(chat.id)) {
      const foundKey = kmKeysList.find(k => k.folderId === chat.id);
      if (foundKey && foundKey.key) {
        setDecryptionKey(foundKey.key);
        goForward('chat');
        return;
      }
    }
    goForward('enterKey');
  };

  const handleKeySubmit = (key) => { 
    setDecryptionKey(key); 
    
    if (activeChat && userEmail) {
      const warningKey = `elysium_warning_shown_${activeChat.id}_${userEmail}`;
      const hasSeenWarning = localStorage.getItem(warningKey);
      
      if (!hasSeenWarning) {
        goForward('warning');
        return;
      }
    }
    
    goForward('chat'); 
  };

  const handleWarningAccept = () => {
    if (activeChat && userEmail) {
      const warningKey = `elysium_warning_shown_${activeChat.id}_${userEmail}`;
      localStorage.setItem(warningKey, 'true');
    }
    goForward('chat');
  };

  const handleWarningCancel = () => {
    setActiveChat(null);
    setDecryptionKey('');
    goBack('chats');
  };

  const handleExitChat = () => { setActiveChat(null); setDecryptionKey(''); goBack('chats'); };
  const handleOpenEditChat = () => { if (activeChat) goForward('editChat'); };

  const handleSaveChatChanges = async (data) => {
    if (!api || !activeChat) return false;
    try {
      if (data.publicAvatar) {
        await api.updateChatAvatar(activeChat.id, decryptionKey, data.publicAvatar, true);
        if (cachedAvatars[activeChat.id] && cachedAvatars[activeChat.id].startsWith('blob:')) {
          URL.revokeObjectURL(cachedAvatars[activeChat.id]);
        }
        setCachedAvatars(prev => {
          const next = { ...prev };
          delete next[activeChat.id];
          return next;
        });
      }

      if (data.name && data.name !== activeChat.name) await api.renameChat(activeChat.id, data.name);
      if (data.description !== undefined) await api.updateChatInfo(activeChat.id, decryptionKey, { description: data.description });
      
      if (data.privateAvatar) await api.updateChatAvatar(activeChat.id, decryptionKey, data.privateAvatar, false);
      if (data.participants && data.participants.length > 0) await api.addParticipant(activeChat.id, data.participants);

      const updatedChat = { ...activeChat, name: data.name || activeChat.name, description: data.description };
      setActiveChat(updatedChat);
      setChats(prev => prev.map(c => c.id === activeChat.id ? {...c, name: updatedChat.name} : c));
      return true;
    } catch (e) { console.error('Save changes error', e); return false; }
  };

  const handleDeleteChat = async () => {
    if (!api || !activeChat) return;
    if (window.confirm(t('app.alertDelete'))) {
        const success = await api.deleteChat(activeChat.id);
        if (success) {
          if(isKMEnabled) await removeKeyFromKM(activeChat.id);
          
          if (cachedAvatars[activeChat.id]) {
            URL.revokeObjectURL(cachedAvatars[activeChat.id]);
            setCachedAvatars(prev => {
              const next = { ...prev };
              delete next[activeChat.id];
              return next;
            });
          }

          setChats(prev => prev.filter(c => c.id !== activeChat.id));
          setActiveChat(null); setDecryptionKey('');
          goBack('chats');
        } else alert(t('app.alertFailedDelete'));
    }
  };

  const hasAnyId = Object.keys(clientIds).length > 0;
  const availableProviders = Object.keys(PROVIDERS_MAP).filter(key => clientIds[key]);

  const providerDisplayName = providerName ? PROVIDERS_MAP[providerName]?.getStyle().name : null;

  const getPingStyle = (time) => {
    if (time === null || time === undefined) return styles.pingError;
    if (time < 200) return styles.pingLow;
    if (time < 500) return styles.pingMedium;
    return styles.pingHigh;
  };

  const getPingText = (time) => {
    if (time === null || time === undefined) return '❌';
    return `${time}ms`;
  };

  if (isLocked && isKMEnabled) {
    return <MasterPasswordPage 
      onSuccess={performUnlock} 
      onDisable={() => toggleKeyManager(false)} 
      providerName={providerName}
    />;
  }

  const renderScreen = () => {
    const screens = {
      register: <RegisterPage onSave={handleSaveAndLogin} onBack={() => { clearError(); goBack('welcome'); }} providerLinks={{ yandex: config.yandex.links.register, google: config.google.links.register, onedrive: config.onedrive.links.register }} errorMessage={authError} />,
      addProvider: <AddProviderPage onSave={handleSaveAndLogin} onBack={() => { clearError(); goBack('welcome'); }} errorMessage={authError} />,
      createChat: <CreateChatPage onCreate={handleCreateChat} onCancel={() => goBack('chats')} api={api} />,
      settings: <SettingsPage 
          onBack={() => goBack('chats')} 
          onExit={handleExit} 
          onOpenUserAgreement={() => goForward('userAgreement')} 
          api={api} token={token} providerName={providerName} 
          kmKeysList={kmKeysList}
          saveKeyToKM={saveKeyToKM}
          removeKeyFromKM={removeKeyFromKM}
          isKMEnabled={isKMEnabled}
          chats={chats}
          toggleKeyManager={toggleKeyManager}
          userEmail={userEmail}
      />,
      userAgreement: <UserAgreementPage onBack={() => goBack('settings')} />,
      editProfile: <EditProfilePage onBack={() => goBack('chat')} api={api} chatId={activeChat?.id} decryptionKey={decryptionKey} userEmail={userEmail} />,
      editChat: <EditChatPage 
          chatData={activeChat} api={api} decryptionKey={decryptionKey} 
          onSave={handleSaveChatChanges} onDelete={handleDeleteChat} onCancel={() => goBack('chat')} 
          isKeyInKM={isKeyInKM} addKeyToKM={saveKeyToKM} removeKeyFromKM={removeKeyFromKM} 
      />,
      enterKey: <EnterKeyPage chatName={activeChat?.name} onBack={() => goBack('chats')} onSubmit={handleKeySubmit} />,
      warning: <WarningPage onAccept={handleWarningAccept} onCancel={handleWarningCancel} />,
      chat: <ChatPage 
          chatId={activeChat?.id} 
          chatName={activeChat?.name} 
          avatarUrl={activeChat?.avatarUrl} 
          decryptionKey={decryptionKey} 
          api={api} 
          onBack={handleExitChat} 
          userEmail={userEmail} 
          onOpenProfile={() => goForward('editProfile')} 
          onOpenEditChat={handleOpenEditChat}
          providerName={providerName} 
      />,
      chats: <ChatsPage 
          chats={chats} 
          isLoading={isLoading} 
          onCreateChat={() => goForward('createChat')} 
          onOpenSettings={() => goForward('settings')} 
          onSelectChat={handleSelectChat} 
          api={api} 
          userEmail={userEmail}
          providerName={providerName}
          providerDisplayName={providerDisplayName}
          onRefreshChats={handleRefreshChats}
          cachedAvatars={cachedAvatars}
          onCacheAvatar={handleCacheAvatar}
      />,
      welcome: (
        <div className={styles.container}>
          <div className={styles.contentWrapper}>
            <div className={styles.header}>
              <span className={styles.welcomeText}>{t('welcome')}</span>
              <h1 className={styles.logoText}>Elysium</h1>
            </div>
            
            {availableProviders.length > 0 && (
              <div className={styles.quickLoginSection}>
                {availableProviders.map(p => {
                  const ProviderClass = PROVIDERS_MAP[p];
                  if (!ProviderClass) return null;
                  
                  const styleConfig = ProviderClass.getStyle();
                  const colorClass = styles[styleConfig.colorClass] || '';
                  const pingTime = pings[p];
                  
                  return (
                    <button 
                      key={p} 
                      className={`${styles.button} ${colorClass}`} 
                      onClick={() => handleLogin(p)}
                    >
                      {styleConfig.icon}
                      <span>{styleConfig.name}</span>
                      <span className={`${styles.pingBadge} ${getPingStyle(pingTime)}`}>
                        {getPingText(pingTime)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            
            <div className={styles.buttonContainer}>
              <button className={`${styles.button} ${styles.secondaryBtn}`} onClick={() => { clearError(); goForward('addProvider'); }}>{t('signIn')}</button>
              <button className={`${styles.button} ${styles.primaryBtn}`} onClick={() => { clearError(); goForward('register'); }}>{t('register')}</button>
            </div>
          </div>
        </div>
      )
    };

    const ScreenComponent = screens[currentScreen];
    
    return (
      <motion.div
        key={currentScreen} 
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ height: '100%', width: '100%' }}
      >
        {ScreenComponent}
      </motion.div>
    );
  };

  return (
    <div className={styles.app}>
      {hasAnyId && ['register', 'addProvider'].includes(currentScreen) && ( <button className={styles.resetButton} onClick={resetAllIds}>🗑️ {t('app.resetIds')}</button> )}
      
      <AnimatePresence mode="wait" custom={direction}>
        {renderScreen()}
      </AnimatePresence>
      
    </div>
  );
}

function App() {
  if (window.location.protocol === 'file:' || window.location.protocol === 'content:') return <GettingStartedPage />;
  return ( 
    <HashRouter>
      <Routes>
        <Route path="/*" element={
          <ChatCacheProvider>
            <AppContent />
          </ChatCacheProvider>
        } />
      </Routes>
    </HashRouter> 
  );
}

export default App;