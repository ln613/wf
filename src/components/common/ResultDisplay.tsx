import { Show } from 'solid-js'
import { callPageStore } from '../../stores/callPageStore'

export const ResultDisplay = () => (
  <Show when={callPageStore.result}>
    {(result) => (
      <div class="result-container">
        <h3>Result</h3>
        <pre class="result">{JSON.stringify(result(), null, 2)}</pre>
      </div>
    )}
  </Show>
)
