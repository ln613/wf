import puppeteer from 'puppeteer-core'

// Store active browser connections
const browserConnections = new Map()

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
 * Find element(s) on a page and extract specified attributes
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID from findBrowserWindow
 * @param {string} inputs.selector - CSS query selector
 * @param {string|string[]} inputs.attributes - Attribute(s) to extract
 * @returns {Object|Object[]|null} Element attributes or array of element attributes
 */
export const findElements = async ({ connectionId, selector, attributes }) => {
  try {
    const connection = browserConnections.get(connectionId)
    if (!connection) {
      throw new Error(`No active browser connection found for ID: ${connectionId}`)
    }

    const { page } = connection

    // Ensure attributes is an array
    const attrList = Array.isArray(attributes) ? attributes : [attributes]

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
    console.error('Error finding elements:', error.message)
    throw error
  }
}

/**
 * Close a browser connection (cleanup)
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 */
export const closeBrowserConnection = async ({ connectionId }) => {
  const connection = browserConnections.get(connectionId)
  if (connection) {
    // If we own the browser (launched it), close it; otherwise just disconnect
    if (connection.owned) {
      await connection.browser.close()
    } else {
      connection.browser.disconnect()
    }
    browserConnections.delete(connectionId)
    return { success: true, message: 'Connection closed' }
  }
  return { success: false, message: 'Connection not found' }
}