import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { formatNumber } from '@/shared/lib/formatters'
import { useAdjustStock } from '../api/inventory.queries'
import {
  ADJUST_TYPE_META,
  ADJUST_TYPES,
  computeStockDelta,
  createStockAdjustSchema,
  MAX_NOTE,
  type AdjustType,
  type StockAdjustInput,
  type StockAdjustValues,
} from '../schemas/stockAdjust.schema'
import type { InventoryItem } from '../types'

interface StockAdjustModalProps {
  item: InventoryItem | null
  onClose: () => void
}

export function StockAdjustModal({ item, onClose }: StockAdjustModalProps) {
  return (
    <Modal opened={item !== null} onClose={onClose} title="Điều chỉnh tồn kho" centered>
      {/* key: mở sản phẩm khác → form khởi tạo lại */}
      {item && <StockAdjustForm key={item.id} item={item} onDone={onClose} />}
    </Modal>
  )
}

const TYPE_OPTIONS = ADJUST_TYPES.map((type) => ({
  value: type,
  label: ADJUST_TYPE_META[type].label,
}))

function isAdjustType(value: string): value is AdjustType {
  return (ADJUST_TYPES as readonly string[]).includes(value)
}

interface StockAdjustFormProps {
  item: InventoryItem
  onDone: () => void
}

/**
 * Form điều chỉnh kho thủ công. Chỉ gửi delta lên RPC `adjust_stock` — DB tự kiểm tra tồn kho
 * không âm và ghi `inventory_movements` (lý do `manual_adjust`, kèm ghi chú).
 */
export function StockAdjustForm({ item, onDone }: StockAdjustFormProps) {
  const adjust = useAdjustStock()
  const schema = useMemo(() => createStockAdjustSchema(item.stock), [item.stock])
  const {
    control,
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<StockAdjustInput, unknown, StockAdjustValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'import', note: '' },
  })
  const type = useWatch({ control, name: 'type' })
  const quantity = useWatch({ control, name: 'quantity' })

  const meta = ADJUST_TYPE_META[type]
  const nextStock =
    typeof quantity === 'number' ? item.stock + computeStockDelta(type, quantity, item.stock) : null

  const onSubmit = handleSubmit((values) => {
    adjust.mutate({ product: item, values }, { onSuccess: () => onDone() })
  })

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Điều chỉnh tồn kho">
      <Stack gap="md">
        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={500}>
            {item.name}
          </Text>
          <Text size="xs" c="dimmed">
            <Text span ff="monospace" inherit>
              {item.sku}
            </Text>{' '}
            · Tồn kho hiện tại: <b>{formatNumber(item.stock)}</b>
          </Text>
        </Paper>

        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Stack gap={4}>
              <Text size="sm" fw={500} id="adjust-type-label">
                Loại điều chỉnh
              </Text>
              <SegmentedControl
                aria-labelledby="adjust-type-label"
                data={TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => {
                  if (!isAdjustType(value)) return
                  field.onChange(value)
                  // Đổi loại → kiểm tra lại số lượng theo quy tắc mới (nếu đã từng submit).
                  if (isSubmitted) void trigger('quantity')
                }}
                fullWidth
              />
              <Text size="xs" c="dimmed">
                {meta.description}
              </Text>
            </Stack>
          )}
        />

        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <NumberInput
              label={meta.quantityLabel}
              placeholder="0"
              withAsterisk
              data-autofocus
              value={field.value ?? ''}
              onChange={(value) => field.onChange(typeof value === 'number' ? value : undefined)}
              onBlur={field.onBlur}
              ref={field.ref}
              min={0}
              allowNegative={false}
              allowDecimal={false}
              allowLeadingZeros={false}
              thousandSeparator="."
              decimalSeparator=","
              error={errors.quantity?.message}
            />
          )}
        />

        <Textarea
          label="Ghi chú"
          placeholder="VD: Nhập lô hàng từ nhà cung cấp A"
          autosize
          minRows={2}
          maxRows={4}
          maxLength={MAX_NOTE}
          error={errors.note?.message}
          {...register('note')}
        />

        <Text size="sm" aria-live="polite" data-testid="stock-preview">
          Tồn kho sau điều chỉnh:{' '}
          {nextStock === null ? (
            '—'
          ) : (
            <Text span fw={600} c={nextStock < 0 ? 'red' : undefined} inherit>
              {formatNumber(item.stock)} → {formatNumber(nextStock)}
            </Text>
          )}
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone} disabled={adjust.isPending}>
            Hủy
          </Button>
          <Button type="submit" loading={adjust.isPending}>
            Lưu điều chỉnh
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
