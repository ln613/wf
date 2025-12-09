import { useState } from 'react'
import './App.css'
import { HomePage } from './components/HomePage'
import { CallPage } from './components/CallPage'
import type { SelectedItem } from './types/workflow'

function App() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)

  const handleSelectItem = (item: SelectedItem) => {
    setSelectedItem(item)
  }

  const handleBack = () => {
    setSelectedItem(null)
  }

  return (
    <div className="app">
      {selectedItem ? (
        <CallPage item={selectedItem} onBack={handleBack} />
      ) : (
        <HomePage onSelectItem={handleSelectItem} />
      )}
    </div>
  )
}

export default App
