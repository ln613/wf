import { getLatestEmail, sendEmail } from './email.js'
import {
  wait,
  findBrowserWindow,
  openBrowserWindow,
  closeBrowserWindow,
  findElements,
  getAttribute,
  setAttribute,
  enterText,
  clickElement,
  checkElement,
  uncheckElement,
  toggleElement,
  selectOption,
  selectFromDropdown,
} from './browser.js'

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
    closeBrowserWindow: {
      name: 'Close Browser Window',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
      ],
      outputs: ['success', 'message'],
      handler: closeBrowserWindow,
    },
    findElements: {
      name: 'Find Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
      ],
      outputs: ['found', 'count', 'selector'],
      handler: findElements,
    },
    getAttribute: {
      name: 'Get Attribute',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'attributes', type: 'string', label: 'Attributes to extract (comma-separated)', required: true },
      ],
      outputs: ['attributes'],
      handler: getAttribute,
    },
    setAttribute: {
      name: 'Set Attribute',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'name', type: 'string', label: 'Attribute Name', required: true },
        { name: 'value', type: 'string', label: 'Attribute Value', required: true },
      ],
      outputs: ['success', 'message'],
      handler: setAttribute,
    },
    enterText: {
      name: 'Enter Text',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'text', type: 'string', label: 'Text to enter', required: true },
      ],
      outputs: ['success', 'message'],
      handler: enterText,
    },
    clickElement: {
      name: 'Click Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
      ],
      outputs: ['success', 'message'],
      handler: clickElement,
    },
    checkElement: {
      name: 'Check Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
      ],
      outputs: ['success', 'message'],
      handler: checkElement,
    },
    uncheckElement: {
      name: 'Uncheck Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
      ],
      outputs: ['success', 'message'],
      handler: uncheckElement,
    },
    toggleElement: {
      name: 'Toggle Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
      ],
      outputs: ['success', 'message', 'checked'],
      handler: toggleElement,
    },
    selectOption: {
      name: 'Select Option',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'value', type: 'string', label: 'Value or text to select', required: true },
      ],
      outputs: ['success', 'message'],
      handler: selectOption,
    },
    selectFromDropdown: {
      name: 'Select From Dropdown',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'value', type: 'string', label: 'Value or text to select', required: true },
      ],
      outputs: ['success', 'message'],
      handler: selectFromDropdown,
    },
  },
  utility: {
    wait: {
      name: 'Wait',
      inputs: [
        { name: 'seconds', type: 'number', label: 'Seconds to wait', required: true },
      ],
      outputs: ['success', 'message'],
      handler: wait,
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