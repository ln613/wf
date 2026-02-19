import { onMount, For, Switch, Match } from 'solid-js'
import type { Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useNavigate } from '@solidjs/router'
import {
  homeStore,
  homeStoreActions,
  homeDerived,
  tabs,
} from '../stores/homeStore'
import type { TabType } from '../types/workflow'
import './HomePage.css'

const TabBar = () => (
  <div class="tabs">
    <For each={tabs}>
      {(tab) => (
        <button
          class={`tab ${homeStore.activeTab === tab.key ? 'active' : ''}`}
          onClick={() => homeStoreActions.setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      )}
    </For>
  </div>
)

const WorkflowList = () => (
  <div class="list-container">
    <ul class="item-list">
      <For each={homeDerived.activeWorkflows()}>
        {(category) => (
          <For each={category.workflows}>
            {(workflow) => (
              <li
                class="item"
                onClick={() => homeStoreActions.selectWorkflow(workflow)}
              >
                <span class="item-name">{workflow.name}</span>
                <span class="item-info">{workflow.tasks.length} tasks</span>
              </li>
            )}
          </For>
        )}
      </For>
    </ul>
  </div>
)

const TaskList = () => (
  <div class="list-container">
    <For each={homeStore.tasks}>
      {(category) => (
        <div class="category">
          <h3 class="category-title">{category.category}</h3>
          <ul class="item-list">
            <For each={category.tasks}>
              {(task) => (
                <li
                  class="item"
                  onClick={() => homeStoreActions.selectTask(task)}
                >
                  <span class="item-name">{task.name}</span>
                  <span class="item-info">{task.inputs.length} inputs</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      )}
    </For>
  </div>
)

const UIPageList = () => {
  const navigate = useNavigate()

  return (
    <div class="list-container">
      <ul class="item-list">
        <For each={homeStore.uiPages}>
          {(uiPage) => (
            <li class="item" onClick={() => navigate(uiPage.url)}>
              <span class="item-name">{uiPage.name}</span>
              <span class="item-info">→</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}

const tabComponents: Record<TabType, Component> = {
  local: WorkflowList,
  test: WorkflowList,
  ui: UIPageList,
  task: TaskList,
}

const HomeContent = () => (
  <Switch>
    <Match when={homeStore.loading}>
      <div class="loading">Loading...</div>
    </Match>
    <Match when={homeStore.error}>
      <div class="error">{homeStore.error}</div>
    </Match>
    <Match when={true}>
      <Dynamic component={tabComponents[homeStore.activeTab]} />
    </Match>
  </Switch>
)

export const HomePage = () => {
  onMount(() => {
    homeStoreActions.loadData()
  })

  return (
    <div class="home-page">
      <h1>Workflow Manager</h1>
      <TabBar />
      <HomeContent />
    </div>
  )
}
