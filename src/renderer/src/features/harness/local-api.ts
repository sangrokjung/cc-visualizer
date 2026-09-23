import { invoke } from '@tauri-apps/api/core'
import { InventorySchema, type Inventory } from './schema'

const pending = new Map<string, Promise<Inventory>>()
export const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export function openContactPage(): Promise<void> {
  return invoke<void>('open_ax_contact')
}
export function loadInventory(project: string, refresh = false): Promise<Inventory> {
  if (!isDesktop()) return Promise.reject(new Error('PC 수집은 데스크톱 앱에서 사용할 수 있습니다.'))
  const key = `${project}:${refresh}`
  const existing = pending.get(key)
  if (existing) return existing
  const promise = invoke<unknown>('load_harness_inventory', { project: project.trim() || null, refresh })
    .then(value => {
      const inventory = InventorySchema.parse(value)
      if (inventory.mode !== 'local') throw new Error('로컬 수집 응답이 아닙니다.')
      return inventory
    })
    .finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}
