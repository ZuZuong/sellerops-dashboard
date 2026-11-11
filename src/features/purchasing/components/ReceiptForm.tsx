import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Grid,
  Group,
  List,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react'
import { useRef, useState, type ReactNode } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from 'react-hook-form'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { todayKey } from '@/shared/lib/dates'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { vndToWords } from '@/shared/lib/vndWords'
import { useSaveReceipt } from '../api/purchases.queries'
import { lineAmount, receiptTotals, shortageQty, weightedAverageCost } from '../domain/costing'
import {
  EMPTY_RECEIPT_ITEM,
  hasReceivedGoods,
  MAX_RECEIPT_ITEMS,
  receiptSchema,
  type ReceiptFormInput,
  type ReceiptFormValues,
} from '../schemas/receipt.schema'
import type { ReceiptDetail } from '../types'
import { ReceiptProductPicker } from './ReceiptProductPicker'

function toFormInput(receipt: ReceiptDetail): ReceiptFormInput {
  return {
    supplier_name: receipt.supplier_name,
    supplier_phone: receipt.supplier_phone ?? '',
    invoice_number: receipt.invoice_number ?? '',
    delivered_by: receipt.delivered_by ?? '',
    received_date: receipt.received_date,
    note: receipt.note ?? '',
    items: receipt.items.map((item) => ({
      product: item.product,
      ordered_qty: item.ordered_qty,
      received_qty: item.received_qty,
      defective_qty: item.defective_qty,
      unit_cost: item.unit_cost,
      condition_note: item.condition_note ?? '',
    })),
  }
}

const emptyForm = (): ReceiptFormInput => ({
  supplier_name: '',
  supplier_phone: '',
  invoice_number: '',
  delivered_by: '',
  received_date: todayKey(),
  note: '',
  items: [EMPTY_RECEIPT_ITEM],
})

interface ReceiptFormProps {
  /** Phiếu nháp đang sửa; không truyền = tạo phiếu mới. */
  receipt?: ReceiptDetail
  onCancel: () => void
  onSaved: (id: string, posted: boolean) => void
  /** Nút phụ (vd. "Xóa nháp") đặt cạnh các nút lưu. */
  extraActions?: ReactNode
}

/**
 * Phiếu nhập kho dạng nháp. "Lưu nháp" chưa ảnh hưởng tồn kho; "Lưu & nhập kho" (có xác nhận)
 * cộng tồn SL thực nhận và cập nhật giá vốn bình quân — sau đó phiếu không sửa được.
 */
export function ReceiptForm({ receipt, onCancel, onSaved, extraActions }: ReceiptFormProps) {
  const save = useSaveReceipt()
  const [pendingPost, setPendingPost] = useState<ReceiptFormValues | null>(null)
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ReceiptFormInput, unknown, ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: receipt ? toFormInput(receipt) : emptyForm(),
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []
  const totals = receiptTotals(items)
  const selectedIds = new Set(items.flatMap((item) => (item?.product ? [item.product.id] : [])))

  const submit = (values: ReceiptFormValues, post: boolean) =>
    save.mutate(
      { id: receipt?.id ?? null, values, post },
      {
        onSuccess: (id) => {
          setPendingPost(null)
          onSaved(id, post)
        },
        onError: () => setPendingPost(null),
      },
    )

  const saveDraft = handleSubmit((values) => submit(values, false))
  const requestPost = handleSubmit((values) => {
    if (!hasReceivedGoods(values)) {
      setError('items', { message: 'Cần ít nhất một dòng có SL thực nhận > 0 để nhập kho' })
      return
    }
    setPendingPost(values)
  })

  /**
   * Ô "thực nhận" tự bằng "chứng từ − lỗi" (trường hợp phổ biến: nhận đủ hàng) cho tới khi người
   * dùng tự sửa ô đó (NCC giao thiếu) — từ đó không ghi đè nữa. Chế độ của mỗi dòng xác định ở lần
   * đồng bộ đầu tiên: phiếu nháp cũ có thực nhận ≠ chứng từ − lỗi được coi là đã sửa tay.
   */
  const receivedMode = useRef(new Map<string, 'auto' | 'manual'>())

  const syncReceived = (index: number, next: { ordered?: number; defective?: number }) => {
    const fieldId = fields[index]?.id
    if (!fieldId) return
    const item = getValues(`items.${index}`)
    let mode = receivedMode.current.get(fieldId)
    if (!mode) {
      const ordered = item.ordered_qty
      const fullyReceived =
        typeof ordered !== 'number' ||
        item.received_qty === Math.max(0, ordered - (item.defective_qty ?? 0))
      mode = fullyReceived ? 'auto' : 'manual'
      receivedMode.current.set(fieldId, mode)
    }
    if (mode === 'manual') return
    const ordered = next.ordered ?? item.ordered_qty ?? 0
    const defective = next.defective ?? item.defective_qty ?? 0
    setValue(`items.${index}.received_qty`, Math.max(0, ordered - defective))
  }

  const markReceivedManual = (index: number) => {
    const fieldId = fields[index]?.id
    if (fieldId) receivedMode.current.set(fieldId, 'manual')
  }

  const itemsError = errors.items?.message ?? errors.items?.root?.message

  return (
    <form onSubmit={(event) => void requestPost(event)} noValidate aria-label="Phiếu nhập kho">
      <Stack gap="lg">
        <Paper withBorder radius="md" p="md">
          <Title order={3} size="h5" mb="sm">
            Thông tin chứng từ
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <TextInput
              label="Nhà cung cấp"
              placeholder="VD: Công ty May Việt Tiến"
              withAsterisk
              data-autofocus
              error={errors.supplier_name?.message}
              {...register('supplier_name')}
            />
            <TextInput
              label="SĐT nhà cung cấp"
              type="tel"
              inputMode="tel"
              error={errors.supplier_phone?.message}
              {...register('supplier_phone')}
            />
            <TextInput
              label="Số hóa đơn / chứng từ"
              placeholder="VD: 0001234"
              error={errors.invoice_number?.message}
              {...register('invoice_number')}
            />
            <TextInput
              label="Người giao hàng"
              error={errors.delivered_by?.message}
              {...register('delivered_by')}
            />
            <TextInput
              label="Ngày nhập"
              type="date"
              withAsterisk
              max={todayKey()}
              error={errors.received_date?.message}
              {...register('received_date')}
            />
            <Textarea
              label="Ghi chú"
              autosize
              minRows={1}
              maxRows={4}
              error={errors.note?.message}
              {...register('note')}
            />
          </SimpleGrid>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Title order={3} size="h5">
              Hàng nhập
            </Title>
            <Text size="xs" c="dimmed">
              Hàng lỗi không nhập kho · Thành tiền = SL thực nhận × đơn giá
            </Text>
          </Group>
          <Stack gap="sm">
            {fields.map((field, index) => (
              <ReceiptItemRow
                key={field.id}
                index={index}
                control={control}
                item={items[index]}
                errors={errors.items?.[index]}
                excludeIds={selectedIds}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
                onProductPicked={(cost) => {
                  if (!getValues(`items.${index}.unit_cost`)) {
                    setValue(`items.${index}.unit_cost`, Math.round(cost))
                  }
                }}
                onOrderedChange={(ordered) => syncReceived(index, { ordered })}
                onDefectiveChange={(defective) => syncReceived(index, { defective })}
                onReceivedChange={() => markReceivedManual(index)}
              />
            ))}

            {itemsError && (
              <Text size="sm" c="red" role="alert">
                {itemsError}
              </Text>
            )}

            <Group>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} aria-hidden />}
                onClick={() => append(EMPTY_RECEIPT_ITEM)}
                disabled={fields.length >= MAX_RECEIPT_ITEMS}
              >
                Thêm dòng
              </Button>
            </Group>
          </Stack>

          <Divider my="md" />

          <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" verticalSpacing="xs">
              <TotalItem label="SL theo chứng từ" value={formatNumber(totals.ordered)} />
              <TotalItem label="Thực nhận (nhập kho)" value={formatNumber(totals.received)} />
              <TotalItem label="Hàng lỗi" value={formatNumber(totals.defective)} />
              <TotalItem label="Thiếu so với chứng từ" value={formatNumber(totals.shortage)} />
            </SimpleGrid>
            <Stack gap={0} align="flex-end">
              <Text size="sm" c="dimmed">
                Tổng tiền hàng
              </Text>
              <Text size="xl" fw={700} data-testid="receipt-total">
                {formatCurrency(totals.amount)}
              </Text>
              <Text size="xs" c="dimmed" fs="italic" ta="right" maw={360}>
                {vndToWords(totals.amount)}
              </Text>
            </Stack>
          </Group>
        </Paper>

        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm">{extraActions}</Group>
          <Group gap="sm" wrap="wrap">
            <Button variant="default" onClick={onCancel} disabled={save.isPending}>
              Quay lại
            </Button>
            <Button
              variant="light"
              onClick={() => void saveDraft()}
              loading={save.isPending && save.variables?.post === false}
              disabled={save.isPending}
            >
              Lưu nháp
            </Button>
            <Button type="submit" color="teal" disabled={save.isPending}>
              Lưu & nhập kho
            </Button>
          </Group>
        </Group>
      </Stack>

      <ConfirmDialog
        opened={pendingPost !== null}
        title="Nhập kho phiếu này?"
        color="teal"
        confirmLabel="Nhập kho"
        cancelLabel="Quay lại"
        loading={save.isPending}
        onClose={() => setPendingPost(null)}
        onConfirm={() => pendingPost && submit(pendingPost, true)}
        message={pendingPost ? <PostSummary values={pendingPost} /> : ''}
      />
    </form>
  )
}

function TotalItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Stack>
  )
}

function PostSummary({ values }: { values: ReceiptFormValues }) {
  const totals = receiptTotals(values.items)
  return (
    <Stack gap="xs">
      <Text size="sm">
        Kho sẽ được cộng <b>{formatNumber(totals.received)}</b> sản phẩm đạt, tiền hàng{' '}
        <b>{formatCurrency(totals.amount)}</b>. Giá vốn bình quân được tính lại theo đơn giá nhập.
      </Text>
      <List size="sm" spacing={2}>
        {values.items
          .filter((item) => item.received_qty > 0 && item.product)
          .map((item) => (
            <List.Item key={item.product?.id}>
              {item.product?.name}: +{formatNumber(item.received_qty)} {item.product?.unit} ×{' '}
              {formatCurrency(item.unit_cost)}
            </List.Item>
          ))}
      </List>
      {totals.defective > 0 && (
        <Text size="sm" c="orange.8">
          {formatNumber(totals.defective)} sản phẩm lỗi không nhập kho (chỉ ghi trên phiếu).
        </Text>
      )}
      <Text size="sm" c="dimmed">
        Sau khi nhập kho, phiếu không thể sửa hoặc xóa.
      </Text>
    </Stack>
  )
}

interface ReceiptItemRowProps {
  index: number
  control: Control<ReceiptFormInput, unknown, ReceiptFormValues>
  item: ReceiptFormInput['items'][number] | undefined
  errors: Partial<Record<keyof ReceiptFormInput['items'][number], { message?: string }>> | undefined
  excludeIds: ReadonlySet<string>
  canRemove: boolean
  onRemove: () => void
  onProductPicked: (costPrice: number) => void
  onOrderedChange: (value: number) => void
  onDefectiveChange: (value: number) => void
  onReceivedChange: () => void
}

function ReceiptItemRow({
  index,
  control,
  item,
  errors,
  excludeIds,
  canRemove,
  onRemove,
  onProductPicked,
  onOrderedChange,
  onDefectiveChange,
  onReceivedChange,
}: ReceiptItemRowProps) {
  const product = item?.product ?? null
  const received = item?.received_qty ?? 0
  const unitCost = item?.unit_cost ?? 0
  const shortage = item ? shortageQty(item) : 0
  const label = (name: string) => `${name} (dòng ${index + 1})`

  return (
    <Paper withBorder radius="md" p="sm" data-testid={`receipt-item-${index}`}>
      <Grid gap="sm" align="flex-start">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Controller
            control={control}
            name={`items.${index}.product`}
            render={({ field }) => (
              <ReceiptProductPicker
                label={`Sản phẩm ${index + 1}`}
                value={field.value ?? null}
                onChange={(next) => {
                  field.onChange(next)
                  if (next) onProductPicked(next.cost_price)
                }}
                onBlur={field.onBlur}
                excludeIds={excludeIds}
                error={errors?.product?.message}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 7, md: 3 }}>
          <NumberController
            control={control}
            name={`items.${index}.unit_cost`}
            label="Đơn giá nhập"
            ariaLabel={label('Đơn giá nhập')}
            suffix=" ₫"
            error={errors?.unit_cost?.message}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 5, md: 2 }}>
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Thành tiền
            </Text>
            <Text size="sm" py={7} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(lineAmount({ received_qty: received, unit_cost: unitCost }))}
            </Text>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 4, md: 2 }}>
          <NumberController
            control={control}
            name={`items.${index}.ordered_qty`}
            label="SL chứng từ"
            ariaLabel={label('SL theo chứng từ')}
            error={errors?.ordered_qty?.message}
            onValueChange={onOrderedChange}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 4, md: 2 }}>
          <NumberController
            control={control}
            name={`items.${index}.received_qty`}
            label="Thực nhận"
            ariaLabel={label('SL thực nhận')}
            error={errors?.received_qty?.message}
            onValueChange={onReceivedChange}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 4, md: 2 }}>
          <NumberController
            control={control}
            name={`items.${index}.defective_qty`}
            label="Lỗi"
            ariaLabel={label('SL lỗi')}
            error={errors?.defective_qty?.message}
            onValueChange={onDefectiveChange}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 10, md: 5 }}>
          <Controller
            control={control}
            name={`items.${index}.condition_note`}
            render={({ field }) => (
              <TextInput
                label="Tình trạng hàng"
                placeholder="VD: 2 áo bị lỗi đường may"
                aria-label={label('Tình trạng hàng')}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors?.condition_note?.message}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 2, md: 1 }}>
          <Group justify="flex-end" pt={26}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              aria-label={`Xóa dòng ${index + 1}`}
              onClick={onRemove}
              disabled={!canRemove}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        </Grid.Col>
      </Grid>

      {product && (
        <Text size="xs" c="dimmed" mt={6} data-testid={`receipt-item-${index}-preview`}>
          ĐVT {product.unit} · Tồn {formatNumber(product.stock)} →{' '}
          {formatNumber(product.stock + received)} · Giá vốn {formatCurrency(product.cost_price)} →{' '}
          {formatCurrency(
            weightedAverageCost(product.stock, product.cost_price, received, unitCost),
          )}
          {shortage > 0 && (
            <Text span inherit c="orange.8">
              {' '}
              · thiếu {formatNumber(shortage)} so với chứng từ
            </Text>
          )}
        </Text>
      )}
      {product && product.cost_price > 0 && unitCost > 0 && unitCost < product.cost_price / 2 && (
        <Alert
          mt={6}
          p={6}
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={14} aria-hidden />}
        >
          <Text size="xs">Đơn giá nhập thấp hơn nhiều so với giá vốn hiện tại — kiểm tra lại.</Text>
        </Alert>
      )}
    </Paper>
  )
}

interface NumberControllerProps {
  control: Control<ReceiptFormInput, unknown, ReceiptFormValues>
  name: FieldPath<ReceiptFormInput>
  label: string
  ariaLabel: string
  suffix?: string
  error?: string
  onValueChange?: (value: number) => void
}

/** Ô số nguyên không âm; ô trống → undefined để Zod báo "Nhập ...". */
function NumberController({
  control,
  name,
  label,
  ariaLabel,
  suffix,
  error,
  onValueChange,
}: NumberControllerProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberInput
          label={label}
          aria-label={ariaLabel}
          value={typeof field.value === 'number' ? field.value : ''}
          onChange={(value) => {
            const next = typeof value === 'number' ? value : undefined
            // Đồng bộ ô liên quan TRƯỚC khi ghi giá trị mới (so sánh với giá trị cũ).
            if (next !== undefined) onValueChange?.(next)
            field.onChange(next)
          }}
          onBlur={field.onBlur}
          ref={field.ref}
          min={0}
          allowNegative={false}
          allowDecimal={false}
          allowLeadingZeros={false}
          thousandSeparator="."
          decimalSeparator=","
          suffix={suffix}
          withAsterisk={!name.endsWith('defective_qty')}
          error={error}
        />
      )}
    />
  )
}
