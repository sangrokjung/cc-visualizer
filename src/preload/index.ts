import { contextBridge, ipcRenderer } from 'electron'

export type ElectronAPI = {
  readFile: (path: string) => Promise<{ ok: boolean; content?: string; error?: string }>
  listDir: (path: string) => Promise<{ ok: boolean; files?: string[]; error?: string }>
  getSystemPaths: () => Promise<Record<string, string>>
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => void
  removeFileChangedListener: () => void
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
  }
} satisfies ElectronAPI)
