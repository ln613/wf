import Imap from 'imap'
import { simpleParser } from 'mailparser'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Store active watchers
const activeWatchers = new Map()

/**
 * Start watching an email account for new emails
 * @param {string} taskId - Unique task identifier
 * @param {Object} config - Configuration with emailAccount and pollingInterval
 * @param {EventEmitter} eventEmitter - Event emitter to emit events
 */
export const watchEmail = (taskId, config, eventEmitter) => {
  validateWatchEmailConfig(config)
  
  const credentials = getGmailAppPasswordCredentials(config.emailAccount)
  const pollingInterval = (config.pollingInterval || 60) * 1000 // Convert to ms
  
  console.log(`[WatchEmail] Starting watcher for ${credentials.email} with ${pollingInterval / 1000}s interval`)
  
  // Track the last seen email UID
  let lastSeenUid = null
  let isFirstCheck = true
  
  const checkForNewEmails = async () => {
    try {
      const result = await fetchLatestEmailInfo(credentials)
      
      if (result && result.uid) {
        if (isFirstCheck) {
          // On first check, just record the current UID without emitting
          lastSeenUid = result.uid
          isFirstCheck = false
          console.log(`[WatchEmail] Initial UID recorded: ${lastSeenUid}`)
        } else if (lastSeenUid !== result.uid) {
          // New email detected
          console.log(`[WatchEmail] New email detected! UID: ${result.uid}`)
          lastSeenUid = result.uid
          
          // Emit the newEmail event
          eventEmitter.emit('newEmail', {
            taskId,
            emailAccount: config.emailAccount,
            email: result.email,
          })
        }
      }
    } catch (error) {
      console.error(`[WatchEmail] Error checking emails:`, error.message)
    }
  }
  
  // Initial check
  checkForNewEmails()
  
  // Set up polling interval
  const intervalId = setInterval(checkForNewEmails, pollingInterval)
  
  // Store the watcher info
  activeWatchers.set(taskId, {
    intervalId,
    credentials,
    config,
  })
}

/**
 * Stop watching an email account
 * @param {string} taskId - Task ID to stop
 */
export const stopWatchEmail = (taskId) => {
  const watcher = activeWatchers.get(taskId)
  if (watcher) {
    clearInterval(watcher.intervalId)
    activeWatchers.delete(taskId)
    console.log(`[WatchEmail] Stopped watcher: ${taskId}`)
  }
}

/**
 * Stop all email watchers
 */
export const stopAllWatchers = () => {
  for (const [taskId, watcher] of activeWatchers) {
    clearInterval(watcher.intervalId)
    console.log(`[WatchEmail] Stopped watcher: ${taskId}`)
  }
  activeWatchers.clear()
}

const validateWatchEmailConfig = (config) => {
  if (!config.emailAccount) {
    throw new Error('Email account environment variable name is required')
  }
}

/**
 * Get Gmail credentials for app password authentication
 * @param {string} accountEnvVar - Environment variable prefix
 * @returns {Object} Credentials with email and appPassword
 */
const getGmailAppPasswordCredentials = (accountEnvVar) => {
  const email = process.env[accountEnvVar]
  const appPassword = process.env[`${accountEnvVar}_APP_PASSWORD`]

  if (!email) throw new Error(`Email not found for ${accountEnvVar}`)
  if (!appPassword) throw new Error(`App password not found for ${accountEnvVar}_APP_PASSWORD`)

  return { email, appPassword }
}

/**
 * Fetch the latest email info including UID
 * @param {Object} credentials - Gmail credentials
 * @returns {Object} Email info with uid and email data
 */
const fetchLatestEmailInfo = async (credentials) => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: credentials.email,
      password: credentials.appPassword,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    imap.once('ready', () => {
      openInboxAndFetchLatestWithUid(imap, resolve, reject)
    })

    imap.once('error', (err) => {
      console.error('[WatchEmail] IMAP error:', err.message)
      reject(err)
    })

    imap.connect()
  })
}

/**
 * Open inbox and fetch the latest email with UID
 * @param {Object} imap - IMAP connection
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
const openInboxAndFetchLatestWithUid = (imap, resolve, reject) => {
  imap.openBox('INBOX', true, (err, box) => {
    if (err) {
      imap.end()
      return reject(err)
    }

    if (box.messages.total === 0) {
      imap.end()
      return resolve(null)
    }

    // Fetch the latest message
    const fetchRange = `${box.messages.total}:${box.messages.total}`
    const fetch = imap.seq.fetch(fetchRange, {
      bodies: '',
      struct: true,
    })

    let emailUid = null

    fetch.on('message', (msg, seqno) => {
      let buffer = ''

      msg.on('attributes', (attrs) => {
        emailUid = attrs.uid
      })

      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
        })
      })

      msg.once('end', async () => {
        try {
          const parsed = await simpleParser(buffer)
          
          // Save attachments to temp folder
          const attachments = await saveAttachments(parsed.attachments || [])
          
          const email = {
            sender: parsed.from?.text || null,
            date: parsed.date?.toISOString() || null,
            subject: parsed.subject || null,
            body: parsed.text || parsed.html || null,
            attachments,
          }

          imap.end()
          resolve({ uid: emailUid, email })
        } catch (parseErr) {
          imap.end()
          reject(parseErr)
        }
      })
    })

    fetch.once('error', (err) => {
      imap.end()
      reject(err)
    })
  })
}

/**
 * Save attachments to a temp folder
 * @param {Array} attachments - Array of attachment objects from mailparser
 * @returns {Array} Array of saved attachment info with paths
 */
const saveAttachments = async (attachments) => {
  if (!attachments || attachments.length === 0) {
    return []
  }

  // Create temp folder for attachments
  const tempDir = path.join(os.tmpdir(), 'email-attachments', Date.now().toString())
  await fs.mkdir(tempDir, { recursive: true })

  const savedAttachments = []

  for (const attachment of attachments) {
    const filename = attachment.filename || `attachment_${savedAttachments.length + 1}`
    const filePath = path.join(tempDir, filename)
    
    // Write attachment content to file
    await fs.writeFile(filePath, attachment.content)
    
    savedAttachments.push({
      filename,
      path: filePath,
      contentType: attachment.contentType || 'application/octet-stream',
      size: attachment.size || attachment.content.length,
    })
  }

  return savedAttachments
}
