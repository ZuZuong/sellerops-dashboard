import { createTheme, Notification } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily:
    'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
  cursorType: 'pointer',
  components: {
    // Nội dung thông báo nhiều dòng (vd. danh sách "cũ → mới") xuống dòng đúng như chuỗi gốc.
    Notification: Notification.extend({ styles: { description: { whiteSpace: 'pre-line' } } }),
  },
})
