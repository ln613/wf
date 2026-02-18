import { createSignal, onMount, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
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
  const [contents, setContents] = createSignal<FolderContents | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = createSignal<number>(-1)
  const [isFullscreen, setIsFullscreen] = createSignal(false)
  const [previewVideo, setPreviewVideo] = createSignal<string | null>(null)
  const [carouselAnimating, setCarouselAnimating] = createSignal(false)
  let previewVideoRef: HTMLVideoElement | undefined
  let fullscreenVideoRef: HTMLVideoElement | undefined

  const loadFolder = async (path: string) => {
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
  }

  onMount(() => {
    loadFolder(DEFAULT_PATH)
  })

  const handleBack = () => {
    const currentContents = contents()
    if (currentContents?.parentPath) {
      loadFolder(currentContents.parentPath)
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
    if (previewVideoRef && previewVideoRef.paused === false) {
      previewVideoRef.pause()
    }
  }

  const handleCloseFullscreen = () => {
    setIsFullscreen(false)
    setCurrentVideoIndex(-1)
  }

  const handleCarouselVideoClick = (index: number) => {
    const animating = carouselAnimating()
    const currentIndex = currentVideoIndex()
    if (animating || index === currentIndex) return
    setCarouselAnimating(true)
    setCurrentVideoIndex(index)
    setTimeout(() => setCarouselAnimating(false), 300)
  }

  const getVideos = () => {
    return contents()?.items.filter((item) => item.type === 'video') || []
  }

  const getCarouselVideos = () => {
    const videos = getVideos()
    const currentIndex = currentVideoIndex()
    if (videos.length === 0 || currentIndex < 0) return []

    const result: { video: FolderItem; position: number }[] = []
    const maxSideVideos = 3

    for (
      let i = Math.max(0, currentIndex - maxSideVideos);
      i <= Math.min(videos.length - 1, currentIndex + maxSideVideos);
      i++
    ) {
      result.push({ video: videos[i], position: i - currentIndex })
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
    <div class="play-folder-header">
      <button class="back-button" onClick={handleBack}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h2 class="folder-name">{contents()?.currentPath || DEFAULT_PATH}</h2>
    </div>
  )

  const renderFolders = () => (
    <div class="folder-list">
      {contents()?.items.map((item) => (
        <div class="folder-item" onClick={() => handleFolderClick(item)}>
          <div class="folder-icon">📁</div>
          <div class="folder-item-name">{item.name}</div>
        </div>
      ))}
    </div>
  )

  const renderVideos = () => (
    <div class="video-list">
      {contents()?.items.map((item, index) => (
        <div
          class="video-item"
          onClick={() => handleVideoClick(item, index)}
          onMouseEnter={() => handleVideoHover(item)}
          onMouseLeave={handleVideoLeave}
        >
          {previewVideo() === item.path ? (
            <video
              ref={previewVideoRef}
              class="video-preview"
              src={getVideoUrl(item.path)}
              autoplay
              muted
              loop
            />
          ) : (
            <div class="video-thumbnail">
              <img
                src={getThumbnailUrl(item.path)}
                alt={item.name}
                class="thumbnail-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              <div class="video-icon fallback-icon" style={{ display: 'none' }}>🎬</div>
            </div>
          )}
          <div class="video-item-name">{item.name}</div>
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
        ref={(el) => {
          if (isCenter) fullscreenVideoRef = el;
        }}
        class={`carousel-video ${isCenter ? 'center' : 'side'}`}
        src={getVideoUrl(video.path)}
        autoplay={isCenter}
        muted={!isCenter}
        loop
        controls={isCenter}
        style={{
          opacity,
          transform: `translateX(${translateX}px) scale(${scale})`,
          'z-index': String(10 - absPosition),
        }}
        onClick={() => !isCenter && handleCarouselVideoClick(index)}
      />
    )

    if (isCenter) {
      return (
        <a
          href={convertPathToExternalUrl(video.path)}
          class="carousel-video-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.preventDefault()}
        >
          {videoElement}
        </a>
      )
    }

    return (
      <div class="carousel-video-wrapper">
        {videoElement}
      </div>
    )
  }

  const renderFullscreen = () => {
    const fullscreen = isFullscreen()
    const currentIndex = currentVideoIndex()
    if (!fullscreen || currentIndex < 0) return null
    
    const carouselVideos = getCarouselVideos()
    const videos = getVideos()

    return (
      <div class="fullscreen-overlay">
        <button class="close-button" onClick={handleCloseFullscreen}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class={`carousel-container ${carouselAnimating() ? 'animating' : ''}`}>
          {carouselVideos.map(({ video, position }, idx) =>
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

  return (
    <Show when={!loading()} fallback={<div class="play-folder loading">Loading...</div>}>
      <Show when={!error()} fallback={<div class="play-folder error">{error()}</div>}>
        <div class="play-folder">
          {renderHeader()}
          <div class="content-area">
            {contents()?.contentType === 'folders' ? renderFolders() : renderVideos()}
          </div>
          {renderFullscreen()}
        </div>
      </Show>
    </Show>
  )
}
