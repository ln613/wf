import { EventEmitter } from 'events'
import { watchEmail, stopWatchEmail, stopAllWatchers as stopAllEmailWatchers } from './emailWatcher.js'
import {
  watchFiles,
  stopWatchFiles,
  stopAllFileWatchers,
  registerFileWatchingTrigger,
  unregisterFileWatchingTrigger,
  getRegisteredWorkflows,
} from './fileWatcher.js'

// Global event emitter for background tasks
export const backgroundEvents = new EventEmitter()

// Registry of active background tasks
const activeBackgroundTasks = new Map()

/**
 * Start a background task
 * @param {string} taskType - Type of background task (e.g., 'watchEmail')
 * @param {Object} config - Configuration for the task
 * @returns {string} Task ID
 */
export const startBackgroundTask = (taskType, config) => {
  validateBackgroundTaskInput(taskType, config)
  
  const taskId = generateTaskId(taskType, config)
  
  if (activeBackgroundTasks.has(taskId)) {
    console.log(`[Background] Task already running: ${taskId}`)
    return taskId
  }
  
  const handler = getBackgroundTaskHandler(taskType)
  handler.start(taskId, config, backgroundEvents)
  
  activeBackgroundTasks.set(taskId, { taskType, config, startedAt: new Date() })
  console.log(`[Background] Started task: ${taskId}`)
  
  return taskId
}

/**
 * Stop a background task
 * @param {string} taskId - Task ID to stop
 */
export const stopBackgroundTask = (taskId) => {
  if (!activeBackgroundTasks.has(taskId)) {
    console.log(`[Background] Task not found: ${taskId}`)
    return
  }
  
  const { taskType } = activeBackgroundTasks.get(taskId)
  const handler = getBackgroundTaskHandler(taskType)
  handler.stop(taskId)
  
  activeBackgroundTasks.delete(taskId)
  console.log(`[Background] Stopped task: ${taskId}`)
}

/**
 * Stop all background tasks
 */
export const stopAllBackgroundTasks = () => {
  console.log('[Background] Stopping all background tasks...')
  stopAllEmailWatchers()
  stopAllFileWatchers()
  activeBackgroundTasks.clear()
  console.log('[Background] All background tasks stopped')
}

/**
 * Get all active background tasks
 * @returns {Array} List of active tasks
 */
export const getActiveBackgroundTasks = () => {
  return Array.from(activeBackgroundTasks.entries()).map(([id, info]) => ({
    id,
    ...info,
  }))
}

const validateBackgroundTaskInput = (taskType, config) => {
  if (!taskType) {
    throw new Error('Task type is required')
  }
  if (!config) {
    throw new Error('Task configuration is required')
  }
}

const generateTaskId = (taskType, config) => {
  if (taskType === 'watchEmail') {
    return `watchEmail_${config.emailAccount}`
  }
  if (taskType === 'watchFiles') {
    return `watchFiles_${config.folder}_${config.changeType}`
  }
  return `${taskType}_${Date.now()}`
}

const getBackgroundTaskHandler = (taskType) => {
  const handlers = {
    watchEmail: {
      start: watchEmail,
      stop: stopWatchEmail,
    },
    watchFiles: {
      start: watchFiles,
      stop: stopWatchFiles,
    },
  }

  const handler = handlers[taskType]
  if (!handler) {
    throw new Error(`Unknown background task type: ${taskType}`)
  }

  return handler
}

// Background task definitions for the task registry
export const backgroundTasks = {
  watchEmail: {
    name: 'Watch Email',
    description: 'Watch an email account for new emails and emit events',
    inputs: [
      { name: 'emailAccount', type: 'string', label: 'Email Account (env var)', required: true },
      { name: 'pollingInterval', type: 'number', label: 'Polling Interval (seconds)', required: false, default: 60 },
    ],
    events: ['newEmail'],
  },
  watchFiles: {
    name: 'Watch Files',
    description: 'Watch a folder for file changes and emit events',
    inputs: [
      { name: 'folder', type: 'string', label: 'Folder Path', required: true },
      {
        name: 'changeType',
        type: 'select',
        label: 'Change Type',
        required: true,
        options: ['created', 'modified', 'deleted'],
      },
      { name: 'filePattern', type: 'string', label: 'File Pattern (e.g., *.txt)', required: false },
    ],
    events: ['fileChange'],
  },
}

// Re-export file watcher registration functions for workflow use
export { registerFileWatchingTrigger, unregisterFileWatchingTrigger, getRegisteredWorkflows }
