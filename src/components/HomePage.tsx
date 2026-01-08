import { useState, useEffect } from 'react'
import { getWorkflows, getTasks } from '../utils/api'
import type { WorkflowCategory, TaskCategory, SelectedItem, ItemType } from '../types/workflow'
import './HomePage.css'

interface HomePageProps {
  onSelectItem: (item: SelectedItem) => void
}

export const HomePage = ({ onSelectItem }: HomePageProps) => {
  const [activeTab, setActiveTab] = useState<ItemType>('workflow')
  const [workflows, setWorkflows] = useState<WorkflowCategory[]>([])
  const [tasks, setTasks] = useState<TaskCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [workflowData, taskData] = await Promise.all([getWorkflows(), getTasks()])
      setWorkflows(workflowData)
      setTasks(taskData)
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

  const renderTabs = () => (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'workflow' ? 'active' : ''}`}
        onClick={() => setActiveTab('workflow')}
      >
        Workflows
      </button>
      <button
        className={`tab ${activeTab === 'task' ? 'active' : ''}`}
        onClick={() => setActiveTab('task')}
      >
        Tasks
      </button>
    </div>
  )

  const renderWorkflows = () => (
    <div className="list-container">
      {workflows.map((category) => (
        <div key={category.category} className="category">
          <h3 className="category-title">{category.category}</h3>
          <ul className="item-list">
            {category.workflows.map((workflow) => (
              <li key={workflow.key} className="item" onClick={() => handleWorkflowSelect(workflow)}>
                <span className="item-name">{workflow.name}</span>
                <span className="item-info">{workflow.tasks.length} tasks</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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

  if (loading) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="home-page">
      <h1>Workflow Manager</h1>
      {renderTabs()}
      {activeTab === 'workflow' ? renderWorkflows() : renderTasks()}
    </div>
  )
}