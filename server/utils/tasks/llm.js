import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api'

/**
 * Get the Ollama base URL from params, env var, or default
 * @param {string} [ollamaUrl] - Optional URL override
 * @returns {string} The Ollama base URL
 */
const getOllamaBaseUrl = (ollamaUrl) =>
  ollamaUrl || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL

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
 * Expand image paths - handles directories, individual files, and URLs
 * @param {string|string[]} images - Image path(s), directory path(s), or URL(s)
 * @returns {string[]} Array of individual image paths/URLs
 */
function expandImagePaths(images) {
  const imageArray = Array.isArray(images) ? images : [images]
  const expandedPaths = []
  
  for (const img of imageArray) {
    // Check if it's a URL
    if (img.startsWith('http://') || img.startsWith('https://')) {
      expandedPaths.push(img)
    } else if (fs.existsSync(img)) {
      const stats = fs.statSync(img)
      if (stats.isDirectory()) {
        // It's a directory - get all images from it
        expandedPaths.push(...getImagesFromDirectory(img))
      } else {
        // It's a file
        expandedPaths.push(img)
      }
    } else {
      // Might be base64 or invalid path, pass through
      expandedPaths.push(img)
    }
  }
  
  return expandedPaths
}

/**
 * Convert image to base64 string
 * @param {string} imagePath - Path to the image file or URL
 * @returns {Promise<string>} Base64 encoded string
 */
async function imageToBase64(imagePath) {
  // Check if it's a URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const response = await fetch(imagePath)
    const buffer = await response.buffer()
    return buffer.toString('base64')
  }
  
  // It's a local file path
  const imageBuffer = fs.readFileSync(imagePath)
  return imageBuffer.toString('base64')
}

/**
 * Convert a JSON object format to Ollama json_schema format
 * @param {Object} format - The JSON object format
 * @returns {Object} The Ollama json_schema format
 */
function convertToJsonSchema(format) {
  const inferType = (value) => {
    if (value === null) return { type: 'string' }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        return { type: 'array', items: inferType(value[0]) }
      }
      return { type: 'array', items: { type: 'string' } }
    }
    if (typeof value === 'object') {
      return buildSchema(value)
    }
    if (typeof value === 'number') return { type: 'number' }
    if (typeof value === 'boolean') return { type: 'boolean' }
    return { type: 'string' }
  }

  const buildSchema = (obj) => {
    const properties = {}
    const required = []
    for (const [key, value] of Object.entries(obj)) {
      properties[key] = inferType(value)
      required.push(key)
    }
    return { type: 'object', properties, required }
  }

  return buildSchema(format)
}

/**
 * Call the Ollama API generate endpoint
 * @param {Object} params - The parameters for the Ollama API call
 * @param {string} params.model - The model to use
 * @param {string} params.prompt - The prompt to send
 * @param {string|string[]} [params.images] - Image path(s) or URL(s) to include
 * @param {string} [params.ollamaUrl] - The Ollama API URL (defaults to env var or localhost)
 * @param {boolean} [params.stream] - Whether to stream the response (default false)
 * @param {Object} [params.format] - JSON object format to convert to json_schema
 * @returns {Promise<Object>} The response from Ollama
 */
export async function ollamaGenerate({ model, prompt, images, ollamaUrl, stream = false, format }) {
  const baseUrl = getOllamaBaseUrl(ollamaUrl)
  const generateUrl = `${baseUrl}/generate`
  const startTime = Date.now()

  console.log(`[Ollama] Starting generation with model: ${model}`)

  // Prepare the request body
  const requestBody = {
    model,
    prompt,
    stream,
  }

  // If format is provided, convert to json_schema
  if (format && typeof format === 'object') {
    requestBody.format = convertToJsonSchema(format)
  }
  
  // Check if images is a valid value (not undefined, null, empty, or unresolved template)
  const isValidImages = (img) => {
    if (!img) return false
    if (typeof img === 'string' && img.includes('{{')) return false // Unresolved template
    return true
  }

  // If images are provided, expand directories and convert to base64
  let expandedImages = []
  if (isValidImages(images)) {
    expandedImages = expandImagePaths(images)
    const base64Images = await Promise.all(
      expandedImages.map(async (img) => {
        // Check if already base64 (no file extension or URL pattern)
        if (!img.includes('.') && !img.startsWith('http')) {
          return img // Already base64
        }
        return await imageToBase64(img)
      })
    )
    requestBody.images = base64Images
  }
  
  // Log the request body (with image paths/URLs instead of base64 for readability)
  const logBody = { ...requestBody }
  if (expandedImages.length > 0) {
    logBody.images = expandedImages
  }
  console.log(`[Ollama] Request body:`, JSON.stringify(logBody, null, 2))
  try {
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    const data = await response.json()
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Ollama] Completed generation with model: ${model} in ${elapsedTime}s`)
    console.log(`[Ollama] Response:`)
    console.log(data)
    
    // Parse and return the JSON from the response field
    // Response comes in format: ```json ... ```
    try {
      const responseText = data.response
      // Extract JSON from markdown code block if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonString = jsonMatch ? jsonMatch[1].trim() : responseText
      return JSON.parse(jsonString)
    } catch {
      // If parsing fails, return the raw response
      return data.response
    }
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Ollama] Failed generation with model: ${model} after ${elapsedTime}s - ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Call the Ollama API tags endpoint to list available models
 * @param {Object} params - The parameters for the Ollama API call
 * @param {string} [params.ollamaUrl] - The Ollama API URL (defaults to env var or localhost)
 * @returns {Promise<string[]>} Array of model names
 */
export async function ollamaList({ ollamaUrl } = {}) {
  const baseUrl = getOllamaBaseUrl(ollamaUrl)
  const tagsUrl = `${baseUrl}/tags`

  try {
    const response = await fetch(tagsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // Extract model names from the response
    const modelNames = data.models?.map((model) => model.name) || []
    return modelNames
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}