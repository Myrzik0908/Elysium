import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './styles/ChatPage.module.css';
import { getMediaType } from '../context/ChatBackend'; 

const isEmojiOnly = (text) => {
  if (!text) return false;
  const cleanText = text.replace(/\s/g, '');
  if (!cleanText) return false;
  const emojiRegex = /^(\p{Regional_Indicator}\p{Regional_Indicator}|\p{Emoji}(\u200D\p{Emoji})*(\uFE0F|\u20E3)?)+$/u;
  return emojiRegex.test(cleanText);
};

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
  onToggleTextView,
  domainFilterSettings // ADDED: Receive domain filter settings
}) => {
  const { t } = useTranslation();
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  
  const isOwn = msg.sender === userEmail;
  const displayName = profile.name || msg.sender.split('@')[0];
  const avatarUrl = profile.avatarUrl;
  const senderFallback = displayName ? displayName[0].toUpperCase() : '?';
  const areProfilesLoading = false; 

  // ADDED: Function to filter URLs based on domain settings
  const getFilteredText = (text) => {
    if (!text) return '';
    if (!domainFilterSettings || !domainFilterSettings.enabled) return text;
    
    const domainList = (domainFilterSettings.domains || '')
      .split('\n')
      .map(d => d.trim().toLowerCase())
      .filter(d => d);

    // Regex to find URLs starting with http:// or https://
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return text.replace(urlRegex, (url) => {
      try {
        // Extract hostname and remove 'www.' prefix
        const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        // Check if domain or subdomain matches any in the list
        const isMatch = domainList.some(d => domain === d || domain.endsWith('.' + d));
        
        if (domainFilterSettings.mode === 'whitelist') {
          // Whitelist: Hide if NOT in the list
          return isMatch ? url : '[url]';
        } else {
          // Blacklist: Hide if IN the list
          return isMatch ? '[url]' : url;
        }
      } catch (e) {
        return url; // Not a valid URL, leave as is
      }
    });
  };

  const getReplyContent = (reply) => {
    if (!reply) return null;
    if (reply.fileName) return `📎 ${reply.fileName}`;
    if (reply.text) {
      // ADDED: Apply filter to reply preview text as well
      const filteredText = getFilteredText(reply.text);
      return filteredText.length > 50 ? filteredText.substring(0, 50) + '...' : filteredText;
    }
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
  
  // ADDED: Check if the original text had emojis, not the filtered one
  const emojiOnly = !msg.linkFile && !msg.gifUrl && isEmojiOnly(msg.text);

  // ADDED: Get filtered text for rendering
  const displayText = getFilteredText(msg.text);

  return (
    <div 
      className={`${styles.messageWrapper} ${isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}
      id={`msg-${msg.id}`}
    >
      {!isOwn && !emojiOnly && (
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

      <div className={`${styles.messageBubble} ${isOwn ? styles.ownBubble : styles.otherBubble} ${msg.pending ? styles.pendingBubble : ''} ${emojiOnly ? styles.emojiOnlyBubble : ''}`}>
        
        {msg.replyTo && (
          <div className={styles.replyContainer} onClick={() => onScrollToMessage && onScrollToMessage(msg.replyTo.id)}>
            <div className={styles.replyLine}></div>
            <div className={styles.replyContent}>
              <span className={styles.replyName}>{getReplyName(msg.replyTo)}</span>
              <span className={styles.replyText}>{getReplyContent(msg.replyTo)}</span>
            </div>
          </div>
        )}

        {!isOwn && !emojiOnly && <span className={styles.senderNameInside}>{displayName}</span>}

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
                      {mediaType === 'image' ? <img src={mediaUrl} alt="media" className={styles.mediaImage} /> : <video src={mediaUrl} controls playsInline webkit-playsinline="true" className={styles.mediaVideo} />}
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
                {/* MODIFIED: Use displayText instead of msg.text */}
                <span className={styles.gifLinkText}>{displayText}</span>
              </div>
            ) : (
              /* MODIFIED: Use displayText instead of msg.text */
              <p className={styles.messageText}>{displayText}</p>
            )}
          </>
        )}
        
        <div className={styles.messageFooter}>
          {!msg.pending && (
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

          {!msg.linkFile && !emojiOnly && (
            /* MODIFIED: Pass original msg.text to copy, so user copies unfiltered text */
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