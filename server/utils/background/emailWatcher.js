import Imap from 'imap'
import { simpleParser } from 'mailparser'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Store active watchers
const activeWatchers = new Map()

/**
 * Start watching an email account for new emails
 * Records a baseline UID on the first check, then emits a 'newEmail' event for every
 * email whose UID is greater than the last seen UID (in ascending order)
 * @param {string} taskId - Unique task identifier
 * @param {Object} config - Configuration with emailAccount and pollingInterval
 * @param {EventEmitter} eventEmitter - Event emitter to emit events
 */
export const watchEmail = (taskId, config, eventEmitter) => {
  validateWatchEmailConfig(config)

  const credentials = getGmailAppPasswordCredentials(config.emailAccount)
  const pollingInterval = (config.pollingInterval || 60) * 1000 // Convert to ms

  console.log(`[WatchEmail] Starting watcher for ${credentials.email} with ${pollingInterval / 1000}s interval`)

  // Track the last seen email UID (null until the baseline is recorded)
  let lastSeenUid = null

  const checkForNewEmails = async () => {
    try {
      console.log('check for new email...')

      // First check: record the baseline UID. Normally this is the current latest UID
      // (nothing existing is replayed). If backfill is enabled via {ACCOUNT}_WATCH_BACKFILL=N,
      // the baseline is moved back N messages so the last N inbox emails are (re)processed.
      if (lastSeenUid === null) {
        const latestUid = await fetchLatestUid(credentials)
        if (latestUid === null) {
          console.log('[WatchEmail] Inbox is empty, will retry on next poll')
          return
        }

        const backfill = getBackfillCount(config.emailAccount)
        if (backfill > 0) {
          lastSeenUid = Math.max(0, latestUid - backfill)
          console.log(`[WatchEmail] Backfill enabled: baseline set to ${lastSeenUid} (latest ${latestUid}, back ${backfill})`)
          // Fall through to process the backfilled range immediately
        } else {
          lastSeenUid = latestUid
          console.log(`[WatchEmail] Initial UID recorded: ${lastSeenUid}`)
          return
        }
      }

      // Subsequent checks: fetch every email newer than the baseline, oldest first
      const newEmails = await fetchEmailsSinceUid(credentials, lastSeenUid)

      for (const { uid, email } of newEmails) {
        lastSeenUid = Math.max(lastSeenUid, uid)
        const { body, ...emailWithoutBody } = email
        console.log(`[WatchEmail] New email detected! UID: ${uid}`)
        console.log({ uid, email: emailWithoutBody })

        await emitAndWait(eventEmitter, 'newEmail', {
          taskId,
          emailAccount: config.emailAccount,
          email,
        })
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
 * Get the backfill count for an account from {ACCOUNT}_WATCH_BACKFILL (0 = disabled, default)
 * When > 0, the watcher moves its startup baseline back this many messages so recent
 * inbox emails are (re)processed on startup (useful for testing)
 * @param {string} accountEnvVar - Environment variable prefix (e.g., 'GMAIL_1')
 * @returns {number} Backfill count (0 if unset or invalid)
 */
const getBackfillCount = (accountEnvVar) => {
  const n = parseInt(process.env[`${accountEnvVar}_WATCH_BACKFILL`], 10)
  return Number.isFinite(n) && n > 0 ? n : 0
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
 * Emit an event and await all (possibly async) listeners sequentially
 * Ensures composite-trigger conditions arriving in the same poll are processed in order
 * (e.g., the first condition's pending trigger is saved before the second is checked)
 * @param {EventEmitter} eventEmitter - Event emitter
 * @param {string} eventName - Event name
 * @param {Object} payload - Event payload
 */
const emitAndWait = async (eventEmitter, eventName, payload) => {
  for (const listener of eventEmitter.listeners(eventName)) {
    try {
      await listener(payload)
    } catch (error) {
      console.error(`[WatchEmail] Listener error for '${eventName}':`, error.message)
    }
  }
}

/**
 * Run a fetch worker within a managed IMAP connection (handles connect, timeout, cleanup)
 * @param {Object} credentials - Gmail credentials
 * @param {Function} worker - (imap, resolve, reject) => void, invoked once the connection is ready
 * @returns {Promise<*>} Whatever the worker resolves with
 */
const runWithImap = (credentials, worker) => {
  return new Promise((resolve, reject) => {
    const CONNECTION_TIMEOUT = 30000 // 30 seconds timeout
    let timeoutId = null
    let isResolved = false

    const settle = (fn, value) => {
      if (isResolved) return
      isResolved = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      fn(value)
    }

    const imap = new Imap({
      user: credentials.email,
      password: credentials.appPassword,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: 'imap.gmail.com',
      },
      connTimeout: CONNECTION_TIMEOUT,
      authTimeout: CONNECTION_TIMEOUT,
    })

    timeoutId = setTimeout(() => {
      console.error('[WatchEmail] IMAP connection timeout after 30s')
      try {
        imap.end()
      } catch (e) {
        // Ignore cleanup errors
      }
      settle(reject, new Error('IMAP connection timeout'))
    }, CONNECTION_TIMEOUT)

    imap.once('ready', () => {
      if (isResolved) return
      console.log('[WatchEmail] IMAP connection ready')
      worker(
        imap,
        (value) => settle(resolve, value),
        (err) => settle(reject, err),
      )
    })

    imap.once('error', (err) => {
      console.error('[WatchEmail] IMAP error:', err.message)
      try {
        imap.end()
      } catch (e) {
        // Ignore cleanup errors
      }
      settle(reject, err)
    })

    imap.once('end', () => {
      console.log('[WatchEmail] IMAP connection ended')
    })

    imap.once('close', (hadError) => {
      console.log(`[WatchEmail] IMAP connection closed${hadError ? ' with error' : ''}`)
      settle(reject, new Error('IMAP connection closed unexpectedly'))
    })

    imap.on('alert', (message) => {
      console.warn('[WatchEmail] IMAP alert:', message)
    })

    console.log('[WatchEmail] Attempting IMAP connection...')
    imap.connect()
  })
}

/**
 * Fetch the UID of the latest email in the inbox (used to record the baseline)
 * @param {Object} credentials - Gmail credentials
 * @returns {Promise<number|null>} Latest UID or null if the inbox is empty
 */
const fetchLatestUid = (credentials) => {
  return runWithImap(credentials, (imap, resolve, reject) => {
    imap.openBox('INBOX', true, (err, box) => {
      if (err) {
        imap.end()
        return reject(err)
      }

      if (box.messages.total === 0) {
        imap.end()
        return resolve(null)
      }

      const fetch = imap.seq.fetch(`${box.messages.total}:${box.messages.total}`, {
        bodies: '',
        struct: true,
      })

      let uid = null

      fetch.on('message', (msg) => {
        msg.on('attributes', (attrs) => {
          uid = attrs.uid
        })
      })

      fetch.once('error', (fetchErr) => {
        imap.end()
        reject(fetchErr)
      })

      fetch.once('end', () => {
        imap.end()
        resolve(uid)
      })
    })
  })
}

/**
 * Fetch all emails with a UID greater than sinceUid, parsed and sorted ascending by UID
 * @param {Object} credentials - Gmail credentials
 * @param {number} sinceUid - Only emails with UID greater than this are returned
 * @returns {Promise<Array>} Array of { uid, email } sorted ascending by UID
 */
const fetchEmailsSinceUid = (credentials, sinceUid) => {
  return runWithImap(credentials, (imap, resolve, reject) => {
    imap.openBox('INBOX', true, (err, box) => {
      if (err) {
        imap.end()
        return reject(err)
      }

      if (box.messages.total === 0) {
        imap.end()
        return resolve([])
      }

      // UID fetch of the open-ended range. Note: IMAP's "N:*" always returns at least the
      // highest-UID message even when its UID < N, so results are filtered by uid > sinceUid.
      const fetch = imap.fetch(`${sinceUid + 1}:*`, {
        bodies: '',
        struct: true,
      })

      const pending = []

      fetch.on('message', (msg) => {
        pending.push(parseFetchedMessage(msg))
      })

      fetch.once('error', (fetchErr) => {
        imap.end()
        reject(fetchErr)
      })

      fetch.once('end', async () => {
        const parsed = await Promise.all(pending)
        imap.end()
        const newEmails = parsed
          .filter((item) => item && item.uid > sinceUid)
          .sort((a, b) => a.uid - b.uid)
        resolve(newEmails)
      })
    })
  })
}

/**
 * Parse a single fetched IMAP message into { uid, email }
 * @param {Object} msg - IMAP message stream
 * @returns {Promise<Object|null>} Parsed { uid, email } or null on parse failure
 */
const parseFetchedMessage = (msg) => {
  return new Promise((resolve) => {
    let buffer = ''
    let uid = null

    msg.on('attributes', (attrs) => {
      uid = attrs.uid
    })

    msg.on('body', (stream) => {
      stream.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
      })
    })

    msg.once('end', async () => {
      try {
        const parsed = await simpleParser(buffer)
        const email = await buildEmailFromParsed(parsed)
        resolve({ uid, email })
      } catch (parseErr) {
        console.error('[WatchEmail] Failed to parse email:', parseErr.message)
        resolve(null)
      }
    })
  })
}

/**
 * Build the email object (with saved attachments) from a mailparser result
 * @param {Object} parsed - mailparser parsed email
 * @returns {Promise<Object>} Email object with sender, date, subject, body, attachments
 */
const buildEmailFromParsed = async (parsed) => {
  const attachments = await saveAttachments(parsed.attachments || [])
  return {
    sender: parsed.from?.text || null,
    date: parsed.date?.toISOString() || null,
    subject: parsed.subject || null,
    body: parsed.text || parsed.html || null,
    attachments,
  }
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
