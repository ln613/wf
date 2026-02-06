import { ComfyApi, Workflow } from 'comfyui-node'
import { readFile, readdir, stat, copyFile } from 'fs/promises'
import { resolve, join, basename } from 'path'

let api

export const runWorkflow = async ({ workflowPath, params, outputKey }) => {
  validateRunWorkflowInput(workflowPath)

  if (!api) {
    api = await createComfyApi()
  }

  const workflowJson = await loadWorkflowJson(workflowPath)
  const wf = createWorkflow(workflowJson, params, outputKey)

  const job = await api.run(wf, { autoDestroy: true })
  logJobProgress(job)

  const result = await job.done()
  return extractOutputFileName(result, outputKey)
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

/**
 * Process files for Comfy FSV/FSVR/FSI workflow
 * @param {Object} params - Input parameters
 * @param {string} params.type - Workflow type: fsv, fsvr, fsi (default: fsv)
 * @param {string} params.filePath - File or folder path (required)
 * @param {string} params.count - Number of faces: 1, 2, 3 (default: 1)
 * @returns {Promise<Object>} Result object with generated file names
 */
export const comfyFsvProcess = async ({ type = 'fsv', filePath, count = '1' }) => {
  validateComfyFsvInput(filePath)

  const files = await getFilesToProcess(filePath)
  const results = []

  for (const file of files) {
    try {
      const result = await processComfyFsvFile(file, type, count)
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
      return files.map((f) => join(filePath, f))
    }

    return [filePath]
  } catch (error) {
    throw new Error(`Failed to access path: ${error.message}`)
  }
}

const processComfyFsvFile = async (file, type, count) => {
  const fileName = basename(file)
  await copyFileToComfyInput(file, fileName)

  const faces = calculateFaces(count)
  const workflowPath = getWorkflowPath(type)
  const params = buildComfyFsvParams(type, fileName, faces)

  const outputFileName = await runWorkflow({
    workflowPath,
    params,
    outputKey: 'images:31',
  })

  return {
    success: true,
    fileName: outputFileName,
    message: `Successfully processed ${fileName}`,
  }
}

const copyFileToComfyInput = async (sourcePath, fileName) => {
  const destPath = join(COMFY_INPUT_DIR, fileName)
  await copyFile(sourcePath, destPath)
}

const calculateFaces = (count) => {
  if (count === '2' || count === 2) return '0,1'
  if (count === '3' || count === 3) return '0,1,2'
  return '0'
}

const getWorkflowPath = (type) => {
  return `./server/utils/comfy/${type}.json`
}

const buildComfyFsvParams = (type, fileName, faces) => {
  if (type === 'fsvr') {
    return [{ key: '45.inputs.video', value: `ComfyUI/input/${fileName}` }]
  }

  // fsv and fsi use same param structure
  return [
    { key: '47.inputs.video', value: fileName },
    { key: '41.inputs.input_faces_index', value: faces },
  ]
}