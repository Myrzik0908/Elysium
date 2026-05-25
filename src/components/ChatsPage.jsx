import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/ChatsPage.module.css';

const formatLastMessageDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const ChatsPage = ({ 
  chats, isLoading, onCreateChat, onOpenSettings, onSelectChat, 
  api, userEmail, providerName, providerDisplayName, onRefreshChats,
  cachedAvatars, onCacheAvatar 
}) => {
  const { t } = useTranslation();
  const [loadingAvatars, setLoadingAvatars] = useState({});
  const [seenHistory, setSeenHistory] = useState({});
  
  const [showUpdateBtn, setShowUpdateBtn] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);

  const isMountedRef = useRef(true);
  const loadingRef = useRef(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clearing memory (Blob URLs) when unmounting a component
  useEffect(() => {
    return () => {
      Object.values(cachedAvatars).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [cachedAvatars]);

  useEffect(() => {
    setShowUpdateBtn(false);
    const timer = setTimeout(() => setShowUpdateBtn(true), 60000);
    return () => clearTimeout(timer);
  }, [updateCounter]);

  useEffect(() => {
    if (!userEmail || !providerName) return;
    const key = `elysium_seen_${providerName}_${userEmail}`;
    try {
      const stored = localStorage.getItem(key);
      setSeenHistory(stored ? JSON.parse(stored) : {});
    } catch (e) {
      console.error("Failed to parse seen history", e);
      setSeenHistory({});
    }
  }, [userEmail, providerName]);

  useEffect(() => {
    if (isLoading || !api || !chats.length) return;
    
    // We find chats that are not yet cached and are not in the process of loading
    const chatsToLoad = chats.filter(chat => 
      cachedAvatars[chat.id] === undefined && !loadingRef.current.has(chat.id)
    );

    if (chatsToLoad.length === 0) return;

    // Marking chats as downloadable
    chatsToLoad.forEach(chat => loadingRef.current.add(chat.id));

    // Updating the UI (showing spinners)
    if (isMountedRef.current) {
      setLoadingAvatars(prev => {
        const next = { ...prev };
        chatsToLoad.forEach(c => { next[c.id] = true; });
        return next;
      });
    }

    // Upload all avatars in parallel
    const loadAvatars = async () => {
      const promises = chatsToLoad.map(async (chat) => {
        try {
          const avatarUrl = await api.getPublicAvatar(chat.id);
          if (isMountedRef.current) {
            onCacheAvatar(chat.id, avatarUrl || null);
          }
        } catch (err) {
          console.error(`Failed to load avatar for ${chat.name}:`, err);
          if (isMountedRef.current) {
            onCacheAvatar(chat.id, null);
          }
        } finally {
          loadingRef.current.delete(chat.id);
          if (isMountedRef.current) {
            setLoadingAvatars(prev => {
              const next = { ...prev };
              delete next[chat.id];
              return next;
            });
          }
        }
      });

      await Promise.all(promises);
    };

    loadAvatars();
  }, [chats, api, isLoading, cachedAvatars, onCacheAvatar]);

  const sortedChats = useMemo(() => {
    if (!chats) return [];
    return [...chats].sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;
      return timeB - timeA;
    });
  }, [chats]);

  const handleChatClick = (chat) => {
    const chatWithAvatar = {
      ...chat,
      avatarUrl: cachedAvatars[chat.id] || null
    };
    onSelectChat(chatWithAvatar);

    // Mark the chat as read to remove the red badge.
    if (chat.lastMessageTime) {
      const key = `elysium_seen_${providerName}_${userEmail}`;
      const newSeenHistory = { ...seenHistory, [chat.id]: Date.now() };
      setSeenHistory(newSeenHistory);
      try {
        localStorage.setItem(key, JSON.stringify(newSeenHistory));
      } catch (e) {
        console.error("Failed to update seen history", e);
      }
    }
  };
  
  const handleUpdateClick = async () => {
    if (onRefreshChats) {
        await onRefreshChats();
        setUpdateCounter(prev => prev + 1);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.menuButton} onClick={onOpenSettings}>☰</button>
        <div className={styles.titleWrapper}>
          <span className={styles.title}>Elysium</span>
          {providerDisplayName && (
            <span className={styles.providerBadge}>
              {providerDisplayName}
            </span>
          )}
        </div>
        <div style={{ width: '24px' }}></div>
      </div>

      <div className={styles.chatList}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>{t('chatsPage.initializing')}</div>
          </div>
        ) : sortedChats.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📁</div>
            <div className={styles.emptyMessage}>{t('chatsPage.noChats')}</div>
            <div className={styles.emptyHint}>{t('chatsPage.createHint')}</div>
          </div>
        ) : (
          sortedChats.map(chat => {
            const lastMsgTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).getTime() : 0;
            const lastVisit = seenHistory[chat.id] || 0;
            const hasNew = lastMsgTime > 0 && lastMsgTime > lastVisit;
            const formattedDate = formatLastMessageDate(chat.lastMessageTime);

            return (
              <div 
                key={chat.id} 
                className={styles.chatItem}
                onClick={() => handleChatClick(chat)}
              >
                <div className={styles.chatAvatar}>
                  {loadingAvatars[chat.id] ? (
                    <div className={styles.avatarLoading}>
                      <div className={styles.avatarSpinner}></div>
                    </div>
                  ) : cachedAvatars[chat.id] ? (
                    <img 
                      src={cachedAvatars[chat.id]} 
                      alt={chat.name} 
                      className={styles.avatarImage}
                    />
                  ) : (
                    chat.name.charAt(0).toUpperCase()
                  )}
                </div>
                
                {hasNew && <div className={styles.unreadBadge}></div>}

                <div className={styles.chatInfo}>
                  <span className={styles.chatName}>{chat.name}</span>
                  <span className={styles.chatMeta}>
                    {formattedDate}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button className={styles.createButton} onClick={onCreateChat} title={t('create')}>
        {t('chatsPage.createBtn')}
      </button>
      
      {showUpdateBtn && (
        <button className={styles.updateButton} onClick={handleUpdateClick} disabled={isLoading}>
          {t('update')}
        </button>
      )}
    </div>
  );
};

export default ChatsPage;