import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/ChatPage.module.css';
import { getMediaType } from '../context/ChatBackend'; 

const MessageItem = ({ 
  msg, 
  userEmail, 
  profile, 
  userProfiles, 
  loadedMediaUrls, 
  loadingMediaIds, 
  copiedMessageId, 
  onCopy, 
  onDelete, 
  onViewMedia, 
  onDownload, 
  onFullscreen,
  onReply, 
  onScrollToMessage,
  loadedFileTexts,
  loadingTextIds,
  viewingTextIds,
  onToggleTextView
}) => {
  const { t } = useTranslation();
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  
  const isOwn = msg.sender === userEmail;
  const displayName = profile.name || msg.sender.split('@')[0];
  const avatarUrl = profile.avatarUrl;
  const senderFallback = displayName ? displayName[0].toUpperCase() : '?';
  const areProfilesLoading = false; 

  const getReplyContent = (reply) => {
    if (!reply) return null;
    if (reply.fileName) return `📎 ${reply.fileName}`;
    if (reply.text) return reply.text.length > 50 ? reply.text.substring(0, 50) + '...' : reply.text;
    return t('message');
  };

  const getReplyName = (reply) => {
    if (!reply || !reply.sender) return t('user');
    if (reply.sender === userEmail) return t('yourself');
    const replyProfile = userProfiles?.[reply.sender];
    return replyProfile?.name || reply.sender.split('@')[0];
  };

  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2000);
    }).catch(console.error);
  };

  const isViewingText = viewingTextIds?.has(msg.id);
  const isLoadingText = loadingTextIds?.has(msg.id);
  const mediaType = msg.linkFile ? getMediaType(msg.fileName) : null;

  return (
    <div 
      className={`${styles.messageWrapper} ${isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}
      id={`msg-${msg.id}`}
    >
      {!isOwn && (
        <div className={styles.messageAvatar}>
          {areProfilesLoading ? (
            <div className={styles.senderAvatarLoading}></div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className={styles.senderAvatarImg} />
          ) : (
            <div className={styles.senderAvatarFallback}>{senderFallback}</div>
          )}
        </div>
      )}

      <div className={`${styles.messageBubble} ${isOwn ? styles.ownBubble : styles.otherBubble} ${msg.pending ? styles.pendingBubble : ''}`}>
        
        {msg.replyTo && (
          <div className={styles.replyContainer} onClick={() => onScrollToMessage && onScrollToMessage(msg.replyTo.id)}>
            <div className={styles.replyLine}></div>
            <div className={styles.replyContent}>
              <span className={styles.replyName}>{getReplyName(msg.replyTo)}</span>
              <span className={styles.replyText}>{getReplyContent(msg.replyTo)}</span>
            </div>
          </div>
        )}

        {!isOwn && <span className={styles.senderNameInside}>{displayName}</span>}

        {msg.linkFile ? (
          (() => {
            const mediaUrl = loadedMediaUrls[msg.id];
            const isLoading = loadingMediaIds.has(msg.id);
            const isPending = msg.pending; 

            if (mediaType === 'text') {
              return (
                <>
                  <div className={styles.fileMessage} onClick={() => onDownload(msg)}>
                    <span className={styles.fileIcon}>📄</span>
                    <span className={styles.fileName}>{msg.fileName || t('chatPage.downloadFile')}</span>
                    {msg.pending && <span className={styles.pendingClock}>🕐</span>}
                  </div>
                  
                  {isViewingText && (
                    <div className={styles.textPreviewContainer}>
                      {isLoadingText ? (
                        <div className={styles.textPreviewLoading}>
                          <div className={`${styles.spinner} ${styles.spinnerSmall}`}></div>
                        </div>
                      ) : loadedFileTexts[msg.id] ? (
                        <div style={{ position: 'relative' }}>
                          <button className={styles.copyCodeButton} onClick={() => handleCopyCode(loadedFileTexts[msg.id])} title={t('copy')}>
                            {isCodeCopied ? '✅' : '📋'}
                          </button>
                          <pre className={styles.textPreviewContent}>
                            <code>{loadedFileTexts[msg.id]}</code>
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              );
            }

            if (mediaType === 'audio') {
              return (
                <div className={styles.audioContainer}>
                  {mediaUrl ? (
                    <>
                      <audio controls className={styles.audioPlayer} src={mediaUrl}>Audio</audio>
                      <button className={`${styles.mediaControlBtn} ${styles.audioDownloadBtn}`} onClick={() => onDownload(msg)} title={t('chatPage.downloadFile')}>↓</button>
                    </>
                  ) : (
                    <>
                      <div className={styles.audioPlaceholder} onClick={() => onViewMedia(msg)}>
                        {isPending ? <span className={styles.pendingClock}>🕐</span> : isLoading ? <div className={`${styles.spinner} ${styles.spinnerSmall}`}></div> : '▶'}
                      </div>
                      <div className={styles.fileNameContainer}>
                        <span className={styles.fileNameText}>{msg.fileName}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            }

            if (mediaType === 'image' || mediaType === 'video') {
              return (
                <div className={styles.mediaContainer}>
                  {mediaUrl ? (
                    <>
                      {mediaType === 'image' ? <img src={mediaUrl} alt="media" className={styles.mediaImage} /> : <video src={mediaUrl} controls className={styles.mediaVideo} />}
                      <button className={`${styles.mediaControlBtn} ${styles.mediaDownloadBtn}`} onClick={() => onDownload(msg)} title={t('chatPage.downloadFile')}>↓</button>
                      {mediaType === 'image' && <button className={`${styles.mediaControlBtn} ${styles.mediaFullscreenBtn}`} onClick={(e) => onFullscreen(e, mediaUrl)} title={t('fullscreen')}>⛶</button>}
                    </>
                  ) : (
                    <div className={styles.mediaPlaceholder}>
                      <div className={styles.mediaOverlay}>
                        {isPending ? <span className={styles.pendingClock}>🕐</span> : isLoading ? <div className={styles.spinner}></div> : <button className={styles.viewMediaBtn} onClick={() => onViewMedia(msg)} title={t('view')}>▶</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className={styles.fileMessage} onClick={() => onDownload(msg)}>
                <span className={styles.fileIcon}>📄</span>
                <span className={styles.fileName}>{msg.fileName || msg.text || t('chatPage.downloadFile')}</span>
                {msg.pending && <span className={styles.pendingClock}>🕐</span>}
              </div>
            );
          })()
        ) : (
          <>
            {msg.gifUrl ? (
              <div className={styles.gifContainer}>
                <img src={msg.gifUrl} alt="gif" className={styles.gifImage} />
                <span className={styles.gifLinkText}>{msg.text}</span>
              </div>
            ) : (
              <p className={styles.messageText}>{msg.text}</p>
            )}
          </>
        )}
        
        <div className={styles.messageFooter}>
          {!isOwn && !msg.pending && (
            <button className={styles.replyButton} onClick={() => onReply && onReply(msg)} title={t('reply')}>↩️</button>
          )}

          {mediaType === 'text' && !msg.pending && (
            <button 
              className={`${styles.replyButton} ${isViewingText ? styles.viewCodeButtonActive : ''}`} 
              onClick={() => onToggleTextView && onToggleTextView(msg)} 
              title={t('viewContents')}
            >
              👁️
            </button>
          )}

          {!msg.linkFile && (
            <button className={styles.copyButton} onClick={() => onCopy(msg.text, msg.id)} title={t('copy')}>
              {copiedMessageId === msg.id ? '✅' : '📋'}
            </button>
          )}
          
          {isOwn && (
            <button className={styles.deleteButton} onClick={() => onDelete(msg)} title={t('delete')}>🗑️</button>
          )}

          {msg.pending && <span className={styles.pendingClock}>🕐</span>}
          <span className={styles.timestamp}>
            {msg.pending ? t('sending') : new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;