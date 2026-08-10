import { useEffect, useRef } from 'react';

export const useAuthSession = (onSessionExpired) => {
  const callbackRef = useRef(onSessionExpired);
  
  useEffect(() => {
    callbackRef.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => {
    const checkTokenExpiration = () => {
      const expiresAt = sessionStorage.getItem('elysium_expires_at');
      const currentToken = sessionStorage.getItem('elysium_access_token');

      if (currentToken && expiresAt && Date.now() > Number(expiresAt)) {
        if (callbackRef.current) callbackRef.current();
      }
    };

    checkTokenExpiration();

    const interval = setInterval(checkTokenExpiration, 60000);
    window.addEventListener('focus', checkTokenExpiration);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkTokenExpiration);
    };
  }, []); 
};