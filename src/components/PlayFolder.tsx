import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFolderContents,
  getApiHost,
  type FolderContents,
  type FolderItem,
} from '../utils/api'
import './PlayFolder.css'

const DEFAULT_PATH = 'C:\\T'
const EXTERNAL_VIDEO_HOST = 'http://192.168.1.64:6911'

const convertPathToExternalUrl = (path: string) => {
  const pathWithoutDrive = path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
  return `${EXTERNAL_VIDEO_HOST}${pathWithoutDrive}`
}

export const PlayFolder = () => {
  const navigate = useNavigate()
  const [contents, setContents] = useState<FolderContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [carouselAnimating, setCarouselAnimating] = useState(false)
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

  const handleVideoClick = (_video: FolderItem, index: number) => {
    setCurrentVideoIndex(index)
    setIsFullscreen(true)
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
    setIsFullscreen(false)
    setCurrentVideoIndex(-1)
  }

  const handleCarouselVideoClick = (index: number) => {
    if (carouselAnimating || index === currentVideoIndex) return
    setCarouselAnimating(true)
    setCurrentVideoIndex(index)
    setTimeout(() => setCarouselAnimating(false), 300)
  }

  const getVideos = () => {
    return contents?.items.filter((item) => item.type === 'video') || []
  }

  const getCarouselVideos = () => {
    const videos = getVideos()
    if (videos.length === 0 || currentVideoIndex < 0) return []

    const result: { video: FolderItem; position: number }[] = []
    const maxSideVideos = 3

    for (
      let i = Math.max(0, currentVideoIndex - maxSideVideos);
      i <= Math.min(videos.length - 1, currentVideoIndex + maxSideVideos);
      i++
    ) {
      result.push({ video: videos[i], position: i - currentVideoIndex })
    }

    return result
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
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

  const renderCarouselVideo = (
    video: FolderItem,
    position: number,
    index: number,
  ) => {
    const isCenter = position === 0
    const absPosition = Math.abs(position)
    const opacity = isCenter ? 1 : Math.max(0.2, 1 - absPosition * 0.25)
    const scale = isCenter ? 1 : Math.max(0.5, 1 - absPosition * 0.15)

    // Simple pixel-based offset - videos placed closer together
    const translateX = position * 250

    const videoElement = (
      <video
        ref={isCenter ? fullscreenVideoRef : null}
        className={`carousel-video ${isCenter ? 'center' : 'side'}`}
        src={getVideoUrl(video.path)}
        autoPlay={isCenter}
        muted={!isCenter}
        loop
        controls={isCenter}
        style={{
          opacity,
          transform: `translateX(${translateX}px) scale(${scale})`,
          zIndex: 10 - absPosition,
        }}
        onClick={() => !isCenter && handleCarouselVideoClick(index)}
      />
    )

    if (isCenter) {
      return (
        <a
          key={video.path}
          href={convertPathToExternalUrl(video.path)}
          className="carousel-video-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.preventDefault()}
        >
          {videoElement}
        </a>
      )
    }

    return (
      <div key={video.path} className="carousel-video-wrapper">
        {videoElement}
      </div>
    )
  }

  const renderFullscreen = () => {
    if (!isFullscreen || currentVideoIndex < 0) return null
    const carouselVideos = getCarouselVideos()
    const videos = getVideos()

    return (
      <div className="fullscreen-overlay">
        <button className="close-button" onClick={handleCloseFullscreen}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className={`carousel-container ${carouselAnimating ? 'animating' : ''}`}>
          {carouselVideos.map(({ video, position }) =>
            renderCarouselVideo(
              video,
              position,
              videos.findIndex((v) => v.path === video.path),
            ),
          )}
        </div>
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
