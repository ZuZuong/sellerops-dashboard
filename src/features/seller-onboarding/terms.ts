/**
 * Cam kết và nội quy dành cho seller.
 *
 * ⚠️ NỘI DUNG DEMO cho dự án portfolio — không phải văn bản pháp lý thật, chưa được luật sư rà
 * soát. Khi đổi nội dung, tăng `TERMS_VERSION`: phiên bản seller đã chấp nhận được lưu cùng thời
 * điểm chấp nhận (`sellers.terms_version`, `terms_accepted_at`) để đối chiếu về sau.
 */
export const TERMS_VERSION = '2026-11-demo-1'

export interface TermsSection {
  title: string
  items: readonly string[]
}

export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: '1. Trách nhiệm pháp lý của người bán',
    items: [
      'Người bán là chủ thể kinh doanh độc lập, tự chịu trách nhiệm trước pháp luật về hoạt động kinh doanh, nghĩa vụ thuế và hóa đơn chứng từ của mình.',
      'Người bán bảo đảm có đầy đủ giấy phép, chứng nhận cần thiết cho ngành hàng đăng ký và duy trì hiệu lực của chúng trong suốt thời gian hoạt động trên nền tảng.',
      'Nền tảng là đơn vị cung cấp công cụ quản lý, không phải bên mua bán trong các giao dịch giữa người bán và khách hàng.',
    ],
  },
  {
    title: '2. Hàng hóa hợp pháp',
    items: [
      'Chỉ kinh doanh hàng hóa có nguồn gốc xuất xứ rõ ràng, không thuộc danh mục cấm kinh doanh hoặc hạn chế kinh doanh theo quy định của pháp luật Việt Nam.',
      'Không kinh doanh hàng giả, hàng nhái, hàng vi phạm quyền sở hữu trí tuệ, hàng nhập lậu hoặc hàng hết hạn sử dụng.',
      'Hàng hóa thuộc diện phải kiểm định, công bố chất lượng phải có giấy tờ tương ứng và xuất trình khi được yêu cầu.',
    ],
  },
  {
    title: '3. Thông tin chính xác',
    items: [
      'Thông tin doanh nghiệp, giấy tờ cung cấp trong hồ sơ đăng ký phải trung thực, chính xác và được cập nhật khi có thay đổi.',
      'Thông tin sản phẩm (tên, mô tả, hình ảnh, giá bán, tồn kho) phải phản ánh đúng hàng hóa thực tế, không gây nhầm lẫn cho khách hàng.',
      'Nền tảng có quyền yêu cầu bổ sung, xác minh thông tin và tạm khóa shop nếu phát hiện thông tin sai lệch.',
    ],
  },
  {
    title: '4. Xử lý đơn hàng và khiếu nại',
    items: [
      'Người bán xác nhận, đóng gói và giao đơn hàng đúng thời hạn đã cam kết với khách hàng.',
      'Người bán tiếp nhận và phản hồi khiếu nại của khách hàng trong thời gian hợp lý, giải quyết đổi trả, hoàn tiền theo chính sách đã công bố và quy định về bảo vệ quyền lợi người tiêu dùng.',
      'Người bán lưu giữ chứng từ giao nhận, thanh toán để phục vụ việc giải quyết tranh chấp khi cần.',
    ],
  },
  {
    title: '5. Vi phạm và khóa shop',
    items: [
      'Khi phát hiện vi phạm nội quy hoặc quy định pháp luật, nền tảng có thể nhắc nhở, tạm khóa shop hoặc chấm dứt cung cấp dịch vụ tùy mức độ vi phạm.',
      'Trong thời gian shop bị tạm khóa, người bán không thể thao tác trên dữ liệu kinh doanh cho tới khi vi phạm được khắc phục và quản trị viên mở khóa.',
      'Người bán có quyền giải trình và cung cấp bằng chứng để đề nghị xem xét lại quyết định khóa shop.',
    ],
  },
]
