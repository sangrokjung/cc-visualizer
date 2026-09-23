import App from '../../App'
import { DataProvider } from '../../lib/DataProvider'
import { SessionEventsProvider } from '../../lib/SessionEventsProvider'

export default function LegacyOperations() {
  return <DataProvider><SessionEventsProvider><App /></SessionEventsProvider></DataProvider>
}
