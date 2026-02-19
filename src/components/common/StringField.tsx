import { callPageStore, callPageStoreActions } from '../../stores/callPageStore'
import { InputLabel } from './InputLabel'
import type { TaskInput } from '../../types/workflow'

interface StringFieldProps {
  input: TaskInput
}

export const StringField = (props: StringFieldProps) => (
  <div class="input-group">
    <InputLabel
      label={props.input.label}
      required={props.input.required}
      for={`input-${props.input.name}`}
    />
    <input
      id={`input-${props.input.name}`}
      type="text"
      value={callPageStore.inputs[props.input.name] || ''}
      onChange={(e) =>
        callPageStoreActions.handleInputChange(
          props.input.name,
          e.currentTarget.value,
        )
      }
      placeholder={props.input.label}
    />
  </div>
)
