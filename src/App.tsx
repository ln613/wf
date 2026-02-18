import { Show } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import './App.css'
import { HomePage } from './components/HomePage'
import { CallPage } from './components/CallPage'
import { PlayFolder } from './components/PlayFolder'
import { homeStore, homeStoreActions } from './stores/homeStore'

const MainContent = () => {
  return (
    <Show
      when={homeStore.selectedItem}
      fallback={<HomePage />}
    >
      {(item) => <CallPage item={item()} onBack={homeStoreActions.clearSelection} />}
    </Show>
  )
}

function App() {
  return (
    <div class="app">
      <Router>
        <Route path="/" component={MainContent} />
        <Route path="/play-folder" component={PlayFolder} />
      </Router>
    </div>
  )
}

export default App
