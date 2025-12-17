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
 * Get attribute(s) from element(s)
 * @param {Object} inputs
 * @param {string} inputs.connectionId - Browser connection ID
 * @param {string} inputs.selector - CSS query selector
 * @param {string|string[]} inputs.attributes - Attribute(s) to extract
 * @returns {Object|Object[]|null} Element attributes or array of element attributes
 */
export const getAttribute = async ({ connectionId, selector, attributes }) => {
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