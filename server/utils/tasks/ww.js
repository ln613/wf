import { JSDOM } from 'jsdom'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import os from 'os'

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
 * @returns {Object} Result with analytes list and metadata
 */
export const parseQcExcel = async () => {
  const downloadFolder = getDownloadFolder()
  const excelFile = await findLatestExcelFile(downloadFolder)
  const workbook = readExcelFile(excelFile)
  const worksheet = getFirstWorksheet(workbook)
  const { metadata, sampleInfos, analyteHeaderRow } =
    extractExcelMetadataAndSampleInfo(worksheet)
  const analytes = extractExcelAnalytes(worksheet, analyteHeaderRow, sampleInfos)
  const sortedAnalytes = sortAnalytes(analytes)

  return { analytes: sortedAnalytes, metadata }
}

/**
 * Get the download folder path based on OS
 * @returns {string} Download folder path
 */
const getDownloadFolder = () => {
  return path.join(os.homedir(), 'Downloads')
}

/**
 * Find the latest Excel file in a folder
 * @param {string} folder - Folder path
 * @returns {string} Full path to the latest Excel file
 */
const findLatestExcelFile = async (folder) => {
  const files = await fs.readdir(folder)
  const excelFiles = files.filter((file) => isExcelFile(file))

  if (excelFiles.length === 0) {
    throw new Error('No Excel files found in download folder')
  }

  const fileStats = await Promise.all(
    excelFiles.map(async (file) => {
      const filePath = path.join(folder, file)
      const stats = await fs.stat(filePath)
      return { file, mtime: stats.mtime }
    }),
  )

  fileStats.sort((a, b) => b.mtime - a.mtime)
  return path.join(folder, fileStats[0].file)
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

