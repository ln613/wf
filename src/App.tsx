import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { HomePage } from './components/HomePage'
import { CallPage } from './components/CallPage'
import { PlayFolder } from './components/PlayFolder'
import type { SelectedItem } from './types/workflow'

const MainContent = () => {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)

  const handleSelectItem = (item: SelectedItem) => {
    setSelectedItem(item)
  }

  const handleBack = () => {
    setSelectedItem(null)
  }

  return selectedItem ? (
    <CallPage item={selectedItem} onBack={handleBack} />
  ) : (
    <HomePage onSelectItem={handleSelectItem} />
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<MainContent />} />
          <Route path="/play-folder" element={<PlayFolder />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
