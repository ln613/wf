import { ComfyApi, Workflow } from 'comfyui-node'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

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
