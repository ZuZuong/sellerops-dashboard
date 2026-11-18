-- =============================================================================
-- Nhật ký hoạt động: chi tiết "cũ → mới" của từng thao tác.
--
--  * changes: [{ "field": "Giá bán", "from": "150.000 ₫", "to": "199.000 ₫" }, ...]
--    Giá trị đã định dạng sẵn ở client để nhật ký hiển thị đúng như lúc thay đổi.
--    from / to = null nghĩa là trống (tạo mới / xóa).
--  * Dòng log cũ (trước migration này) có changes = [].
-- =============================================================================

alter table public.activity_logs
  add column changes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(changes) = 'array' and octet_length(changes::text) <= 20000);

grant insert (changes) on public.activity_logs to authenticated;
