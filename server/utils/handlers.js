import { get, save, remove } from './db.js'
import { ObjectId } from 'mongodb'
import { executeWorkflow, getAllWorkflows } from './workflows/index.js'
import { getAllTasks, getTaskByName } from './tasks/index.js'
import { readdir, stat, access } from 'fs/promises'
import { join, dirname, basename, extname } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const execAsync = promisify(exec)

const getTodos = async () => {
  return get('todos', {}, { sort: { createdAt: -1 } })
}

const updateTodo = async (body) => {
  validateTodoInput(body)
  const todo = prepareTodoForSave(body)
  return save('todos', todo)
}

const deleteTodo = async (body) => {
  validateDeleteInput(body)
  const id = parseObjectId(body.id)
  return remove('todos', { _id: id })
}

const seedTodos = async () => {
  const testTodos = createTestTodos()
  for (const todo of testTodos) {
    await save('todos', todo)
  }
  return { message: 'Seeded test todos', count: testTodos.length }
}

const validateTodoInput = (body) => {
  if (!body) throw new Error('Request body is required')
  if (!body.title && !body._id) throw new Error('Title is required for new todos')
}

const validateDeleteInput = (body) => {
  if (!body?.id) throw new Error('Todo id is required')
}

const parseObjectId = (id) => {
  try {
    return new ObjectId(id)
  } catch {
    throw new Error('Invalid todo id format')
  }
}

const prepareTodoForSave = (body) => {
  const todo = { ...body }
  if (todo._id) {
    todo._id = parseObjectId(todo._id)
  } else {
    todo.createdAt = new Date()
    todo.completed = false
  }
  return todo
}

const createTestTodos = () => [
  { title: 'Learn React', completed: false, createdAt: new Date() },
  { title: 'Build a todo app', completed: false, createdAt: new Date() },
  { title: 'Setup Netlify functions', completed: true, createdAt: new Date() },
]

const getWorkflows = async () => {
  return getAllWorkflows()
}

const getTasks = async () => {
  return getAllTasks()
}

const runWorkflowHandler = async (body) => {
  validateWorkflowInput(body)
  return executeWorkflow(body.workflow, body.inputs || {})
}

const validateWorkflowInput = (body) => {
  if (!body) throw new Error('Request body is required')
  if (!body.workflow) throw new Error('Workflow name is required')
}

const runTaskHandler = async (body) => {
  validateTaskInput(body)
  const task = getTaskByName(body.task)
  if (!task) throw new Error(`Task not found: ${body.task}`)
  return task.handler(body.inputs || {})
}

const validateTaskInput = (body) => {
  if (!body) throw new Error('Request body is required')
  if (!body.task) throw new Error('Task name is required')
}

const getUIPages = async () => {
  const specsUIPath = join(__dirname, '../../specs/UI')
  return await scanUIPages(specsUIPath)
}

const scanUIPages = async (uiPath) => {
  try {
    const files = await readdir(uiPath)
    const pages = []
    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = basename(file, '.md')
        const url = '/' + name.toLowerCase().replace(/ /g, '-')
        pages.push({ name, url })
      }
    }
    return pages
  } catch (err) {
    console.error('Error scanning UI pages:', err)
    return []
  }
}

const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']

const getFolderContents = async (params) => {
  const folderPath = params.path || 'C:\\T'
  return await scanFolderContents(folderPath)
}

const scanFolderContents = async (folderPath) => {
  try {
    await access(folderPath)
  } catch {
    throw new Error(`Folder not accessible: ${folderPath}`)
  }

  const entries = await readdir(folderPath, { withFileTypes: true })
  const subfolders = entries.filter((e) => e.isDirectory())
  const parentPath = dirname(folderPath) !== folderPath ? dirname(folderPath) : undefined

  if (subfolders.length > 0) {
    return buildFolderResponse(folderPath, parentPath, subfolders)
  }

  return await buildVideoResponse(folderPath, parentPath, entries)
}

const buildFolderResponse = (currentPath, parentPath, subfolders) => {
  const items = subfolders.map((f) => ({
    name: f.name,
    path: join(currentPath, f.name),
    type: 'folder',
  }))

  return {
    currentPath,
    parentPath,
    items,
    contentType: 'folders',
  }
}

const buildVideoResponse = async (currentPath, parentPath, entries) => {
  const videoFiles = entries.filter(
    (e) => e.isFile() && VIDEO_EXTENSIONS.includes(extname(e.name).toLowerCase()),
  )

  const items = videoFiles.map((f) => ({
    name: f.name,
    path: join(currentPath, f.name),
    type: 'video',
  }))

  return {
    currentPath,
    parentPath,
    items,
    contentType: 'videos',
  }
}

const getVideoThumbnail = async (params) => {
  const videoPath = params.path
  if (!videoPath) throw new Error('Video path is required')
  
  const thumbnailPath = await generateVideoThumbnail(videoPath)
  return { thumbnail: thumbnailPath }
}

const generateVideoThumbnail = async (videoPath) => {
  const tempDir = join(homedir(), '.wf-thumbnails')
  const fs = await import('fs/promises')
  
  try {
    await access(tempDir)
  } catch {
    await fs.mkdir(tempDir, { recursive: true })
  }

  const videoName = basename(videoPath, extname(videoPath))
  const thumbnailFile = `${videoName}-thumb.jpg`
  const thumbnailPath = join(tempDir, thumbnailFile)

  try {
    await access(thumbnailPath)
    return thumbnailPath
  } catch {
    // Generate thumbnail
  }

  const escapedVideoPath = videoPath.replace(/"/g, '\\"')
  const escapedThumbnailPath = thumbnailPath.replace(/"/g, '\\"')
  const ffmpegCmd = `ffmpeg -i "${escapedVideoPath}" -ss 00:00:05 -vframes 1 -vf "scale=320:-1" "${escapedThumbnailPath}" -y`

  try {
    await execAsync(ffmpegCmd)
  } catch (err) {
    console.error('Failed to generate thumbnail:', err)
    return ''
  }

  return thumbnailPath
}

const openFilePicker = async (body) => {
  const mode = body?.mode || 'folder' // 'file' or 'folder'
  const initialDir = body?.initialDir || homedir()

  try {
    if (mode === 'folder') {
      return await openFolderPicker(initialDir)
    } else {
      return await openFilePickerDialog(initialDir)
    }
  } catch (error) {
    throw new Error(`File picker error: ${error.message}`)
  }
}

const openFolderPicker = async (initialDir) => {
  const tempFile = join(homedir(), '.folder_picker_result.txt')
  const psFile = join(homedir(), '.folder_picker.ps1')
  const escapedPath = initialDir.replace(/'/g, "''")
  const escapedTempFile = tempFile.replace(/'/g, "''")

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$browser = New-Object System.Windows.Forms.FolderBrowserDialog
$browser.Description = 'Select a folder'
$browser.SelectedPath = '${escapedPath}'
$browser.ShowNewFolderButton = $true
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$result = $browser.ShowDialog($form)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [System.IO.File]::WriteAllText('${escapedTempFile}', $browser.SelectedPath, [System.Text.Encoding]::UTF8)
}
`

  try {
    const fs = await import('fs/promises')
    await fs.writeFile(psFile, psScript, 'utf8')
    await fs.writeFile(tempFile, '', 'utf8')

    await execAsync(`powershell -NoProfile -STA -ExecutionPolicy Bypass -File "${psFile}"`)

    const selectedPath = (await fs.readFile(tempFile, 'utf8')).trim()
    await fs.unlink(psFile).catch(() => {})
    await fs.unlink(tempFile).catch(() => {})

    if (!selectedPath) {
      return { cancelled: true }
    }

    return { path: selectedPath, cancelled: false }
  } catch (error) {
    console.error('Folder picker error:', error)
    return { cancelled: true, error: error.message }
  }
}

const openFilePickerDialog = async (initialDir) => {
  const tempFile = join(homedir(), '.file_picker_result.txt')
  const psFile = join(homedir(), '.file_picker.ps1')
  const escapedPath = initialDir.replace(/'/g, "''")
  const escapedTempFile = tempFile.replace(/'/g, "''")

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.InitialDirectory = '${escapedPath}'
$dialog.Filter = 'All Files (*.*)|*.*'
$dialog.Title = 'Select a file'
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$result = $dialog.ShowDialog($form)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [System.IO.File]::WriteAllText('${escapedTempFile}', $dialog.FileName, [System.Text.Encoding]::UTF8)
}
`

  try {
    const fs = await import('fs/promises')
    await fs.writeFile(psFile, psScript, 'utf8')
    await fs.writeFile(tempFile, '', 'utf8')

    await execAsync(`powershell -NoProfile -STA -ExecutionPolicy Bypass -File "${psFile}"`)

    const selectedPath = (await fs.readFile(tempFile, 'utf8')).trim()
    await fs.unlink(psFile).catch(() => {})
    await fs.unlink(tempFile).catch(() => {})

    if (!selectedPath) {
      return { cancelled: true }
    }

    return { path: selectedPath, cancelled: false }
  } catch (error) {
    console.error('File picker error:', error)
    return { cancelled: true, error: error.message }
  }
}

export const apiHandlers = {
  get: {
    todos: getTodos,
    workflows: getWorkflows,
    tasks: getTasks,
    uiPages: getUIPages,
    folderContents: getFolderContents,
    videoThumbnail: getVideoThumbnail,
  },
  post: {
    todo: updateTodo,
    deleteTodo: deleteTodo,
    seed: seedTodos,
    workflow: runWorkflowHandler,
    task: runTaskHandler,
    openFilePicker: openFilePicker,
  },
}