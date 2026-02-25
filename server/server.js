import dns from 'node:dns/promises'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createReadStream, statSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../.env') })

// Fix for Node.js v24+ on Windows: force DNS servers to resolve MongoDB SRV records
dns.setServers(['1.1.1.1', '8.8.8.8'])

import express from 'express'
import cors from 'cors'
import { connectDB } from './utils/db.js'
import { apiHandlers } from './utils/handlers.js'
import { registerAllEventTriggers } from './utils/workflows/triggers.js'
import { stopAllBackgroundTasks } from './utils/background/index.js'

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

    // Handle video streaming separately
    if (type === 'videoStream') {
      return handleVideoStream(req, res, restParams)
    }

    // Handle thumbnail streaming separately
    if (type === 'thumbnailStream') {
      return handleThumbnailStream(req, res, restParams)
    }

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

const handleVideoStream = (req, res, params) => {
  const videoPath = params.path
  if (!videoPath) {
    return res.status(400).json({ error: 'Video path is required' })
  }

  try {
    const stat = statSync(videoPath)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = end - start + 1
      const file = createReadStream(videoPath, { start, end })
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(206, head)
      file.pipe(res)
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head)
      createReadStream(videoPath).pipe(res)
    }
  } catch (error) {
    console.error('Video stream error:', error)
    res.status(404).json({ error: 'Video not found' })
  }
}

const handleThumbnailStream = async (req, res, params) => {
  const videoPath = params.path
  if (!videoPath) {
    return res.status(400).json({ error: 'Video path is required' })
  }

  try {
    await connectDB()
    const { thumbnail } = await apiHandlers.get.videoThumbnail({ path: videoPath })
    
    if (!thumbnail) {
      return res.status(404).json({ error: 'Thumbnail not found' })
    }

    const stat = statSync(thumbnail)
    const head = {
      'Content-Length': stat.size,
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    }
    res.writeHead(200, head)
    createReadStream(thumbnail).pipe(res)
  } catch (error) {
    console.error('Thumbnail stream error:', error)
    res.status(404).json({ error: 'Thumbnail not found' })
  }
}

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

// Initialize event triggers and start background tasks
const initializeBackgroundServices = () => {
  console.log('[Server] Initializing background services...')
  registerAllEventTriggers()
  console.log('[Server] Background services initialized')
}

// Graceful shutdown handler
const handleShutdown = () => {
  console.log('[Server] Shutting down...')
  stopAllBackgroundTasks()
  process.exit(0)
}

process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  initializeBackgroundServices()
})