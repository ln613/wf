import { createStore } from 'solid-js/store';
import { runWorkflow, runTask } from '../utils/api'
import type { SelectedItem, TaskInput } from '../types/workflow'

export interface CallPageStoreState {
  inputs: Record<string, string>;
  result: unknown;
  loading: boolean;
  error: string | null;
  dropdownOptions: Record<string, string[]>;
  loadingOptions: Record<string, boolean>;
}

const getInitialState = (): CallPageStoreState => ({
  inputs: {},
  result: null,
  loading: false,
  error: null,
  dropdownOptions: {},
  loadingOptions: {},
})

export const [callPageStore, setCallPageStore] = createStore<CallPageStoreState>(getInitialState())

export const callPageStoreActions = {
  initializeItem: (item: SelectedItem) => {
    // Set default values based on item inputs
    const newInputs: Record<string, string> = {};
    
    item.inputs.forEach((input) => {
      // Set default value for radio buttons
      if (input.type === 'radio' && input.options && input.options.length > 0) {
        const defaultValue = input.default || input.options[0].value;
        if (!callPageStore.inputs[input.name]) {
          newInputs[input.name] = defaultValue;
        }
      }
      // Set default value for string/text inputs
      if ((input.type === 'string' || input.type === 'text' || !input.type) && input.default) {
        if (!callPageStore.inputs[input.name]) {
          newInputs[input.name] = input.default;
        }
      }
    });

    if (Object.keys(newInputs).length > 0) {
      setCallPageStore('inputs', prev => ({ ...prev, ...newInputs }));
    }
  },

  loadDropdownOptions: async (input: TaskInput) => {
    if (!input.optionsApi) return;

    const taskNameMap: Record<string, string> = {
      ollamaList: 'Ollama List',
    };

    const taskName = taskNameMap[input.optionsApi] || input.optionsApi;
    setCallPageStore('loadingOptions', input.name, true);

    try {
      const options = await runTask(taskName);
      const optionsList = Array.isArray(options) ? options : [];
      setCallPageStore('dropdownOptions', input.name, optionsList);

      // Set default value if available
      if (optionsList.length > 0) {
        const defaultValue = input.default
          ? optionsList.find((opt) => opt.includes(input.default!)) || optionsList[0]
          : optionsList[0];
        
        if (!callPageStore.inputs[input.name]) {
          setCallPageStore('inputs', input.name, defaultValue);
        }
      }
    } catch (err) {
      console.error(`Failed to load options for ${input.name}:`, err);
      setCallPageStore('dropdownOptions', input.name, []);
    } finally {
      setCallPageStore('loadingOptions', input.name, false);
    }
  },

  handleInputChange: (name: string, value: string) => {
    setCallPageStore('inputs', name, value);
  },

  handleCall: async (itemKey: string) => {
    try {
      setCallPageStore({ loading: true, error: null, result: null });
      const response = await runWorkflow(itemKey, callPageStore.inputs);
      setCallPageStore({ result: response, loading: false });
    } catch (err) {
      setCallPageStore({
        error: err instanceof Error ? err.message : 'Failed to execute',
        loading: false,
      });
    }
  },

  reset: () => {
    setCallPageStore(getInitialState())
  },
};