import { get, save, remove } from './db.js'
import { ObjectId } from 'mongodb'
import { executeWorkflow, getAllWorkflows } from './workflows/index.js'
import { getAllTasks, getTaskByName } from './tasks/index.js'

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

export const apiHandlers = {
  get: {
    todos: getTodos,
    workflows: getWorkflows,
    tasks: getTasks,
  },
  post: {
    todo: updateTodo,
    deleteTodo: deleteTodo,
    seed: seedTodos,
    workflow: runWorkflowHandler,
    task: runTaskHandler,
  },
}