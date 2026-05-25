import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './styles/ChatPage.module.css';
import { useChatBackend } from '../context/ChatBackend';
import MessageItem from './MessageItem';

const MessageSkeleton = ({ isOwn }) => {
  return (
    <div className={`${styles.messageWrapper} ${isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}>
      {!isOwn && (<div className={styles.messageAvatar}><div className={styles.senderAvatarLoading}></div></div>)}
      <div className={`${styles.messageBubble} ${isOwn ? styles.ownBubble : styles.otherBubble} ${styles.skeletonBubble}`}>
        <div className={styles.skeletonText} style={{ width: '100%' }}></div>
        <div className={styles.skeletonText} style={{ width: '60%' }}></div>
      </div>
    </div>
  );
};

const ChatPage = ({ chatId, chatName: propChatName, avatarUrl: propAvatarUrl, decryptionKey, api, onBack, userEmail, onOpenProfile, onOpenEditChat, providerName }) => {
  const { t } = useTranslation();
  const currentChatName = propChatName || t('chat');
  const backend = useChatBackend({ chatId, decryptionKey, api, userEmail, providerName });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(true);
  const dragStartTargetRef = useRef(null); 
  const [currentUserImgError, setCurrentUserImgError] = useState(false);
  const liveVideoRef = useRef(null);
  
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (backend.recordingStatus === 'recording' && backend.recordingMode === 'video' && backend.recordStream) {
      if (liveVideoRef.current && liveVideoRef.current.srcObject !== backend.recordStream) {
        liveVideoRef.current.srcObject = backend.recordStream;
      }
    }
  }, [backend.recordingStatus, backend.recordingMode, backend.recordStream]);

  useEffect(() => {
    if (backend.recordingStatus !== 'recording') setIsVideoReady(false);
  }, [backend.recordingStatus]);

  useEffect(() => {
    if (!backend.isInitialLoading && !backend.isDecryptionFailed) {
      const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); }, 50);
      return () => clearTimeout(timer);
    }
  }, [backend.messages, backend.isInitialLoading, backend.isDecryptionFailed]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight > 200) setShowScrollButton(true); else setShowScrollButton(false);
  };
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToMessage = (id) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.transition = 'background-color 0.2s'; element.style.backgroundColor = '#fffbe6';
      setTimeout(() => { element.style.backgroundColor = ''; }, 1500);
    }
  };

  const fallbackLetter = currentChatName ? currentChatName[0].toUpperCase() : 'U';
  const finalAvatarUrl = backend.privateAvatarUrl || propAvatarUrl;
  const showFallback = (!finalAvatarUrl || backend.imgError);
  const currentUserProfile = backend.userProfiles[userEmail] || {};
  const currentUserAvatarUrl = currentUserProfile.avatarUrl;
  const currentUserFallback = userEmail ? userEmail[0].toUpperCase() : 'U';

  const getReplyPreviewContent = (msg) => { if (!msg) return ''; if (msg.fileName) return `📎 ${msg.fileName}`; return msg.text || t('message'); };
  const getReplyBarDisplayName = () => {
    if (!backend.replyingTo) return ''; const sender = backend.replyingTo.sender;
    if (sender === userEmail) return t('yourself'); const profile = backend.userProfiles[sender]; return profile?.name || sender.split('@')[0];
  };

  const handleDragEnd = (event, info) => { if (dragStartTargetRef.current && dragStartTargetRef.current.closest(`.${styles.messageBubble}`)) return; if (info.offset.x > 100 || (info.velocity.x > 300 && info.offset.x > 20)) onBack(); };
  const handlePointerDown = (e) => { if (backend.isDecryptionFailed) return; dragStartTargetRef.current = e.target; if (e.target.closest(`.${styles.messageBubble}`)) setIsDragEnabled(false); else setIsDragEnabled(true); };

  const messageVariants = { hidden: { opacity: 0, y: 20, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } }, exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } } };
  const skeletonPattern = [false, true, true, false, true, false, false, true, false, true];

  return (
    <motion.div className={styles.container} drag={isDragEnabled ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.5 }} onDragEnd={handleDragEnd} style={{ touchAction: isDragEnabled ? 'pan-y' : 'auto' }} onPointerDown={handlePointerDown} onDragEnter={backend.handleDragEnter} onDragLeave={backend.handleDragLeave} onDragOver={backend.handleDragOver} onDrop={backend.handleDrop}>
      
      {backend.recordingStatus === 'recording' && backend.recordingMode === 'video' && (
        <div className={styles.fullscreenVideoOverlay}>
          <video autoPlay muted playsInline ref={liveVideoRef} onPlay={() => setIsVideoReady(true)} className={`${styles.fullscreenVideo} ${isVideoReady ? styles.videoReady : ''}`} />
          <div className={styles.videoControlsTop}>
            <div className={styles.recordingVideoTimer}><span className={styles.recordingDot}></span>{backend.formatRecordTime(backend.recordTime)}</div>
            {backend.hasMultipleCameras && (<button className={styles.switchCameraBtn} onClick={backend.handleSwitchCamera}>🔄</button>)}
          </div>
          <div className={styles.videoControlsBottom}>
            <button className={styles.stopButton} onClick={backend.stopRecording} title={t('stopRecording')}>⏹</button>
          </div>
        </div>
      )}

      {backend.isDragging && (<div className={styles.dropOverlay}><div className={styles.dropBox}><span className={styles.dropIcon}>📄</span><span className={styles.dropText}>{t('chatPage.dropFiles')}</span></div></div>)}
      <input type="file" ref={backend.fileInputRef} style={{ display: 'none' }} onChange={backend.handleFileChange} disabled={backend.isDecryptionFailed} />

      <header className={styles.header}>
        <button className={styles.iconButton} onClick={onBack}>←</button>
        <div className={styles.chatInfo}>
          <div className={`${styles.userAvatar} ${backend.isDecryptionFailed ? styles.disabledControl : ''}`} onClick={backend.isDecryptionFailed ? undefined : (e) => { e.stopPropagation(); onOpenProfile(); }}>
            {backend.areProfilesLoading ? (<div className={styles.avatarLoading}></div>) : currentUserAvatarUrl && !currentUserImgError ? (<img src={currentUserAvatarUrl} alt="Me" className={styles.userAvatarImage} onError={() => setCurrentUserImgError(true)} />) : (<div className={styles.userAvatarFallback}>{currentUserFallback}</div>)}
          </div>
          <div className={styles.chatAvatarWrapper}>
            {backend.isChatAvatarLoading ? (<div className={styles.avatarLoading}></div>) : showFallback ? (<div className={styles.avatarFallback}>{fallbackLetter}</div>) : (<img src={finalAvatarUrl} alt="Avatar" className={styles.avatarImage} onError={() => backend.setImgError(true)} />)}
          </div>
          <div className={styles.titleWrapper}>
            <span className={styles.title}>{currentChatName}</span>
            <span className={styles.status}>{backend.isDecryptionFailed ? '❌' : (backend.chatDescription || t('loading'))}</span>
          </div>
        </div>
        <button className={`${styles.iconButton} ${backend.isDecryptionFailed ? styles.disabledControl : ''}`} onClick={backend.isDecryptionFailed ? undefined : backend.handleExportChat} title={t('chatPage.exportChat')}>↓</button>
        <button className={`${styles.iconButton} ${backend.isDecryptionFailed ? styles.disabledControl : ''}`} onClick={backend.isDecryptionFailed ? undefined : onOpenEditChat}>⋯</button>
      </header>

      <main className={styles.messageList} ref={messagesContainerRef} onScroll={handleScroll}>
        {backend.isDecryptionFailed ? (
          <div className={styles.errorCardContainer}>
            <div className={styles.errorCard}>
              <span className={styles.errorCardIcon}>🔓</span>
              <p className={styles.errorCardText}>{t('chatPage.decryptionFailed')}</p>
            </div>
          </div>
        ) : (
          <>
            {backend.isInitialLoading && (<>{skeletonPattern.map((isOwn, index) => (<MessageSkeleton key={index} isOwn={isOwn} />))}</>)}
            <AnimatePresence initial={false}>
              {!backend.isInitialLoading && backend.messages.map((msg) => {
                const profile = backend.userProfiles[msg.sender] || {};
                return (
                  <motion.div key={msg.id} variants={messageVariants} initial="hidden" animate="visible" exit="exit" layout>
                    <MessageItem 
                      msg={msg} userEmail={userEmail} profile={profile} userProfiles={backend.userProfiles} 
                      loadedMediaUrls={backend.loadedMediaUrls} loadingMediaIds={backend.loadingMediaIds} 
                      copiedMessageId={backend.copiedMessageId} onCopy={backend.handleCopyMessage} 
                      onDelete={backend.handleDeleteMessage} onViewMedia={backend.handleViewMedia} 
                      onDownload={backend.handleDownloadFile} onFullscreen={backend.handleOpenFullscreen} 
                      onReply={backend.handleStartReply} onScrollToMessage={scrollToMessage} 
                      loadedFileTexts={backend.loadedFileTexts} 
                      loadingTextIds={backend.loadingTextIds} 
                      viewingTextIds={backend.viewingTextIds} 
                      onToggleTextView={backend.handleToggleTextView} 
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
            {showScrollButton && <button className={styles.scrollToBottomButton} onClick={scrollToBottom}>↓</button>}
          </>
        )}
      </main>

      {!backend.isDecryptionFailed && (
        <footer className={styles.footer}>
          {backend.hashtagInput && backend.suggestedHashtags.length > 0 && (<div className={styles.hashtagList}>{backend.suggestedHashtags.map((tag) => (<div key={tag} className={styles.hashtagItem} onMouseDown={(e) => e.preventDefault()} onClick={() => backend.handleSelectHashtag(tag)}>{tag}</div>))}</div>)}
          {backend.replyingTo && (<div className={styles.replyBar}><div className={styles.replyBarInfo}><span className={styles.replyBarName}>{t('replyingTo')} {getReplyBarDisplayName()}</span><span className={styles.replyBarText}>{getReplyPreviewContent(backend.replyingTo)}</span></div><button className={styles.replyBarClose} onClick={backend.handleCancelReply}>✕</button></div>)}

          <div className={styles.inputRow}>
              {backend.recordingStatus === 'recording' && backend.recordingMode === 'audio' && (
                <>
                  <div className={styles.inputContainer}><div className={`${styles.input} ${styles.recordingInput}`}><span className={styles.recordingDot}></span><span className={styles.recordingTimerText}>{backend.formatRecordTime(backend.recordTime)}</span></div></div>
                  <div className={styles.actionButtonsContainer}><button className={styles.stopButton} onClick={backend.stopRecording} title={t('stopRecording')}>⏹</button></div>
                </>
              )}

              {backend.recordingStatus === 'preview' && (
                <>
                  <div className={styles.inputContainer}>
                    {backend.recordingMode === 'video' && backend.previewUrl ? (<video controls className={styles.previewVideo} src={backend.previewUrl} autoPlay>Video</video>) : (<div className={styles.audioPreviewWrapper}><audio key={backend.previewUrl} controls className={styles.previewAudioPlayer} src={backend.previewUrl} ref={backend.previewAudioRef}>Audio</audio></div>)}
                  </div>
                  <div className={styles.previewActions}>
                      <button className={styles.previewBtn} onClick={backend.handleDeleteVoice} title={t('delete')}>🗑️</button>
                      <button className={`${styles.previewBtn} ${styles.sendPreviewBtn}`} onClick={backend.handleSendVoice} title={t('send')}>➤</button>
                  </div>
                </>
              )}

              {backend.recordingStatus === 'idle' && (
                <>
                  <button className={styles.attachButton} onClick={backend.handleAttach} disabled={backend.isUploading}>📎</button>
                  <div className={styles.inputContainer}>
                    <textarea ref={backend.textareaRef} className={styles.input} placeholder={backend.isUploading ? t('chatPage.uploadingFile') : t('chatPage.messagePlaceholder')} value={backend.inputValue} onChange={backend.handleInputChange} onSelect={backend.handleTextareaSelect} onKeyDown={backend.handleKeyDown} onBlur={backend.handleInputBlur} disabled={backend.isUploading} rows={1} />
                  </div>
                  <div className={styles.actionButtonsContainer}>
                    {backend.hasText && !backend.isUploading ? (
                      <button className={`${styles.sendButton} ${styles.sendButtonActive}`} onClick={() => backend.handleSendMessage(backend.inputValue)} title={t('send')}>➤</button>
                    ) : !backend.isUploading ? (
                      <>
                        <button className={styles.micButton} onClick={backend.handleStartAudioRecording} title={t('audioMessage')}>🎤</button>
                        <button className={styles.micButton} onClick={backend.handleStartVideoRecording} title={t('videoMessage')}>🎥</button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
          </div>
        </footer>
      )}
    </motion.div>
  );
};

export default ChatPage;