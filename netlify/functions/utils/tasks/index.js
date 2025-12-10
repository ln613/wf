import { getLatestEmail, sendEmail } from './email.js'
import { findBrowserWindow, openBrowserWindow, findElements, closeBrowserConnection } from './browser.js'

export const tasks = {
  email: {
    getLatestEmail: {
      name: 'Get Latest Email',
      inputs: [
        { name: 'emailAccount', type: 'string', label: 'Email Account (env var)', required: true },
      ],
      outputs: ['sender', 'date', 'subject', 'body'],
      handler: getLatestEmail,
    },
    sendEmail: {
      name: 'Send Email',
      inputs: [
        { name: 'senderAccount', type: 'string', label: 'Sender Account (env var)', required: true },
        { name: 'receiverEmail', type: 'string', label: 'Receiver Email', required: true },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        { name: 'body', type: 'text', label: 'Email Body', required: true },
      ],
      outputs: ['success', 'message'],
      handler: sendEmail,
    },
  },
  browser: {
    findBrowserWindow: {
      name: 'Find Browser Window',
      inputs: [
        { name: 'browserType', type: 'string', label: 'Browser Type (any, chrome, firefox)', required: false, default: 'any' },
        { name: 'title', type: 'string', label: 'Window Title (substring, case insensitive)', required: true },
      ],
      outputs: ['connectionId', 'title', 'url', 'browserType'],
      handler: findBrowserWindow,
    },
    openBrowserWindow: {
      name: 'Open Browser Window',
      inputs: [
        { name: 'browserType', type: 'string', label: 'Browser Type (chrome, firefox)', required: false, default: 'chrome' },
        { name: 'url', type: 'string', label: 'URL to navigate to', required: true },
      ],
      outputs: ['connectionId', 'title', 'url', 'browserType'],
      handler: openBrowserWindow,
    },
    findElements: {
      name: 'Find Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'attributes', type: 'string', label: 'Attributes to extract (comma-separated)', required: true },
      ],
      outputs: ['elements'],
      handler: findElements,
    },
    closeBrowserConnection: {
      name: 'Close Browser Connection',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
      ],
      outputs: ['success', 'message'],
      handler: closeBrowserConnection,
    },
  },
}

export const getTaskByName = (taskName) => {
  for (const category of Object.values(tasks)) {
    for (const [key, task] of Object.entries(category)) {
      if (task.name === taskName) {
        return { ...task, key }
      }
    }
  }
  return null
}

export const getAllTasks = () => {
  const result = []
  for (const [category, categoryTasks] of Object.entries(tasks)) {
    result.push({
      category,
      tasks: Object.entries(categoryTasks).map(([key, task]) => ({
        key,
        name: task.name,
        inputs: task.inputs,
        outputs: task.outputs,
      })),
    })
  }
  return result
}