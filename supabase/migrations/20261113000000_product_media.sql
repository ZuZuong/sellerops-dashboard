-- =============================================================================
-- SellerOps – Mô tả & ảnh sản phẩm
--   * description: nội dung chi tiết sản phẩm.
--   * hero_image_path: ảnh đại diện; image_paths: ảnh phụ (tối đa 8).
--     Lưu ĐƯỜNG DẪN trong Storage (không lưu URL) để đổi domain / CDN không phải sửa dữ liệu.
--   * Ảnh nằm trong bucket public `product-images`, thư mục theo user: <user_id>/<uuid>.<ext>.
--     Ai cũng xem được ảnh (ảnh sản phẩm để bán), chỉ chủ sở hữu được tải lên / xóa.
-- =============================================================================

-- Mọi đường dẫn ảnh phải nằm trong thư mục của chính chủ sản phẩm.
create function public.paths_owned_by(p_paths text[], p_owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(starts_with(p, p_owner::text || '/')), true)
  from unnest(p_paths) as p;
$$;

alter table public.products
  add column description text
    check (description is null or length(description) <= 5000),
  add column hero_image_path text,
  add column image_paths text[] not null default '{}'
    check (cardinality(image_paths) <= 8),
  add constraint products_image_paths_owned
    check (public.paths_owned_by(array_append(image_paths, hero_image_path), user_id));

grant insert (description, hero_image_path, image_paths) on public.products to authenticated;
grant update (description, hero_image_path, image_paths) on public.products to authenticated;

-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "product-images: insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-images: update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-images: delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Hàm thuần, vô hại; vẫn cấp cho authenticated vì CHECK constraint chạy với quyền người ghi.
revoke execute on function public.paths_owned_by(text[], uuid) from public, anon;
grant execute on function public.paths_owned_by(text[], uuid) to authenticated;
