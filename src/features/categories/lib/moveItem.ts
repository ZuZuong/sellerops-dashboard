/** Đổi chỗ phần tử `index` với phần tử kế bên theo `direction` (ở biên thì giữ nguyên). */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(index, 1)
  if (item !== undefined) next.splice(target, 0, item)
  return next
}
