import type { Bill, Product } from './model'

type Workspace = { products: Product[]; bills: Bill[] }
const key = 'spark-workspace-v2'
// The first version seeded these IDs. User-created items use UUIDs and are retained.
const oldSampleNames: Record<string, string> = {
  p1: 'Electric Sparklers', p2: 'Flower Pots Deluxe', p3: 'Ground Chakkar Big',
  p4: 'Rocket Bomb', p5: '100 Wala Garland', p6: 'Celebration Gift Box',
  p7: 'Colour Sparklers', p8: 'Flower Pots Special',
}
export function loadWorkspace(storage: Pick<Storage, 'getItem'> = localStorage): Workspace {
  const read = <T,>(name: string, fallback: T): T => {
    try { return JSON.parse(storage.getItem(name) || 'null') ?? fallback } catch { return fallback }
  }
  const saved = read<Workspace | null>(key, null)
  if (saved && Array.isArray(saved.products) && Array.isArray(saved.bills)) return saved
  const oldProducts = read<Product[]>('spark-stock', [])
  return {
    products: Array.isArray(oldProducts) ? oldProducts.filter(p => oldSampleNames[p.id] !== p.name || Boolean(p.imageData)) : [],
    bills: read<Bill[]>('spark-bills', []),
  }
}
export function saveWorkspace(products: Product[], bills: Bill[]) {
  // One storage write keeps the bill and stock together if the device is full.
  localStorage.setItem(key, JSON.stringify({ products, bills }))
}
