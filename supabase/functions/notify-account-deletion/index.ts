// supabase/functions/notify-account-deletion/index.ts
//
// Gửi email thông báo cho chủ tài khoản bị admin xóa (xóa mềm), kèm lý do và hướng dẫn khiếu nại.
//
// Bảo mật:
//  * Chỉ nhận `deletion_id`. Người nhận, tiêu đề, nội dung đều do server dựng từ database —
//    client KHÔNG truyền được email / HTML tùy ý (không thể dùng function để gửi spam).
//  * Gọi RPC bằng chính JWT của người gọi → `admin_deletion_notice` từ chối nếu không phải admin.
//    Function không dùng service_role key.
//  * Secrets (Supabase Dashboard → Edge Functions → Secrets):
//      RESEND_API_KEY   API key của Resend
//      EMAIL_FROM       Người gửi, vd. "SellerOps <no-reply@ten-mien.vn>" (domain đã xác minh)
//      SUPPORT_EMAIL    Email tiếp nhận khiếu nại (đặt làm Reply-To)
//      ALLOWED_ORIGINS  (tùy chọn) danh sách origin, phân tách bằng dấu phẩy

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))

interface Notice {
  email: string
  full_name: string | null
  shop_name: string | null
  reason: string
  requested_at: string
  evidence_count: number
}

function buildEmail(notice: Notice) {
  const greeting = escapeHtml(notice.full_name ?? notice.email)
  const shop = notice.shop_name ? ` (shop <strong>${escapeHtml(notice.shop_name)}</strong>)` : ''
  const support = SUPPORT_EMAIL ? escapeHtml(SUPPORT_EMAIL) : null
  const evidence =
    notice.evidence_count > 0
      ? `<p>Hồ sơ vi phạm kèm theo ${notice.evidence_count} tài liệu bằng chứng do quản trị viên lưu trữ.</p>`
      : ''
  const appeal = support
    ? `Gửi email tới <a href="mailto:${support}">${support}</a> (hoặc trả lời trực tiếp thư này)`
    : 'Trả lời trực tiếp thư này'

  const subject = 'Thông báo xóa tài khoản người bán trên SellerOps'
  const html = `<!doctype html>
<html lang="vi">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #0f172a;">Thông báo xóa tài khoản</h2>
    <p>Kính gửi ${greeting},</p>
    <p>Tài khoản người bán của bạn${shop} đã bị quản trị viên SellerOps <strong>tạm xóa</strong> vào lúc ${escapeHtml(formatDateTime(notice.requested_at))}. Tài khoản hiện không thể đăng nhập và mọi thao tác kinh doanh đã bị dừng.</p>
    <p><strong>Lý do:</strong></p>
    <blockquote style="margin: 0; padding: 12px 16px; background: #f1f5f9; border-left: 4px solid #b45309;">${escapeHtml(notice.reason).replaceAll('\n', '<br />')}</blockquote>
    ${evidence}
    <h3 style="color: #0f172a;">Khiếu nại</h3>
    <p>Nếu bạn cho rằng quyết định này chưa chính xác, hãy gửi khiếu nại để hai bên cùng xem xét:</p>
    <ol>
      <li>${appeal}, ghi rõ email đăng nhập và tên shop.</li>
      <li>Trình bày nội dung giải trình và đính kèm tài liệu chứng minh (hóa đơn, chứng từ nguồn gốc hàng hóa, giấy phép…).</li>
      <li>Quản trị viên sẽ phản hồi và có thể khôi phục tài khoản nếu khiếu nại được chấp nhận. Dữ liệu shop của bạn được giữ nguyên trong thời gian xem xét.</li>
    </ol>
    <p>Trân trọng,<br />Ban quản trị SellerOps</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0;" />
    <p style="font-size: 12px; color: #64748b;">Đây là thư thông báo tự động về tài khoản của bạn.</p>
  </body>
</html>`
  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json(req, { error: 'NOT_AUTHENTICATED' }, 401)

  let deletionId: unknown
  try {
    ;({ deletion_id: deletionId } = await req.json())
  } catch {
    return json(req, { error: 'INVALID_BODY' }, 400)
  }
  if (typeof deletionId !== 'string' || !UUID.test(deletionId)) {
    return json(req, { error: 'INVALID_BODY' }, 400)
  }

  // Client mang JWT của người gọi: mọi quyền do RLS / RPC trong database quyết định.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .rpc('admin_deletion_notice', { p_deletion_id: deletionId })
    .single<Notice>()
  if (error || !data) {
    const code = error?.message ?? 'DELETION_NOT_FOUND'
    return json(req, { error: code }, code === 'NOT_ADMIN' ? 403 : 400)
  }

  // Kiểm tra cấu hình SAU khi xác nhận người gọi là admin, và ghi lỗi vào hồ sơ để trang
  // "Chờ xóa" hiển thị lý do (thay vì mãi "Chưa gửi").
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    await supabase.rpc('mark_deletion_notified', {
      p_deletion_id: deletionId,
      p_error: 'EMAIL_NOT_CONFIGURED',
    })
    return json(req, { error: 'EMAIL_NOT_CONFIGURED' }, 500)
  }

  const { subject, html } = buildEmail(data)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [data.email],
      subject,
      html,
      ...(SUPPORT_EMAIL ? { reply_to: SUPPORT_EMAIL } : {}),
    }),
  })

  if (!response.ok) {
    // Không trả chi tiết của Resend về client; lưu tóm tắt để admin biết cần gửi lại.
    // Mã gọn để giao diện map sang tiếng Việt; chi tiết xem ở Resend → Logs.
    const detail = response.status === 403 ? 'EMAIL_SENDER_NOT_ALLOWED' : 'EMAIL_SEND_FAILED'
    await supabase.rpc('mark_deletion_notified', { p_deletion_id: deletionId, p_error: detail })
    return json(req, { error: 'EMAIL_SEND_FAILED' }, 502)
  }

  await supabase.rpc('mark_deletion_notified', { p_deletion_id: deletionId })
  return json(req, { ok: true })
})
