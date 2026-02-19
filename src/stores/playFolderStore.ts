import { createMemo } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  getFolderContents,
  getApiHost,
  type FolderContents,
  type FolderItem,
} from '../utils/api'

const DEFAULT_PATH = 'C:\\T'
const EXTERNAL_VIDEO_HOST = 'http://192.168.1.64:6911'
const MAX_SIDE_VIDEOS = 3
const CAROUSEL_ANIMATION_MS = 300

export interface PlayFolderStoreState {
  contents: FolderContents | null
  loading: boolean
  error: string | null
  currentVideoIndex: number
  isFullscreen: boolean
  previewVideo: string | null
  carouselAnimating: boolean
}

const getInitialState = (): PlayFolderStoreState => ({
  contents: null,
  loading: true,
  error: null,
  currentVideoIndex: -1,
  isFullscreen: false,
  previewVideo: null,
  carouselAnimating: false,
})

export const [playFolderStore, setPlayFolderStore] =
  createStore<PlayFolderStoreState>(getInitialState())

const videos = createMemo(
  () => playFolderStore.contents?.items.filter((item) => item.type === 'video') || [],
)

const carouselVideos = createMemo(() => {
  const allVideos = videos()
  const currentIndex = playFolderStore.currentVideoIndex
  if (allVideos.length === 0 || currentIndex < 0) return []

  const result: { video: FolderItem; position: number; globalIndex: number }[] = []

  for (
    let i = Math.max(0, currentIndex - MAX_SIDE_VIDEOS);
    i <= Math.min(allVideos.length - 1, currentIndex + MAX_SIDE_VIDEOS);
    i++
  ) {
    result.push({ video: allVideos[i], position: i - currentIndex, globalIndex: i })
  }

  return result
})

export const playFolderDerived = {
  videos,
  carouselVideos,
}

const loadFolder = async (path: string) => {
  try {
    setPlayFolderStore({ loading: true, error: null })
    const data = await getFolderContents(path)
    setPlayFolderStore({ contents: data, loading: false })
  } catch (err) {
    setPlayFolderStore({
      error: err instanceof Error ? err.message : 'Failed to load folder',
      loading: false,
    })
  }
}

export const playFolderStoreActions = {
  loadDefaultFolder: () => loadFolder(DEFAULT_PATH),

  navigateToFolder: (folder: FolderItem) => loadFolder(folder.path),

  navigateToParent: () => {
    const parentPath = playFolderStore.contents?.parentPath
    if (parentPath) loadFolder(parentPath)
    return !!parentPath
  },

  openVideoFullscreen: (index: number) => {
    setPlayFolderStore({ currentVideoIndex: index, isFullscreen: true })
  },

  closeFullscreen: () => {
    setPlayFolderStore({ isFullscreen: false, currentVideoIndex: -1 })
  },

  setPreviewVideo: (path: string | null) => {
    setPlayFolderStore('previewVideo', path)
  },

  selectCarouselVideo: (index: number) => {
    if (playFolderStore.carouselAnimating || index === playFolderStore.currentVideoIndex)
      return
    setPlayFolderStore({ carouselAnimating: true, currentVideoIndex: index })
    setTimeout(() => setPlayFolderStore('carouselAnimating', false), CAROUSEL_ANIMATION_MS)
  },

  reset: () => {
    setPlayFolderStore(getInitialState())
  },
}

export const convertPathToExternalUrl = (path: string) => {
  const pathWithoutDrive = path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
  return `${EXTERNAL_VIDEO_HOST}${pathWithoutDrive}`
}

export const getVideoUrl = (path: string) =>
  `${getApiHost()}/api?type=videoStream&path=${encodeURIComponent(path)}`

export const getThumbnailUrl = (path: string) =>
  `${getApiHost()}/api?type=thumbnailStream&path=${encodeURIComponent(path)}`
