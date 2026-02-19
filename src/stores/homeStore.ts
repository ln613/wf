import { createMemo } from 'solid-js'
import { createStore } from 'solid-js/store'
import { getWorkflows, getTasks, getUIPages } from '../utils/api'
import type {
  WorkflowCategory,
  WorkflowDefinition,
  TaskDefinition,
  TaskCategory,
  UIPage,
  SelectedItem,
  TabType,
} from '../types/workflow'

export interface TabDefinition {
  key: TabType
  label: string
}

export const tabs: TabDefinition[] = [
  { key: 'local', label: 'Local Workflows' },
  { key: 'ui', label: 'UI' },
  { key: 'test', label: 'Test Workflows' },
  { key: 'task', label: 'Tasks' },
]

export interface HomeStoreState {
  localWorkflows: WorkflowCategory[]
  testWorkflows: WorkflowCategory[]
  tasks: TaskCategory[]
  uiPages: UIPage[]
  loading: boolean
  error: string | null
  selectedItem: SelectedItem | null
  activeTab: TabType
}

const getInitialState = (): HomeStoreState => ({
  localWorkflows: [],
  testWorkflows: [],
  tasks: [],
  uiPages: [],
  loading: true,
  error: null,
  selectedItem: null,
  activeTab: 'local',
})

export const [homeStore, setHomeStore] = createStore<HomeStoreState>(getInitialState())

const activeWorkflows = createMemo(() => {
  const tab = homeStore.activeTab
  if (tab === 'local') return homeStore.localWorkflows
  if (tab === 'test') return homeStore.testWorkflows
  return []
})

export const homeDerived = {
  activeWorkflows,
}

export const homeStoreActions = {
  loadData: async () => {
    try {
      setHomeStore({ loading: true, error: null })

      const [workflowData, taskData, uiData] = await Promise.all([
        getWorkflows(),
        getTasks(),
        getUIPages(),
      ])

      const processedWorkflowData: WorkflowCategory[] = Array.isArray(workflowData)
        ? workflowData
        : []

      const local = processedWorkflowData.filter((c) => c && c.category === 'local')
      const test = processedWorkflowData.filter((c) => c && c.category === 'test')

      setHomeStore({
        localWorkflows: local,
        testWorkflows: test,
        tasks: taskData,
        uiPages: uiData,
        loading: false,
        error: null,
      })
    } catch (err) {
      setHomeStore({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data',
      })
    }
  },

  selectWorkflow: (workflow: WorkflowDefinition) => {
    setHomeStore('selectedItem', {
      type: 'workflow',
      key: workflow.key,
      name: workflow.name,
      inputs: workflow.inputs || [],
    })
  },

  selectTask: (task: TaskDefinition) => {
    setHomeStore('selectedItem', {
      type: 'task',
      key: task.key,
      name: task.name,
      inputs: task.inputs,
    })
  },

  selectItem: (item: SelectedItem) => {
    setHomeStore('selectedItem', item)
  },

  clearSelection: () => {
    setHomeStore('selectedItem', null)
  },

  setActiveTab: (tab: TabType) => {
    setHomeStore('activeTab', tab)
  },

  reset: () => {
    setHomeStore(getInitialState())
  },
}