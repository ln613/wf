import { callPageStore, callPageStoreActions } from '../../stores/callPageStore'
import { InputLabel } from './InputLabel'
import type { TaskInput } from '../../types/workflow'

interface TextFieldProps {
  input: TaskInput
}

export const TextField = (props: TextFieldProps) => (
  <div class="input-group">
    <InputLabel label={props.input.label} for={`input-${props.input.name}`} />
    <textarea
      id={`input-${props.input.name}`}
      value={callPageStore.inputs[props.input.name] || ''}
      onChange={(e) =>
        callPageStoreActions.handleInputChange(
          props.input.name,
          e.currentTarget.value,
        )
      }
      placeholder={props.input.label}
      rows={props.input.rows || 4}
    />
  </div>
)
