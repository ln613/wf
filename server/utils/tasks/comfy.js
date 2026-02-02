import { ComfyApi, Workflow } from 'comfyui-node'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

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