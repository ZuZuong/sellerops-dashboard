import { Avatar, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useSignOut } from '../api/auth.queries'
import { useCurrentUser } from '../hooks/useAuth'

export function UserMenu() {
  const user = useCurrentUser()
  const signOut = useSignOut()
  const email = user?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'

  return (
    <Menu position="bottom-end" width={240} shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label={`Tài khoản: ${email}`}>
          <Avatar color="blue" radius="xl" size={34}>
            {initial}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Đăng nhập với</Menu.Label>
        <Text size="sm" px="sm" pb="xs" truncate="end" title={email}>
          {email}
        </Text>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} aria-hidden />}
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          Đăng xuất
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
