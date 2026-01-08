import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../.env') })

import express from 'express'
import cors from 'cors'
import { connectDB } from './utils/db.js'
import { apiHandlers } from './utils/handlers.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const validateRequest = (method, type) => {
  if (!type) return 'Missing type parameter'
  if (!apiHandlers[method]) return `Invalid method: ${method}`
  if (!apiHandlers[method][type]) return `Invalid type: ${type} for method: ${method}`
  return null
}

app.get('/api', async (req, res) => {
  try {
    const { type, ...restParams } = req.query
    console.log(`[API] GET request received - type: ${type}`)

    const error = validateRequest('get', type)
    if (error) {
      return res.status(400).json({ error })
    }

    await connectDB()

    const handler = apiHandlers.get[type]
    const result = await handler(restParams)

    res.json(result)
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

const getPostLogMessage = (type, body) => {
  const baseMsg = `[API] POST request received - type: ${type}`
  if (type === 'task' && body?.task) return `${baseMsg}, task: ${body.task}`
  if (type === 'workflow' && body?.workflow) return `${baseMsg}, workflow: ${body.workflow}`
  return baseMsg
}

app.post('/api', async (req, res) => {
  try {
    const { type } = req.query
    console.log(getPostLogMessage(type, req.body))

    const error = validateRequest('post', type)
    if (error) {
      return res.status(400).json({ error })
    }

    await connectDB()

    const handler = apiHandlers.post[type]
    const result = await handler(req.body)

    res.json(result)
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})