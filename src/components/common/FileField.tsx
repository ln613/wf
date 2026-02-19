import { callPageStore, callPageStoreActions } from '../../stores/callPageStore'
import { FilePicker } from '../FilePicker'
import type { TaskInput } from '../../types/workflow'

interface FileFieldProps {
  input: TaskInput
}

export const FileField = (props: FileFieldProps) => (
  <div class="input-group">
    <FilePicker
      value={callPageStore.inputs[props.input.name] || ''}
      onChange={(path) =>
        callPageStoreActions.handleInputChange(props.input.name, path)
      }
      label={props.input.label}
      required={props.input.required}
      defaultFolder={props.input.defaultFolder}
    />
  </div>
)
