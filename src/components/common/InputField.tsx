import { Dynamic } from 'solid-js/web'
import { DropdownField } from './DropdownField'
import { RadioField } from './RadioField'
import { FileField } from './FileField'
import { TextField } from './TextField'
import { StringField } from './StringField'
import type { Component } from 'solid-js'
import type { TaskInput } from '../../types/workflow'

interface InputFieldProps {
  input: TaskInput
}

const fieldComponents: Record<string, Component<InputFieldProps>> = {
  dropdown: DropdownField,
  radio: RadioField,
  file: FileField,
  text: TextField,
}

export const InputField = (props: InputFieldProps) => (
  <Dynamic
    component={fieldComponents[props.input.type] || StringField}
    input={props.input}
  />
)
