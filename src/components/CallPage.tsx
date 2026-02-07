import { useState, useEffect, useCallback } from 'react'
import { runWorkflow, runTask } from '../utils/api'
import type { SelectedItem, TaskInput } from '../types/workflow'
import { FilePicker } from './FilePicker'
import './CallPage.css'

interface CallPageProps {
  item: SelectedItem
  onBack: () => void
}

interface DropdownOptions {
  [inputName: string]: string[]
}

const taskNameMap: Record<string, string> = {
  ollamaList: 'Ollama List',
}

export const CallPage = ({ item, onBack }: CallPageProps) => {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({})
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({})

  const loadDropdownOptions = useCallback(async (input: TaskInput) => {
    if (!input.optionsApi) return

    const taskName = taskNameMap[input.optionsApi] || input.optionsApi
    setLoadingOptions((prev) => ({ ...prev, [input.name]: true }))

    try {
      const options = await runTask(taskName)
      const optionsList = Array.isArray(options) ? options : []
      setDropdownOptions((prev) => ({ ...prev, [input.name]: optionsList }))

      // Set default value if available
      if (optionsList.length > 0) {
        const defaultValue = input.default
          ? optionsList.find((opt) => opt.includes(input.default!)) || optionsList[0]
          : optionsList[0]
        setInputs((prev) => {
          if (!prev[input.name]) {
            return { ...prev, [input.name]: defaultValue }
          }
          return prev
        })
      }
    } catch (err) {
      console.error(`Failed to load options for ${input.name}:`, err)
      setDropdownOptions((prev) => ({ ...prev, [input.name]: [] }))
    } finally {
      setLoadingOptions((prev) => ({ ...prev, [input.name]: false }))
    }
  }, [])

  useEffect(() => {
    // Load dropdown options for inputs with optionsApi
    item.inputs.forEach((input) => {
      if (input.type === 'dropdown' && input.optionsApi) {
        loadDropdownOptions(input)
      }
      // Set default value for radio buttons
      if (input.type === 'radio' && input.options && input.options.length > 0) {
        const defaultValue = input.default || input.options[0].value
        setInputs((prev) => {
          if (!prev[input.name]) {
            return { ...prev, [input.name]: defaultValue }
          }
          return prev
        })
      }
      // Set default value for string/text inputs
      if ((input.type === 'string' || input.type === 'text' || !input.type) && input.default) {
        setInputs((prev) => {
          if (!prev[input.name]) {
            return { ...prev, [input.name]: input.default! }
          }
          return prev
        })
      }
    })
  }, [item.inputs, loadDropdownOptions])

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  const handleCall = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)
      const response = await runWorkflow(item.key, inputs)
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute')
    } finally {
      setLoading(false)
    }
  }

  const renderDropdownField = (input: TaskInput) => {
    const value = inputs[input.name] || ''
    const inputId = `input-${input.name}`
    const options = dropdownOptions[input.name] || []
    const isLoading = loadingOptions[input.name]

    return (
      <div key={input.name} className="input-group">
        <label htmlFor={inputId}>
          {input.label}
          {input.required && <span className="required">*</span>}
        </label>
        {isLoading ? (
          <div className="loading-options">Loading options...</div>
        ) : (
          <select
            id={inputId}
            value={value}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
          >
            {options.length === 0 && <option value="">No options available</option>}
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  const renderRadioField = (input: TaskInput) => {
    const value = inputs[input.name] || ''
    const options = input.options || []

    return (
      <div key={input.name} className="input-group">
        <label>
          {input.label}
          {input.required && <span className="required">*</span>}
        </label>
        <div className="radio-group">
          {options.map((option) => (
            <label key={option.value} className="radio-option">
              <input
                type="radio"
                name={input.name}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => handleInputChange(input.name, e.target.value)}
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  const renderInputField = (input: TaskInput) => {
    const value = inputs[input.name] || ''
    const inputId = `input-${input.name}`

    if (input.type === 'dropdown') {
      return renderDropdownField(input)
    }

    if (input.type === 'radio') {
      return renderRadioField(input)
    }

    if (input.type === 'file') {
      return (
        <div key={input.name} className="input-group">
          <FilePicker
            value={value}
            onChange={(path) => handleInputChange(input.name, path)}
            label={input.label}
            required={input.required}
            defaultFolder={input.defaultFolder}
          />
        </div>
      )
    }

    if (input.type === 'text') {
      return (
        <div key={input.name} className="input-group">
          <label htmlFor={inputId}>{input.label}</label>
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.label}
            rows={4}
          />
        </div>
      )
    }

    return (
      <div key={input.name} className="input-group">
        <label htmlFor={inputId}>
          {input.label}
          {input.required && <span className="required">*</span>}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(input.name, e.target.value)}
          placeholder={input.label}
        />
      </div>
    )
  }

  const renderResult = () => {
    if (!result) return null
    return (
      <div className="result-container">
        <h3>Result</h3>
        <pre className="result">{JSON.stringify(result, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="call-page">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h1>{item.name}</h1>
      <p className="item-type">{item.type === 'workflow' ? 'Workflow' : 'Task'}</p>

      {item.inputs.length > 0 && (
        <div className="inputs-section">
          <h3>Inputs</h3>
          {item.inputs.map(renderInputField)}
        </div>
      )}

      <button className="call-button" onClick={handleCall} disabled={loading}>
        {loading ? 'Running...' : 'Call'}
      </button>

      {error && <div className="error">{error}</div>}
      {renderResult()}
    </div>
  )
}