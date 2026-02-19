import { createEffect } from 'solid-js'
import { Show, For } from 'solid-js'
import { homeStore, homeStoreActions } from '../stores/homeStore'
import { callPageStore, callPageStoreActions } from '../stores/callPageStore'
import { InputField } from './common/InputField'
import { ResultDisplay } from './common/ResultDisplay'
import './CallPage.css'

export const CallPage = () => {
  createEffect(() => {
    const item = homeStore.selectedItem
    if (!item) return

    callPageStoreActions.initializeItem(item)
    item.inputs.forEach((input) => {
      if (input.type === 'dropdown' && input.optionsApi) {
        callPageStoreActions.loadDropdownOptions(input)
      }
    })
  })

  return (
    <Show when={homeStore.selectedItem}>
      {(item) => (
        <div class="call-page">
          <button class="back-button" onClick={homeStoreActions.clearSelection}>
            ← Back
          </button>
          <h1>{item().name}</h1>
          <p class="item-type">
            {item().type === 'workflow' ? 'Workflow' : 'Task'}
          </p>

          <Show when={item().inputs.length > 0}>
            <div class="inputs-section">
              <h3>Inputs</h3>
              <For each={item().inputs}>
                {(input) => <InputField input={input} />}
              </For>
            </div>
          </Show>

          <button
            class="call-button"
            onClick={() => callPageStoreActions.handleCall(item().key)}
            disabled={callPageStore.loading}
          >
            {callPageStore.loading ? 'Running...' : 'Call'}
          </button>

          <Show when={callPageStore.error}>
            {(error) => <div class="error">{error()}</div>}
          </Show>

          <ResultDisplay />
        </div>
      )}
    </Show>
  )
}
