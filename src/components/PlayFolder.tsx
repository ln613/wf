import { onMount, For, Show, Switch, Match } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import {
  playFolderStore,
  playFolderStoreActions,
  playFolderDerived,
  convertPathToExternalUrl,
  getVideoUrl,
  getThumbnailUrl,
} from '../stores/playFolderStore'
import type { FolderItem } from '../utils/api'
import './PlayFolder.css'

// --- Icons ---

const BackIcon = () => (
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
)

const CloseIcon = () => (
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
)

// --- Header ---

const PlayFolderHeader = () => {
  const navigate = useNavigate()

  const handleBack = () => {
    const navigated = playFolderStoreActions.navigateToParent()
    if (!navigated) navigate('/')
  }

  return (
    <div class="play-folder-header">
      <button class="back-button" onClick={handleBack}>
        <BackIcon />
      </button>
      <h2 class="folder-name">
        {playFolderStore.contents?.currentPath || 'C:\\T'}
      </h2>
    </div>
  )
}

// --- Folder List ---

const FolderList = () => (
  <div class="folder-list">
    <For each={playFolderStore.contents?.items}>
      {(item) => (
        <div
          class="folder-item"
          onClick={() => playFolderStoreActions.navigateToFolder(item)}
        >
          <div class="folder-icon">📁</div>
          <div class="folder-item-name">{item.name}</div>
        </div>
      )}
    </For>
  </div>
)

// --- Video List ---

const VideoThumbnail = (props: { item: FolderItem }) => (
  <div class="video-thumbnail">
    <img
      src={getThumbnailUrl(props.item.path)}
      alt={props.item.name}
      class="thumbnail-image"
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.style.display = 'none'
        const fallback = target.nextElementSibling as HTMLElement
        if (fallback) fallback.style.display = 'flex'
      }}
    />
    <div class="video-icon fallback-icon" style={{ display: 'none' }}>
      🎬
    </div>
  </div>
)

const VideoPreview = (props: { path: string }) => {
  let ref: HTMLVideoElement | undefined

  const handleMouseLeave = () => {
    if (ref && !ref.paused) ref.pause()
    playFolderStoreActions.setPreviewVideo(null)
  }

  return (
    <video
      ref={ref}
      class="video-preview"
      src={getVideoUrl(props.path)}
      autoplay
      muted
      loop
      onMouseLeave={handleMouseLeave}
    />
  )
}

const VideoItem = (props: { item: FolderItem; index: number }) => (
  <div
    class="video-item"
    onClick={() => playFolderStoreActions.openVideoFullscreen(props.index)}
    onMouseEnter={() => playFolderStoreActions.setPreviewVideo(props.item.path)}
    onMouseLeave={() => playFolderStoreActions.setPreviewVideo(null)}
  >
    <Show
      when={playFolderStore.previewVideo === props.item.path}
      fallback={<VideoThumbnail item={props.item} />}
    >
      <VideoPreview path={props.item.path} />
    </Show>
    <div class="video-item-name">{props.item.name}</div>
  </div>
)

const VideoList = () => (
  <div class="video-list">
    <For each={playFolderStore.contents?.items}>
      {(item, index) => <VideoItem item={item} index={index()} />}
    </For>
  </div>
)

// --- Video Carousel ---

const getCarouselStyle = (position: number) => {
  const isCenter = position === 0
  const absPosition = Math.abs(position)
  const opacity = isCenter ? 1 : Math.max(0.2, 1 - absPosition * 0.25)
  const scale = isCenter ? 1 : Math.max(0.5, 1 - absPosition * 0.15)
  const translateX = position * 250

  return {
    opacity,
    transform: `translateX(${translateX}px) scale(${scale})`,
    'z-index': String(10 - absPosition),
  }
}

const CenterVideo = (props: { video: FolderItem }) => (
  <a
    href={convertPathToExternalUrl(props.video.path)}
    class="carousel-video-link"
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.preventDefault()}
  >
    <video
      class="carousel-video center"
      src={getVideoUrl(props.video.path)}
      autoplay
      loop
      controls
      style={getCarouselStyle(0)}
    />
  </a>
)

const SideVideo = (props: {
  video: FolderItem
  position: number
  globalIndex: number
}) => (
  <div class="carousel-video-wrapper">
    <video
      class="carousel-video side"
      src={getVideoUrl(props.video.path)}
      muted
      loop
      style={getCarouselStyle(props.position)}
      onClick={() => playFolderStoreActions.selectCarouselVideo(props.globalIndex)}
    />
  </div>
)

const CarouselItem = (props: {
  video: FolderItem
  position: number
  globalIndex: number
}) => (
  <Show
    when={props.position === 0}
    fallback={
      <SideVideo
        video={props.video}
        position={props.position}
        globalIndex={props.globalIndex}
      />
    }
  >
    <CenterVideo video={props.video} />
  </Show>
)

const VideoCarousel = () => (
  <Show
    when={playFolderStore.isFullscreen && playFolderStore.currentVideoIndex >= 0}
  >
    <div class="fullscreen-overlay">
      <button class="close-button" onClick={playFolderStoreActions.closeFullscreen}>
        <CloseIcon />
      </button>
      <div
        class="carousel-container"
        classList={{ animating: playFolderStore.carouselAnimating }}
      >
        <For each={playFolderDerived.carouselVideos()}>
          {({ video, position, globalIndex }) => (
            <CarouselItem
              video={video}
              position={position}
              globalIndex={globalIndex}
            />
          )}
        </For>
      </div>
    </div>
  </Show>
)

// --- Main Component ---

export const PlayFolder = () => {
  onMount(() => {
    playFolderStoreActions.loadDefaultFolder()
  })

  return (
    <Switch>
      <Match when={playFolderStore.loading}>
        <div class="play-folder loading">Loading...</div>
      </Match>
      <Match when={playFolderStore.error}>
        <div class="play-folder error">{playFolderStore.error}</div>
      </Match>
      <Match when={true}>
        <div class="play-folder">
          <PlayFolderHeader />
          <div class="content-area">
            <Show
              when={playFolderStore.contents?.contentType === 'folders'}
              fallback={<VideoList />}
            >
              <FolderList />
            </Show>
          </div>
          <VideoCarousel />
        </div>
      </Match>
    </Switch>
  )
}
