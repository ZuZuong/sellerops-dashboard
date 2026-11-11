import { notifications } from '@mantine/notifications'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { productKeys } from '@/features/products'
import { formatNumber } from '@/shared/lib/formatters'
import { getInventoryErrorMessage } from '../lib/inventoryLib'
import type { InventoryFilters } from '../schemas/inventoryFilters.schema'
import {
  buildAdjustNote,
  computeStockDelta,
  type StockAdjustValues,
} from '../schemas/stockAdjust.schema'
import type { InventoryItem } from '../types'
import {
  adjustStock,
  fetchInventory,
  fetchInventorySummary,
  fetchStockMovements,
} from './inventory.api'

/**
 * Dữ liệu kho chính là dữ liệu sản phẩm → key nằm dưới `productKeys.all`. Mọi thao tác đã
 * invalidate sản phẩm (sửa nhanh tồn kho, xác nhận / hủy đơn...) tự làm mới trang Kho hàng.
 */
export const inventoryKeys = {
  all: [...productKeys.all, 'inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (filters: InventoryFilters) => [...inventoryKeys.lists(), filters] as const,
  summary: () => [...inventoryKeys.all, 'summary'] as const,
  movements: (productId: string, page: number, pageSize: number) =>
    [...inventoryKeys.all, 'movements', productId, page, pageSize] as const,
}

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => fetchInventory(filters),
    placeholderData: keepPreviousData,
  })
}

export function useInventorySummary() {
  return useQuery({ queryKey: inventoryKeys.summary(), queryFn: fetchInventorySummary })
}

export function useStockMovements(productId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: inventoryKeys.movements(productId, page, pageSize),
    queryFn: () => fetchStockMovements(productId, page, pageSize),
    placeholderData: keepPreviousData,
  })
}

export interface AdjustStockVariables {
  product: Pick<InventoryItem, 'id' | 'name' | 'stock'>
  values: StockAdjustValues
}

export function useAdjustStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, values }: AdjustStockVariables) =>
      adjustStock(
        product.id,
        computeStockDelta(values.type, values.quantity, product.stock),
        buildAdjustNote(values.type, values.note),
      ),
    onSuccess: (newStock, { product }) => {
      notifications.show({
        color: 'green',
        title: 'Đã cập nhật tồn kho',
        message: `${product.name}: ${formatNumber(product.stock)} → ${formatNumber(newStock)}`,
      })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không cập nhật được tồn kho',
        message: getInventoryErrorMessage(error),
      })
    },
    // Lỗi cũng làm mới: tồn kho thật trên server có thể đã khác số đang hiển thị.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}
