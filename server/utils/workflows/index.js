import { testWorkflows } from './definitions/test.js'
import { runWorkflow } from './engine.js'

export const workflows = {
  ...testWorkflows,
}

export const getWorkflowByName = (workflowName) => {
  for (const [key, workflow] of Object.entries(workflows)) {
    if (workflow.name === workflowName || key === workflowName) {
      return { ...workflow, key }
    }
  }
  return null
}

export const getAllWorkflows = () => {
  const grouped = {}
  for (const [key, workflow] of Object.entries(workflows)) {
    const category = workflow.category || 'general'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push({
      key,
      name: workflow.name,
      inputs: workflow.inputs || [],
      tasks: workflow.tasks.map((t) => t.taskName),
    })
  }
  return Object.entries(grouped).map(([category, items]) => ({
    category,
    workflows: items,
  }))
}

export const executeWorkflow = async (workflowName, inputs = {}) => {
  const workflow = getWorkflowByName(workflowName)
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowName}`)
  }
  return runWorkflow(workflow, inputs)
}

export { runWorkflow }