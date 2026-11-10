import { Button, type ButtonProps } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { ProductFormModal } from './ProductFormModal'

/** Nút "Thêm sản phẩm" tự quản lý modal tạo mới (dùng ở header trang và empty state). */
export function CreateProductButton(props: Pick<ButtonProps, 'size' | 'variant'>) {
  const [opened, { open, close }] = useDisclosure(false)
  return (
    <>
      <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={open} {...props}>
        Thêm sản phẩm
      </Button>
      <ProductFormModal opened={opened} onClose={close} />
    </>
  )
}
