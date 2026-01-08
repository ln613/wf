import { JSDOM } from 'jsdom'

/**
 * Parse QC HTML content and extract <p> elements sorted by position
 * @param {Object} inputs
 * @param {string} inputs.html - HTML content to parse
 * @returns {Object} Result with groups of text values
 */
export const parseQcHtml = async ({ html }) => {
  validateHtmlInput(html)

  const pElements = extractPElements(html)
  const sortedElements = sortByPosition(pElements)
  const groups = groupByTop(sortedElements)
  const result = formatGroups(groups)

  return { groups: result }
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
    const text = p.textContent?.trim() || ''

    return { top, left, text }
  })
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
 * Format groups into array of joined text strings
 * @param {Map} groups - Map of top position to elements
 * @returns {Array} Array of joined text strings
 */
const formatGroups = (groups) => {
  const result = []

  for (const [, elements] of groups) {
    const joinedText = elements.map((el) => el.text).join('|')
    result.push(joinedText)
  }

  return result
}
