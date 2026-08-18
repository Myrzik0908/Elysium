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

// ADDED: SVG Icon components for a consistent native look
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

// ADDED: Larger SVG icons for empty states
const LargeSearchIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const FolderIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

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

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isMountedRef = useRef(true);
  const loadingRef = useRef(new Set());
  const avatarsRef = useRef({}); 

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    avatarsRef.current = cachedAvatars;
  }, [cachedAvatars]);

  useEffect(() => {
    return () => {
      Object.values(avatarsRef.current).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

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
    if (!api || !chats.length) return;
    
    const visibleChats = searchQuery 
      ? chats.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : chats;
      
    const chatsToLoad = visibleChats.filter(chat => 
      (cachedAvatars[chat.id] === undefined || cachedAvatars[chat.id] === 'failed') && !loadingRef.current.has(chat.id)
    );

    if (chatsToLoad.length === 0) return;

    chatsToLoad.forEach(chat => loadingRef.current.add(chat.id));

    if (isMountedRef.current) {
      setLoadingAvatars(prev => {
        const next = { ...prev };
        chatsToLoad.forEach(c => { next[c.id] = true; });
        return next;
      });
    }

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
            onCacheAvatar(chat.id, 'failed');
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

    if (!isLoading) {
      loadAvatars();
    }
  }, [chats, api, isLoading, cachedAvatars, onCacheAvatar, searchQuery]);

  const sortedChats = useMemo(() => {
    if (!chats) return [];
    
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    const filteredChats = lowerCaseQuery 
      ? chats.filter(chat => chat.name.toLowerCase().includes(lowerCaseQuery))
      : chats;

    return [...filteredChats].sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;
      return timeB - timeA;
    });
  }, [chats, searchQuery]);

  const handleChatClick = (chat) => {
    const chatWithAvatar = {
      ...chat,
      avatarUrl: cachedAvatars[chat.id] || null
    };
    onSelectChat(chatWithAvatar);

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

  const handleOpenSearch = () => setIsSearchActive(true);
  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
  };
  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.menuButton} onClick={onOpenSettings}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        
        {isSearchActive ? (
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('search') || 'Search...'}
            value={searchQuery}
            onChange={handleSearchChange}
            autoFocus
          />
        ) : (
          <div className={styles.titleWrapper}>
            <span className={styles.title}>Elysium</span>
            {providerDisplayName && (
              <span className={styles.providerBadge}>
                {providerDisplayName}
              </span>
            )}
          </div>
        )}

        {isSearchActive ? (
          <button className={styles.menuButton} onClick={handleCloseSearch}>
            <CloseIcon />
          </button>
        ) : (
          <button className={styles.menuButton} onClick={handleOpenSearch}>
            <SearchIcon />
          </button>
        )}
      </div>

      <div className={styles.chatList}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>{t('chatsPage.initializing')}</div>
          </div>
        ) : sortedChats.length === 0 ? (
          searchQuery ? (
            <div className={styles.emptyState}>
              {/* MODIFIED: Replaced emoji with LargeSearchIcon SVG */}
              <div className={styles.emptyIcon}>
                <LargeSearchIcon />
              </div>
              <div className={styles.emptyMessage}>{t('chatsPage.noSearchResults') || 'No chats found'}</div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              {/* MODIFIED: Replaced emoji with FolderIcon SVG */}
              <div className={styles.emptyIcon}>
                <FolderIcon />
              </div>
              <div className={styles.emptyMessage}>{t('chatsPage.noChats')}</div>
              <div className={styles.emptyHint}>{t('chatsPage.createHint')}</div>
            </div>
          )
        ) : (
          sortedChats.map(chat => {
            const lastMsgTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).getTime() : 0;
            const lastVisit = seenHistory[chat.id] || 0;
            const hasNew = lastMsgTime > 0 && lastMsgTime > lastVisit;
            const formattedDate = formatLastMessageDate(chat.lastMessageTime);
            const avatar = cachedAvatars[chat.id];

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
                  ) : avatar && avatar !== 'failed' ? (
                    <img 
                      src={avatar} 
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