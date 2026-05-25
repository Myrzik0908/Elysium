import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getKeyFromPassword, 
  filterSensitiveData, 
  parseGifUrl 
} from '../providers/utils'; 
import { useSmartPolling } from '../hooks/useSmartPolling';
import { useChatCache } from '../context/ChatCacheContext';

export const getMediaType = (fileName) => {
  if (!fileName) return null;
  if (fileName.startsWith('voice_')) return 'audio';
  if (fileName.startsWith('video_')) return 'video';
  const ext = fileName.split('.').pop().toLowerCase();
  const images = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const videos = ['mp4', 'webm', 'mov', 'mkv'];
  const audios = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
  const texts = ['txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'css', 'html', 'xml', 'yaml', 'yml', 'md', 'log', 'sh', 'bat', 'c', 'cpp', 'java', 'rb', 'php', 'sql', 'csv', 'ini', 'cfg'];
  if (images.includes(ext)) return 'image';
  if (videos.includes(ext)) return 'video';
  if (audios.includes(ext)) return 'audio';
  if (texts.includes(ext)) return 'text';
  return null;
};

const isCryptoError = (e) => {
  if (e.name === 'OperationError') return true;
  if (e instanceof SyntaxError) return true;
  if (e.message && (e.message.toLowerCase().includes('decrypt') || e.message.toLowerCase().includes('integrity'))) return true;
  return false;
};

export const useChatBackend = ({ 
  chatId, decryptionKey, api, userEmail, providerName 
}) => {
  const { t } = useTranslation();
  const { state, updateCache } = useChatCache();
  
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [chatKey, setChatKey] = useState(null);
  const [chatDescription, setChatDescription] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingMediaIds, setLoadingMediaIds] = useState(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const [displayAvatarUrl, setDisplayAvatarUrl] = useState(null); 
  const [privateAvatarUrl, setPrivateAvatarUrl] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [isChatAvatarLoading, setIsChatAvatarLoading] = useState(true);
  const [areProfilesLoading, setAreProfilesLoading] = useState(true);

  const [replyingTo, setReplyingTo] = useState(null);

  const [hashtagInput, setHashtagInput] = useState(null); 
  const [suggestedHashtags, setSuggestedHashtags] = useState([]);
  const lastSelectionRef = useRef({ start: 0, end: 0 });

  const [recordingMode, setRecordingMode] = useState('audio');
  const [recordingStatus, setRecordingStatus] = useState('idle'); 
  const [recordTime, setRecordTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [recordStream, setRecordStream] = useState(null); 
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  
  const [isDecryptionFailed, setIsDecryptionFailed] = useState(false);
  
  const [loadedFileTexts, setLoadedFileTexts] = useState({});
  const [loadingTextIds, setLoadingTextIds] = useState(new Set());
  const [viewingTextIds, setViewingTextIds] = useState(new Set());

  // --- Refs ---
  const isLoadingRef = useRef(false);
  const lastTimestampRef = useRef(lastTimestamp);
  const chatKeyRef = useRef(chatKey);
  const isRestoredRef = useRef(false);
  const dragCounterRef = useRef(0);
  const isDecryptionFailedRef = useRef(isDecryptionFailed);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const previewAudioRef = useRef(null);
  const mediaStreamRef = useRef(null); 
  const facingModeRef = useRef('user');
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadedMediaUrls = state.caches[chatId]?.mediaUrls || {};

  useEffect(() => { isDecryptionFailedRef.current = isDecryptionFailed; }, [isDecryptionFailed]);

  useEffect(() => {
    if (isDecryptionFailed) {
      setIsChatAvatarLoading(false);
      setAreProfilesLoading(false);
      setIsInitialLoading(false);
    }
  }, [isDecryptionFailed]);

  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch (e) { console.error("Error checking devices", e); }
    };
    checkDevices();
  }, []);

  const allHashtags = useMemo(() => {
    const tags = new Set();
    const regex = /(?:^|\s)(#[^\s]+)/g; 
    messages.forEach(msg => {
      if (msg.text) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(msg.text)) !== null) { tags.add(match[1]); }
      }
    });
    return Array.from(tags);
  }, [messages]);

  useEffect(() => {
    if (!hashtagInput) { setSuggestedHashtags([]); return; }
    const query = hashtagInput.toLowerCase();
    setSuggestedHashtags(allHashtags.filter(tag => tag.toLowerCase().startsWith(query)).slice(0, 7));
  }, [hashtagInput, allHashtags]);

  const handleTextareaSelect = (e) => {
    const target = e.target;
    lastSelectionRef.current = { start: target.selectionStart, end: target.selectionEnd };
  };

  const handleSelectHashtag = (tag) => {
    if (!textareaRef.current) return;
    const cursorPos = lastSelectionRef.current.start;
    const text = inputValue;
    const textBefore = text.substring(0, cursorPos);
    const textAfter = text.substring(cursorPos);
    const lastHashIndex = textBefore.lastIndexOf('#');
    if (lastHashIndex !== -1) {
      const newValue = textBefore.substring(0, lastHashIndex) + tag + ' ' + textAfter;
      setInputValue(newValue); updateCache(chatId, { inputValue: newValue }); setHashtagInput(null);
      textareaRef.current.focus();
      const newCursorPos = lastHashIndex + tag.length + 1;
      setTimeout(() => { textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos); lastSelectionRef.current = { start: newCursorPos, end: newCursorPos }; }, 0);
    }
  };

  useEffect(() => {
    if (!chatId || !userEmail || !providerName) return;
    const key = `elysium_seen_${providerName}_${userEmail}`;
    const updateSeenTime = () => { try { const raw = localStorage.getItem(key); const data = raw ? JSON.parse(raw) : {}; data[chatId] = Date.now(); localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} };
    updateSeenTime(); const interval = setInterval(updateSeenTime, 5000); return () => clearInterval(interval);
  }, [chatId, userEmail, providerName]);

  useEffect(() => { lastTimestampRef.current = lastTimestamp; }, [lastTimestamp]);
  useEffect(() => { chatKeyRef.current = chatKey; }, [chatKey]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (textareaRef.current && recordingStatus === 'idle') {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue, recordingStatus]);

  useEffect(() => {
    isRestoredRef.current = false;
    setMessages([]); setLastTimestamp(null); lastTimestampRef.current = null;
    setChatKey(null); setPrivateAvatarUrl(null); setChatDescription('');
    setUserProfiles({}); setInputValue(''); setIsInitialLoading(true);
    setIsChatAvatarLoading(true); setAreProfilesLoading(true); setImgError(false);
    setIsDecryptionFailed(false);
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const cachedData = state.caches[chatId];
    if (cachedData && !isRestoredRef.current) {
      isRestoredRef.current = true;
      if (cachedData.chatKey) setChatKey(cachedData.chatKey);
      if (cachedData.messages) { setMessages(cachedData.messages); if (cachedData.messages.length > 0) setIsInitialLoading(false); }
      if (cachedData.userProfiles) { setUserProfiles(cachedData.userProfiles); setAreProfilesLoading(false); }
      if (cachedData.privateAvatarUrl) { setPrivateAvatarUrl(cachedData.privateAvatarUrl); setIsChatAvatarLoading(false); }
      if (cachedData.inputValue) setInputValue(cachedData.inputValue);
      if (cachedData.lastTimestamp) setLastTimestamp(cachedData.lastTimestamp);
      if (cachedData.description) setChatDescription(cachedData.description);
    }
  }, [chatId, state.caches]);

  useEffect(() => {
    if (chatKey || !api || !chatId) return;
    let isCancelled = false;
    const loadKey = async () => {
      if (!decryptionKey) {
        setIsDecryptionFailed(true);
        setIsInitialLoading(false);
        return;
      }
      try {
        const json = await api.getChatInfo(chatId, decryptionKey);
        if (!isCancelled && json && json.salt) {
           const key = await getKeyFromPassword(decryptionKey, json.salt);
           setChatKey(key); updateCache(chatId, { chatKey: key, description: json.description });
           if (json.description) setChatDescription(json.description);
        } else if (!isCancelled) {
           setIsDecryptionFailed(true);
           setIsInitialLoading(false);
        }
      } catch (e) { 
        console.error('Chat key load error:', e); 
        if (!isCancelled) {
          setIsDecryptionFailed(isCryptoError(e));
          setIsInitialLoading(false);
        }
      }
    };
    loadKey(); return () => { isCancelled = true; };
  }, [decryptionKey, api, chatId, chatKey, updateCache]);

  useEffect(() => {
    if (!chatKey || !api || !chatId || privateAvatarUrl) return;
    let isCancelled = false;
    const loadAvatar = async () => {
      setIsChatAvatarLoading(true);
      try {
        const privUrl = await api.getPrivateAvatarUrl(chatId, chatKey);
        if (!isCancelled && privUrl) { setPrivateAvatarUrl(privUrl); updateCache(chatId, { privateAvatarUrl: privUrl }); }
      } catch (e) { console.error('Avatar load error:', e); } finally { if (!isCancelled) setIsChatAvatarLoading(false); }
    };
    loadAvatar(); return () => { isCancelled = true; };
  }, [chatKey, api, chatId, privateAvatarUrl, updateCache]);

  useEffect(() => {
    if (!api || !chatId || !decryptionKey) return;
    if (Object.keys(userProfiles).length > 0 && isRestoredRef.current) return; 
    const loadProfiles = async () => {
      setAreProfilesLoading(true);
      try { const profiles = await api.getAllUserProfiles(chatId, decryptionKey); setUserProfiles(profiles); updateCache(chatId, { userProfiles: profiles }); } 
      catch (e) { console.error("Load profiles error", e); } finally { setAreProfilesLoading(false); }
    };
    if (chatKey) loadProfiles();
  }, [api, chatId, decryptionKey, chatKey, updateCache]);

  const loadMessages = useCallback(async () => {
    if (!api || !chatId || !chatKeyRef.current) return 0;
    if (isLoadingRef.current) return 0;
    if (isDecryptionFailedRef.current) return 0;
    isLoadingRef.current = true;
    try {
      const newMessages = await api.getMessages(chatId, chatKeyRef.current, lastTimestampRef.current);
      if (isInitialLoading) setIsInitialLoading(false);
      if (newMessages.length === 0) return 0;
      const processed = [];
      for (const msg of newMessages) {
        msg.text = filterSensitiveData(msg.text || '');
        if (msg.text) { const urlMatch = msg.text.match(/(https?:\/\/[^\s]+)/g); if (urlMatch) { const potentialGif = await parseGifUrl(urlMatch[0]); if (potentialGif) msg.gifUrl = potentialGif; } }
        processed.push(msg);
      }
      const getMsgKey = (m) => `${m.sender}_${m.timestamp}`;
      setMessages(prev => {
        const existingKeys = new Set(prev.map(getMsgKey));
        const uniqueNew = processed.filter(m => !existingKeys.has(getMsgKey(m)));
        if (uniqueNew.length === 0) return prev;
        const updatedMessages = [...prev, ...uniqueNew];
        const latestTs = uniqueNew[uniqueNew.length - 1].timestamp;
        updateCache(chatId, { messages: updatedMessages, lastTimestamp: latestTs });
        setLastTimestamp(latestTs); lastTimestampRef.current = latestTs;
        return updatedMessages;
      });
      return processed.length;
    } catch (e) { 
      console.error("Load messages error", e); 
      if (isCryptoError(e)) {
        setIsDecryptionFailed(true);
        setIsInitialLoading(false);
      }
      if (isInitialLoading) setIsInitialLoading(false); 
      return 0; 
    } finally { isLoadingRef.current = false; }
  }, [api, chatId, updateCache, isInitialLoading]);

  const { resetActivity } = useSmartPolling(loadMessages, [api, chatId, chatKey]);

  const handleCopyMessage = (text, messageId) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedMessageId(messageId); setTimeout(() => setCopiedMessageId(null), 2000); }).catch(console.error);
  };

  const handleDeleteMessage = async (msg) => {
    if (!window.confirm(t('confirmDeleteMessage'))) return;
    const idToDelete = msg.id;
    const mediaUrlToRestore = loadedMediaUrls[idToDelete];
    setMessages(prev => {
      const nextList = prev.filter(m => m.id !== idToDelete);
      let newLastTimestamp = lastTimestampRef.current;
      if (prev.length > 0 && prev[prev.length - 1].id === idToDelete) {
        const newLastMsg = nextList.length > 0 ? nextList[nextList.length - 1] : null;
        newLastTimestamp = newLastMsg ? newLastMsg.timestamp : null;
        setLastTimestamp(newLastTimestamp); lastTimestampRef.current = newLastTimestamp;
      }
      const newMediaUrls = { ...(state.caches[chatId]?.mediaUrls || {}) };
      if (newMediaUrls[idToDelete]) delete newMediaUrls[idToDelete];
      updateCache(chatId, { messages: nextList, lastTimestamp: newLastTimestamp, mediaUrls: newMediaUrls });
      return nextList;
    });
    try {
      if (msg.linkFile && msg.fileId) await api.deleteResource(msg.fileId);
      if (msg._fileId) await api.deleteResource(msg._fileId);
      if (typeof api.deleteMessage === 'function') await api.deleteMessage(chatId, idToDelete);
    } catch (e) {
      console.error("Failed to delete message", e); alert(t('error'));
      setMessages(prev => {
        if (prev.some(m => m.id === idToDelete)) return prev;
        const restoredList = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const restoredLastTs = restoredList.length > 0 ? restoredList[restoredList.length - 1].timestamp : null;
        setLastTimestamp(restoredLastTs); lastTimestampRef.current = restoredLastTs;
        const restoredMediaUrls = { ...(state.caches[chatId]?.mediaUrls || {}) };
        if (mediaUrlToRestore) restoredMediaUrls[idToDelete] = mediaUrlToRestore;
        updateCache(chatId, { messages: restoredList, lastTimestamp: restoredLastTs, mediaUrls: restoredMediaUrls });
        return restoredList;
      });
    }
  };

  const handleViewMedia = async (msg) => {
    if (!msg.fileId || !chatKeyRef.current) return;
    setLoadingMediaIds(prev => new Set(prev).add(msg.id));
    try { const blob = await api.downloadFile(msg.fileId, chatKeyRef.current); if (blob) updateCache(chatId, { mediaUrls: { [msg.id]: URL.createObjectURL(blob) } }); } 
    catch (e) { console.error("View media error", e); alert(t('error')); } finally { setLoadingMediaIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; }); }
  };

  const handleDownloadFile = async (msg) => {
    if (!msg.fileId || !chatKeyRef.current) return;
    const cachedUrl = loadedMediaUrls[msg.id];
    if (cachedUrl) { triggerDownload(cachedUrl, msg.fileName); return; }
    try {
      setLoadingMediaIds(prev => new Set(prev).add(msg.id));
      const blob = await api.downloadFile(msg.fileId, chatKeyRef.current);
      if (!blob) throw new Error(t('error'));
      const url = URL.createObjectURL(blob);
      updateCache(chatId, { mediaUrls: { [msg.id]: url } }); triggerDownload(url, msg.fileName);
    } catch (e) { console.error("Download error", e); alert(t('error')); } finally { setLoadingMediaIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; }); }
  };

  const triggerDownload = (url, fileName) => { const a = document.createElement('a'); a.href = url; a.download = fileName || 'download'; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  const handleOpenFullscreen = (e, url) => {
    e.stopPropagation(); if (!url) return;
    const overlay = document.createElement('div'); overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out;`;
    const img = document.createElement('img'); img.src = url; img.style.cssText = 'max-width: 95%; max-height: 95%; object-fit: contain;';
    overlay.onclick = () => document.body.removeChild(overlay); overlay.appendChild(img); document.body.appendChild(overlay);
  };

  const handleStartReply = (msg) => { setReplyingTo(msg); textareaRef.current?.focus(); };
  const handleCancelReply = () => { setReplyingTo(null); };

  const handleToggleTextView = async (msg) => {
    const msgId = msg.id;
    const isViewing = viewingTextIds.has(msgId);
    
    if (isViewing) {
      setViewingTextIds(prev => { const next = new Set(prev); next.delete(msgId); return next; });
    } else {
      setViewingTextIds(prev => new Set(prev).add(msgId));
      if (!loadedFileTexts[msgId] && !loadingTextIds.has(msgId)) {
        if (!msg.fileId || !chatKeyRef.current) return;
        setLoadingTextIds(prev => new Set(prev).add(msgId));
        try {
          const blob = await api.downloadFile(msg.fileId, chatKeyRef.current);
          if (blob) {
            const text = await blob.text();
            setLoadedFileTexts(prev => ({ ...prev, [msgId]: text }));
          }
        } catch (e) { console.error("View text file error", e); alert(t('error')); } 
        finally { setLoadingTextIds(prev => { const next = new Set(prev); next.delete(msgId); return next; }); }
      }
    }
  };

  const handleSendMessage = async (text, file = null) => {
    if (isDecryptionFailedRef.current) return;
    if (!text.trim() && !file) return; if (!chatKeyRef.current) return; setIsUploading(true);
    const timestamp = new Date().toISOString(); const tempId = 'temp_' + Date.now();
    let replyToData = replyingTo ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text, fileName: replyingTo.fileName } : null;
    const optimisticMessage = { id: tempId, text: filterSensitiveData(text), sender: userEmail, timestamp, linkFile: !!file, pending: true, fileName: file ? file.name : null, fileId: null, gifUrl: null, replyTo: replyToData };
    let localFileUrl = null;
    if (file && getMediaType(file.name)) { localFileUrl = URL.createObjectURL(file); updateCache(chatId, { mediaUrls: { [tempId]: localFileUrl } }); }
    setMessages(prev => { const exists = prev.some(m => m.sender === userEmail && m.timestamp === timestamp); if (exists) return prev; const currentMessages = [...prev, optimisticMessage]; updateCache(chatId, { messages: currentMessages }); return currentMessages; });
    setInputValue(''); setReplyingTo(null); setHashtagInput(null); updateCache(chatId, { inputValue: '' }); resetActivity();
    let parsedGifUrl = null; if (text) { const urlMatch = text.match(/(https?:\/\/[^\s]+)/g); if (urlMatch) parsedGifUrl = await parseGifUrl(urlMatch[0]); }
    try {
      let fileMeta = null; if (file) { fileMeta = await api.uploadFile(chatId, file, file.name, chatKeyRef.current); if (!fileMeta) throw new Error(t('error')); }
      const messageToSave = { id: timestamp, text: filterSensitiveData(text), sender: userEmail, timestamp, linkFile: !!fileMeta, fileId: fileMeta ? fileMeta.id : null, fileName: fileMeta ? fileMeta.originalName : null, replyTo: replyToData };
      const msgFileId = await api.sendMessage(chatId, messageToSave, chatKeyRef.current);
      if (msgFileId) {
        setMessages(prev => {
          const index = prev.findIndex(m => m.id === tempId);
          if (index === -1) { const exists = prev.some(m => m.sender === userEmail && m.timestamp === timestamp); if(exists) return prev; const finalList = [...prev, { ...messageToSave, pending: false, gifUrl: parsedGifUrl, _fileId: msgFileId }]; updateCache(chatId, { messages: finalList, lastTimestamp: timestamp }); setLastTimestamp(timestamp); lastTimestampRef.current = timestamp; return finalList; }
          const finalList = prev.map(m => m.id === tempId ? { ...messageToSave, pending: false, gifUrl: parsedGifUrl, _fileId: msgFileId } : m);
          updateCache(chatId, { messages: finalList, lastTimestamp: timestamp }); setLastTimestamp(timestamp); lastTimestampRef.current = timestamp;
          if (localFileUrl) updateCache(chatId, { mediaUrls: { [messageToSave.id]: localFileUrl } });
          return finalList;
        });
      } else { throw new Error(t('error')); }
    } catch (err) {
      console.error('Send error:', err); if (localFileUrl) URL.revokeObjectURL(localFileUrl);
      setMessages(prev => { const rollbackList = prev.filter(m => m.id !== tempId); updateCache(chatId, { messages: rollbackList }); return rollbackList; });
      alert(t('error') + ': ' + err.message);
    } finally { setIsUploading(false); }
  };

  const resetRecordingState = useCallback(() => {
    setRecordingStatus('idle'); setRecordTime(0); setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(track => track.stop()); mediaStreamRef.current = null; }
    setRecordStream(null);
  }, [previewUrl]);

  const startRecordingStream = async (constraints, mode) => {
    if (isUploading || recordingStatus !== 'idle' || isDecryptionFailedRef.current) return;
    try {
      setRecordingMode(mode);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream; if (mode === 'video') setRecordStream(stream);
      let mimeType = mode === 'video' ? 'video/webm;codecs=vp8,opus' : 'audio/mp4;codecs=aac';
      if (!MediaRecorder.isTypeSupported(mimeType)) { mimeType = mode === 'video' ? 'video/webm' : 'audio/webm;codecs=opus'; if (!MediaRecorder.isTypeSupported(mimeType)) { mimeType = mode === 'video' ? 'video/mp4' : 'audio/webm'; } }
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorderRef.current.onstop = () => {
        if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(track => track.stop()); mediaStreamRef.current = null; }
        setRecordStream(null);
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType });
        setRecordedBlob(blob); setPreviewUrl(URL.createObjectURL(blob)); setRecordingStatus('preview');
      };
      mediaRecorderRef.current.start(); setRecordingStatus('recording'); setRecordTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err) { console.error("Error accessing media devices:", err); alert(t('microphonePermissionDenied') || "Media access denied."); resetRecordingState(); }
  };

  const handleStartAudioRecording = () => startRecordingStream({ audio: true }, 'audio');
  const handleStartVideoRecording = () => { facingModeRef.current = 'user'; startRecordingStream({ audio: true, video: { facingMode: 'user' } }, 'video'); };

  const handleSwitchCamera = async () => {
    if (recordingStatus !== 'recording' || recordingMode !== 'video' || !mediaStreamRef.current || !hasMultipleCameras) return;
    const newMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newMode;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode } });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const currentStream = mediaStreamRef.current;
      currentStream.getVideoTracks().forEach(track => { track.stop(); currentStream.removeTrack(track); });
      currentStream.addTrack(newVideoTrack);
      setRecordStream(new MediaStream(currentStream.getTracks()));
    } catch (err) { console.error("Switch camera error:", err); alert(t('error') || "Failed to switch camera"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop(); clearInterval(recordingIntervalRef.current); };

  const handleSendRecordedMedia = () => {
    if (recordedBlob) {
      const isVideo = recordingMode === 'video'; let extension = isVideo ? 'webm' : 'm4a'; let prefix = isVideo ? 'video_' : 'voice_';
      if (!isVideo && recordedBlob.type.includes('webm')) extension = 'webm'; if (isVideo && recordedBlob.type.includes('mp4')) extension = 'mp4';
      handleSendMessage('', new File([recordedBlob], `${prefix}${Date.now()}.${extension}`, { type: recordedBlob.type }));
      resetRecordingState();
    }
  };

  const handleDeleteVoice = () => resetRecordingState();
  const formatRecordTime = (seconds) => { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; };

  const handleDragEnter = (e) => { if (isDecryptionFailedRef.current) return; e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true); };
  const handleDragLeave = (e) => { if (isDecryptionFailedRef.current) return; e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false); };
  const handleDragOver = (e) => { if (isDecryptionFailedRef.current) return; e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => { if (isDecryptionFailedRef.current) return; e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounterRef.current = 0; if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { Array.from(e.dataTransfer.files).forEach(file => handleSendMessage('', file)); e.dataTransfer.clearData(); } };

  const handleInputChange = (e) => {
    if (isDecryptionFailedRef.current) return;
    const val = e.target.value; setInputValue(val); updateCache(chatId, { inputValue: val });
    const textareaNode = textareaRef.current; const cursorPos = textareaNode ? textareaNode.selectionStart : 0;
    lastSelectionRef.current = { start: cursorPos, end: textareaNode ? textareaNode.selectionEnd : 0 };
    const textBeforeCursor = val.substring(0, cursorPos); const match = textBeforeCursor.match(/(?:^|\s)(#[^\s]*)$/);
    if (match) setHashtagInput(match[1]); else setHashtagInput(null);
  };

  const handleKeyDown = (e) => {
    if (isDecryptionFailedRef.current) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (e.key === 'Enter' && !e.shiftKey) { if (!isMobile) { e.preventDefault(); handleSendMessage(inputValue); } }
  };

  const handleAttach = () => { if (isDecryptionFailedRef.current) return; fileInputRef.current?.click(); };
  const handleFileChange = (e) => { const file = e.target.files[0]; if (!file) return; handleSendMessage(inputValue, file); if(fileInputRef.current) fileInputRef.current.value = ""; };

  const handleExportChat = useCallback(() => {
    if (isDecryptionFailedRef.current) return;

    const participantNames = Object.values(userProfiles)
      .map(profile => profile.name)
      .filter(Boolean);

    const exportData = {
      chatId,
      exportDate: new Date().toISOString(),
      participants: participantNames,
      messages: messages.map(msg => {
        const cleanMsg = { ...msg };
        
        const profile = userProfiles[msg.sender];
        cleanMsg.senderName = profile?.name || 'User';
        
        delete cleanMsg.sender;
        delete cleanMsg.pending;
        delete cleanMsg._fileId;
        delete cleanMsg.gifUrl;
        delete cleanMsg.avatarUrl;
        
        if (cleanMsg.replyTo) {
          const replyProfile = userProfiles[cleanMsg.replyTo.sender];
          cleanMsg.replyTo.senderName = replyProfile?.name || 'User';
          delete cleanMsg.replyTo.sender;
          delete cleanMsg.replyTo.avatarUrl;
        }
        
        return cleanMsg;
      })
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `chat_${chatId}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [messages, userProfiles, chatId]);

  return {
    messages, userProfiles, inputValue, isUploading, chatDescription, loadingMediaIds, copiedMessageId,
    recordingStatus, recordingMode, recordTime, previewUrl, recordStream, isDragging, displayAvatarUrl,
    privateAvatarUrl, imgError, isChatAvatarLoading, areProfilesLoading, loadedMediaUrls, chatKey, 
    replyingTo, hashtagInput, suggestedHashtags, isInitialLoading, hasMultipleCameras,
    loadedFileTexts, loadingTextIds, viewingTextIds, isDecryptionFailed,
    setImgError, textareaRef, fileInputRef, previewAudioRef,
    hasText: inputValue.trim().length > 0,
    handleSendMessage, handleDeleteMessage, handleViewMedia, handleDownloadFile, handleOpenFullscreen,
    handleCopyMessage, handleInputChange, handleKeyDown, handleAttach, handleFileChange,
    handleStartAudioRecording, handleStartVideoRecording, handleSwitchCamera, handleSendVoice: handleSendRecordedMedia,
    handleDeleteVoice, stopRecording, formatRecordTime, handleStartReply, handleCancelReply,
    handleToggleTextView,
    handleTextareaSelect, handleSelectHashtag, handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    handleExportChat
  };
};