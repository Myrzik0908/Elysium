import React, { createContext, useContext, useReducer, useCallback } from 'react';

const ChatCacheContext = createContext();

const initialState = {
  caches: {}
};

function chatCacheReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CACHE': {
      const { chatId, data } = action.payload;
      const currentChatCache = state.caches[chatId] || {};
      
      const newCacheData = { ...data };
      if (data.mediaUrls && currentChatCache.mediaUrls) {
        newCacheData.mediaUrls = {
          ...currentChatCache.mediaUrls,
          ...data.mediaUrls
        };
      }

      return {
        ...state,
        caches: {
          ...state.caches,
          [chatId]: {
            ...currentChatCache,
            ...newCacheData,
            lastUpdated: Date.now()
          }
        }
      };
    }
    case 'CLEAR_CACHE': {
      const { chatId } = action.payload;
      const newCaches = { ...state.caches };
      delete newCaches[chatId];
      return { ...state, caches: newCaches };
    }
    default:
      return state;
  }
}

export function ChatCacheProvider({ children }) {
  const [state, dispatch] = useReducer(chatCacheReducer, initialState);

  const updateCache = useCallback((chatId, data) => {
    dispatch({ type: 'UPDATE_CACHE', payload: { chatId, data } });
  }, []);

  const clearCache = useCallback((chatId) => {
    dispatch({ type: 'CLEAR_CACHE', payload: { chatId } });
  }, []);

  const getCache = useCallback((chatId) => {
    return state.caches[chatId];
  }, [state.caches]);

  return (
    <ChatCacheContext.Provider value={{ state, updateCache, clearCache, getCache }}>
      {children}
    </ChatCacheContext.Provider>
  );
}

export function useChatCache() {
  const context = useContext(ChatCacheContext);
  if (!context) {
    throw new Error('useChatCache must be used within ChatCacheProvider');
  }
  return context;
}