import puppeteer from 'puppeteer-core'

// Store active browser connections
const browserConnections = new Map()

/**
 * Wait for a specified number of seconds
 * @param {Object} inputs
 * @param {number} inputs.seconds - Number of seconds to wait
 * @returns {Object} Result with success status
 */
export const wait = async ({ seconds }) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  return { success: true, message: `Waited ${seconds} seconds` }
}

/**
 * Navigate to a URL in the current browser window
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.url - URL to navigate to
 * @returns {Object} Result with success status
 */
export const navigate = async ({ connectionId, url }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    await page.goto(url, { waitUntil: 'networkidle2' })
    
    const pageTitle = await page.title()
    
    return {
      success: true,
      message: `Navigated to ${url}`,
      title: pageTitle,
      url: page.url()
    }
  } catch (error) {
    console.error('Error navigating:', error.message)
    throw error
  }
}

/**
 * Find an existing browser window by type and title
 * @param {Object} inputs
 * @param {string} inputs.browserType - Browser type (chrome, firefox, any)
 * @param {string} inputs.title - Substring of the window title (case insensitive)
 * @returns {Object|null} Browser instance info or null if not found
 */
export const findBrowserWindow = async ({ browserType = 'any', title }) => {
  try {
    // Default Chrome debugging port
    const debuggingPort = process.env.CHROME_DEBUGGING_PORT || 9222
    const browserWSEndpoint = `http://127.0.0.1:${debuggingPort}`

    // Connect to existing browser instance
    const browser = await puppeteer.connect({
      browserURL: browserWSEndpoint,
      defaultViewport: null,
    })

    const pages = await browser.pages()

    for (const page of pages) {
      const pageTitle = await page.title()
      
      // Check if title matches (case insensitive substring match)
      if (title && pageTitle.toLowerCase().includes(title.toLowerCase())) {
        // Generate a unique ID for this connection
        const connectionId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Store the browser and page reference
        browserConnections.set(connectionId, { browser, page })

        return {
          connectionId,
          title: pageTitle,
          url: page.url(),
          browserType: 'chrome', // Currently only Chrome supported via CDP
        }
      }
    }

    // No matching page found, disconnect
    browser.disconnect()
    return null
  } catch (error) {
    console.error('Error finding browser window:', error.message)
    return null
  }
}

/**
 * Open a new browser window and navigate to URL
 * @param {Object} inputs
 * @param {string} inputs.browserType - Browser type (chrome, firefox, any)
 * @param {string} inputs.url - URL to navigate to
 * @returns {Object} Browser instance info
 */
export const openBrowserWindow = async ({ browserType = 'chrome', url }) => {
  try {
    // Get Chrome executable path based on OS
    const executablePath = process.env.CHROME_PATH || getDefaultChromePath()

    // Launch new browser instance
    const browser = await puppeteer.launch({
      executablePath,
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized'],
    })

    // Create new page and navigate to URL
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    // Generate a unique ID for this connection
    const connectionId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store the browser and page reference
    browserConnections.set(connectionId, { browser, page, owned: true })

    const pageTitle = await page.title()

    return {
      connectionId,
      title: pageTitle,
      url: page.url(),
      browserType,
    }
  } catch (error) {
    console.error('Error opening browser window:', error.message)
    throw error
  }
}

/**
 * Get default Chrome executable path based on OS
 */
const getDefaultChromePath = () => {
  const platform = process.platform
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  } else {
    return '/usr/bin/google-chrome'
  }
}

/**
 * Close a browser window
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @returns {Object} Result with success status
 */
export const closeBrowserWindow = async ({ connectionId }) => {
  const connection = browserConnections.get(connectionId)
  if (connection) {
    // If we own the browser (launched it), close it; otherwise just disconnect
    if (connection.owned) {
      await connection.browser.close()
    } else {
      connection.browser.disconnect()
    }
    browserConnections.delete(connectionId)
    return { success: true, message: 'Browser window closed' }
  }
  return { success: false, message: 'Connection not found' }
}

/**
 * Find element(s) on a page
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID from findBrowserWindow
 * @param {string} inputs.selector - CSS query selector
 * @returns {Object} Result with found status and count
 */
export const findElements = async ({ connectionId, selector }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection

    // Find all elements matching the selector
    const elements = await page.$$(selector)

    return {
      found: elements.length > 0,
      count: elements.length,
      selector,
    }
  } catch (error) {
    console.error('Error finding elements:', error.message)
    throw error
  }
}

/**
 * Wait for element(s) to appear on a page
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID from findBrowserWindow
 * @param {string} inputs.selector - CSS query selector
 * @param {number} inputs.timeoutSeconds - Maximum seconds to wait (default: 30)
 * @param {number} inputs.pollIntervalSeconds - Seconds between polls (default: 1)
 * @returns {Object} Result with found status and count
 */
export const waitForElement = async ({
  connectionId,
  selector,
  timeoutSeconds = 30,
  pollIntervalSeconds = 1,
}) => {
  const connection = browserConnections.get(connectionId)
  if (!connection) {
    throw new Error(`No active browser connection found for ID: ${connectionId}`)
  }

  const { page } = connection
  return pollForElement(page, selector, timeoutSeconds, pollIntervalSeconds)
}

/**
 * Get attribute(s) from element(s)
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @param {string|string[]} inputs.attributes - Attribute(s) to extract (comma-separated string or array)
 * @returns {Object|Object[]|null} Element attributes or array of element attributes
 */
export const getAttribute = async ({ connectionId, selector, attributes }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection

    // Ensure attributes is an array (handle comma-separated string)
    const attrList = Array.isArray(attributes)
      ? attributes
      : typeof attributes === 'string'
        ? attributes.split(',').map((s) => s.trim())
        : [attributes]

    // Find all elements matching the selector
    const elements = await page.$$(selector)

    if (elements.length === 0) {
      return null
    }

    // Extract attributes from each element
    const results = await Promise.all(
      elements.map(async (element) => {
        const result = {}
        for (const attr of attrList) {
          if (attr === 'text' || attr === 'textContent') {
            result[attr] = await element.evaluate((el) => el.textContent?.trim())
          } else if (attr === 'innerHTML') {
            result[attr] = await element.evaluate((el) => el.innerHTML)
          } else if (attr === 'outerHTML') {
            result[attr] = await element.evaluate((el) => el.outerHTML)
          } else {
            result[attr] = await element.evaluate((el, a) => el.getAttribute(a), attr)
          }
        }
        return result
      })
    )

    // Return single object if only one element found, otherwise return array
    return results.length === 1 ? results[0] : results
  } catch (error) {
    console.error('Error getting attribute:', error.message)
    throw error
  }
}

/**
 * Set attribute on element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @param {string} inputs.name - Attribute name
 * @param {string} inputs.value - Attribute value
 * @returns {Object} Result with success status
 */
export const setAttribute = async ({ connectionId, selector, name, value }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    await element.evaluate((el, attrName, attrValue) => {
      el.setAttribute(attrName, attrValue)
    }, name, value)

    return { success: true, message: `Attribute ${name} set to ${value}` }
  } catch (error) {
    console.error('Error setting attribute:', error.message)
    throw error
  }
}

/**
 * Enter text into an input element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @param {string} inputs.text - Text to enter (or env var name)
 * @returns {Object} Result with success status
 */
export const enterText = async ({ connectionId, selector, text }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    // Check if element is input or textarea
    const tagName = await element.evaluate((el) => el.tagName.toLowerCase())
    if (tagName !== 'input' && tagName !== 'textarea') {
      return { success: false, message: 'Element is not an input box or text area' }
    }

    // Resolve text from environment variable if it exists
    const resolvedText = process.env[text] || text

    await element.type(resolvedText)
    return { success: true, message: 'Text entered successfully' }
  } catch (error) {
    console.error('Error entering text:', error.message)
    throw error
  }
}

/**
 * Click on an element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @returns {Object} Result with success status
 */
export const clickElement = async ({ connectionId, selector }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    await element.click()
    return { success: true, message: 'Element clicked successfully' }
  } catch (error) {
    console.error('Error clicking element:', error.message)
    throw error
  }
}

/**
 * Check a checkbox element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @returns {Object} Result with success status
 */
export const checkElement = async ({ connectionId, selector }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    // Check if element is a checkbox
    const isCheckbox = await element.evaluate((el) => el.type === 'checkbox')
    if (!isCheckbox) {
      return { success: false, message: 'Element is not a checkbox' }
    }

    const isChecked = await element.evaluate((el) => el.checked)
    if (!isChecked) {
      await element.click()
    }

    return { success: true, message: 'Checkbox checked' }
  } catch (error) {
    console.error('Error checking element:', error.message)
    throw error
  }
}

/**
 * Uncheck a checkbox element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @returns {Object} Result with success status
 */
export const uncheckElement = async ({ connectionId, selector }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    // Check if element is a checkbox
    const isCheckbox = await element.evaluate((el) => el.type === 'checkbox')
    if (!isCheckbox) {
      return { success: false, message: 'Element is not a checkbox' }
    }

    const isChecked = await element.evaluate((el) => el.checked)
    if (isChecked) {
      await element.click()
    }

    return { success: true, message: 'Checkbox unchecked' }
  } catch (error) {
    console.error('Error unchecking element:', error.message)
    throw error
  }
}

/**
 * Toggle a checkbox element
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @returns {Object} Result with success status and new state
 */
export const toggleElement = async ({ connectionId, selector }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    // Check if element is a checkbox
    const isCheckbox = await element.evaluate((el) => el.type === 'checkbox')
    if (!isCheckbox) {
      return { success: false, message: 'Element is not a checkbox' }
    }

    await element.click()
    const newState = await element.evaluate((el) => el.checked)

    return { success: true, message: 'Checkbox toggled', checked: newState }
  } catch (error) {
    console.error('Error toggling element:', error.message)
    throw error
  }
}

/**
 * Select option in a radio button group
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector for radio group
 * @param {string} inputs.value - Value or text to select
 * @returns {Object} Result with success status
 */
export const selectOption = async ({ connectionId, selector, value }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const elements = await page.$$(selector)

    if (elements.length === 0) {
      return { success: false, message: 'No elements found' }
    }

    // Find radio button with matching value or label
    for (const element of elements) {
      const isRadio = await element.evaluate((el) => el.type === 'radio')
      if (!isRadio) continue

      const elementValue = await element.evaluate((el) => el.value)
      const labelText = await element.evaluate((el) => {
        const label = el.labels?.[0]
        return label ? label.textContent?.trim() : ''
      })

      if (elementValue === value || labelText === value) {
        await element.click()
        return { success: true, message: `Selected option: ${value}` }
      }
    }

    return { success: false, message: `Option with value "${value}" not found` }
  } catch (error) {
    console.error('Error selecting option:', error.message)
    throw error
  }
}

/**
 * Select option from dropdown
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector for select element
 * @param {string} inputs.value - Value or text to select
 * @returns {Object} Result with success status
 */
export const selectFromDropdown = async ({ connectionId, selector, value }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection
    const element = await page.$(selector)

    if (!element) {
      return { success: false, message: 'Element not found' }
    }

    // Check if element is a select
    const tagName = await element.evaluate((el) => el.tagName.toLowerCase())
    if (tagName !== 'select') {
      return { success: false, message: 'Element is not a select/dropdown' }
    }

    // Try to select by value first, then by text
    try {
      await page.select(selector, value)
      return { success: true, message: `Selected: ${value}` }
    } catch {
      // If value selection fails, try selecting by visible text
      const selected = await element.evaluate((el, val) => {
        const options = Array.from(el.options)
        const option = options.find((opt) => opt.text === val)
        if (option) {
          el.value = option.value
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
        return false
      }, value)

      if (selected) {
        return { success: true, message: `Selected: ${value}` }
      }
      return { success: false, message: `Option "${value}" not found in dropdown` }
    }
  } catch (error) {
    console.error('Error selecting from dropdown:', error.message)
    throw error
  }
}

/**
 * Wait for a download to complete by monitoring the download folder for new .xlsx files
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID (optional, for future use)
 * @param {string} inputs.downloadPath - Path to monitor for downloads (defaults to user's Downloads folder)
 * @param {number} inputs.timeoutSeconds - Maximum seconds to wait (default: 60)
 * @param {number} inputs.pollIntervalSeconds - Seconds between polls (default: 2)
 * @returns {Object} Result with success status and downloaded file path
 */
export const waitForDownload = async ({ connectionId, downloadPath, timeoutSeconds = 60, pollIntervalSeconds = 2 }) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Get default download path if not specified
    const downloadDir = downloadPath || getDefaultDownloadPath()
    
    console.log(`[waitForDownload] Monitoring folder: ${downloadDir}`)
    console.log(`[waitForDownload] Timeout: ${timeoutSeconds}s, Poll interval: ${pollIntervalSeconds}s`)
    
    // Get initial list of files in download folder
    const initialFiles = await getExcelFilesInFolder(fs, downloadDir)
    const initialFileSet = new Set(initialFiles.map(f => f.name))
    
    console.log(`[waitForDownload] Initial Excel files: ${initialFiles.length}`)
    
    const startTime = Date.now()
    const timeoutMs = timeoutSeconds * 1000
    const pollIntervalMs = pollIntervalSeconds * 1000
    
    while (Date.now() - startTime < timeoutMs) {
      await sleep(pollIntervalMs)
      
      // Check for new files or files that are still being written (.crdownload, .tmp)
      const currentFiles = await getExcelFilesInFolder(fs, downloadDir)
      
      // Find new files that weren't in the initial set
      const newFiles = currentFiles.filter(f => !initialFileSet.has(f.name))
      
      if (newFiles.length > 0) {
        // Check if the file is complete (not a partial download)
        const completedFile = newFiles.find(f =>
          !f.name.endsWith('.crdownload') &&
          !f.name.endsWith('.tmp') &&
          f.name.endsWith('.xlsx')
        )
        
        if (completedFile) {
          const filePath = path.default.join(downloadDir, completedFile.name)
          console.log(`[waitForDownload] Download completed: ${filePath}`)
          return { success: true, message: 'Download completed', filePath }
        }
        
        console.log(`[waitForDownload] Download in progress...`)
      }
      
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
      console.log(`[waitForDownload] Waiting... ${elapsedSeconds}s elapsed`)
    }
    
    throw new Error(`Download timed out after ${timeoutSeconds} seconds`)
  } catch (error) {
    console.error('Error waiting for download:', error.message)
    throw error
  }
}

/**
 * Get list of Excel files in a folder with their stats
 * @param {Object} fs - fs/promises module
 * @param {string} folder - Folder path
 * @returns {Array} Array of file objects with name and mtime
 */
const getExcelFilesInFolder = async (fs, folder) => {
  try {
    const files = await fs.readdir(folder)
    const excelFiles = files.filter(f =>
      f.toLowerCase().endsWith('.xlsx') ||
      f.toLowerCase().endsWith('.xls') ||
      f.toLowerCase().endsWith('.crdownload') ||
      f.toLowerCase().endsWith('.tmp')
    )
    
    const fileStats = await Promise.all(
      excelFiles.map(async (name) => {
        try {
          const stats = await fs.stat(`${folder}/${name}`)
          return { name, mtime: stats.mtime }
        } catch {
          return null
        }
      })
    )
    
    return fileStats.filter(f => f !== null)
  } catch {
    return []
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Poll for element(s) on a page, stopping early if the page finishes loading
 * without the element being found.
 * @param {import('puppeteer-core').Page} page - Puppeteer page
 * @param {string} selector - CSS query selector
 * @param {number} timeoutSeconds - Maximum seconds to wait
 * @param {number} pollIntervalSeconds - Seconds between polls (default: 1)
 * @returns {Object} Result with found status and count
 */
const pollForElement = async (page, selector, timeoutSeconds, pollIntervalSeconds = 1) => {
  const startTime = Date.now()
  const timeoutMs = timeoutSeconds * 1000
  const pollIntervalMs = pollIntervalSeconds * 1000

  let pageLoadFired = false
  const onLoad = () => { pageLoadFired = true }
  page.on('load', onLoad)

  try {
    while (Date.now() - startTime < timeoutMs) {
      const elements = await page.$$(selector)

      if (elements.length > 0) {
        return { found: true, count: elements.length, selector }
      }

      if (pageLoadFired) {
        return {
          found: false,
          count: 0,
          selector,
          error: 'Element not found after page finished loading',
        }
      }

      await sleep(pollIntervalMs)
    }

    return {
      found: false,
      count: 0,
      selector,
      error: `Element not found after ${timeoutSeconds} seconds`,
    }
  } finally {
    page.off('load', onLoad)
  }
}

/**
 * Parse a mapping object (or JS object literal string) into an array of mapping row objects
 * Each value is in the format "{sub selector}@{attr}"
 * If @{attr} is omitted, defaults to 'text'
 * @param {Object|string} mapping - JS object literal or its string representation
 * @returns {Array<{name: string, subSelector: string, attr: string}>}
 */
const parseMapping = (mapping) => {
  const obj = typeof mapping === 'string' ? parseObjectLiteral(mapping) : mapping
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([key, value]) => parseMappingValue(key, value))
}

/**
 * Parse a JS object literal string into an object
 * Supports both JSON and JS object literal syntax
 * @param {string} str - JS object literal string
 * @returns {Object}
 */
const parseObjectLiteral = (str) => {
  if (!str || !str.trim()) return {}
  try {
    return JSON.parse(str)
  } catch {
    return new Function('return ' + str)()
  }
}

/**
 * Parse a single mapping value string into a structured object
 * @param {string} key - The property name for the output object
 * @param {string} value - Value in format "{sub selector}@{attr}"
 * @returns {{name: string, subSelector: string, attr: string}}
 */
const parseMappingValue = (key, value) => {
  const atIndex = value.lastIndexOf('@')
  if (atIndex === -1) {
    return { name: key, subSelector: value, attr: 'text' }
  }
  const subSelector = value.substring(0, atIndex).trim()
  const attr = value.substring(atIndex + 1).trim() || 'text'
  return { name: key, subSelector, attr }
}

/**
 * Get an attribute value from a Puppeteer element handle
 * @param {import('puppeteer-core').ElementHandle} element - Element handle
 * @param {string} attr - Attribute name ('text', 'innerHTML', 'outerHTML', or any HTML attribute)
 * @returns {Promise<string|null>} Attribute value
 */
const getElementAttrValue = async (element, attr) => {
  if (attr === 'text' || attr === 'textContent') {
    return element.evaluate((el) => el.textContent?.trim())
  }
  if (attr === 'innerHTML') {
    return element.evaluate((el) => el.innerHTML)
  }
  if (attr === 'outerHTML') {
    return element.evaluate((el) => el.outerHTML)
  }
  return element.evaluate((el, a) => el.getAttribute(a), attr)
}

/**
 * Extract data from a list of elements using a mapping definition
 * Opens a browser window, extracts data, and closes the browser
 * @param {Object} inputs
 * @param {string} inputs.url - URL to open
 * @param {string} inputs.listSelector - CSS selector for the list elements
 * @param {Object|string} inputs.mapping - JS object literal (or string), values in format "{sub selector}@{attr}"
 * @param {number} inputs.timeoutSeconds - Maximum seconds to wait for list elements (default: 30)
 * @returns {Object} Result with extracted data array or error
 */
export const extractByMapping = async ({
  url,
  listSelector,
  mapping,
  timeoutSeconds = 30,
}) => {
  validateExtractByMappingInput(url, listSelector, mapping)

  const browserWindow = await openBrowserWindow({ browserType: 'chrome', url })
  try {
    return await extractFromPage(browserWindow.connectionId, listSelector, mapping, timeoutSeconds)
  } finally {
    await closeBrowserWindow({ connectionId: browserWindow.connectionId })
  }
}

/**
 * Extract data from the current page using a mapping definition
 */
const extractFromPage = async (connectionId, listSelector, mapping, timeoutSeconds) => {
  const connection = browserConnections.get(connectionId)
  if (!connection) {
    throw new Error(`No active browser connection found for ID: ${connectionId}`)
  }

  const { page } = connection
  const mappingRows = parseMapping(mapping)

  const waitResult = await waitForListElements(page, listSelector, timeoutSeconds)
  if (!waitResult.found) {
    return { found: false, error: waitResult.error, data: null }
  }

  const listElements = await page.$$(listSelector)
  const data = await extractDataFromElements(listElements, mappingRows)

  return { found: true, data }
}

/**
 * Validate extractByMapping inputs
 */
const validateExtractByMappingInput = (url, listSelector, mapping) => {
  if (!url) throw new Error('url is required')
  if (!listSelector) throw new Error('listSelector is required')
  if (!mapping) throw new Error('mapping is required')
}

/**
 * Wait for list elements to appear on the page
 * @param {import('puppeteer-core').Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeoutSeconds - Timeout in seconds
 * @returns {Object} Result with found status
 */
const waitForListElements = (page, selector, timeoutSeconds) =>
  pollForElement(page, selector, timeoutSeconds)

/**
 * Extract data from a list of elements using mapping rows
 * @param {import('puppeteer-core').ElementHandle[]} elements - List of element handles
 * @param {Array<{name: string, subSelector: string, attr: string}>} mappingRows - Parsed mapping rows
 * @returns {Promise<Object[]>} Array of extracted data objects
 */
const extractDataFromElements = async (elements, mappingRows) => {
  const data = []
  for (const element of elements) {
    const obj = await extractSingleElement(element, mappingRows)
    data.push(obj)
  }
  return data
}

/**
 * Extract data from a single element using mapping rows
 * @param {import('puppeteer-core').ElementHandle} element - Element handle
 * @param {Array<{name: string, subSelector: string, attr: string}>} mappingRows - Parsed mapping rows
 * @returns {Promise<Object>} Extracted data object
 */
const extractSingleElement = async (element, mappingRows) => {
  const obj = {}
  for (const { name, subSelector, attr } of mappingRows) {
    const subElement = await element.$(subSelector)
    if (subElement) {
      obj[name] = await getElementAttrValue(subElement, attr)
    }
  }
  return obj
}

/**
 * Get default download path based on OS
 */
const getDefaultDownloadPath = () => {
  const platform = process.platform
  const homeDir = process.env.HOME || process.env.USERPROFILE
  if (platform === 'win32') {
    return `${homeDir}\\Downloads`
  }
  return `${homeDir}/Downloads`
}