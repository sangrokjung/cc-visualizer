import { contextBridge, ipcRenderer } from 'electron'

export type ElectronAPI = {
  readFile: (path: string) => Promise<{ ok: boolean; content?: string; error?: string }>
  listDir: (path: string) => Promise<{ ok: boolean; files?: string[]; error?: string }>
  getSystemPaths: () => Promise<Record<string, string>>
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => void
  removeFileChangedListener: () => void
  onSessionEvent: (callback: (event: any) => void) => void
  removeSessionEventListener: () => void
  onSessionId: (callback: (id: string) => void) => void
  rescanSystem: () => Promise<{ ok: boolean; data?: any; error?: string }>
  rescanUsage: () => Promise<{ ok: boolean; data?: any; error?: string }>
}

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  listDir: (path: string) => ipcRenderer.invoke('list-dir', path),
  getSystemPaths: () => ipcRenderer.invoke('get-system-paths'),
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => {
    ipcRenderer.on('file-changed', (_event, data) => callback(data))
  },
  removeFileChangedListener: () => {
    ipcRenderer.removeAllListeners('file-changed')
  },
  onSessionEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('session-event', (_event, data) => callback(data))
  },
  removeSessionEventListener: () => {
    ipcRenderer.removeAllListeners('session-event')
  },
  onSessionId: (callback: (id: string) => void) => {
    ipcRenderer.on('session-id', (_event, id) => callback(id))
  },
  rescanSystem: () => ipcRenderer.invoke('rescan-system'),
  rescanUsage: () => ipcRenderer.invoke('rescan-usage')
} satisfies ElectronAPI)
