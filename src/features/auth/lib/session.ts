import { getSessionUser } from '../api/auth.api'

/** Id user của phiên hiện tại (không gọi mạng) — cho feature khác prefetch dữ liệu theo user. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null
}
