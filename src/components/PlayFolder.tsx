import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFolderContents, getApiHost, type FolderContents, type FolderItem } from '../utils/api'
import './PlayFolder.css'

const DEFAULT_PATH = 'C:\\T'

export const PlayFolder = () => {
  const navigate = useNavigate()
  const [contents, setContents] = useState<FolderContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1)
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null)

  const loadFolder = useCallback(async (path: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await getFolderContents(path)
      setContents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFolder(DEFAULT_PATH)
  }, [loadFolder])

  const handleBack = () => {
    if (contents?.parentPath) {
      loadFolder(contents.parentPath)
    } else {
      navigate('/')
    }
  }

  const handleFolderClick = (folder: FolderItem) => {
    loadFolder(folder.path)
  }

  const handleVideoClick = (video: FolderItem, index: number) => {
    setFullscreenVideo(video.path)
    setCurrentVideoIndex(index)
  }

  const handleVideoHover = (video: FolderItem) => {
    setPreviewVideo(video.path)
  }

  const handleVideoLeave = () => {
    setPreviewVideo(null)
    if (previewVideoRef.current) {
      previewVideoRef.current.pause()
    }
  }

  const handleCloseFullscreen = () => {
    setFullscreenVideo(null)
    setCurrentVideoIndex(-1)
  }

  const handlePrevVideo = () => {
    if (!contents || currentVideoIndex <= 0) return
    const videos = contents.items.filter((item) => item.type === 'video')
    const newIndex = currentVideoIndex - 1
    setFullscreenVideo(videos[newIndex].path)
    setCurrentVideoIndex(newIndex)
  }

  const handleNextVideo = () => {
    if (!contents) return
    const videos = contents.items.filter((item) => item.type === 'video')
    if (currentVideoIndex >= videos.length - 1) return
    const newIndex = currentVideoIndex + 1
    setFullscreenVideo(videos[newIndex].path)
    setCurrentVideoIndex(newIndex)
  }

  const getVideoUrl = (path: string) => {
    return `${getApiHost()}/api?type=videoStream&path=${encodeURIComponent(path)}`
  }

  const getThumbnailUrl = (path: string) => {
    return `${getApiHost()}/api?type=thumbnailStream&path=${encodeURIComponent(path)}`
  }

  const renderHeader = () => (
    <div className="play-folder-header">
      <button className="back-button" onClick={handleBack}>
        ← Back
      </button>
      <h2 className="folder-name">{contents?.currentPath || DEFAULT_PATH}</h2>
    </div>
  )

  const renderFolders = () => (
    <div className="folder-list">
      {contents?.items.map((item) => (
        <div key={item.path} className="folder-item" onClick={() => handleFolderClick(item)}>
          <div className="folder-icon">📁</div>
          <div className="folder-item-name">{item.name}</div>
        </div>
      ))}
    </div>
  )

  const renderVideos = () => (
    <div className="video-list">
      {contents?.items.map((item, index) => (
        <div
          key={item.path}
          className="video-item"
          onClick={() => handleVideoClick(item, index)}
          onMouseEnter={() => handleVideoHover(item)}
          onMouseLeave={handleVideoLeave}
        >
          {previewVideo === item.path ? (
            <video
              ref={previewVideoRef}
              className="video-preview"
              src={getVideoUrl(item.path)}
              autoPlay
              muted
              loop
            />
          ) : (
            <div className="video-thumbnail">
              <img
                src={getThumbnailUrl(item.path)}
                alt={item.name}
                className="thumbnail-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              <div className="video-icon fallback-icon" style={{ display: 'none' }}>🎬</div>
            </div>
          )}
          <div className="video-item-name">{item.name}</div>
        </div>
      ))}
    </div>
  )

  const renderFullscreen = () => {
    if (!fullscreenVideo) return null
    const videos = contents?.items.filter((item) => item.type === 'video') || []
    const hasPrev = currentVideoIndex > 0
    const hasNext = currentVideoIndex < videos.length - 1

    return (
      <div className="fullscreen-overlay">
        <button className="close-button" onClick={handleCloseFullscreen}>
          ✕
        </button>
        {hasPrev && (
          <button className="nav-button prev-button" onClick={handlePrevVideo}>
            ‹
          </button>
        )}
        <video
          ref={fullscreenVideoRef}
          className="fullscreen-video"
          src={getVideoUrl(fullscreenVideo)}
          autoPlay
          loop
          controls
        />
        {hasNext && (
          <button className="nav-button next-button" onClick={handleNextVideo}>
            ›
          </button>
        )}
      </div>
    )
  }

  if (loading) return <div className="play-folder loading">Loading...</div>
  if (error) return <div className="play-folder error">{error}</div>

  return (
    <div className="play-folder">
      {renderHeader()}
      <div className="content-area">
        {contents?.contentType === 'folders' ? renderFolders() : renderVideos()}
      </div>
      {renderFullscreen()}
    </div>
  )
}
