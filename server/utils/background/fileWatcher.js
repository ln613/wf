import chokidar from 'chokidar'
import path from 'path'

// Store active watchers by folder path
const activeWatchers = new Map()

// Store registered workflows with their triggers
const registeredWorkflows = new Map()

/**
 * Register a workflow with a file watching trigger
 * @param {string} workflowId - Unique workflow identifier
 * @param {Object} trigger - Trigger configuration
 * @param {string} trigger.folder - Folder path to watch
 * @param {string} trigger.changeType - Type of change: 'created' | 'modified' | 'deleted'
 * @param {string} [trigger.filePattern] - Optional glob pattern for file matching (e.g., '*.txt')
 * @param {EventEmitter} eventEmitter - Event emitter to emit events
 */
export const registerFileWatchingTrigger = (workflowId, trigger, eventEmitter) => {
  validateTrigger(workflowId, trigger)

  const normalizedFolder = path.resolve(trigger.folder)
  const registrationKey = `${workflowId}_${normalizedFolder}_${trigger.changeType}`

  if (registeredWorkflows.has(registrationKey)) {
    console.log(`[FileWatcher] Workflow already registered: ${registrationKey}`)
    return registrationKey
  }

  // Store the registration
  registeredWorkflows.set(registrationKey, {
    workflowId,
    trigger: { ...trigger, folder: normalizedFolder },
    eventEmitter,
  })

  console.log(
    `[FileWatcher] Registered workflow: ${workflowId} for ${trigger.changeType} in ${normalizedFolder}`,
  )

  // Start or update watcher for this folder
  ensureWatcherForFolder(normalizedFolder)

  return registrationKey
}

/**
 * Unregister a workflow from file watching
 * @param {string} registrationKey - Registration key returned from registerFileWatchingTrigger
 */
export const unregisterFileWatchingTrigger = (registrationKey) => {
  if (!registeredWorkflows.has(registrationKey)) {
    console.log(`[FileWatcher] Registration not found: ${registrationKey}`)
    return
  }

  const { trigger } = registeredWorkflows.get(registrationKey)
  registeredWorkflows.delete(registrationKey)

  console.log(`[FileWatcher] Unregistered: ${registrationKey}`)

  // Check if we still need the watcher for this folder
  cleanupWatcherIfUnused(trigger.folder)
}

/**
 * Start watching files for a specific task configuration
 * @param {string} taskId - Unique task identifier
 * @param {Object} config - Configuration with folder, changeType, filePattern
 * @param {EventEmitter} eventEmitter - Event emitter to emit events
 */
export const watchFiles = (taskId, config, eventEmitter) => {
  validateWatchFilesConfig(config)

  const normalizedFolder = path.resolve(config.folder)

  console.log(
    `[FileWatcher] Starting file watcher task: ${taskId} for ${config.changeType} in ${normalizedFolder}`,
  )

  // Register this as a workflow trigger
  const registrationKey = registerFileWatchingTrigger(taskId, config, eventEmitter)

  return registrationKey
}

/**
 * Stop a file watching task
 * @param {string} taskId - Task ID to stop
 */
export const stopWatchFiles = (taskId) => {
  // Find and remove all registrations for this taskId
  const keysToRemove = []
  for (const [key, registration] of registeredWorkflows) {
    if (registration.workflowId === taskId) {
      keysToRemove.push(key)
    }
  }

  for (const key of keysToRemove) {
    unregisterFileWatchingTrigger(key)
  }

  console.log(`[FileWatcher] Stopped file watcher task: ${taskId}`)
}

/**
 * Stop all file watchers
 */
export const stopAllFileWatchers = () => {
  for (const [folder, watcher] of activeWatchers) {
    watcher.close()
    console.log(`[FileWatcher] Stopped watcher for: ${folder}`)
  }
  activeWatchers.clear()
  registeredWorkflows.clear()
  console.log('[FileWatcher] All file watchers stopped')
}

/**
 * Get all registered workflows
 * @returns {Array} List of registered workflows
 */
export const getRegisteredWorkflows = () => {
  return Array.from(registeredWorkflows.entries()).map(([key, registration]) => ({
    registrationKey: key,
    workflowId: registration.workflowId,
    trigger: registration.trigger,
  }))
}

const validateTrigger = (workflowId, trigger) => {
  if (!workflowId) {
    throw new Error('Workflow ID is required')
  }
  if (!trigger) {
    throw new Error('Trigger configuration is required')
  }
  if (!trigger.folder) {
    throw new Error('Folder path is required in trigger')
  }
  if (!trigger.changeType) {
    throw new Error('Change type is required in trigger')
  }

  const validChangeTypes = ['created', 'modified', 'deleted']
  if (!validChangeTypes.includes(trigger.changeType)) {
    throw new Error(`Invalid change type: ${trigger.changeType}. Must be one of: ${validChangeTypes.join(', ')}`)
  }
}

const validateWatchFilesConfig = (config) => {
  if (!config) {
    throw new Error('Configuration is required')
  }
  if (!config.folder) {
    throw new Error('Folder path is required')
  }
  if (!config.changeType) {
    throw new Error('Change type is required')
  }
}

const ensureWatcherForFolder = (folder) => {
  if (activeWatchers.has(folder)) {
    return // Watcher already exists
  }

  console.log(`[FileWatcher] Creating watcher for folder: ${folder}`)

  const watcher = chokidar.watch(folder, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  })

  watcher.on('add', (filePath) => handleFileEvent('created', filePath))
  watcher.on('change', (filePath) => handleFileEvent('modified', filePath))
  watcher.on('unlink', (filePath) => handleFileEvent('deleted', filePath))
  watcher.on('error', (error) => {
    console.error(`[FileWatcher] Error watching ${folder}:`, error.message)
  })

  activeWatchers.set(folder, watcher)
}

const handleFileEvent = (changeType, filePath) => {
  const fileFolder = path.dirname(filePath)
  const fileName = path.basename(filePath)

  console.log(`[FileWatcher] File ${changeType}: ${filePath}`)

  // Find all registered workflows that match this event
  for (const [, registration] of registeredWorkflows) {
    const { workflowId, trigger, eventEmitter } = registration

    if (!matchesTrigger(trigger, fileFolder, fileName, changeType)) {
      continue
    }

    console.log(`[FileWatcher] Emitting event for workflow: ${workflowId}`)

    eventEmitter.emit('fileChange', {
      workflowId,
      changeType,
      file: {
        path: filePath,
        folder: fileFolder,
        name: fileName,
      },
    })
  }
}

const matchesTrigger = (trigger, fileFolder, fileName, changeType) => {
  // Check change type
  if (trigger.changeType !== changeType) {
    return false
  }

  // Check folder (must be exact match or subfolder)
  if (!fileFolder.startsWith(trigger.folder)) {
    return false
  }

  // Check file pattern if specified
  if (trigger.filePattern) {
    return matchesPattern(fileName, trigger.filePattern)
  }

  return true
}

const matchesPattern = (fileName, pattern) => {
  // Simple glob pattern matching
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(fileName)
}

const cleanupWatcherIfUnused = (folder) => {
  // Check if any registrations still use this folder
  for (const [, registration] of registeredWorkflows) {
    if (registration.trigger.folder === folder) {
      return // Still in use
    }
  }

  // No more registrations for this folder, close the watcher
  const watcher = activeWatchers.get(folder)
  if (watcher) {
    watcher.close()
    activeWatchers.delete(folder)
    console.log(`[FileWatcher] Closed unused watcher for: ${folder}`)
  }
}
