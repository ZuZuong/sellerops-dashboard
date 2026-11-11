import { Button, type ButtonProps } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { orderDetailPath } from '@/shared/constants/routes'
import { CreateOrderModal } from './CreateOrderModal'

/** Nút "Tạo đơn hàng" tự quản lý modal; tạo xong chuyển tới trang chi tiết đơn để xử lý tiếp. */
export function CreateOrderButton(props: Pick<ButtonProps, 'size' | 'variant'>) {
  const [opened, { open, close }] = useDisclosure(false)
  const navigate = useNavigate()
  return (
    <>
      <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={open} {...props}>
        Tạo đơn hàng
      </Button>
      <CreateOrderModal
        opened={opened}
        onClose={close}
        onCreated={(id) => void navigate(orderDetailPath(id))}
      />
    </>
  )
}
