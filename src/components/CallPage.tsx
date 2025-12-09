import { useState } from 'react'
import { runWorkflow } from '../utils/api'
import type { SelectedItem, TaskInput } from '../types/workflow'
import './CallPage.css'

interface CallPageProps {
  item: SelectedItem
  onBack: () => void
}

export const CallPage = ({ item, onBack }: CallPageProps) => {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const renderInputField = (input: TaskInput) => {
    const value = inputs[input.name] || ''
    const inputId = `input-${input.name}`

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