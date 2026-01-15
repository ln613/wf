import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'

/**
 * Convert PDF to individual page images using Stirling API
 * @param {Object} inputs
 * @param {string} inputs.pdfPath - Path to the PDF file (required)
 * @param {number} inputs.startPage - Start page number (default: 1)
 * @param {number} inputs.endPage - End page number (default: last page)
 * @returns {Object} Result with folder path containing generated images
 */
export const pdfToImages = async ({ pdfPath, startPage = 1, endPage }) => {
  validatePdfInput(pdfPath)

  const pdfBuffer = await readPdfFile(pdfPath)
  const outputFolder = createOutputFolder(pdfPath)
  const imageBuffers = await callStirlingApi(pdfBuffer, startPage, endPage)
  await saveImages(imageBuffers, outputFolder)

  return { folder: outputFolder }
}

/**
 * Validate PDF input
 * @param {string} pdfPath - Path to PDF file
 */
const validatePdfInput = (pdfPath) => {
  if (!pdfPath) {
    throw new Error('PDF file path is required')
  }
  if (!fsSync.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`)
  }
}

/**
 * Read PDF file as buffer
 * @param {string} pdfPath - Path to PDF file
 * @returns {Buffer} PDF file buffer
 */
const readPdfFile = async (pdfPath) => {
  return await fs.readFile(pdfPath)
}

/**
 * Create output folder for images
 * @param {string} pdfPath - Path to PDF file
 * @returns {string} Output folder path
 */
const createOutputFolder = (pdfPath) => {
  const pdfName = path.basename(pdfPath, path.extname(pdfPath))
  const timestamp = Date.now()
  const outputFolder = path.join(os.tmpdir(), `pdf-images-${pdfName}-${timestamp}`)
  fsSync.mkdirSync(outputFolder, { recursive: true })
  return outputFolder
}

/**
 * Get Stirling API URL from environment or use default
 * @returns {string} Stirling API URL
 */
const getStirlingApiUrl = () => {
  return process.env.STIRLING_API_URL || 'http://localhost:8080'
}

/**
 * Get Stirling API key from environment
 * @returns {string} Stirling API key
 */
const getStirlingApiKey = () => {
  return process.env.STIRLING_API_KEY || ''
}

/**
 * Call Stirling API to convert PDF to images
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {number} startPage - Start page number
 * @param {number} endPage - End page number (null for all pages)
 * @returns {Array<Buffer>} Array of image buffers
 */
const callStirlingApi = async (pdfBuffer, startPage, endPage) => {
  const apiUrl = getStirlingApiUrl()
  const apiKey = getStirlingApiKey()

  const formData = new FormData()
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
  formData.append('fileInput', pdfBlob, 'input.pdf')
  formData.append('imageFormat', 'png')
  formData.append('singleOrMultiple', 'multiple')
  formData.append('colorType', 'color')
  formData.append('dpi', '150')

  if (startPage && startPage > 1) {
    formData.append('pageNumbers', buildPageRange(startPage, endPage))
  } else if (endPage) {
    formData.append('pageNumbers', buildPageRange(1, endPage))
  }

  const headers = {}
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const response = await fetch(`${apiUrl}/api/v1/convert/pdf/img`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Stirling API error: ${response.status} - ${errorText}`)
  }

  const imageBuffers = await extractImagesFromResponse(response)
  return imageBuffers
}

/**
 * Build page range string for Stirling API
 * @param {number} startPage - Start page number
 * @param {number} endPage - End page number
 * @returns {string} Page range string (e.g., "1-5" or "1,2,3,4,5")
 */
const buildPageRange = (startPage, endPage) => {
  if (!endPage) {
    return `${startPage}-`
  }
  return `${startPage}-${endPage}`
}

/**
 * Extract images from Stirling API response
 * The response is a ZIP file containing the images
 * @param {Response} response - Fetch response
 * @returns {Array<Buffer>} Array of image buffers
 */
const extractImagesFromResponse = async (response) => {
  const JSZip = (await import('jszip')).default
  const zipBuffer = await response.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)

  const imageBuffers = []
  const fileNames = Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && /\.(png|jpg|jpeg)$/i.test(name),
  )

  // Sort files by name to maintain page order
  fileNames.sort((a, b) => {
    const numA = extractPageNumber(a)
    const numB = extractPageNumber(b)
    return numA - numB
  })

  for (const fileName of fileNames) {
    const buffer = await zip.files[fileName].async('nodebuffer')
    imageBuffers.push({ name: fileName, buffer })
  }

  return imageBuffers
}

/**
 * Extract page number from filename
 * @param {string} fileName - File name
 * @returns {number} Page number
 */
const extractPageNumber = (fileName) => {
  const match = fileName.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Save images to output folder
 * @param {Array<{name: string, buffer: Buffer}>} imageBuffers - Array of image objects
 * @param {string} outputFolder - Output folder path
 */
const saveImages = async (imageBuffers, outputFolder) => {
  for (let i = 0; i < imageBuffers.length; i++) {
    const { name, buffer } = imageBuffers[i]
    const ext = path.extname(name) || '.png'
    const outputPath = path.join(outputFolder, `page-${String(i + 1).padStart(4, '0')}${ext}`)
    await fs.writeFile(outputPath, buffer)
  }
}
