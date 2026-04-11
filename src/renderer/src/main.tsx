import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DataProvider } from './lib/DataProvider'
import { SessionEventsProvider } from './lib/SessionEventsProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataProvider>
      <SessionEventsProvider>
        <App />
      </SessionEventsProvider>
    </DataProvider>
  </React.StrictMode>
)
