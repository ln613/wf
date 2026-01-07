import { getTaskByName } from '../tasks/index.js'
import fs from 'fs'
import path from 'path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

/**
 * Get all image files from a directory
 * @param {string} dirPath - Path to the directory
 * @returns {string[]} Array of image file paths
 */
function getImagesFromDirectory(dirPath) {
  const files = fs.readdirSync(dirPath)
  return files
    .filter(file => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map(file => path.join(dirPath, file))
}

/**
 * Get all files with specific extension from a directory
 * @param {string} dirPath - Path to the directory
 * @param {string} extension - File extension (e.g., '.html')
 * @returns {string[]} Array of file paths
 */
function getFilesWithExtension(dirPath, extension) {
  const files = fs.readdirSync(dirPath)
  return files
    .filter(file => path.extname(file).toLowerCase() === extension.toLowerCase())
    .map(file => path.join(dirPath, file))
}

/**
 * Read file content
 * @param {string} filePath - Path to the file
 * @returns {string} File content
 */
function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Merge results by combining content arrays while keeping the first header
 * @param {Object[]} results - Array of results with header and content
 * @returns {Object} Merged result with combined content
 */
function mergeContentResults(results) {
  if (!results || results.length === 0) {
    return { results: { header: null, content: [] } }
  }
  
  const firstResult = results[0]
  const mergedContent = results.reduce((acc, result) => {
    if (result && result.content && Array.isArray(result.content)) {
      return [...acc, ...result.content]
    }
    return acc
  }, [])
  
  return {
    results: {
      header: firstResult?.header || null,
      content: mergedContent,
    },
  }
}

export const runWorkflow = async (workflow, inputs = {}) => {
  validateWorkflow(workflow)
  let context = { ...inputs }
  let lastOutput = null

  for (const taskStep of workflow.tasks) {
    lastOutput = await executeTaskStep(taskStep, context)
    if (lastOutput !== undefined) {
      context = { ...context, ...lastOutput }
    }
  }

  return workflow.output ? extractOutput(context, workflow.output) : lastOutput
}

const validateWorkflow = (workflow) => {
  if (!workflow) throw new Error('Workflow is required')
  if (!workflow.name) throw new Error('Workflow name is required')
  if (!workflow.tasks || !Array.isArray(workflow.tasks)) {
    throw new Error('Workflow tasks must be an array')
  }
}

const executeTaskStep = async (taskStep, context) => {
  // Handle forEach loop
  if (taskStep.forEach) {
    return executeForEach(taskStep, context)
  }
  
  const task = resolveTask(taskStep)
  const taskInputs = resolveTaskInputs(task, taskStep, context)
  return task.handler(taskInputs)
}

const executeForEach = async (taskStep, context) => {
  const { forEach, tasks, combineResults } = taskStep
  let items = []
  let readContent = false
  
  // Resolve the items to iterate over
  if (forEach.imagesIn) {
    // Get all images from directory
    const dirPath = forEach.imagesIn
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      items = getImagesFromDirectory(dirPath)
    }
  } else if (forEach.filesIn) {
    // Get all files with specific extension from directory
    const { directory, extension } = forEach.filesIn
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
      items = getFilesWithExtension(directory, extension)
      readContent = forEach.readContent !== false // Default to true
    }
  } else if (forEach.items) {
    items = Array.isArray(forEach.items) ? forEach.items : [forEach.items]
  }
  
  const results = []
  const itemVar = forEach.as || 'item'
  const contentVar = forEach.contentAs || 'content'
  
  // Execute tasks for each item
  for (const item of items) {
    let loopContext = { ...context, [itemVar]: item }
    
    // Read file content if needed
    if (readContent && fs.existsSync(item)) {
      loopContext[contentVar] = readFileContent(item)
    }
    
    let loopOutput = null
    
    for (const subTask of tasks) {
      loopOutput = await executeTaskStep(subTask, loopContext)
      if (loopOutput !== undefined) {
        loopContext = { ...loopContext, ...loopOutput }
      }
    }
    
    results.push(loopOutput)
  }
  
  // Combine results
  if (combineResults === 'array') {
    return { results }
  } else if (combineResults === 'merge') {
    return { results: results.reduce((acc, r) => ({ ...acc, ...r }), {}) }
  } else if (combineResults === 'flatten') {
    return { results: results.flat() }
  } else if (combineResults === 'mergeContent') {
    // Merge results by combining content arrays while keeping the first header
    return mergeContentResults(results)
  }
  
  return { results }
}

const resolveTask = (taskStep) => {
  const task = getTaskByName(taskStep.taskName)
  if (!task) {
    throw new Error(`Task not found: ${taskStep.taskName}`)
  }
  return task
}

const resolveTaskInputs = (task, taskStep, context) => {
  const inputs = {}
  for (const inputDef of task.inputs) {
    const value = getInputValue(inputDef.name, taskStep, context)
    if (inputDef.required && value === undefined) {
      throw new Error(`Required input '${inputDef.name}' not provided for task '${taskStep.taskName}'`)
    }
    inputs[inputDef.name] = value
  }
  return inputs
}

const getInputValue = (inputName, taskStep, context) => {
  if (taskStep.inputs && taskStep.inputs[inputName] !== undefined) {
    const value = taskStep.inputs[inputName]
    // Resolve template variables like {{varName}} - supports multiple and embedded variables
    if (typeof value === 'string' && value.includes('{{')) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return context[varName] !== undefined ? context[varName] : match
      })
    }
    return value
  }
  return context[inputName]
}

const extractOutput = (context, outputDef) => {
  if (Array.isArray(outputDef)) {
    const result = {}
    for (const key of outputDef) {
      result[key] = context[key]
    }
    return result
  }
  return context[outputDef]
}