const getApiHost = () => {
  return import.meta.env.DEV ? 'http://localhost:3001' : ''
}

const buildUrl = (type: string, params?: Record<string, string>) => {
  const host = getApiHost()
  const queryParams = new URLSearchParams({ type, ...params })
  return `${host}/api?${queryParams}`
}

const handleResponse = async (response: Response) => {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export const apiGet = async (type: string, params?: Record<string, string>) => {
  const url = buildUrl(type, params)
  const response = await fetch(url)
  return handleResponse(response)
}

export const apiPost = async (type: string, body: unknown) => {
  const url = buildUrl(type)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(response)
}

export const getWorkflows = () => apiGet('workflows')

export const getTasks = () => apiGet('tasks')

export const runWorkflow = (workflow: string, inputs: Record<string, unknown>) =>
  apiPost('workflow', { workflow, inputs })

export const runTask = (task: string, inputs: Record<string, unknown> = {}) =>
  apiPost('task', { task, inputs })

export interface FilePickerResult {
  path?: string
  cancelled: boolean
}

export const openFilePicker = (mode: 'file' | 'folder' = 'folder', initialDir?: string): Promise<FilePickerResult> =>
  apiPost('openFilePicker', { mode, initialDir })