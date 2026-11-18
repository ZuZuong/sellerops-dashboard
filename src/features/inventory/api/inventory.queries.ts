import { notifications } from '@mantine/notifications'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { productKeys } from '@/features/products'
import { change, withChanges } from '@/shared/lib/activityChanges'
import { formatNumber } from '@/shared/lib/formatters'
import { getInventoryErrorMessage } from '../lib/inventoryLib'
import type { InventoryFilters } from '../schemas/inventoryFilters.schema'
import type { StocktakeScope } from '../schemas/stocktakeScope.schema'
import {
  ADJUST_TYPE_META,
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
  fetchStocktakeItems,
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
  stocktake: (scope: StocktakeScope) => [...inventoryKeys.all, 'stocktake', scope] as const,
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

/** Số liệu sổ sách cho biên bản kiểm kê — luôn lấy mới khi mở trang (không dùng cache cũ). */
export function useStocktakeItems(scope: StocktakeScope) {
  return useQuery({
    queryKey: inventoryKeys.stocktake(scope),
    queryFn: () => fetchStocktakeItems(scope),
    staleTime: 0,
    refetchOnMount: 'always',
  })
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
    onSuccess: (newStock, { product, values }) => {
      notifications.show({
        color: 'green',
        title: 'Đã cập nhật tồn kho',
        message: `${product.name}: ${formatNumber(product.stock)} → ${formatNumber(newStock)}`,
        ...withChanges([
          change('Tồn kho', formatNumber(product.stock), formatNumber(newStock)),
          change('Loại điều chỉnh', null, ADJUST_TYPE_META[values.type].label),
          change('Ghi chú', null, values.note),
        ]),
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
