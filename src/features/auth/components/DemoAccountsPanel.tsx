import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconPlayerPlay } from '@tabler/icons-react'
import { DEMO_ACCOUNTS } from '@/shared/lib/demo/demoSession'

interface DemoAccountsPanelProps {
  disabled: boolean
  onSignIn: (username: string, password: string) => void
}

const ROLE_LABEL = { admin: 'Quản trị', seller: 'Người bán' } as const

/**
 * Tài khoản dùng thử: chạy hoàn toàn trên trình duyệt, không ghi vào database. Dữ liệu mẫu sống
 * trong tab hiện tại, đóng tab là đặt lại từ đầu.
 */
export function DemoAccountsPanel({ disabled, onSignIn }: DemoAccountsPanelProps) {
  return (
    <Paper withBorder radius="md" p="sm" aria-labelledby="demo-accounts-title">
      <Stack gap="xs">
        <div>
          <Text id="demo-accounts-title" fw={600} size="sm">
            Tài khoản dùng thử
          </Text>
          <Text size="xs" c="dimmed">
            Dữ liệu mẫu chỉ lưu trong tab này, không ghi vào hệ thống. Đóng tab là đặt lại.
          </Text>
        </div>
        {DEMO_ACCOUNTS.map((account) => (
          <Group key={account.username} justify="space-between" wrap="nowrap" gap="xs">
            <div style={{ minWidth: 0 }}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm" ff="monospace">
                  {account.username}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={account.role === 'admin' ? 'grape' : 'teal'}
                >
                  {ROLE_LABEL[account.role]}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" ff="monospace">
                MK: {account.password}
              </Text>
            </div>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlayerPlay size={14} aria-hidden />}
              disabled={disabled}
              onClick={() => onSignIn(account.username, account.password)}
              aria-label={`Đăng nhập tài khoản dùng thử ${ROLE_LABEL[account.role]}`}
            >
              Dùng thử
            </Button>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
