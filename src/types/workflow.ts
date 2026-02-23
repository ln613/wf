export interface RadioOption {
  text: string
  value: string
}

export interface TaskInput {
  name: string
  type: string
  label: string
  required: boolean
  optionsApi?: string
  default?: string | number
  options?: RadioOption[]
  defaultFolder?: string
  rows?: number
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
  inputs?: TaskInput[]
  tasks: string[]
}

export interface WorkflowCategory {
  category: string
  workflows: WorkflowDefinition[]
}

export type TabType = 'local' | 'ui' | 'test' | 'task'
export type ItemType = 'workflow' | 'task'

export interface UIPage {
  name: string
  url: string
}

export interface SelectedItem {
  type: ItemType
  key: string
  name: string
  inputs: TaskInput[]
}