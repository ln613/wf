import { For } from 'solid-js'
import { callPageStore, callPageStoreActions } from '../../stores/callPageStore'
import { InputLabel } from './InputLabel'
import type { TaskInput } from '../../types/workflow'

interface RadioFieldProps {
  input: TaskInput
}

export const RadioField = (props: RadioFieldProps) => (
  <div class="input-group">
    <InputLabel label={props.input.label} required={props.input.required} />
    <div class="radio-group">
      <For each={props.input.options || []}>
        {(option) => (
          <label class="radio-option">
            <input
              type="radio"
              name={props.input.name}
              value={option.value}
              checked={
                (callPageStore.inputs[props.input.name] || '') === option.value
              }
              onChange={(e) =>
                callPageStoreActions.handleInputChange(
                  props.input.name,
                  e.currentTarget.value,
                )
              }
            />
            <span>{option.text}</span>
          </label>
        )}
      </For>
    </div>
  </div>
)
