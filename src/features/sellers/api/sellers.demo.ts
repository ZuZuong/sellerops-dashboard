import { readDemoDb } from '@/shared/lib/demo/demoDb'
import type { Seller } from '../types'

export async function fetchOwnSeller(userId: string): Promise<Seller | null> {
  const db = await readDemoDb()
  return db.sellers.find((s) => s.owner_id === userId) ?? null
}
