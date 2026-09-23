import React from 'react'
import ReactDOM from 'react-dom/client'
import HarnessDashboard from './features/harness/HarnessDashboard'
import { exampleInventory } from './features/harness/example'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HarnessDashboard inventory={exampleInventory} /></React.StrictMode>)
