import { JSDOM } from 'jsdom'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import os from 'os'
import {
  openBrowserWindow,
  enterText,
  clickElement,
  wait,
  navigate,
  waitForDownload,
  closeBrowserWindow,
} from './browser.js'

/**
 * Parse QC HTML content and extract analytes and metadata
 * @param {Object} inputs
 * @param {string} inputs.html - HTML content to parse
 * @returns {Object} Result with analytes list and metadata
 */
export const parseQcHtml = async ({ html }) => {
  validateHtmlInput(html)

  const pElements = extractPElements(html)
  const sortedElements = sortByPosition(pElements)
  const groups = groupByTop(sortedElements)
  const result = processGroups(groups)

  return result
}

/**
 * Validate HTML input
 * @param {string} html - HTML content
 */
const validateHtmlInput = (html) => {
  if (!html) {
    throw new Error('HTML content is required')
  }
}

/**
 * Extract all <p> elements with their position and text
 * @param {string} html - HTML content
 * @returns {Array} Array of objects with top, left, and text
 */
const extractPElements = (html) => {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const pElements = document.querySelectorAll('p')

  return Array.from(pElements).map((p) => {
    const style = p.getAttribute('style') || ''
    const top = extractStyleValue(style, 'top')
    const left = extractStyleValue(style, 'left')
    const text = normalizeText(p.textContent || '')

    return { top, left, text }
  })
}

/**
 * Normalize text by replacing non-breaking spaces with regular spaces and trimming
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
const normalizeText = (text) => {
  return text.replace(/\u00A0/g, ' ').trim()
}

/**
 * Remove ", Continued" suffix from text
 * @param {string} text - Text to process
 * @returns {string} Text without ", Continued" suffix
 */
const removeContinuedSuffix = (text) => {
  return text.replace(/, Continued$/i, '').trim()
}

/**
 * Extract numeric value from style attribute
 * @param {string} style - Style attribute string
 * @param {string} property - CSS property name (top or left)
 * @returns {number} Numeric value in pixels
 */
const extractStyleValue = (style, property) => {
  const regex = new RegExp(`${property}:\\s*([\\d.]+)(?:px)?`, 'i')
  const match = style.match(regex)
  return match ? parseFloat(match[1]) : 0
}

/**
 * Check if two top values are within tolerance (+1/-1)
 * @param {number} top1 - First top value
 * @param {number} top2 - Second top value
 * @returns {boolean} True if within tolerance
 */
const isWithinTolerance = (top1, top2) => {
  return Math.abs(top1 - top2) <= 1
}

/**
 * Sort elements by top then left position (with +1/-1 tolerance for top)
 * @param {Array} elements - Array of elements with top and left
 * @returns {Array} Sorted array
 */
const sortByPosition = (elements) => {
  return [...elements].sort((a, b) => {
    if (!isWithinTolerance(a.top, b.top)) {
      return a.top - b.top
    }
    return a.left - b.left
  })
}

/**
 * Group elements by their top position (with +1/-1 tolerance)
 * @param {Array} elements - Sorted array of elements
 * @returns {Map} Map of top position to array of elements
 */
const groupByTop = (elements) => {
  const groups = new Map()

  for (const element of elements) {
    const existingKey = findExistingGroupKey(groups, element.top)
    if (existingKey !== null) {
      groups.get(existingKey).push(element)
    } else {
      groups.set(element.top, [element])
    }
  }

  return groups
}

/**
 * Find existing group key within tolerance
 * @param {Map} groups - Existing groups
 * @param {number} top - Top value to match
 * @returns {number|null} Existing key or null
 */
const findExistingGroupKey = (groups, top) => {
  for (const key of groups.keys()) {
    if (isWithinTolerance(key, top)) {
      return key
    }
  }
  return null
}

/**
 * Check if a group should be ignored
 * @param {Array} texts - Array of text values in the group
 * @returns {boolean} True if the group should be ignored
 */
const shouldIgnoreGroup = (texts) => {
  if (texts.length === 0) return true

  const firstItem = texts[0]
  if (firstItem === 'TEST RESULTS' || firstItem === 'Analyte') return true
  if (firstItem.startsWith('Page ') || firstItem.startsWith('Rev ')) return true

  return false
}

/**
 * Check if a group contains metadata and extract it
 * Key mapping: "REPORTED TO" -> clientName, "WORK ORDER" -> labReportId
 * @param {Array} texts - Array of text values in the group
 * @returns {Object|null} Metadata object or null if not metadata
 */
const extractMetadata = (texts) => {
  if (texts.length !== 4) return null

  // Check for "REPORTED TO", "...", "WORK ORDER", "..." pattern
  if (texts[0] === 'REPORTED TO' && texts[2] === 'WORK ORDER') {
    return {
      clientName: texts[1],
      labReportId: texts[3],
    }
  }

  // Check for "PROJECT", "...", "REPORTED", "..." pattern
  if (texts[0] === 'PROJECT' && texts[2] === 'REPORTED') {
    return {
      project: texts[1],
      reported: texts[3],
    }
  }

  return null
}

/**
 * Check if text matches sample info format and extract it
 * Format: "{clientSampleId} ({labSampleId}) | Matrix: {matrix} | Sampled: {collectionDate} {collectionTime}"
 * Date can be in formats: YYYY-MM-DD, MM/DD/YYYY, or similar
 * ", Continued" may appear at the end and should be ignored
 * @param {string} text - Text to check
 * @returns {Object|null} Sample info object or null
 */
const extractSampleInfo = (text) => {
  // Normalize whitespace (including newlines) to single spaces and remove ", Continued" suffix
  const normalizedText = removeContinuedSuffix(text.replace(/\s+/g, ' ').trim())
  // Match format: "ClientId (LabId) | Matrix: MatrixType | Sampled: Date Time"
  const sampleInfoRegex = /^(.+?)\s*\(([^)]+)\)\s*\|\s*Matrix:\s*(.+?)\s*\|\s*Sampled:\s*([\d\-\/]+)\s+(\d{1,2}:\d{2})$/
  const match = normalizedText.match(sampleInfoRegex)

  if (match) {
    return {
      clientSampleId: match[1].trim(),
      labSampleId: match[2].trim(),
      matrix: match[3].trim(),
      collectionDate: match[4].trim(),
      collectionTime: match[5].trim(),
    }
  }
  return null
}

/**
 * Check if a group represents a category (single item that is not sample info)
 * Removes ", Continued" suffix from category names
 * @param {Array} texts - Array of text values in the group
 * @returns {string|null} Category name or null
 */
const extractCategory = (texts) => {
  if (texts.length === 1 && texts[0]) {
    // Remove ", Continued" suffix first
    const cleanedText = removeContinuedSuffix(texts[0])
    // Check if it's sample info
    if (extractSampleInfo(texts[0])) {
      return null
    }
    return cleanedText
  }
  return null
}

/**
 * Check if a group represents sample info (single item)
 * @param {Array} texts - Array of text values in the group
 * @returns {Object|null} Sample info object or null
 */
const extractSampleInfoFromGroup = (texts) => {
  if (texts.length === 1 && texts[0]) {
    return extractSampleInfo(texts[0])
  }
  return null
}

/**
 * Check if a group represents an analyte row and extract it
 * Expected format: Analyte, Result, RL, Units, Analyzed, Qualifier (optional)
 * @param {Array} texts - Array of text values in the group
 * @param {string} currentCategory - Current category
 * @param {Object|null} currentSampleInfo - Current sample info
 * @returns {Object|null} Analyte object or null
 */
const extractAnalyte = (texts, currentCategory, currentSampleInfo) => {
  if (texts.length !== 5 && texts.length !== 6) return null

  return {
    analyte: texts[0],
    result: texts[1],
    rl: texts[2],
    unit: texts[3],
    analyzed: texts[4],
    qualifier: texts[5] || '',
    category: currentCategory,
    sampleInfo: currentSampleInfo,
  }
}

/**
 * Sort analytes by sampleInfo.labSampleId, then category, then analyte name
 * @param {Array} analytes - Array of analyte objects
 * @returns {Array} Sorted array
 */
const sortAnalytes = (analytes) => {
  return [...analytes].sort((a, b) => {
    const labSampleIdA = a.sampleInfo?.labSampleId || ''
    const labSampleIdB = b.sampleInfo?.labSampleId || ''
    const labSampleIdCompare = labSampleIdA.localeCompare(labSampleIdB)
    if (labSampleIdCompare !== 0) return labSampleIdCompare
    const categoryCompare = (a.category || '').localeCompare(b.category || '')
    if (categoryCompare !== 0) return categoryCompare
    return (a.analyte || '').localeCompare(b.analyte || '')
  })
}

/**
 * Process groups and extract analytes and metadata
 * @param {Map} groups - Map of top position to elements
 * @param {Object} initialState - Initial state with currentCategory and currentSampleInfo
 * @returns {Object} Object with analytes array, metadata object, and final state
 */
const processGroups = (groups, initialState = {}) => {
  const analytes = []
  const metadata = {}
  let currentCategory = initialState.currentCategory || ''
  let currentSampleInfo = initialState.currentSampleInfo || null

  for (const [, elements] of groups) {
    const texts = elements.map((el) => el.text)

    if (shouldIgnoreGroup(texts)) {
      continue
    }

    const metadataResult = extractMetadata(texts)
    if (metadataResult) {
      Object.assign(metadata, metadataResult)
      continue
    }

    const sampleInfo = extractSampleInfoFromGroup(texts)
    if (sampleInfo) {
      currentSampleInfo = sampleInfo
      continue
    }

    const category = extractCategory(texts)
    if (category) {
      currentCategory = category
      continue
    }

    const analyte = extractAnalyte(texts, currentCategory, currentSampleInfo)
    if (analyte) {
      analytes.push(analyte)
    }
  }

  const sortedAnalytes = sortAnalytes(analytes)

  return {
    analytes: sortedAnalytes,
    metadata,
    state: { currentCategory, currentSampleInfo },
  }
}

/**
 * Parse all QC HTML files in a folder
 * @param {Object} inputs
 * @param {string} inputs.folder - Folder path containing HTML files
 * @param {Function} inputs.filterFn - Optional filter function to filter files
 * @returns {Object} Combined result with analytes list and merged metadata
 */
export const parseAllQcHtmls = async ({ folder, filterFn }) => {
  validateFolderInput(folder)

  const htmlFiles = await getHtmlFiles(folder)
  const filteredFiles = await filterHtmlFiles(htmlFiles, folder, filterFn)
  const results = await parseAllFiles(filteredFiles, folder)
  const combinedResult = combineResults(results)

  return combinedResult
}

/**
 * Validate folder input
 * @param {string} folder - Folder path
 */
const validateFolderInput = (folder) => {
  if (!folder) {
    throw new Error('Folder path is required')
  }
}

/**
 * Get all HTML files in a folder
 * @param {string} folder - Folder path
 * @returns {Array} Array of HTML file names
 */
const getHtmlFiles = async (folder) => {
  const files = await fs.readdir(folder)
  return files.filter((file) => file.toLowerCase().endsWith('.html'))
}

/**
 * Filter HTML files using the filter function
 * @param {Array} files - Array of file names
 * @param {string} folder - Folder path
 * @param {Function} filterFn - Filter function
 * @returns {Array} Filtered array of file names
 */
const filterHtmlFiles = async (files, folder, filterFn) => {
  if (!filterFn) return files

  const filteredFiles = []
  for (const file of files) {
    const filePath = path.join(folder, file)
    const content = await fs.readFile(filePath, 'utf-8')
    if (filterFn(content)) {
      filteredFiles.push(file)
    }
  }
  return filteredFiles
}

/**
 * Parse all HTML files and collect results, carrying over state between files
 * @param {Array} files - Array of file names
 * @param {string} folder - Folder path
 * @returns {Array} Array of parse results
 */
const parseAllFiles = async (files, folder) => {
  const results = []
  let state = {}

  for (const file of files) {
    const filePath = path.join(folder, file)
    const content = await fs.readFile(filePath, 'utf-8')
    const result = await parseQcHtmlWithState({ html: content, initialState: state })
    results.push({ analytes: result.analytes, metadata: result.metadata })
    state = result.state
  }
  return results
}

/**
 * Parse QC HTML content with initial state (for multi-file parsing)
 * @param {Object} inputs
 * @param {string} inputs.html - HTML content to parse
 * @param {Object} inputs.initialState - Initial state with currentCategory and currentSampleInfo
 * @returns {Object} Result with analytes list, metadata, and final state
 */
const parseQcHtmlWithState = async ({ html, initialState = {} }) => {
  validateHtmlInput(html)

  const pElements = extractPElements(html)
  const sortedElements = sortByPosition(pElements)
  const groups = groupByTop(sortedElements)
  const result = processGroups(groups, initialState)

  return result
}

/**
 * Combine results from multiple files
 * @param {Array} results - Array of parse results
 * @returns {Object} Combined result with sorted analytes and merged metadata
 */
const combineResults = (results) => {
  const allAnalytes = []
  const mergedMetadata = {}

  for (const result of results) {
    allAnalytes.push(...result.analytes)
    Object.assign(mergedMetadata, result.metadata)
  }

  const sortedAnalytes = sortAnalytes(allAnalytes)

  return { analytes: sortedAnalytes, metadata: mergedMetadata }
}

/**
 * Parse QC Excel file from the download folder
 * Waits for the file to appear (polls every 2 seconds for up to 60 seconds)
 * @param {Object} inputs
 * @param {string} inputs.labReportId - Lab report ID (required)
 * @param {number} inputs.maxWaitSeconds - Maximum seconds to wait for file (default: 60)
 * @param {number} inputs.pollIntervalSeconds - Seconds between polls (default: 2)
 * @returns {Object|null} Result with analytes list and metadata, or null if file not found after waiting
 */
export const parseQcExcel = async ({ labReportId, maxWaitSeconds = 60, pollIntervalSeconds = 2 }) => {
  validateLabReportIdInput(labReportId)

  const downloadFolder = getDownloadFolder()
  const excelFile = await waitForExcelFile(downloadFolder, labReportId, maxWaitSeconds, pollIntervalSeconds)

  if (!excelFile) {
    return null
  }

  const workbook = readExcelFile(excelFile)
  const worksheet = getFirstWorksheet(workbook)
  const { metadata, sampleInfos, analyteHeaderRow } =
    extractExcelMetadataAndSampleInfo(worksheet)
  const analytes = extractExcelAnalytes(worksheet, analyteHeaderRow, sampleInfos)
  const sortedAnalytes = sortAnalytes(analytes)

  return { analytes: sortedAnalytes, metadata }
}

/**
 * Wait for Excel file to appear in the download folder
 * @param {string} folder - Folder path
 * @param {string} labReportId - Lab report ID
 * @param {number} maxWaitSeconds - Maximum seconds to wait
 * @param {number} pollIntervalSeconds - Seconds between polls
 * @returns {string|null} Full path to the Excel file or null if not found
 */
const waitForExcelFile = async (folder, labReportId, maxWaitSeconds, pollIntervalSeconds) => {
  console.log(`[Parse QC Excel] Waiting for Excel file (max ${maxWaitSeconds}s, polling every ${pollIntervalSeconds}s)`)
  
  const startTime = Date.now()
  const maxWaitMs = maxWaitSeconds * 1000
  const pollIntervalMs = pollIntervalSeconds * 1000
  
  while (Date.now() - startTime < maxWaitMs) {
    const excelFile = await findExcelFileByLabReportId(folder, labReportId)
    if (excelFile) {
      return excelFile
    }
    
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Parse QC Excel] File not found yet, waited ${elapsedSeconds}s...`)
    
    await sleep(pollIntervalMs)
  }
  
  console.log(`[Parse QC Excel] Timed out waiting for Excel file after ${maxWaitSeconds}s`)
  return null
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Validate lab report ID input
 * @param {string} labReportId - Lab report ID
 */
const validateLabReportIdInput = (labReportId) => {
  if (!labReportId) {
    throw new Error('Lab report ID is required')
  }
}

/**
 * Get the download folder path based on OS
 * @returns {string} Download folder path
 */
const getDownloadFolder = () => {
  return path.join(os.homedir(), 'Downloads')
}

/**
 * Find Excel file by lab report ID with freshness check
 * File name format: "{lab report id} summary archive{...}.xlsx" (the ... part can be empty or anything)
 * Returns null if file not found or older than 1 minute
 * @param {string} folder - Folder path
 * @param {string} labReportId - Lab report ID
 * @returns {string|null} Full path to the Excel file or null
 */
const findExcelFileByLabReportId = async (folder, labReportId) => {
  console.log(`[Parse QC Excel] Searching for Excel file in folder: ${folder}`)
  console.log(`[Parse QC Excel] Lab Report ID: ${labReportId}`)
  
  const matchingFile = await findMatchingExcelFile(folder, labReportId)
  if (!matchingFile) {
    console.log(`[Parse QC Excel] No matching Excel file found`)
    return null
  }

  console.log(`[Parse QC Excel] Found matching file: ${matchingFile}`)
  const filePath = path.join(folder, matchingFile)
  const isFileFresh = await checkFileFreshness(filePath, 60)
  if (!isFileFresh) {
    console.log(`[Parse QC Excel] File is older than 1 minute, skipping`)
    return null
  }

  console.log(`[Parse QC Excel] File is fresh, using: ${filePath}`)
  return filePath
}

/**
 * Find Excel file matching the pattern "{lab report id} summary archive{...}.xlsx"
 * @param {string} folder - Folder path
 * @param {string} labReportId - Lab report ID
 * @returns {string|null} Matching file name or null
 */
const findMatchingExcelFile = async (folder, labReportId) => {
  const files = await fs.readdir(folder)
  const pattern = new RegExp(`^${escapeRegExp(labReportId)} summary archive.*\\.xlsx$`, 'i')

  const matchingFiles = files.filter((file) => pattern.test(file))
  if (matchingFiles.length === 0) {
    return null
  }

  // If multiple matches, return the most recently modified one
  if (matchingFiles.length === 1) {
    return matchingFiles[0]
  }

  const fileStats = await Promise.all(
    matchingFiles.map(async (file) => {
      const filePath = path.join(folder, file)
      const stats = await fs.stat(filePath)
      return { file, mtime: stats.mtime }
    }),
  )

  fileStats.sort((a, b) => b.mtime - a.mtime)
  return fileStats[0].file
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeRegExp = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to file
 * @returns {boolean} True if file exists
 */
const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a file is fresh (modified within the specified seconds)
 * @param {string} filePath - Path to file
 * @param {number} maxAgeSeconds - Maximum age in seconds
 * @returns {boolean} True if file is fresh
 */
const checkFileFreshness = async (filePath, maxAgeSeconds) => {
  const stats = await fs.stat(filePath)
  const now = Date.now()
  const fileAge = (now - stats.mtime.getTime()) / 1000
  return fileAge <= maxAgeSeconds
}

/**
 * Check if a file is an Excel file
 * @param {string} filename - File name
 * @returns {boolean} True if Excel file
 */
const isExcelFile = (filename) => {
  const ext = filename.toLowerCase()
  return ext.endsWith('.xlsx') || ext.endsWith('.xls')
}

/**
 * Read an Excel file
 * @param {string} filePath - Path to Excel file
 * @returns {Object} XLSX workbook object
 */
const readExcelFile = (filePath) => {
  const buffer = fsSync.readFileSync(filePath)
  return XLSX.read(buffer, { type: 'buffer' })
}

/**
 * Get the first worksheet from a workbook
 * @param {Object} workbook - XLSX workbook object
 * @returns {Object} First worksheet
 */
const getFirstWorksheet = (workbook) => {
  const sheetName = workbook.SheetNames[0]
  return workbook.Sheets[sheetName]
}

/**
 * Get cell value from worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} row - Row number (1-based)
 * @param {number} col - Column number (1-based)
 * @returns {string|number|null} Cell value or null
 */
const getCellValue = (worksheet, row, col) => {
  const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })
  const cell = worksheet[cellAddress]
  return cell ? cell.v : null
}

/**
 * Check if a row is empty
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} row - Row number (1-based)
 * @param {number} maxCol - Maximum column to check
 * @returns {boolean} True if row is empty
 */
const isRowEmpty = (worksheet, row, maxCol) => {
  for (let col = 1; col <= maxCol; col++) {
    const value = getCellValue(worksheet, row, col)
    if (value !== null && value !== '') {
      return false
    }
  }
  return true
}

/**
 * Find the first empty row in the worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @returns {number} Row number of first empty row
 */
const findFirstEmptyRow = (worksheet) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const maxCol = range.e.c + 1

  for (let row = 1; row <= range.e.r + 1; row++) {
    if (isRowEmpty(worksheet, row, maxCol)) {
      return row
    }
  }
  return range.e.r + 2
}

/**
 * Find the analyte header row (Analyte, Unit, Analytical Method)
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} startRow - Row to start searching from
 * @returns {number} Row number of analyte header
 */
const findAnalyteHeaderRow = (worksheet, startRow) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')

  for (let row = startRow; row <= range.e.r + 1; row++) {
    const colA = getCellValue(worksheet, row, 1)
    const colB = getCellValue(worksheet, row, 2)
    const colC = getCellValue(worksheet, row, 3)

    if (colA === 'Analyte' && colB === 'Unit' && colC === 'Analytical Method') {
      return row
    }
  }
  throw new Error('Analyte header row not found')
}

/**
 * Key mapping for Excel metadata
 * "Client Name: " -> clientName, "Lab Name: " -> labName, "Lab Report ID: " -> labReportId, "Lab Report Name: " -> labReportName
 */
const EXCEL_METADATA_KEY_MAP = {
  'Client Name: ': 'clientName',
  'Lab Name: ': 'labName',
  'Lab Report ID: ': 'labReportId',
  'Lab Report Name: ': 'labReportName',
}

/**
 * Key mapping for Excel sample info
 * "Client Sample ID" -> clientSampleId, "Lab Sample ID" -> labSampleId, Matrix -> matrix, "Sampling Location Code" -> samplingLocationCode, "Date Sampled" -> collectionDate, "Time Sampled (24h)" -> collectionTime
 */
const EXCEL_SAMPLE_INFO_KEY_MAP = {
  'Client Sample ID': 'clientSampleId',
  'Lab Sample ID': 'labSampleId',
  Matrix: 'matrix',
  'Sampling Location Code': 'samplingLocationCode',
  'Date Sampled': 'collectionDate',
  'Time Sampled (24h)': 'collectionTime',
}

/**
 * Map a key using the provided key map
 * @param {string} key - Original key
 * @param {Object} keyMap - Key mapping object
 * @returns {string} Mapped key or original key if not in map
 */
const mapKey = (key, keyMap) => {
  return keyMap[key] || key
}

/**
 * Extract metadata from rows before the first empty row
 * Key mapping: "Client Name: " -> clientName, "Lab Name: " -> labName, "Lab Report ID: " -> labReportId, "Lab Report Name: " -> labReportName
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} firstEmptyRow - First empty row number
 * @returns {Object} Metadata object
 */
const extractExcelMetadataFromRows = (worksheet, firstEmptyRow) => {
  const metadata = {}

  for (let row = 1; row < firstEmptyRow; row++) {
    const key = getCellValue(worksheet, row, 1)
    const value = getCellValue(worksheet, row, 2)

    if (key && value !== null) {
      const mappedKey = mapKey(key, EXCEL_METADATA_KEY_MAP)
      metadata[mappedKey] = value
    }
  }

  return metadata
}

/**
 * Extract sample info from columns starting from D, before the analyte header row
 * Key mapping: "Client Sample ID" -> clientSampleId, "Lab Sample ID" -> labSampleId, Matrix -> matrix, "Sampling Location Code" -> samplingLocationCode, "Date Sampled" -> collectionDate, "Time Sampled (24h)" -> collectionTime
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} analyteHeaderRow - Analyte header row number
 * @returns {Array} Array of sample info objects with column index
 */
const extractExcelSampleInfoFromCols = (worksheet, analyteHeaderRow) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const sampleInfos = []

  for (let col = 4; col <= range.e.c + 1; col++) {
    const sampleInfo = {}
    let hasData = false

    for (let row = 1; row < analyteHeaderRow; row++) {
      const key = getCellValue(worksheet, row, 1)
      const value = getCellValue(worksheet, row, col)

      if (key && value !== null) {
        const mappedKey = mapKey(key, EXCEL_SAMPLE_INFO_KEY_MAP)
        sampleInfo[mappedKey] = value
        hasData = true
      }
    }

    if (hasData) {
      sampleInfos.push({ col, sampleInfo })
    }
  }

  return sampleInfos
}

/**
 * Extract metadata and sample info from Excel worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @returns {Object} Object with metadata, sampleInfos, and analyteHeaderRow
 */
const extractExcelMetadataAndSampleInfo = (worksheet) => {
  const firstEmptyRow = findFirstEmptyRow(worksheet)
  const metadata = extractExcelMetadataFromRows(worksheet, firstEmptyRow)
  const analyteHeaderRow = findAnalyteHeaderRow(worksheet, firstEmptyRow)
  const sampleInfos = extractExcelSampleInfoFromCols(worksheet, analyteHeaderRow)

  return { metadata, sampleInfos, analyteHeaderRow }
}

/**
 * Extract analytes from Excel worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} analyteHeaderRow - Analyte header row number
 * @param {Array} sampleInfos - Array of sample info objects with column index
 * @returns {Array} Array of analyte objects
 */
const extractExcelAnalytes = (worksheet, analyteHeaderRow, sampleInfos) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const analytes = []
  let currentCategory = ''

  for (let row = analyteHeaderRow + 1; row <= range.e.r + 1; row++) {
    const rowData = extractExcelRowData(worksheet, row, sampleInfos)

    if (rowData.isEmpty) {
      continue
    }

    if (rowData.isLabResults) {
      continue
    }

    if (rowData.isCategoryRow) {
      currentCategory = rowData.category
      continue
    }

    const rowAnalytes = createAnalytesFromRow(
      rowData,
      currentCategory,
      sampleInfos,
    )
    analytes.push(...rowAnalytes)
  }

  return analytes
}

/**
 * Extract row data from Excel worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} row - Row number
 * @param {Array} sampleInfos - Array of sample info objects with column index
 * @returns {Object} Row data object
 */
const extractExcelRowData = (worksheet, row, sampleInfos) => {
  const colA = getCellValue(worksheet, row, 1)
  const colB = getCellValue(worksheet, row, 2)

  const isEmpty = colA === null || colA === ''
  const isLabResults = colA === 'Lab Results'

  const hasOnlyFirstCell =
    colA !== null &&
    colA !== '' &&
    (colB === null || colB === '') &&
    !hasResultValues(worksheet, row, sampleInfos)

  const results = {}
  for (const { col, sampleInfo } of sampleInfos) {
    const value = getCellValue(worksheet, row, col)
    results[col] = value
  }

  return {
    isEmpty,
    isLabResults,
    isCategoryRow: hasOnlyFirstCell,
    category: hasOnlyFirstCell ? colA : null,
    analyte: colA,
    unit: colB,
    results,
  }
}

/**
 * Check if row has result values in sample columns
 * @param {Object} worksheet - XLSX worksheet
 * @param {number} row - Row number
 * @param {Array} sampleInfos - Array of sample info objects with column index
 * @returns {boolean} True if has result values
 */
const hasResultValues = (worksheet, row, sampleInfos) => {
  for (const { col } of sampleInfos) {
    const value = getCellValue(worksheet, row, col)
    if (value !== null && value !== '') {
      return true
    }
  }
  return false
}

/**
 * Create analyte objects from row data
 * @param {Object} rowData - Row data object
 * @param {string} currentCategory - Current category
 * @param {Array} sampleInfos - Array of sample info objects with column index
 * @returns {Array} Array of analyte objects
 */
const createAnalytesFromRow = (rowData, currentCategory, sampleInfos) => {
  const analytes = []

  for (const { col, sampleInfo } of sampleInfos) {
    const result = rowData.results[col]

    if (result !== null && result !== '') {
      analytes.push({
        analyte: rowData.analyte,
        unit: rowData.unit,
        result,
        category: currentCategory,
        sampleInfo,
      })
    }
  }

  return analytes
}

/**
 * Perform QC check by comparing two analyte lists
 * @param {Object} inputs
 * @param {Array} inputs.analyteList1 - First analyte list
 * @param {Array} inputs.analyteList2 - Second analyte list
 * @returns {Object} Comparison result with differences
 */
export const qcCheck = async ({ analyteList1, analyteList2 }) => {
  validateQcCheckInputs(analyteList1, analyteList2)

  const differences = compareAnalyteLists(analyteList1, analyteList2)

  return { differences, hasDifferences: differences.length > 0 }
}

/**
 * Validate QC check inputs
 * @param {Array} analyteList1 - First analyte list
 * @param {Array} analyteList2 - Second analyte list
 */
const validateQcCheckInputs = (analyteList1, analyteList2) => {
  if (!analyteList1) {
    throw new Error('Analyte list 1 is required')
  }
  if (!analyteList2) {
    throw new Error('Analyte list 2 is required')
  }
  if (!Array.isArray(analyteList1)) {
    throw new Error('Analyte list 1 must be an array')
  }
  if (!Array.isArray(analyteList2)) {
    throw new Error('Analyte list 2 must be an array')
  }
}

/**
 * Fields to ignore during comparison
 */
const IGNORED_FIELDS = ['rl', 'analyzed', 'qualifier', 'sampleInfo.samplingLocationCode']

/**
 * Check if a field should be ignored
 * @param {string} fieldPath - Field path (e.g., 'sampleInfo.samplingLocationCode')
 * @returns {boolean} True if field should be ignored
 */
const shouldIgnoreField = (fieldPath) => {
  return IGNORED_FIELDS.includes(fieldPath)
}

/**
 * Check if analyte should be ignored (e.g., surrogates)
 * @param {string} analyteName - Analyte name
 * @returns {boolean} True if analyte should be ignored
 */
const shouldIgnoreAnalyte = (analyteName) => {
  if (typeof analyteName !== 'string') return false
  return analyteName.toLowerCase().startsWith('surrogate:')
}

/**
 * Normalize analyte name for comparison
 * Rules:
 * - Case insensitive
 * - "... + ..." = "...+..." (normalize spaces around +)
 * - "... & ..." = "... and ..." (normalize & to and)
 * - "{analyte}, {type}" = "{analyte} ({type})" where type is dissolved/total
 * - "{analyte}, {type} as ..." = "{analyte} ({type})" (remove "as ..." suffix)
 * - "{analyte}, {type} (as ...)" = "{analyte} ({type})" (remove "(as ...)" suffix)
 * - "{analyte} ({type}, as ...)" = "{analyte} ({type})" (remove ", as ..." in parens)
 * - "{analyte} ({type}, by ...)" = "{analyte} ({type})" (remove ", by ..." in parens)
 * - "{type} {analyte}" = "{analyte} ({type})" (reorder type prefix)
 * @param {string} analyteName - Analyte name
 * @returns {string} Normalized analyte name (lowercase)
 */
const normalizeAnalyteName = (analyteName) => {
  if (typeof analyteName !== 'string') return String(analyteName).toLowerCase()
  
  let name = analyteName.toLowerCase().trim()
  
  // Normalize spaces around + symbol: "... + ..." = "...+..."
  name = name.replace(/\s*\+\s*/g, '+')
  
  // Normalize & to and: "... & ..." = "... and ..."
  name = name.replace(/\s*&\s*/g, ' and ')
  
  // Normalize conductivity: "conductivity (ec)" = "conductivity"
  if (name === 'conductivity (ec)') {
    return 'conductivity'
  }
  
  // Normalize MTBE: "methyl tert-butyl ether (mtbe)" = "methyl tert-butyl ether"
  if (name === 'methyl tert-butyl ether (mtbe)') {
    return 'methyl tert-butyl ether'
  }
  
  // Handle "{type} {analyte}" format (type as prefix)
  const prefixMatch = name.match(/^(dissolved|total)\s+(.+)$/i)
  if (prefixMatch) {
    return `${prefixMatch[2].trim()} (${prefixMatch[1].toLowerCase()})`
  }
  
  // Handle "{analyte}, {type} as ..." or "{analyte}, {type} (as ...)" format
  const commaAsMatch = name.match(/^(.+),\s*(dissolved|total)(?:\s+as\s+.+|\s*\(as\s+[^)]+\))?$/i)
  if (commaAsMatch) {
    return `${commaAsMatch[1].trim()} (${commaAsMatch[2].toLowerCase()})`
  }
  
  // Handle "{analyte} ({type})" or "{analyte} ({type}, as ...)" or "{analyte} ({type}, by ...)" format
  const parenMatch = name.match(/^(.+)\s*\((dissolved|total)(?:,\s*(?:as|by)\s+[^)]+)?\)$/i)
  if (parenMatch) {
    return `${parenMatch[1].trim()} (${parenMatch[2].toLowerCase()})`
  }
  
  // Handle simple "{analyte}, {type}" format
  const simpleCommaMatch = name.match(/^(.+),\s*(dissolved|total)$/i)
  if (simpleCommaMatch) {
    return `${simpleCommaMatch[1].trim()} (${simpleCommaMatch[2].toLowerCase()})`
  }
  
  return name
}

/**
 * Normalize unit value: "µg/L" = "μg/L" (normalize micro symbol)
 * @param {string} unit - Unit string
 * @returns {string} Normalized unit
 */
const normalizeUnitValue = (unit) => {
  if (typeof unit !== 'string') return String(unit)
  // Normalize different micro symbols (µ U+00B5 and μ U+03BC)
  return unit.replace(/\u00B5/g, '\u03BC')
}

/**
 * Create a unique key for an analyte based on labSampleId, category, and normalized analyte name
 * Uses normalized analyte name to match different formats like "{analyte}, {type}" and "{analyte} ({type})"
 * @param {Object} analyte - Analyte object
 * @returns {string} Unique key
 */
const createAnalyteKey = (analyte) => {
  const labSampleId = analyte.sampleInfo?.labSampleId || ''
  const category = analyte.category || ''
  const analyteName = normalizeAnalyteName(analyte.analyte || '')
  return `${labSampleId}|${category}|${analyteName}`
}

/**
 * Build a map of analytes by their unique key
 * Filters out analytes that should be ignored (e.g., surrogates)
 * @param {Array} analytes - Array of analyte objects
 * @returns {Map} Map of key to analyte
 */
const buildAnalyteMap = (analytes) => {
  const map = new Map()
  for (const analyte of analytes) {
    // Skip surrogates and other ignored analytes
    if (shouldIgnoreAnalyte(analyte.analyte)) {
      continue
    }
    const key = createAnalyteKey(analyte)
    map.set(key, analyte)
  }
  return map
}

/**
 * Normalize result value: "< {value}" = "<{value}"
 * @param {string} value - Result value
 * @returns {string} Normalized value
 */
const normalizeResultValue = (value) => {
  if (typeof value !== 'string') return String(value)
  // Remove space after < symbol
  return value.replace(/^<\s+/, '<')
}

/**
 * Month name to number mapping for date parsing
 */
const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Parse date from various formats to a normalized string
 * Supports: "yyyy-MM-dd", "dd-MMM-yy"
 * @param {string} dateStr - Date string
 * @returns {string} Normalized date string (yyyy-MM-dd)
 */
const normalizeDateValue = (dateStr) => {
  if (typeof dateStr !== 'string') return String(dateStr)
  
  // Try yyyy-MM-dd format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return dateStr
  }
  
  // Try dd-MMM-yy format (e.g., "15-Jan-26")
  const dMyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (dMyMatch) {
    const day = dMyMatch[1].padStart(2, '0')
    const monthName = dMyMatch[2].toLowerCase()
    const year = dMyMatch[3]
    const month = MONTH_MAP[monthName]
    if (month !== undefined) {
      // Assume 20xx for 2-digit years
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`
      return `${fullYear}-${String(month + 1).padStart(2, '0')}-${day}`
    }
  }
  
  return dateStr
}

/**
 * Normalize time value: ignore timezone like "MDT"
 * @param {string} timeStr - Time string
 * @returns {string} Normalized time string (HH:mm)
 */
const normalizeTimeValue = (timeStr) => {
  if (typeof timeStr !== 'string') return String(timeStr)
  // Remove timezone suffix (e.g., " MDT", " PST")
  return timeStr.replace(/\s+[A-Z]{2,4}$/, '').trim()
}

/**
 * Normalize value based on field path
 * @param {*} value - Value to normalize
 * @param {string} fieldPath - Field path
 * @returns {*} Normalized value
 */
const normalizeValueForComparison = (value, fieldPath) => {
  if (value === null || value === undefined) return value
  
  if (fieldPath === 'result') {
    return normalizeResultValue(value)
  }
  if (fieldPath === 'sampleInfo.collectionDate' || fieldPath === 'collectionDate') {
    return normalizeDateValue(value)
  }
  if (fieldPath === 'sampleInfo.collectionTime' || fieldPath === 'collectionTime') {
    return normalizeTimeValue(value)
  }
  if (fieldPath === 'analyte') {
    return normalizeAnalyteName(value)
  }
  if (fieldPath === 'unit') {
    return normalizeUnitValue(value)
  }
  
  return value
}

/**
 * Check if unit comparison should be skipped for a given analyte
 * @param {string} analyteName - Analyte name
 * @returns {boolean} True if unit comparison should be skipped
 */
const shouldSkipUnitComparisonForAnalyte = (analyteName) => {
  if (typeof analyteName !== 'string') return false
  return analyteName.toLowerCase().trim() === 'ph'
}

/**
 * Compare two values, handling nested objects
 * @param {*} value1 - First value
 * @param {*} value2 - Second value
 * @param {string} fieldPath - Current field path
 * @param {Object} context - Optional context with analyte info
 * @returns {Array} Array of differences
 */
const compareValues = (value1, value2, fieldPath, context = {}) => {
  if (shouldIgnoreField(fieldPath)) {
    return []
  }

  // Skip unit comparison for pH analyte
  if (fieldPath === 'unit' && shouldSkipUnitComparisonForAnalyte(context.analyteName)) {
    return []
  }

  const differences = []

  if (value1 === null || value1 === undefined) {
    if (value2 !== null && value2 !== undefined) {
      differences.push({
        type: 'missing_in_list1',
        field: fieldPath,
        value2,
      })
    }
    return differences
  }

  if (value2 === null || value2 === undefined) {
    differences.push({
      type: 'missing_in_list2',
      field: fieldPath,
      value1,
    })
    return differences
  }

  if (typeof value1 === 'object' && typeof value2 === 'object') {
    return compareObjects(value1, value2, fieldPath, context)
  }

  // Normalize values before comparison
  const normalizedValue1 = normalizeValueForComparison(value1, fieldPath)
  const normalizedValue2 = normalizeValueForComparison(value2, fieldPath)

  if (String(normalizedValue1) !== String(normalizedValue2)) {
    differences.push({
      type: 'mismatch',
      field: fieldPath,
      value1,
      value2,
    })
  }

  return differences
}

/**
 * Compare two objects recursively
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @param {string} parentPath - Parent field path
 * @param {Object} context - Optional context with analyte info
 * @returns {Array} Array of differences
 */
const compareObjects = (obj1, obj2, parentPath = '', context = {}) => {
  const differences = []
  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})])

  for (const key of allKeys) {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key
    const diffs = compareValues(obj1?.[key], obj2?.[key], fieldPath, context)
    differences.push(...diffs)
  }

  return differences
}

/**
 * Compare two analyte objects
 * @param {Object} analyte1 - First analyte
 * @param {Object} analyte2 - Second analyte
 * @param {string} key - Analyte key for identification
 * @returns {Object|null} Difference object or null if no differences
 */
const compareAnalytes = (analyte1, analyte2, key) => {
  const analyteName = analyte1?.analyte || analyte2?.analyte
  const context = { analyteName }
  const fieldDifferences = compareObjects(analyte1, analyte2, '', context)

  if (fieldDifferences.length > 0) {
    return {
      key,
      analyte: analyteName,
      labSampleId: analyte1?.sampleInfo?.labSampleId || analyte2?.sampleInfo?.labSampleId,
      category: analyte1?.category || analyte2?.category,
      differences: fieldDifferences,
    }
  }

  return null
}

/**
 * Cross-list equivalence rules
 * These are special cases where an analyte in list 1 should match a different analyte name in list 2
 * Format: { list1Name, list2Name, category } - all in lowercase
 */
const CROSS_LIST_EQUIVALENCES = [
  {
    list1Name: 'phosphorus, total (as p)',
    list2Name: 'phosphorus (total, apha 4500-p)',
    category: 'calculated parameters',
  },
]

/**
 * Find cross-list equivalent key for an analyte from list 1 in list 2
 * @param {Object} analyte - Analyte from list 1
 * @param {Map} map2 - Map of list 2 analytes
 * @returns {string|null} The equivalent key in list 2, or null if no equivalence
 */
const findCrossListEquivalentKey = (analyte, map2) => {
  const analyteName = (analyte.analyte || '').toLowerCase().trim()
  const category = (analyte.category || '').toLowerCase().trim()
  const labSampleId = analyte.sampleInfo?.labSampleId || ''

  for (const rule of CROSS_LIST_EQUIVALENCES) {
    if (analyteName === rule.list1Name && category === rule.category) {
      // Build the key for the equivalent analyte in list 2
      const equivalentKey = `${labSampleId}|${analyte.category}|${normalizeAnalyteName(rule.list2Name)}`
      if (map2.has(equivalentKey)) {
        return equivalentKey
      }
    }
  }
  return null
}

/**
 * Find cross-list equivalent key for an analyte from list 2 in list 1
 * @param {Object} analyte - Analyte from list 2
 * @param {Map} map1 - Map of list 1 analytes
 * @returns {string|null} The equivalent key in list 1, or null if no equivalence
 */
const findReverseCrossListEquivalentKey = (analyte, map1) => {
  const analyteName = (analyte.analyte || '').toLowerCase().trim()
  const category = (analyte.category || '').toLowerCase().trim()
  const labSampleId = analyte.sampleInfo?.labSampleId || ''

  for (const rule of CROSS_LIST_EQUIVALENCES) {
    if (analyteName === rule.list2Name && category === rule.category) {
      // Build the key for the equivalent analyte in list 1
      const equivalentKey = `${labSampleId}|${analyte.category}|${normalizeAnalyteName(rule.list1Name)}`
      if (map1.has(equivalentKey)) {
        return equivalentKey
      }
    }
  }
  return null
}

/**
 * Compare two analyte lists and find all differences
 * @param {Array} list1 - First analyte list
 * @param {Array} list2 - Second analyte list
 * @returns {Array} Array of difference objects
 */
const compareAnalyteLists = (list1, list2) => {
  const map1 = buildAnalyteMap(list1)
  const map2 = buildAnalyteMap(list2)
  const allKeys = new Set([...map1.keys(), ...map2.keys()])
  const differences = []
  const processedCrossListPairs = new Set()

  for (const key of allKeys) {
    const analyte1 = map1.get(key)
    const analyte2 = map2.get(key)

    if (!analyte1) {
      // Check if this analyte in list 2 has a cross-list equivalent in list 1
      const equivalentKey = findReverseCrossListEquivalentKey(analyte2, map1)
      if (equivalentKey && !processedCrossListPairs.has(`${equivalentKey}|${key}`)) {
        // This will be handled when we process the equivalent key from list 1
        processedCrossListPairs.add(`${equivalentKey}|${key}`)
        continue
      }
      differences.push({
        key,
        type: 'missing_in_list1',
        analyte: analyte2.analyte,
        labSampleId: analyte2.sampleInfo?.labSampleId,
        category: analyte2.category,
      })
      continue
    }

    if (!analyte2) {
      // Check if this analyte in list 1 has a cross-list equivalent in list 2
      const equivalentKey = findCrossListEquivalentKey(analyte1, map2)
      if (equivalentKey) {
        // Found a cross-list equivalent, compare them instead
        const equivalentAnalyte2 = map2.get(equivalentKey)
        processedCrossListPairs.add(`${key}|${equivalentKey}`)
        const diff = compareAnalytes(analyte1, equivalentAnalyte2, key)
        if (diff) {
          differences.push(diff)
        }
        continue
      }
      differences.push({
        key,
        type: 'missing_in_list2',
        analyte: analyte1.analyte,
        labSampleId: analyte1.sampleInfo?.labSampleId,
        category: analyte1.category,
      })
      continue
    }

    const diff = compareAnalytes(analyte1, analyte2, key)
    if (diff) {
      differences.push(diff)
    }
  }

  return differences
}

/**
 * Generate report by logging into WirelessWater and navigating to the lab report
 * @param {Object} inputs
 * @param {string} inputs.labReportId - Lab report ID (required)
 * @returns {Object} Result with success status, labReportId, and reportPath
 */
export const generateReport = async ({ labReportId }) => {
  validateLabReportIdInput(labReportId)

  const connectionId = await loginToWirelessWater()
  await navigateToLabArchive(connectionId)
  await searchForLabReport(connectionId, labReportId)
  await openLabReportSummary(connectionId)
  const reportPath = await waitForDownloadToComplete(connectionId, labReportId)
  await closeBrowser(connectionId)

  return { success: true, labReportId, reportPath }
}

/**
 * Wait for the download to complete and return the downloaded file path
 * @param {string} connectionId - Browser connection ID
 * @param {string} labReportId - Lab report ID to find the downloaded file
 * @returns {string|null} Path to the downloaded report file
 */
const waitForDownloadToComplete = async (connectionId, labReportId) => {
  const result = await waitForDownload({
    connectionId,
    timeoutSeconds: 60,
  })
  
  // Find the downloaded Excel file in the Downloads folder
  const downloadFolder = getDownloadFolder()
  const reportPath = await findExcelFileByLabReportId(downloadFolder, labReportId)
  
  return reportPath
}

/**
 * Close the browser
 * @param {string} connectionId - Browser connection ID
 */
const closeBrowser = async (connectionId) => {
  await closeBrowserWindow({ connectionId })
}

/**
 * Login to WirelessWater website
 * @returns {string} Browser connection ID
 */
const loginToWirelessWater = async () => {
  const { connectionId } = await openBrowserWindow({
    browserType: 'chrome',
    url: 'https://wirelesswater.com/Account/LogOn?ReturnUrl=%2fmain',
  })

  await enterText({
    connectionId,
    selector: '#username',
    text: 'WW_LAB',
  })

  await enterText({
    connectionId,
    selector: '#password',
    text: 'WW_LAB_PASSWORD',
  })

  await clickElement({
    connectionId,
    selector: 'button.filter',
  })

  await wait({ seconds: 3 })

  return connectionId
}

/**
 * Navigate to lab archive page
 * @param {string} connectionId - Browser connection ID
 */
const navigateToLabArchive = async (connectionId) => {
  await navigate({
    connectionId,
    url: 'https://wirelesswater.com/labarchive',
  })
}

/**
 * Search for a lab report by ID
 * @param {string} connectionId - Browser connection ID
 * @param {string} labReportId - Lab report ID
 */
const searchForLabReport = async (connectionId, labReportId) => {
  await enterText({
    connectionId,
    selector: '#txtSearch1',
    text: labReportId,
  })

  await clickElement({
    connectionId,
    selector: 'a[title="Search"]',
  })

  await wait({ seconds: 3 })
}

/**
 * Open the lab report summary view
 * @param {string} connectionId - Browser connection ID
 */
const openLabReportSummary = async (connectionId) => {
  await clickElement({
    connectionId,
    selector: 'a[href^="/LabArchive/SummaryView/"]',
  })
}

