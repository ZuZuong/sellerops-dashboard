import { Alert, Button, Group, Text } from '@mantine/core'
import { IconFlask } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { resetDemoDb } from '@/shared/lib/demo/demoDb'
import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { queryClient } from '@/shared/lib/queryClient'

/**
 * Nhắc người dùng đang ở chế độ dùng thử (ADR 011): dữ liệu là dữ liệu mẫu, chỉ sống trong tab.
 * Nút "Đặt lại" xóa mọi thay đổi trong tab và nạp lại bộ dữ liệu mẫu ban đầu.
 */
export function DemoModeBanner() {
  const [confirming, setConfirming] = useState(false)
  if (!isDemoMode()) return null

  const reset = () => {
    resetDemoDb()
    setConfirming(false)
    void queryClient.invalidateQueries()
  }

  return (
    <>
      <Alert
        color="yellow"
        variant="light"
        radius="md"
        mb="md"
        icon={<IconFlask size={18} aria-hidden />}
        role="status"
        py="xs"
      >
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Text size="sm">
            <b>Chế độ dùng thử</b> — dữ liệu mẫu chỉ lưu trong tab này, không ghi vào hệ thống. Đóng
            tab là đặt lại.
          </Text>
          <Button
            size="compact-sm"
            variant="subtle"
            color="yellow"
            onClick={() => setConfirming(true)}
          >
            Đặt lại dữ liệu mẫu
          </Button>
        </Group>
      </Alert>
      <ConfirmDialog
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={reset}
        title="Đặt lại dữ liệu mẫu?"
        message="Mọi thay đổi bạn đã làm trong tab này (đơn hàng, sản phẩm, duyệt hồ sơ…) sẽ bị xóa."
        confirmLabel="Đặt lại"
      />
    </>
  )
}
