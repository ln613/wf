import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkflows, getTasks, getUIPages } from '../utils/api'
import type { WorkflowCategory, TaskCategory, SelectedItem, TabType, UIPage } from '../types/workflow'
import './HomePage.css'

interface HomePageProps {
  onSelectItem: (item: SelectedItem) => void
}

export const HomePage = ({ onSelectItem }: HomePageProps) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('local')
  const [localWorkflows, setLocalWorkflows] = useState<WorkflowCategory[]>([])
  const [testWorkflows, setTestWorkflows] = useState<WorkflowCategory[]>([])
  const [tasks, setTasks] = useState<TaskCategory[]>([])
  const [uiPages, setUIPages] = useState<UIPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [workflowData, taskData, uiData] = await Promise.all([
        getWorkflows(),
        getTasks(),
        getUIPages(),
      ])
      const local = workflowData.filter((c: WorkflowCategory) => c.category === 'local')
      const test = workflowData.filter((c: WorkflowCategory) => c.category === 'test')
      setLocalWorkflows(local)
      setTestWorkflows(test)
      setTasks(taskData)
      setUIPages(uiData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowSelect = (workflow: WorkflowCategory['workflows'][0]) => {
    onSelectItem({
      type: 'workflow',
      key: workflow.key,
      name: workflow.name,
      inputs: workflow.inputs || [],
    })
  }

  const handleTaskSelect = (task: TaskCategory['tasks'][0]) => {
    onSelectItem({
      type: 'task',
      key: task.key,
      name: task.name,
      inputs: task.inputs,
    })
  }

  const handleUIPageSelect = (uiPage: UIPage) => {
    navigate(uiPage.url)
  }

  const renderTabs = () => (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'local' ? 'active' : ''}`}
        onClick={() => setActiveTab('local')}
      >
        Local Workflows
      </button>
      <button
        className={`tab ${activeTab === 'ui' ? 'active' : ''}`}
        onClick={() => setActiveTab('ui')}
      >
        UI
      </button>
      <button
        className={`tab ${activeTab === 'test' ? 'active' : ''}`}
        onClick={() => setActiveTab('test')}
      >
        Test Workflows
      </button>
      <button
        className={`tab ${activeTab === 'task' ? 'active' : ''}`}
        onClick={() => setActiveTab('task')}
      >
        Tasks
      </button>
    </div>
  )

  const renderWorkflows = (workflows: WorkflowCategory[]) => (
    <div className="list-container">
      <ul className="item-list">
        {workflows.flatMap((category) =>
          category.workflows.map((workflow) => (
            <li key={workflow.key} className="item" onClick={() => handleWorkflowSelect(workflow)}>
              <span className="item-name">{workflow.name}</span>
              <span className="item-info">{workflow.tasks.length} tasks</span>
            </li>
          )),
        )}
      </ul>
    </div>
  )

  const renderTasks = () => (
    <div className="list-container">
      {tasks.map((category) => (
        <div key={category.category} className="category">
          <h3 className="category-title">{category.category}</h3>
          <ul className="item-list">
            {category.tasks.map((task) => (
              <li key={task.key} className="item" onClick={() => handleTaskSelect(task)}>
                <span className="item-name">{task.name}</span>
                <span className="item-info">{task.inputs.length} inputs</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  const renderUIPages = () => (
    <div className="list-container">
      <ul className="item-list">
        {uiPages.map((uiPage) => (
          <li key={uiPage.url} className="item" onClick={() => handleUIPageSelect(uiPage)}>
            <span className="item-name">{uiPage.name}</span>
            <span className="item-info">→</span>
          </li>
        ))}
      </ul>
    </div>
  )

  if (loading) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  const renderContent = () => {
    switch (activeTab) {
      case 'local':
        return renderWorkflows(localWorkflows)
      case 'ui':
        return renderUIPages()
      case 'test':
        return renderWorkflows(testWorkflows)
      case 'task':
        return renderTasks()
    }
  }

  return (
    <div className="home-page">
      <h1>Workflow Manager</h1>
      {renderTabs()}
      {renderContent()}
    </div>
  )
}