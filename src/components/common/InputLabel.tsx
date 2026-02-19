import { Show } from 'solid-js'

interface InputLabelProps {
  label: string
  required?: boolean
  for?: string
}

export const InputLabel = (props: InputLabelProps) => (
  <label for={props.for}>
    {props.label}
    <Show when={props.required}>
      <span class="required">*</span>
    </Show>
  </label>
)
