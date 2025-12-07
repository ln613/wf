import { connectDB } from './utils/db.js'
import { apiHandlers } from './utils/handlers.js'

const validateRequest = (method, type) => {
  if (!type) return 'Missing type parameter'
  if (!apiHandlers[method]) return `Invalid method: ${method}`
  if (!apiHandlers[method][type]) return `Invalid type: ${type} for method: ${method}`
  return null
}

const parseBody = async (event) => {
  if (!event.body) return {}
  try {
    return JSON.parse(event.body)
  } catch {
    return {}
  }
}

const buildResponse = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
  body: JSON.stringify(data),
})

const handleOptions = () => buildResponse(200, {})

const handleRequest = async (event) => {
  const method = event.httpMethod.toLowerCase()
  const params = event.queryStringParameters || {}
  const { type, ...restParams } = params

  const error = validateRequest(method, type)
  if (error) return buildResponse(400, { error })

  await connectDB()

  const body = method === 'post' ? await parseBody(event) : null
  const handler = apiHandlers[method][type]
  const result = await handler(method === 'post' ? body : restParams)

  return buildResponse(200, result)
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return handleOptions()
    }
    return await handleRequest(event)
  } catch (error) {
    console.error('API Error:', error)
    return buildResponse(500, { error: error.message })
  }
}