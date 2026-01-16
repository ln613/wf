import { google } from 'googleapis'
import nodemailer from 'nodemailer'

export const getLatestEmail = async ({ emailAccount }) => {
  console.log('[getLatestEmail] Starting with account:', emailAccount)
  validateEmailAccount(emailAccount)
  const credentials = getGmailCredentials(emailAccount)
  console.log('[getLatestEmail] Got credentials for:', credentials.email)
  const gmail = await createGmailClient(credentials)
  console.log('[getLatestEmail] Gmail client created')
  return fetchLatestGmailMessage(gmail)
}

export const sendEmail = async ({ senderAccount, receiverEmail, subject, body }) => {
  validateSendEmailInput({ senderAccount, receiverEmail, subject, body })
  const credentials = getGmailAppPasswordCredentials(senderAccount)
  console.log('[sendEmail] Got credentials for:', credentials.email)
  return sendEmailWithNodemailer(credentials, receiverEmail, subject, body)
}

const validateEmailAccount = (emailAccount) => {
  if (!emailAccount) {
    throw new Error('Email account environment variable name is required')
  }
}

const validateSendEmailInput = ({ senderAccount, receiverEmail, subject, body }) => {
  const errors = []
  if (!senderAccount) errors.push('Sender account is required')
  if (!receiverEmail) errors.push('Receiver email is required')
  if (!subject) errors.push('Subject is required')
  if (!body) errors.push('Email body is required')
  if (errors.length > 0) {
    throw new Error(errors.join(', '))
  }
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
 * @returns {Object} Result with success status
 */
const sendEmailWithNodemailer = async (credentials, to, subject, body) => {
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

  console.log('[sendEmailWithNodemailer] Sending email...')
  await transporter.sendMail(mailOptions)

  console.log('[sendEmailWithNodemailer] Email sent successfully')
  return { success: true, message: 'Email sent successfully' }
}

const getGmailCredentials = (accountEnvVar) => {
  const email = process.env[accountEnvVar]
  const clientId = process.env[`${accountEnvVar}_CLIENT_ID`]
  const clientSecret = process.env[`${accountEnvVar}_CLIENT_SECRET`]
  const refreshToken = process.env[`${accountEnvVar}_REFRESH_TOKEN`]

  if (!email) throw new Error(`Email not found for ${accountEnvVar}`)
  if (!clientId) throw new Error(`Client ID not found for ${accountEnvVar}`)
  if (!clientSecret) throw new Error(`Client Secret not found for ${accountEnvVar}`)
  if (!refreshToken) throw new Error(`Refresh Token not found for ${accountEnvVar}`)

  return { email, clientId, clientSecret, refreshToken }
}

const createGmailClient = async (credentials) => {
  const oauth2Client = createOAuth2Client(credentials)
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken })
  console.log('[createGmailClient] OAuth2 client configured')
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

const createOAuth2Client = (credentials) => {
  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    'https://developers.google.com/oauthplayground'
  )
}

const fetchLatestGmailMessage = async (gmail) => {
  console.log('[fetchLatestGmailMessage] Listing messages...')
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 1,
  })

  const messages = listResponse.data.messages
  if (!messages || messages.length === 0) {
    console.log('[fetchLatestGmailMessage] No messages found')
    return { sender: null, date: null, subject: null, body: null }
  }

  console.log('[fetchLatestGmailMessage] Getting message details for:', messages[0].id)
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messages[0].id,
    format: 'full',
  })

  console.log('[fetchLatestGmailMessage] Parsing message...')
  return parseGmailMessage(message.data)
}

const parseGmailMessage = (message) => {
  const headers = message.payload.headers || []
  const sender = getHeader(headers, 'From')
  const date = getHeader(headers, 'Date')
  const subject = getHeader(headers, 'Subject')
  const body = extractGmailBody(message.payload)

  console.log('[parseGmailMessage] Parsed - Subject:', subject)
  return { sender, date, subject, body }
}

const getHeader = (headers, name) => {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || null
}

const extractGmailBody = (payload) => {
  if (payload.body?.data) {
    return decodeBase64(payload.body.data)
  }

  if (payload.parts) {
    const textPart = findTextPart(payload.parts)
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data)
    }
  }

  return ''
}

const findTextPart = (parts) => {
  for (const part of parts) {
    if (part.mimeType === 'text/plain') return part
    if (part.parts) {
      const found = findTextPart(part.parts)
      if (found) return found
    }
  }
  return parts.find((p) => p.mimeType === 'text/html') || null
}

const decodeBase64 = (data) => {
  const decoded = Buffer.from(data, 'base64').toString('utf-8')
  return decoded
}

const sendGmailMessage = async (gmail, from, to, subject, body) => {
  console.log('[sendGmailMessage] Preparing email...')
  const message = createMimeMessage(from, to, subject, body)
  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  console.log('[sendGmailMessage] Sending email...')
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  })

  console.log('[sendGmailMessage] Email sent successfully')
  return { success: true, message: 'Email sent successfully' }
}

const createMimeMessage = (from, to, subject, body) => {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')
}