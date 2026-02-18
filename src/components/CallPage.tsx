/* eslint-disable */
import { createEffect } from 'solid-js'
import { callPageStore, callPageStoreActions } from '../stores/callPageStore'
import type { SelectedItem, TaskInput } from '../types/workflow'
import { FilePicker } from './FilePicker'
import './CallPage.css'

interface CallPageProps {
  item: SelectedItem
  onBack: () => void
}

export const CallPage = (props: CallPageProps) => {
  // Initialize the store when the item changes
  createEffect(() => {
    callPageStoreActions.initializeItem(props.item)
    
    // Load dropdown options for inputs with optionsApi
    props.item.inputs.forEach((input) => {
      if (input.type === 'dropdown' && input.optionsApi) {
        callPageStoreActions.loadDropdownOptions(input)
      }
    })
  })

  const handleCall = async () => {
    await callPageStoreActions.handleCall(props.item.key, props.item.inputs)
  }

  const renderDropdownField = (input: TaskInput) => {
    const value = callPageStore.inputs[input.name] || ''
    const inputId = `input-${input.name}`
    const options = callPageStore.dropdownOptions[input.name] || []
    const isLoading = callPageStore.loadingOptions[input.name]

    return (
      <div class="input-group">
        <label for={inputId}>
          {input.label}
          {input.required && <span class="required">*</span>}
        </label>
        {isLoading ? (
          <div class="loading-options">Loading options...</div>
        ) : (
          <select
            id={inputId}
            value={value}
            onChange={(e) => callPageStoreActions.handleInputChange(input.name, e.currentTarget.value)}
          >
            {options.length === 0 && <option value="">No options available</option>}
            {options.map((option) => (
              <option value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  const renderRadioField = (input: TaskInput) => {
    const value = callPageStore.inputs[input.name] || ''
    const options = input.options || []

    return (
      <div class="input-group">
        <label>
          {input.label}
          {input.required && <span class="required">*</span>}
        </label>
        <div class="radio-group">
          {options.map((option) => (
            <label class="radio-option">
              <input
                type="radio"
                name={input.name}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => callPageStoreActions.handleInputChange(input.name, e.currentTarget.value)}
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  const renderInputField = (input: TaskInput) => {
    const value = callPageStore.inputs[input.name] || ''
    const inputId = `input-${input.name}`

    if (input.type === 'dropdown') {
      return renderDropdownField(input)
    }

    if (input.type === 'radio') {
      return renderRadioField(input)
    }

    if (input.type === 'file') {
      return (
        <div class="input-group">
          <FilePicker
            value={value}
            onChange={(path) => callPageStoreActions.handleInputChange(input.name, path)}
            label={input.label}
            required={input.required}
            defaultFolder={input.defaultFolder}
          />
        </div>
      )
    }

    if (input.type === 'text') {
      return (
        <div class="input-group">
          <label for={inputId}>{input.label}</label>
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => callPageStoreActions.handleInputChange(input.name, e.currentTarget.value)}
            placeholder={input.label}
            rows={4}
          />
        </div>
      )
    }

    return (
      <div class="input-group">
        <label for={inputId}>
          {input.label}
          {input.required && <span class="required">*</span>}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => callPageStoreActions.handleInputChange(input.name, e.currentTarget.value)}
          placeholder={input.label}
        />
      </div>
    )
  }

  const renderResult = () => {
    const resultValue = callPageStore.result
    if (!resultValue) return null
    return (
      <div class="result-container">
        <h3>Result</h3>
        <pre class="result">{JSON.stringify(resultValue, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div class="call-page">
      <button class="back-button" onClick={props.onBack}>
        ← Back
      </button>
      <h1>{props.item.name}</h1>
      <p class="item-type">{props.item.type === 'workflow' ? 'Workflow' : 'Task'}</p>

      {props.item.inputs.length > 0 && (
        <div class="inputs-section">
          <h3>Inputs</h3>
          {props.item.inputs.map(renderInputField)}
        </div>
      )}

      <button class="call-button" onClick={handleCall} disabled={callPageStore.loading}>
        {callPageStore.loading ? 'Running...' : 'Call'}
      </button>

      {callPageStore.error && <div class="error">{callPageStore.error}</div>}
      {renderResult()}
    </div>
  )
}