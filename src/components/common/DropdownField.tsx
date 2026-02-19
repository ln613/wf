import { Show, For } from 'solid-js'
import { callPageStore, callPageStoreActions } from '../../stores/callPageStore'
import { InputLabel } from './InputLabel'
import type { TaskInput } from '../../types/workflow'

interface DropdownFieldProps {
  input: TaskInput
}

export const DropdownField = (props: DropdownFieldProps) => (
  <div class="input-group">
    <InputLabel
      label={props.input.label}
      required={props.input.required}
      for={`input-${props.input.name}`}
    />
    <Show
      when={!callPageStore.loadingOptions[props.input.name]}
      fallback={<div class="loading-options">Loading options...</div>}
    >
      <select
        id={`input-${props.input.name}`}
        value={callPageStore.inputs[props.input.name] || ''}
        onChange={(e) =>
          callPageStoreActions.handleInputChange(
            props.input.name,
            e.currentTarget.value,
          )
        }
      >
        <Show when={(callPageStore.dropdownOptions[props.input.name] || []).length === 0}>
          <option value="">No options available</option>
        </Show>
        <For each={callPageStore.dropdownOptions[props.input.name] || []}>
          {(option) => <option value={option}>{option}</option>}
        </For>
      </select>
    </Show>
  </div>
)
