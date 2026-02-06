import { getLatestEmailWithAttachment, sendEmail } from './email.js'
import { runWorkflow as comfyRunWorkflow, comfyFsvProcess } from './comfy.js'
import {
  wait,
  navigate,
  findBrowserWindow,
  openBrowserWindow,
  closeBrowserWindow,
  findElements,
  waitForElement,
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
import { ollamaGenerate, ollamaList } from './llm.js'
import { parseQcHtml, parseAllQcHtmls, parseQcExcel, qcCheck, generateReport } from './ww.js'
import { pdfToImages, pdfToHtmls } from './doc.js'
import { ffmpegCut, ffprobeDuration, ksCutProcess } from './media.js'

export const tasks = {
  email: {
    getLatestEmailWithAttachment: {
      name: 'Get Latest Email with attachment',
      inputs: [
        { name: 'emailAccount', type: 'string', label: 'Email Account (env var)', required: true },
      ],
      outputs: ['sender', 'date', 'subject', 'body', 'attachments'],
      handler: getLatestEmailWithAttachment,
    },
    sendEmail: {
      name: 'Send Email',
      inputs: [
        { name: 'senderAccount', type: 'string', label: 'Sender Account (env var)', required: true },
        { name: 'receiverEmail', type: 'string', label: 'Receiver Email', required: false },
        { name: 'receiverAccount', type: 'string', label: 'Receiver Account (env var)', required: false },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        { name: 'body', type: 'text', label: 'Email Body', required: true },
        { name: 'attachments', type: 'array', label: 'Attachments (file paths)', required: false },
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
    navigate: {
      name: 'Navigate',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'url', type: 'string', label: 'URL to navigate to', required: true },
      ],
      outputs: ['success', 'message', 'title', 'url'],
      handler: navigate,
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
    waitForElement: {
      name: 'Wait for Element',
      inputs: [
        { name: 'connectionId', type: 'string', label: 'Browser Connection ID', required: true },
        { name: 'selector', type: 'string', label: 'CSS Selector', required: true },
        { name: 'timeoutSeconds', type: 'number', label: 'Timeout (seconds)', required: false, default: 30 },
        { name: 'pollIntervalSeconds', type: 'number', label: 'Poll Interval (seconds)', required: false, default: 1 },
      ],
      outputs: ['found', 'count', 'selector', 'error'],
      handler: waitForElement,
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
    readFile: {
      name: 'Read File',
      inputs: [
        { name: 'filePath', type: 'string', label: 'File Path', required: true },
        { name: 'encoding', type: 'string', label: 'Encoding (default: utf-8)', required: false, default: 'utf-8' },
      ],
      outputs: ['content', 'success', 'message'],
      handler: async ({ filePath, encoding = 'utf-8' }) => {
        const fs = await import('fs')
        try {
          const content = fs.readFileSync(filePath, encoding)
          return { content, success: true, message: `File read successfully: ${filePath}` }
        } catch (error) {
          throw new Error(`Failed to read file: ${error.message}`)
        }
      },
    },
    moveFile: {
      name: 'Move File',
      inputs: [
        { name: 'sourcePath', type: 'string', label: 'Source File Path', required: true },
        { name: 'destinationFolder', type: 'string', label: 'Destination Folder', required: true },
        { name: 'newFileName', type: 'string', label: 'New File Name (optional)', required: false },
      ],
      outputs: ['success', 'message', 'destinationPath'],
      handler: async ({ sourcePath, destinationFolder, newFileName }) => {
        const fs = await import('fs/promises')
        const path = await import('path')
        try {
          validateMoveFileInput(sourcePath, destinationFolder)

          // Ensure destination folder exists
          await fs.mkdir(destinationFolder, { recursive: true })

          // Determine destination file name
          const fileName = newFileName || path.basename(sourcePath)
          const destinationPath = path.join(destinationFolder, fileName)

          // Move the file
          await fs.rename(sourcePath, destinationPath)

          return {
            success: true,
            message: `File moved successfully from ${sourcePath} to ${destinationPath}`,
            destinationPath,
          }
        } catch (error) {
          throw new Error(`Failed to move file: ${error.message}`)
        }
      },
    },
  },
  llm: {
    ollamaGenerate: {
      name: 'Ollama API',
      inputs: [
        { name: 'model', type: 'string', label: 'Model', required: true },
        { name: 'prompt', type: 'text', label: 'Prompt', required: true },
        { name: 'images', type: 'string', label: 'Images (comma-separated paths or URLs)', required: false },
        { name: 'ollamaUrl', type: 'string', label: 'Ollama URL (default: http://localhost:11434/api)', required: false },
        { name: 'stream', type: 'boolean', label: 'Stream Response', required: false, default: false },
        { name: 'format', type: 'object', label: 'JSON format (converted to json_schema)', required: false },
      ],
      outputs: ['success', 'response', 'model', 'error'],
      handler: ollamaGenerate,
    },
    ollamaList: {
      name: 'Ollama List',
      inputs: [
        { name: 'ollamaUrl', type: 'string', label: 'Ollama URL (default: http://localhost:11434)', required: false },
      ],
      outputs: ['models'],
      handler: ollamaList,
    },
  },
  ww: {
    parseQcHtml: {
      name: 'Parse QC Html',
      inputs: [
        { name: 'html', type: 'text', label: 'HTML Content', required: true },
      ],
      outputs: ['analytes', 'metadata'],
      handler: parseQcHtml,
    },
    parseAllQcHtmls: {
      name: 'Parse All QC Htmls',
      inputs: [
        { name: 'folder', type: 'string', label: 'Folder Path', required: true },
        { name: 'filterFn', type: 'function', label: 'Filter Function', required: false },
      ],
      outputs: ['analytes', 'metadata'],
      handler: parseAllQcHtmls,
    },
    parseQcExcel: {
      name: 'Parse QC Excel',
      inputs: [
        { name: 'labReportId', type: 'string', label: 'Lab Report ID', required: true },
      ],
      outputs: ['analytes', 'metadata'],
      handler: parseQcExcel,
    },
    qcCheck: {
      name: 'QC Check',
      inputs: [
        { name: 'analyteList1', type: 'array', label: 'Analyte List 1', required: true },
        { name: 'analyteList2', type: 'array', label: 'Analyte List 2', required: true },
      ],
      outputs: ['differences', 'hasDifferences'],
      handler: qcCheck,
    },
    generateReport: {
      name: 'Generate Report',
      inputs: [
        { name: 'labReportId', type: 'string', label: 'Lab Report ID', required: true },
      ],
      outputs: ['success', 'labReportId', 'reportPath'],
      handler: generateReport,
    },
  },
  doc: {
    pdfToImages: {
      name: 'PDF to Images',
      inputs: [
        { name: 'pdfPath', type: 'string', label: 'PDF File Path', required: true },
        { name: 'startPage', type: 'number', label: 'Start Page', required: false, default: 1 },
        { name: 'endPage', type: 'number', label: 'End Page (default: last page)', required: false },
      ],
      outputs: ['folder'],
      handler: pdfToImages,
    },
    pdfToHtmls: {
      name: 'PDF to Htmls',
      inputs: [
        { name: 'pdfPath', type: 'string', label: 'PDF File Path', required: true },
        { name: 'startPage', type: 'number', label: 'Start Page', required: false, default: 1 },
        { name: 'endPage', type: 'number', label: 'End Page (default: last page)', required: false },
      ],
      outputs: ['folder'],
      handler: pdfToHtmls,
    },
  },
  comfy: {
    runWorkflow: {
      name: 'Run ComfyUI Workflow',
      inputs: [
        { name: 'workflowPath', type: 'file', label: 'Workflow JSON File Path', required: true },
        { name: 'params', type: 'array', label: 'Params to set (key/value pairs)', required: false },
        { name: 'outputKey', type: 'string', label: 'Output Key', required: false },
      ],
      outputs: ['fileName'],
      handler: comfyRunWorkflow,
    },
    comfyFsvProcess: {
      name: 'Comfy FSV Process',
      inputs: [
        {
          name: 'type',
          type: 'radio',
          label: 'Workflow Type',
          required: false,
          default: 'fsv',
          options: [
            { value: 'fsv', text: 'fsv' },
            { value: 'fsvr', text: 'fsvr' },
            { value: 'fsi', text: 'fsi' },
          ],
        },
        { name: 'filePath', type: 'file', label: 'File or Folder Path', required: true },
        {
          name: 'count',
          type: 'radio',
          label: 'Face Count',
          required: false,
          default: '1',
          options: [
            { value: '1', text: '1' },
            { value: '2', text: '2' },
            { value: '3', text: '3' },
          ],
        },
      ],
      outputs: ['success', 'results', 'message'],
      handler: comfyFsvProcess,
    },
  },
  media: {
    ffmpegCut: {
      name: 'FFmpeg Cut',
      inputs: [
        { name: 'fileName', type: 'file', label: 'File Path', required: true },
        { name: 'duration', type: 'number', label: 'Duration (seconds)', required: false },
        { name: 'start', type: 'number', label: 'Start Time (seconds)', required: false, default: 0 },
        { name: 'end', type: 'number', label: 'End Time (seconds)', required: false },
        { name: 'isCopy', type: 'boolean', label: 'Use Stream Copy (faster but less accurate)', required: false, default: false },
      ],
      outputs: ['success', 'message', 'outputPath'],
      handler: ffmpegCut,
    },
    ffprobeDuration: {
      name: 'FFprobe Duration',
      inputs: [
        { name: 'fileName', type: 'file', label: 'File Path', required: true },
      ],
      outputs: ['success', 'duration', 'message'],
      handler: ffprobeDuration,
    },
    ksCutProcess: {
      name: 'KS Cut Process',
      inputs: [
        { name: 'filePath', type: 'string', label: 'File or Folder Path', required: true },
        { name: 'start', type: 'number', label: 'Start Time (seconds)', required: false },
        { name: 'end', type: 'number', label: 'End Time (seconds)', required: false },
      ],
      outputs: ['success', 'results', 'message'],
      handler: ksCutProcess,
    },
  },
}

const validateMoveFileInput = (sourcePath, destinationFolder) => {
  if (!sourcePath) {
    throw new Error('Source path is required')
  }
  if (!destinationFolder) {
    throw new Error('Destination folder is required')
  }
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