import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useCreateOrder } from '../api/orders.queries'
import { calcOrderTotal, lineTotal } from '../lib/orderTotal'
import {
  createOrderSchema,
  EMPTY_ORDER_FORM,
  EMPTY_ORDER_ITEM,
  MAX_ORDER_ITEMS,
  MAX_QUANTITY,
  type CreateOrderInput,
  type CreateOrderValues,
} from '../schemas/order.schema'
import { ProductPicker } from './ProductPicker'

interface CreateOrderModalProps {
  opened: boolean
  onClose: () => void
  /** Gọi với id đơn mới sau khi tạo thành công. */
  onCreated?: (orderId: string) => void
}

export function CreateOrderModal({ opened, onClose, onCreated }: CreateOrderModalProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Tạo đơn hàng"
      size="xl"
      fullScreen={isMobile}
      centered
    >
      {opened && (
        <CreateOrderForm
          onCancel={onClose}
          onCreated={(id) => {
            onClose()
            onCreated?.(id)
          }}
        />
      )}
    </Modal>
  )
}

interface CreateOrderFormProps {
  onCancel: () => void
  onCreated: (orderId: string) => void
}

export function CreateOrderForm({ onCancel, onCreated }: CreateOrderFormProps) {
  const createOrder = useCreateOrder()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrderInput, unknown, CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: EMPTY_ORDER_FORM,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []

  const lines = items.map((item) => ({ price: item?.product?.price, quantity: item?.quantity }))
  const total = calcOrderTotal(lines)
  const selectedIds = new Set(items.flatMap((item) => (item?.product ? [item.product.id] : [])))
  const overStock = items.filter(
    (item) => item?.product && item.quantity && item.quantity > item.product.stock,
  )

  const onSubmit = handleSubmit((values) => {
    createOrder.mutate(values, { onSuccess: (orderId) => onCreated(orderId) })
  })

  const itemsError = errors.items?.message ?? errors.items?.root?.message

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Tạo đơn hàng">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Tên khách hàng"
            placeholder="VD: Nguyễn Văn A"
            withAsterisk
            data-autofocus
            autoComplete="off"
            error={errors.customer_name?.message}
            {...register('customer_name')}
          />
          <TextInput
            label="Số điện thoại"
            placeholder="VD: 0901234567"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            error={errors.customer_phone?.message}
            {...register('customer_phone')}
          />
        </SimpleGrid>

        <Divider label="Sản phẩm" labelPosition="left" />

        <Stack gap="sm">
          {fields.map((field, index) => {
            const item = items[index]
            const product = item?.product ?? null
            const quantity = item?.quantity
            const itemErrors = errors.items?.[index]
            return (
              <Paper key={field.id} withBorder radius="md" p="sm">
                <Grid gap="sm" align="flex-start">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Controller
                      control={control}
                      name={`items.${index}.product`}
                      render={({ field: productField }) => (
                        <ProductPicker
                          label={`Sản phẩm ${index + 1}`}
                          value={productField.value ?? null}
                          onChange={productField.onChange}
                          onBlur={productField.onBlur}
                          excludeIds={selectedIds}
                          error={itemErrors?.product?.message}
                        />
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 5, sm: 2 }}>
                    <Controller
                      control={control}
                      name={`items.${index}.quantity`}
                      render={({ field: quantityField }) => (
                        <NumberInput
                          label="Số lượng"
                          aria-label={`Số lượng sản phẩm ${index + 1}`}
                          value={quantityField.value ?? ''}
                          onChange={(value) =>
                            quantityField.onChange(typeof value === 'number' ? value : undefined)
                          }
                          onBlur={quantityField.onBlur}
                          ref={quantityField.ref}
                          min={1}
                          max={MAX_QUANTITY}
                          allowNegative={false}
                          allowDecimal={false}
                          allowLeadingZeros={false}
                          thousandSeparator="."
                          decimalSeparator=","
                          withAsterisk
                          error={itemErrors?.quantity?.message}
                        />
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 5, sm: 3 }}>
                    <Stack gap={4}>
                      <Text size="sm" fw={500}>
                        Thành tiền
                      </Text>
                      <Text
                        size="sm"
                        py={7}
                        style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {formatCurrency(lineTotal({ price: product?.price, quantity }))}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 2, sm: 1 }}>
                    <Group justify="flex-end" pt={26}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        aria-label={`Xóa sản phẩm ${index + 1}`}
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  </Grid.Col>
                </Grid>
                {product && (
                  <Text
                    size="xs"
                    mt={4}
                    c={quantity && quantity > product.stock ? 'orange.8' : 'dimmed'}
                  >
                    {formatCurrency(product.price)} / sản phẩm · Tồn kho{' '}
                    {formatNumber(product.stock)}
                    {quantity && quantity > product.stock ? ' — vượt tồn kho hiện tại' : ''}
                  </Text>
                )}
              </Paper>
            )
          })}

          {itemsError && (
            <Text size="sm" c="red" role="alert">
              {itemsError}
            </Text>
          )}

          <Group>
            <Button
              variant="light"
              leftSection={<IconPlus size={16} aria-hidden />}
              onClick={() => append(EMPTY_ORDER_ITEM)}
              disabled={fields.length >= MAX_ORDER_ITEMS}
            >
              Thêm sản phẩm
            </Button>
          </Group>
        </Stack>

        {overStock.length > 0 && (
          <Alert
            color="orange"
            variant="light"
            icon={<IconAlertTriangle size={18} aria-hidden />}
            title="Có sản phẩm vượt tồn kho"
          >
            Đơn vẫn được tạo ở trạng thái chờ xác nhận, nhưng sẽ không xác nhận được cho tới khi
            nhập đủ hàng.
          </Alert>
        )}

        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Stack gap={0}>
            <Text size="sm" c="dimmed">
              Tạm tính
            </Text>
            <Text size="xl" fw={700} data-testid="order-total">
              {formatCurrency(total)}
            </Text>
            <Text size="xs" c="dimmed">
              Giá chốt theo giá bán tại thời điểm tạo đơn.
            </Text>
          </Stack>
          <Group gap="sm">
            <Button variant="default" onClick={onCancel} disabled={createOrder.isPending}>
              Hủy
            </Button>
            <Button type="submit" loading={createOrder.isPending}>
              Tạo đơn
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  )
}
