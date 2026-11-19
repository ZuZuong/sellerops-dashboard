import { Button, type ButtonProps } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useSignOut } from '../api/auth.queries'

/** Nút đăng xuất cho các màn hình chặn (tài khoản khóa, shop chưa duyệt…) để không bị kẹt. */
export function SignOutButton(props: Omit<ButtonProps, 'onClick' | 'loading'>) {
  const signOut = useSignOut()
  return (
    <Button
      variant="default"
      leftSection={<IconLogout size={16} aria-hidden />}
      {...props}
      loading={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      Đăng xuất
    </Button>
  )
}
