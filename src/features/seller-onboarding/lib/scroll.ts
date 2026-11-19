/** Sai số (px) khi so vị trí cuộn: trình duyệt làm tròn số lẻ khi phóng to / thu nhỏ. */
const BOTTOM_TOLERANCE = 8

/**
 * Đã cuộn tới cuối vùng nội dung chưa. Nội dung ngắn hơn khung (không có gì để cuộn) cũng tính
 * là đã đọc hết.
 */
export function isScrolledToBottom(
  element: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  tolerance = BOTTOM_TOLERANCE,
): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - tolerance
}
