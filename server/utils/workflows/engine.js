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
  // Handle conditional execution
  if (taskStep.condition !== undefined) {
    const conditionMet = evaluateCondition(taskStep.condition, context)
    if (!conditionMet) {
      return undefined
    }
    // If condition is met and there are nested tasks, execute them
    if (taskStep.tasks && Array.isArray(taskStep.tasks)) {
      return executeNestedTasks(taskStep.tasks, context)
    }
  }

  // Handle forEach loop
  if (taskStep.forEach) {
    return executeForEach(taskStep, context)
  }

  // Handle inline handler functions
  if (taskStep.handler) {
    return executeInlineHandler(taskStep, context)
  }
  
  const task = resolveTask(taskStep)
  const taskInputs = resolveTaskInputs(task, taskStep, context)
  const result = await task.handler(taskInputs)
  
  // Handle debug logging
  if (taskStep.debug) {
    console.log(`[DEBUG] Task: ${taskStep.taskName}`)
    console.log(`[DEBUG] Output:`, JSON.stringify(result, null, 2))
  }
  
  // Handle outputAs - store result under a named key
  if (taskStep.outputAs) {
    return { [taskStep.outputAs]: result }
  }
  
  return result
}

/**
 * Execute an inline handler function
 * @param {Object} taskStep - Task step with handler function
 * @param {Object} context - Context object
 * @returns {Object} Result from handler, optionally wrapped with outputAs
 */
const executeInlineHandler = async (taskStep, context) => {
  const result = await taskStep.handler(context)

  if (taskStep.debug) {
    console.log(`[DEBUG] Inline handler`)
    console.log(`[DEBUG] Output:`, JSON.stringify(result, null, 2))
  }

  if (taskStep.outputAs) {
    return { [taskStep.outputAs]: result }
  }

  return result
}

/**
 * Evaluate a condition expression
 * Supports template variables like {{E}} which checks if E is truthy (not null/undefined)
 * @param {string} condition - Condition expression
 * @param {Object} context - Context object with variable values
 * @returns {boolean} True if condition is met
 */
const evaluateCondition = (condition, context) => {
  if (typeof condition === 'boolean') {
    return condition
  }
  
  if (typeof condition === 'string') {
    // Check if it's a simple template variable check like {{E}}
    const singleTemplateMatch = condition.match(/^\{\{([\w.]+)\}\}$/)
    if (singleTemplateMatch) {
      const value = getNestedValue(context, singleTemplateMatch[1])
      // Check if value is truthy (not null, undefined, false, 0, '', etc.)
      return value !== null && value !== undefined && value !== false
    }
    
    // For more complex conditions, resolve the template and evaluate
    const resolved = resolveTemplateString(condition, context)
    return resolved !== '' && resolved !== 'false' && resolved !== 'null' && resolved !== 'undefined'
  }
  
  return Boolean(condition)
}

/**
 * Execute nested tasks and return combined output
 * @param {Array} tasks - Array of task steps
 * @param {Object} context - Context object
 * @returns {Object} Combined output from all tasks
 */
const executeNestedTasks = async (tasks, context) => {
  let nestedContext = { ...context }
  let lastOutput = undefined
  
  for (const subTask of tasks) {
    lastOutput = await executeTaskStep(subTask, nestedContext)
    if (lastOutput !== undefined) {
      nestedContext = { ...nestedContext, ...lastOutput }
    }
  }
  
  return lastOutput
}

/**
 * Get nested property value from object using dot notation
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot-separated path (e.g., 'H.analytes')
 * @returns {*} Value at path or undefined
 */
const getNestedValue = (obj, path) => {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[part]
  }
  return current
}

/**
 * Resolve template variables in a string
 * Supports nested property access like {{H.analytes}}
 * @param {string} value - String potentially containing {{varName}} or {{varName.prop}} templates
 * @param {Object} context - Context object with variable values
 * @returns {string} Resolved string
 */
const resolveTemplateString = (value, context) => {
  if (typeof value !== 'string' || !value.includes('{{')) {
    return value
  }
  return value.replace(/\{\{([\w.]+)\}\}/g, (match, varPath) => {
    const resolved = getNestedValue(context, varPath)
    return resolved !== undefined ? resolved : match
  })
}

const executeForEach = async (taskStep, context) => {
  const { forEach, tasks, combineResults } = taskStep
  let items = []
  let readContent = false
  let isImageType = false
  
  // Resolve the items to iterate over
  if (forEach.imagesIn) {
    // Get all images from directory
    const dirPath = resolveTemplateString(forEach.imagesIn, context)
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      items = getImagesFromDirectory(dirPath)
    }
    isImageType = true
  } else if (forEach.filesIn) {
    // Get all files with specific extension from directory
    let { directory, extension, extensionByType } = forEach.filesIn
    const { readContentByType } = forEach
    
    // Resolve directory template
    directory = resolveTemplateString(directory, context)
    
    // Determine extension based on type if extensionByType is provided
    if (extensionByType && context.type) {
      const typeValue = context.type
      extension = extensionByType[typeValue]
      isImageType = extension === 'image'
    }
    
    // Determine readContent based on type if readContentByType is provided
    if (readContentByType && context.type) {
      const typeValue = context.type
      readContent = readContentByType[typeValue] === true
    } else {
      readContent = forEach.readContent !== false // Default to true
    }
    
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
      if (isImageType) {
        items = getImagesFromDirectory(directory)
      } else {
        items = getFilesWithExtension(directory, extension)
      }
    }
  } else if (forEach.items) {
    const resolvedItems = typeof forEach.items === 'function'
      ? await forEach.items(context)
      : resolveValue(forEach.items, context)
    items = Array.isArray(resolvedItems) ? resolvedItems : [resolvedItems]
  }
  
  const results = []
  const itemVar = forEach.as || 'item'
  const contentVar = forEach.contentAs || 'content'
  
  // Execute tasks for each item
  for (const item of items) {
    let loopContext = { ...context, [itemVar]: item }
    
    // For image type, set the imageFile variable
    if (isImageType) {
      loopContext.imageFile = item
    }
    
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
    return resolveValue(value, context)
  }
  return context[inputName]
}

/**
 * Resolve a value, handling strings with templates, arrays, and objects
 * @param {*} value - Value to resolve
 * @param {Object} context - Context object with variable values
 * @returns {*} Resolved value
 */
const resolveValue = (value, context) => {
  // Handle arrays - resolve each element
  if (Array.isArray(value)) {
    return value.map(item => resolveValue(item, context))
  }
  
  // Handle strings with template variables
  if (typeof value === 'string' && value.includes('{{')) {
    // Check if the entire value is a single template expression
    const singleTemplateMatch = value.match(/^\{\{([\w.]+)\}\}$/)
    if (singleTemplateMatch) {
      // Return the actual value (could be object, array, etc.)
      const resolved = getNestedValue(context, singleTemplateMatch[1])
      return resolved !== undefined ? resolved : value
    }
    // Otherwise, do string replacement - convert objects to JSON strings
    return value.replace(/\{\{([\w.]+)\}\}/g, (match, varPath) => {
      const resolved = getNestedValue(context, varPath)
      if (resolved === undefined) return match
      // Convert objects/arrays to JSON string for string interpolation
      if (typeof resolved === 'object' && resolved !== null) {
        return JSON.stringify(resolved, null, 2)
      }
      return resolved
    })
  }
  
  // Handle objects - resolve each property value
  if (typeof value === 'object' && value !== null) {
    const resolved = {}
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, context)
    }
    return resolved
  }
  
  return value
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