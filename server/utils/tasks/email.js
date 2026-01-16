import nodemailer from 'nodemailer'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export const getLatestEmailWithAttachment = async ({ emailAccount }) => {
  console.log('[getLatestEmailWithAttachment] Starting with account:', emailAccount)
  validateEmailAccount(emailAccount)
  const credentials = getGmailAppPasswordCredentials(emailAccount)
  console.log('[getLatestEmailWithAttachment] Got credentials for:', credentials.email)
  return fetchLatestEmailWithImap(credentials)
}

// Keep old function name for backward compatibility
export const getLatestEmail = getLatestEmailWithAttachment

export const sendEmail = async ({ senderAccount, receiverEmail, receiverAccount, subject, body, attachments }) => {
  validateSendEmailInput({ senderAccount, receiverEmail, receiverAccount, subject, body })
  const credentials = getGmailAppPasswordCredentials(senderAccount)
  console.log('[sendEmail] Got credentials for:', credentials.email)
  
  // Resolve receiver email - can be direct email or env var reference
  const resolvedReceiverEmail = resolveReceiverEmail(receiverEmail, receiverAccount)
  console.log('[sendEmail] Sending to:', resolvedReceiverEmail)
  
  return sendEmailWithNodemailer(credentials, resolvedReceiverEmail, subject, body, attachments)
}

const validateEmailAccount = (emailAccount) => {
  if (!emailAccount) {
    throw new Error('Email account environment variable name is required')
  }
}

const validateSendEmailInput = ({ senderAccount, receiverEmail, receiverAccount, subject, body }) => {
  const errors = []
  if (!senderAccount) errors.push('Sender account is required')
  if (!receiverEmail && !receiverAccount) errors.push('Receiver email or receiver account is required')
  if (!subject) errors.push('Subject is required')
  if (!body) errors.push('Email body is required')
  if (errors.length > 0) {
    throw new Error(errors.join(', '))
  }
}

/**
 * Resolve receiver email from direct email or env var reference
 * @param {string} receiverEmail - Direct email address
 * @param {string} receiverAccount - Environment variable name for email account
 * @returns {string} Resolved email address
 */
const resolveReceiverEmail = (receiverEmail, receiverAccount) => {
  if (receiverEmail) {
    return receiverEmail
  }
  if (receiverAccount) {
    const email = process.env[receiverAccount]
    if (!email) {
      throw new Error(`Email not found for receiver account ${receiverAccount}`)
    }
    return email
  }
  throw new Error('No receiver email or account specified')
}

/**
 * Get Gmail credentials for app password authentication
 * Environment variables: {accountEnvVar} = email, {accountEnvVar}_APP_PASSWORD = app password
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
 * Send email using nodemailer with Gmail SMTP and app password
 * @param {Object} credentials - Gmail credentials with email and appPassword
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text)
 * @param {Array} attachments - Optional array of attachment paths or objects
 * @returns {Object} Result with success status
 */
const sendEmailWithNodemailer = async (credentials, to, subject, body, attachments) => {
  console.log('[sendEmailWithNodemailer] Creating transporter...')
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: credentials.email,
      pass: credentials.appPassword,
    },
  })

  const mailOptions = {
    from: credentials.email,
    to,
    subject,
    text: body,
  }

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = formatAttachments(attachments)
    console.log(`[sendEmailWithNodemailer] Adding ${mailOptions.attachments.length} attachment(s)`)
  }

  console.log('[sendEmailWithNodemailer] Sending email...')
  await transporter.sendMail(mailOptions)

  console.log('[sendEmailWithNodemailer] Email sent successfully')
  return { success: true, message: 'Email sent successfully' }
}

/**
 * Format attachments for nodemailer
 * @param {Array} attachments - Array of file paths or attachment objects
 * @returns {Array} Formatted attachments for nodemailer
 */
const formatAttachments = (attachments) => {
  return attachments.map((attachment) => {
    // If it's a string, treat it as a file path
    if (typeof attachment === 'string') {
      return {
        filename: path.basename(attachment),
        path: attachment,
      }
    }
    // If it's an object with path property
    if (attachment.path) {
      return {
        filename: attachment.filename || path.basename(attachment.path),
        path: attachment.path,
        contentType: attachment.contentType,
      }
    }
    // Return as-is if already in nodemailer format
    return attachment
  })
}

/**
 * Fetch the latest email using IMAP with Gmail app password
 * @param {Object} credentials - Gmail credentials with email and appPassword
 * @returns {Object} Email with sender, date, subject, and body
 */
const fetchLatestEmailWithImap = async (credentials) => {
  console.log('[fetchLatestEmailWithImap] Connecting to Gmail IMAP...')
  
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
      console.log('[fetchLatestEmailWithImap] IMAP connection ready')
      openInboxAndFetchLatest(imap, resolve, reject)
    })

    imap.once('error', (err) => {
      console.error('[fetchLatestEmailWithImap] IMAP error:', err.message)
      reject(err)
    })

    imap.once('end', () => {
      console.log('[fetchLatestEmailWithImap] IMAP connection ended')
    })

    imap.connect()
  })
}

/**
 * Open inbox and fetch the latest email
 * @param {Object} imap - IMAP connection
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
const openInboxAndFetchLatest = (imap, resolve, reject) => {
  imap.openBox('INBOX', true, (err, box) => {
    if (err) {
      imap.end()
      return reject(err)
    }

    console.log('[openInboxAndFetchLatest] Inbox opened, total messages:', box.messages.total)

    if (box.messages.total === 0) {
      imap.end()
      return resolve({ sender: null, date: null, subject: null, body: null })
    }

    // Fetch the latest message (highest sequence number)
    const fetchRange = `${box.messages.total}:${box.messages.total}`
    const fetch = imap.seq.fetch(fetchRange, {
      bodies: '',
      struct: true,
    })

    fetch.on('message', (msg) => {
      handleImapMessage(msg, imap, resolve, reject)
    })

    fetch.once('error', (err) => {
      imap.end()
      reject(err)
    })

    fetch.once('end', () => {
      console.log('[openInboxAndFetchLatest] Fetch completed')
    })
  })
}

/**
 * Handle an IMAP message and parse it
 * @param {Object} msg - IMAP message
 * @param {Object} imap - IMAP connection
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
const handleImapMessage = (msg, imap, resolve, reject) => {
  let buffer = ''

  msg.on('body', (stream) => {
    stream.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
    })
  })

  msg.once('end', async () => {
    try {
      console.log('[handleImapMessage] Parsing email...')
      const parsed = await simpleParser(buffer)
      
      // Save attachments to temp folder
      const attachments = await saveAttachments(parsed.attachments || [])
      
      const result = {
        sender: parsed.from?.text || null,
        date: parsed.date?.toISOString() || null,
        subject: parsed.subject || null,
        body: parsed.text || parsed.html || null,
        attachments,
      }

      console.log('[handleImapMessage] Parsed - Subject:', result.subject)
      console.log('[handleImapMessage] Attachments:', attachments.length)
      imap.end()
      resolve(result)
    } catch (parseErr) {
      imap.end()
      reject(parseErr)
    }
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

    console.log(`[saveAttachments] Saved: ${filename} (${savedAttachments[savedAttachments.length - 1].size} bytes)`)
  }

  return savedAttachments
}