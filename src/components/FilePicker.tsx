import { createSignal } from 'solid-js'
import { openFilePicker } from '../utils/api'
import './FilePicker.css'

interface FilePickerProps {
  value: string
  onChange: (path: string) => void
  label: string
  required?: boolean
  defaultFolder?: string
}

export const FilePicker = (props: FilePickerProps) => {
  const [loading, setLoading] = createSignal<'file' | 'folder' | null>(null)

  const handleBrowseFolder = async () => {
    setLoading('folder')
    try {
      const result = await openFilePicker('folder', props.defaultFolder)
      if (!result.cancelled && result.path) {
        props.onChange(result.path)
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
      const result = await openFilePicker('file', props.defaultFolder)
      if (!result.cancelled && result.path) {
        props.onChange(result.path)
      }
    } catch (err) {
      console.error('File picker error:', err)
    } finally {
      setLoading(null)
    }
  }

  const handlePathChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    props.onChange(target.value)
  }

  return (
    <div class="file-picker">
      <label>
        {props.label}
        {props.required && <span class="required">*</span>}
      </label>
      <input
        type="text"
        value={props.value}
        onInput={handlePathChange}
        placeholder="Enter path or click Browse"
        class="file-picker-input"
      />
      <div class="file-picker-buttons">
        <button
          type="button"
          class="browse-button browse-folder"
          onClick={handleBrowseFolder}
          disabled={loading() !== null}
        >
          {loading() === 'folder' ? '...' : '📁 Folder'}
        </button>
        <button
          type="button"
          class="browse-button browse-file"
          onClick={handleBrowseFile}
          disabled={loading() !== null}
        >
          {loading() === 'file' ? '...' : '📄 File'}
        </button>
      </div>
    </div>
  )
}
