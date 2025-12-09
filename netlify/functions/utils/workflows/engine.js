import { getTaskByName } from '../tasks/index.js'

export const runWorkflow = async (workflow, inputs = {}) => {
  validateWorkflow(workflow)
  let context = { ...inputs }
  let lastOutput = null

  for (const taskStep of workflow.tasks) {
    lastOutput = await executeTaskStep(taskStep, context)
    context = { ...context, ...lastOutput }
  }

  return workflow.output ? extractOutput(context, workflow.output) : lastOutput
}

const validateWorkflow = (workflow) => {
  if (!workflow) throw new Error('Workflow is required')
  if (!workflow.name) throw new Error('Workflow name is required')
  if (!workflow.tasks || !Array.isArray(workflow.tasks)) {
    throw new Error('Workflow tasks must be an array')
  }
}

const executeTaskStep = async (taskStep, context) => {
  const task = resolveTask(taskStep)
  const taskInputs = resolveTaskInputs(task, taskStep, context)
  return task.handler(taskInputs)
}

const resolveTask = (taskStep) => {
  const task = getTaskByName(taskStep.taskName)
  if (!task) {
    throw new Error(`Task not found: ${taskStep.taskName}`)
  }
  return task
}

const resolveTaskInputs = (task, taskStep, context) => {
  const inputs = {}
  for (const inputDef of task.inputs) {
    const value = getInputValue(inputDef.name, taskStep, context)
    if (inputDef.required && value === undefined) {
      throw new Error(`Required input '${inputDef.name}' not provided for task '${taskStep.taskName}'`)
    }
    inputs[inputDef.name] = value
  }
  return inputs
}

const getInputValue = (inputName, taskStep, context) => {
  if (taskStep.inputs && taskStep.inputs[inputName] !== undefined) {
    return taskStep.inputs[inputName]
  }
  return context[inputName]
}

const extractOutput = (context, outputDef) => {
  if (Array.isArray(outputDef)) {
    const result = {}
    for (const key of outputDef) {
      result[key] = context[key]
    }
    return result
  }
  return context[outputDef]
}