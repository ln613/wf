export interface TaskInput {
  name: string
  type: string
  label: string
  required: boolean
}

export interface TaskDefinition {
  key: string
  name: string
  inputs: TaskInput[]
  outputs: string[]
}

export interface TaskCategory {
  category: string
  tasks: TaskDefinition[]
}

export interface WorkflowDefinition {
  key: string
  name: string
  tasks: string[]
}

export interface WorkflowCategory {
  category: string
  workflows: WorkflowDefinition[]
}

export type ItemType = 'workflow' | 'task'

export interface SelectedItem {
  type: ItemType
  key: string
  name: string
  inputs: TaskInput[]
}