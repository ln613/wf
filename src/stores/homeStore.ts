import { createStore } from 'solid-js/store'
import { getWorkflows, getTasks, getUIPages } from '../utils/api'
import type {
  WorkflowCategory,
  TaskCategory,
  UIPage,
  SelectedItem,
  TabType,
} from '../types/workflow'

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

const initialState: HomeStoreState = {
  localWorkflows: [],
  testWorkflows: [],
  tasks: [],
  uiPages: [],
  loading: true,
  error: null,
  selectedItem: null,
  activeTab: 'local',
}

export const [homeStore, setHomeStore] = createStore<HomeStoreState>(initialState)

export const homeStoreActions = {
  loadData: async () => {
    try {
      setHomeStore({ loading: true, error: null })

      const [workflowData, taskData, uiData] = await Promise.all([
        getWorkflows(),
        getTasks(),
        getUIPages(),
      ])

      // Process workflow data - ensure it's an array of categories
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
    setHomeStore(initialState)
  },
}