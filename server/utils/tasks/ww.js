import { JSDOM } from 'jsdom'

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
 * @param {Array} texts - Array of text values in the group
 * @returns {Object|null} Metadata object or null if not metadata
 */
const extractMetadata = (texts) => {
  if (texts.length !== 4) return null

  // Check for "REPORTED TO", "...", "WORK ORDER", "..." pattern
  if (texts[0] === 'REPORTED TO' && texts[2] === 'WORK ORDER') {
    return {
      reportedTo: texts[1],
      workOrder: texts[3],
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
 * Check if a group represents a category (single item)
 * @param {Array} texts - Array of text values in the group
 * @returns {string|null} Category name or null
 */
const extractCategory = (texts) => {
  if (texts.length === 1 && texts[0]) {
    return texts[0]
  }
  return null
}

/**
 * Check if a group represents an analyte row and extract it
 * Expected format: Analyte, Result, RL, Units, Analyzed, Qualifier (optional)
 * @param {Array} texts - Array of text values in the group
 * @param {string} currentCategory - Current category
 * @returns {Object|null} Analyte object or null
 */
const extractAnalyte = (texts, currentCategory) => {
  if (texts.length !== 5 && texts.length !== 6) return null

  return {
    analyte: texts[0],
    result: texts[1],
    rl: texts[2],
    units: texts[3],
    analyzed: texts[4],
    qualifier: texts[5] || '',
    category: currentCategory,
  }
}

/**
 * Process groups and extract analytes and metadata
 * @param {Map} groups - Map of top position to elements
 * @returns {Object} Object with analytes array and metadata object
 */
const processGroups = (groups) => {
  const analytes = []
  const metadata = {}
  let currentCategory = ''

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

    const category = extractCategory(texts)
    if (category) {
      currentCategory = category
      continue
    }

    const analyte = extractAnalyte(texts, currentCategory)
    if (analyte) {
      analytes.push(analyte)
    }
  }

  return { analytes, metadata }
}
