import { ComfyApi, Workflow } from 'comfyui-node'
import { readFile, readdir, stat, copyFile, rename, unlink, mkdir, access } from 'fs/promises'
import { resolve, join, basename, dirname } from 'path'
import { pinyin } from 'pinyin-pro'

export const runWorkflow = async ({ workflowPath, params, outputKey }) => {
  validateRunWorkflowInput(workflowPath)

  // Create fresh API connection for each workflow to avoid websocket issues
  const api = await createComfyApi()

  const workflowJson = await loadWorkflowJson(workflowPath)
  const wf = createWorkflow(workflowJson, params, outputKey)

  console.log(`Starting workflow: ${workflowPath}`)
  const job = await api.run(wf, { autoDestroy: true })
  logJobProgress(job)

  try {
    const result = await job.done()
    console.log('Workflow completed, result:', JSON.stringify(result, null, 2))
    return extractOutputFileName(result, outputKey)
  } catch (error) {
    console.error('Workflow job error:', error)
    throw error
  } finally {
    // Close the API connection after job completes
    try {
      api.close?.()
    } catch (e) {
      // Ignore close errors
    }
  }
}

const validateRunWorkflowInput = (workflowPath) => {
  if (!workflowPath) {
    throw new Error('Workflow path is required')
  }
}

const createComfyApi = async () => {
  return await new ComfyApi(process.env.COMFY_URL || 'http://127.0.0.1:8188').ready()
}

const loadWorkflowJson = async (workflowPath) => {
  const resolvedPath = resolve(workflowPath)
  const content = await readFile(resolvedPath, 'utf-8')
  return JSON.parse(content)
}

const createWorkflow = (workflowJson, params, outputKey) => {
  const wf = Workflow.from(workflowJson)

  if (params && Array.isArray(params)) {
    params.forEach(({ key, value }) => {
      if (key && value !== undefined) {
        wf.set(key, value)
      }
    })
  }

  if (outputKey) {
    wf.output(outputKey)
  }

  return wf
}

const logJobProgress = (job) => {
  job.on('progress_pct', (p) => console.log(`${p}%`))
}

const extractOutputFileName = (result, outputKey) => {
  if (result.images?.gifs?.[0]?.filename) {
    return result.images.gifs[0].filename
  }
  if (result.images?.images?.[0]?.filename) {
    return result.images.images[0].filename
  }
  if (result.files?.[0]?.filename) {
    return result.files[0].filename
  }
  return null
}

const COMFY_INPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\input'
const COMFY_OUTPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\output'
const OUTPUT_BASE_DIR = 'C:\\T\\fg\\v'

/**
 * Process files for Comfy FSV/FSVR/FSI workflow
 * @param {Object} params - Input parameters
 * @param {string} params.type - Workflow type: fsv, fsvr, fsi (default: fsv)
 * @param {string} params.filePath - File or folder path (required)
 * @param {string} params.count - Number of faces: 1, 2, 3 (default: 1)
 * @param {string} params.order - Face order: large-small, left-right (default: large-small)
 * @returns {Promise<Object>} Result object with generated file names
 */
export const comfyFsvProcess = async ({ type = 'fsv', filePath, count = '1', order = 'large-small' }) => {
  validateComfyFsvInput(filePath)

  const { files, folderName } = await getFilesToProcess(filePath)
  const results = []

  for (const file of files) {
    try {
      const result = await processComfyFsvFile(file, type, count, order, folderName)
      results.push({ file, ...result })
    } catch (error) {
      results.push({ file, success: false, error: error.message })
    }
  }

  return {
    success: results.every((r) => r.success),
    results,
    message: `Processed ${results.filter((r) => r.success).length}/${results.length} files`,
  }
}

const validateComfyFsvInput = (filePath) => {
  if (!filePath) {
    throw new Error('File path is required')
  }
}

const getFilesToProcess = async (filePath) => {
  try {
    const fileStat = await stat(filePath)

    if (fileStat.isDirectory()) {
      const files = await readdir(filePath)
      const folderName = basename(filePath)
      return {
        files: files.map((f) => join(filePath, f)),
        folderName,
      }
    }

    return {
      files: [filePath],
      folderName: null,
    }
  } catch (error) {
    throw new Error(`Failed to access path: ${error.message}`)
  }
}

const processComfyFsvFile = async (file, type, count, order, folderName) => {
  const fileName = basename(file)
  console.log(`Processing file: ${fileName}`)

  // Calculate target file name and target folder BEFORE processing
  const targetFileName = `${type}-${fileName}`
  const targetFolder = getOutputDestinationDir(folderName)
  const targetFilePath = join(targetFolder, targetFileName)

  // Check if target file already exists - skip if it does
  if (await fileExists(targetFilePath)) {
    console.log(`Target file already exists, skipping: ${targetFilePath}`)
    return {
      success: true,
      fileName: targetFileName,
      message: `Skipped ${fileName} - target already exists`,
      skipped: true,
    }
  }

  // Target doesn't exist, proceed with processing
  const copiedFilePath = await copyFileToComfyInput(file, fileName)
  console.log(`Copied file to: ${copiedFilePath}`)

  const faces = calculateFaces(count)
  const workflowPath = getWorkflowPath(type)
  const params = buildComfyFsvParams(type, fileName, faces, order)

  console.log(`Running workflow with params:`, JSON.stringify(params))
  const outputFileName = await runWorkflow({
    workflowPath,
    params,
    outputKey: 'images:31',
  })
  console.log(`Workflow returned output file: ${outputFileName}`)

  console.log('Starting post-processing...')
  const renamedFileName = await postProcessWorkflowResult(outputFileName, targetFileName, targetFolder, copiedFilePath)
  console.log('Post-processing completed')

  return {
    success: true,
    fileName: renamedFileName || targetFileName,
    message: `Successfully processed ${fileName}`,
  }
}

const fileExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const copyFileToComfyInput = async (sourcePath, fileName) => {
  const destPath = join(COMFY_INPUT_DIR, fileName)
  await copyFile(sourcePath, destPath)
  return destPath
}

const postProcessWorkflowResult = async (outputFileName, targetFileName, targetFolder, copiedFilePath) => {
  console.log(`Post-processing: output=${outputFileName}, targetFileName=${targetFileName}, targetFolder=${targetFolder}`)
  const renamedFileName = await renameAndMoveGeneratedFile(outputFileName, targetFileName, targetFolder)
  await deleteCopiedInputFile(copiedFilePath)
  return renamedFileName
}

const convertChineseToFolderName = (name) => {
  if (!name) return null
  
  // Check if name contains Chinese characters
  const hasChinese = /[\u4e00-\u9fa5]/.test(name)
  if (!hasChinese) return name
  
  // Convert Chinese to pinyin
  const pinyinResult = pinyin(name, { toneType: 'none', type: 'array' })
  return pinyinResult.join('')
}

const getOutputDestinationDir = (folderName) => {
  if (!folderName) return OUTPUT_BASE_DIR
  
  const convertedFolderName = convertChineseToFolderName(folderName)
  return join(OUTPUT_BASE_DIR, convertedFolderName)
}

const ensureDirectoryExists = async (dirPath) => {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

const moveFileCrossDevice = async (sourcePath, destPath) => {
  // Use copy + delete for cross-device moves (network share to local drive)
  await copyFile(sourcePath, destPath)
  await unlink(sourcePath)
}

const renameAndMoveGeneratedFile = async (outputFileName, targetFileName, targetFolder) => {
  if (!outputFileName) {
    console.log('No output file name, skipping rename and move')
    return null
  }

  const outputDir = COMFY_OUTPUT_DIR
  const oldPath = join(outputDir, outputFileName)

  // Ensure destination directory exists
  await ensureDirectoryExists(targetFolder)

  const destPath = join(targetFolder, targetFileName)

  console.log(`Moving and renaming: ${oldPath} -> ${destPath}`)
  try {
    await moveFileCrossDevice(oldPath, destPath)
    console.log('Move and rename successful')
    return targetFileName
  } catch (error) {
    console.error(`Failed to move and rename output file: ${error.message}`)
    return null
  }
}

const deleteCopiedInputFile = async (copiedFilePath) => {
  console.log(`Deleting copied file: ${copiedFilePath}`)
  try {
    await unlink(copiedFilePath)
    console.log('Delete successful')
  } catch (error) {
    console.error(`Failed to delete copied input file: ${error.message}`)
  }
}

const calculateFaces = (count) => {
  if (count === '2' || count === 2) return '0,1'
  if (count === '3' || count === 3) return '0,1,2'
  return '0'
}

const getWorkflowPath = (type) => {
  return `./server/utils/comfy/${type}.json`
}

const buildComfyFsvParams = (type, fileName, faces, order) => {
  if (type === 'fsvr') {
    return [{ key: '45.inputs.video', value: `ComfyUI/input/${fileName}` }]
  }

  // fsv and fsi use same param structure
  return [
    { key: '47.inputs.video', value: fileName },
    { key: '41.inputs.input_faces_index', value: faces },
    { key: '41.inputs.input_faces_order', value: order },
  ]
}