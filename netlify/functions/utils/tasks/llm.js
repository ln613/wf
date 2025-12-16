import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

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
 * Call the Ollama API generate endpoint
 * @param {Object} params - The parameters for the Ollama API call
 * @param {string} params.model - The model to use
 * @param {string} params.prompt - The prompt to send
 * @param {string|string[]} [params.images] - Image path(s) or URL(s) to include
 * @param {string} [params.ollamaUrl] - The Ollama API URL (defaults to env var or localhost)
 * @param {boolean} [params.stream] - Whether to stream the response (default false)
 * @returns {Promise<Object>} The response from Ollama
 */
export async function ollamaGenerate({ model, prompt, images, ollamaUrl, stream = false }) {
  // Get Ollama URL from params, env var, or default
  const baseUrl = ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434/api'
  const generateUrl = `${baseUrl}/generate`
  
  // Prepare the request body
  const requestBody = {
    model,
    prompt,
    stream,
  }
  
  // If images are provided, convert them to base64
  if (images) {
    const imageArray = Array.isArray(images) ? images : [images]
    const base64Images = await Promise.all(
      imageArray.map(async (img) => {
        // Check if already base64 (no file extension or URL pattern)
        if (!img.includes('.') && !img.startsWith('http')) {
          return img // Already base64
        }
        return await imageToBase64(img)
      })
    )
    requestBody.images = base64Images
  }
  
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
    
    return {
      success: true,
      response: data.response,
      model: data.model,
      createdAt: data.created_at,
      done: data.done,
      context: data.context,
      totalDuration: data.total_duration,
      loadDuration: data.load_duration,
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      evalDuration: data.eval_duration,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}