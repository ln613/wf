/* eslint-disable */
import { onMount } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { homeStore, homeStoreActions } from '../stores/homeStore'
import type { UIPage, WorkflowCategory, TaskCategory, TaskDefinition, WorkflowDefinition } from '../types/workflow'
import './HomePage.css'

export const HomePage = () => {
  const navigate = useNavigate()

  onMount(() => {
    homeStoreActions.loadData()
  })

  const handleWorkflowSelect = (workflow: WorkflowDefinition) => {
    homeStoreActions.selectItem({
      type: 'workflow',
      key: workflow.key,
      name: workflow.name,
      inputs: workflow.inputs || [],
    })
  }

  const handleTaskSelect = (task: TaskDefinition) => {
    homeStoreActions.selectItem({
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
    <div class="tabs">
      <button
        class={`tab ${homeStore.activeTab === 'local' ? 'active' : ''}`}
        onClick={() => homeStoreActions.setActiveTab('local')}
      >
        Local Workflows
      </button>
      <button
        class={`tab ${homeStore.activeTab === 'ui' ? 'active' : ''}`}
        onClick={() => homeStoreActions.setActiveTab('ui')}
      >
        UI
      </button>
      <button
        class={`tab ${homeStore.activeTab === 'test' ? 'active' : ''}`}
        onClick={() => homeStoreActions.setActiveTab('test')}
      >
        Test Workflows
      </button>
      <button
        class={`tab ${homeStore.activeTab === 'task' ? 'active' : ''}`}
        onClick={() => homeStoreActions.setActiveTab('task')}
      >
        Tasks
      </button>
    </div>
  )

  const renderWorkflows = (workflows: WorkflowCategory[]) => (
    <div class="list-container">
      <ul class="item-list">
        {workflows.flatMap((category) =>
          category.workflows.map((workflow) => (
            <li class="item" onClick={() => handleWorkflowSelect(workflow)}>
              <span class="item-name">{workflow.name}</span>
              <span class="item-info">{workflow.tasks.length} tasks</span>
            </li>
          )),
        )}
      </ul>
    </div>
  )

  const renderTasks = () => (
    <div class="list-container">
      {homeStore.tasks.map((category) => (
        <div class="category">
          <h3 class="category-title">{category.category}</h3>
          <ul class="item-list">
            {category.tasks.map((task) => (
              <li class="item" onClick={() => handleTaskSelect(task)}>
                <span class="item-name">{task.name}</span>
                <span class="item-info">{task.inputs.length} inputs</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  const renderUIPages = () => (
    <div class="list-container">
      <ul class="item-list">
        {homeStore.uiPages.map((uiPage) => (
          <li class="item" onClick={() => handleUIPageSelect(uiPage)}>
            <span class="item-name">{uiPage.name}</span>
            <span class="item-info">→</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const renderContent = () => {
    if (homeStore.loading) {
      return <div class="loading">Loading...</div>
    }

    if (homeStore.error) {
      return <div class="error">{homeStore.error}</div>
    }

    switch (homeStore.activeTab) {
      case 'local':
        return renderWorkflows(homeStore.localWorkflows)
      case 'ui':
        return renderUIPages()
      case 'test':
        return renderWorkflows(homeStore.testWorkflows)
      case 'task':
        return renderTasks()
    }
  }

  return (
    <div class="home-page">
      <h1>Workflow Manager</h1>
      {renderTabs()}
      {renderContent()}
    </div>
  )
}