import { useState } from 'react'
import { openFilePicker } from '../utils/api'
import './FilePicker.css'

interface FilePickerProps {
  value: string
  onChange: (path: string) => void
  label: string
  required?: boolean
  defaultFolder?: string
}

export const FilePicker = ({ value, onChange, label, required, defaultFolder }: FilePickerProps) => {
  const [loading, setLoading] = useState<'file' | 'folder' | null>(null)

  const handleBrowseFolder = async () => {
    setLoading('folder')
    try {
      const result = await openFilePicker('folder', defaultFolder)
      if (!result.cancelled && result.path) {
        onChange(result.path)
      }
    } catch (err) {
      console.error('Folder picker error:', err)
    } finally {
      setLoading(null)
    }
  }

  const handleBrowseFile = async () => {
    setLoading('file')
    try {
      const result = await openFilePicker('file', defaultFolder)
      if (!result.cancelled && result.path) {
        onChange(result.path)
      }
    } catch (err) {
      console.error('File picker error:', err)
    } finally {
      setLoading(null)
    }
  }

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="file-picker">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={handlePathChange}
        placeholder="Enter path or click Browse"
        className="file-picker-input"
      />
      <div className="file-picker-buttons">
        <button
          type="button"
          className="browse-button browse-folder"
          onClick={handleBrowseFolder}
          disabled={loading !== null}
        >
          {loading === 'folder' ? '...' : '📁 Folder'}
        </button>
        <button
          type="button"
          className="browse-button browse-file"
          onClick={handleBrowseFile}
          disabled={loading !== null}
        >
          {loading === 'file' ? '...' : '📄 File'}
        </button>
      </div>
    </div>
  )
}
