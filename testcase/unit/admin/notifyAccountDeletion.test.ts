import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const rpc = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

const { notifyAccountDeletion } = await import('@/features/admin/api/admin.api')

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  invoke.mockReset()
  rpc.mockReset().mockResolvedValue({ error: null })
})

describe('notifyAccountDeletion', () => {
  it('gửi thành công: chỉ truyền id hồ sơ, không truyền người nhận / nội dung', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })
    await notifyAccountDeletion('d1')
    expect(invoke).toHaveBeenCalledWith('notify-account-deletion', { body: { deletion_id: 'd1' } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('function chưa deploy (404) → ghi lỗi vào hồ sơ để trang "Chờ xóa" hiện lý do', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response('Not found', { status: 404 })),
    })
    await expect(notifyAccountDeletion('d1')).rejects.toThrow('EMAIL_FUNCTION_NOT_DEPLOYED')
    expect(rpc).toHaveBeenCalledWith('mark_deletion_notified', {
      p_deletion_id: 'd1',
      p_error: 'EMAIL_FUNCTION_NOT_DEPLOYED',
    })
  })

  it('không gọi được function (mạng) → ghi lỗi', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError('Failed to fetch') })
    await expect(notifyAccountDeletion('d1')).rejects.toThrow('EMAIL_FUNCTION_UNREACHABLE')
    expect(rpc).toHaveBeenCalledWith(
      'mark_deletion_notified',
      expect.objectContaining({ p_error: 'EMAIL_FUNCTION_UNREACHABLE' }),
    )
  })

  it('function trả mã lỗi (đã tự ghi vào hồ sơ) → chỉ báo lỗi, không ghi đè', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { error: 'EMAIL_NOT_CONFIGURED' }),
    })
    await expect(notifyAccountDeletion('d1')).rejects.toThrow('EMAIL_NOT_CONFIGURED')
    expect(rpc).not.toHaveBeenCalled()
  })
})
