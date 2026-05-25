import { useEffect, useRef, useCallback } from 'react';

const PHASES = [
  { interval: 1000, duration: 30000 },   // Phase 1: Every second, 30 seconds
  { interval: 10000, duration: 300000 }, // Phase 2: every 10 seconds, 5 minutes
  { interval: 60000, duration: 900000 }, // Phase 3: once a minute, 15 minutes
  { interval: 300000, duration: 3600000 }, // Phase 4: every 5 minutes, 1 hour
  { interval: 600000, duration: 7200000 }, // Phase 5: every 10 minutes, 2 hours
  { interval: 1800000, duration: Infinity } // Phase 6: Every 30 minutes, infinitely
];

export const useSmartPolling = (fetchMessages, deps = []) => {
  const phaseIndex = useRef(0);
  const timerRef = useRef(null);
  const phaseStartRef = useRef(Date.now());
  const fetchMessagesRef = useRef(fetchMessages);

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  const resetActivity = useCallback(() => {
    phaseIndex.current = 0;
    phaseStartRef.current = Date.now();
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const currentPhase = PHASES[0];
    timerRef.current = setInterval(tick, currentPhase.interval);
    
    fetchMessagesRef.current();
  }, []);

  const tick = useCallback(async () => {
    const now = Date.now();
    const currentPhase = PHASES[phaseIndex.current];

    if (now - phaseStartRef.current > currentPhase.duration && phaseIndex.current < PHASES.length - 1) {
      phaseIndex.current++;
      phaseStartRef.current = now;
      
      clearInterval(timerRef.current);
      const newPhase = PHASES[phaseIndex.current];
      timerRef.current = setInterval(tick, newPhase.interval);
    }

    try {
      const newMessagesCount = await fetchMessagesRef.current();
      if (newMessagesCount > 0) {
        resetActivity();
      }
    } catch (e) {
      console.error("Polling tick error", e);
    }
  }, [resetActivity]);

  useEffect(() => {
    phaseStartRef.current = Date.now();
    phaseIndex.current = 0;
    
    const currentPhase = PHASES[0];
    timerRef.current = setInterval(tick, currentPhase.interval);
    
    fetchMessagesRef.current();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, deps);

  return { resetActivity };
};