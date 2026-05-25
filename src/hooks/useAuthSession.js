import { useEffect, useRef } from 'react';

export const useAuthSession = (onSessionExpired) => {
  const callbackRef = useRef(onSessionExpired);
  
  useEffect(() => {
    callbackRef.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const provider = params.get('state') || 'google';

      const expiresIn = params.get('expires_in'); 
      
      if (accessToken) {
        sessionStorage.setItem('elysium_access_token', accessToken);
        sessionStorage.setItem('elysium_provider', provider);

        if (expiresIn) {
          const expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000;
          sessionStorage.setItem('elysium_expires_at', expiresAt);
        }

        window.location.replace('/#/');
      }
    }
  }, []);

  useEffect(() => {
    const checkTokenExpiration = () => {
      const expiresAt = sessionStorage.getItem('elysium_expires_at');
      const currentToken = sessionStorage.getItem('elysium_access_token');

      if (expiresAt && currentToken && Date.now() > Number(expiresAt)) {
        if (callbackRef.current) callbackRef.current();
      }
    };

    const interval = setInterval(checkTokenExpiration, 60000);

    window.addEventListener('focus', checkTokenExpiration);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkTokenExpiration);
    };
  }, []); 
};