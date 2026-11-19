/**
 * Cam kết và nội quy dành cho người bán.
 *
 * Khi sửa nội dung, PHẢI tăng `TERMS_VERSION`: phiên bản seller đã chấp nhận được lưu cùng thời
 * điểm chấp nhận (`sellers.terms_version`, `terms_accepted_at`) làm căn cứ đối chiếu khi có tranh
 * chấp. Nội dung nên được bộ phận pháp chế rà soát trước khi áp dụng chính thức.
 */
export const TERMS_VERSION = '2026.11-v1'

export const TERMS_TITLE = 'Cam kết và Nội quy dành cho Người bán'

export const TERMS_INTRO =
  'Văn bản này quy định quyền, nghĩa vụ và trách nhiệm của Người bán khi sử dụng nền tảng SellerOps để quản lý và kinh doanh hàng hóa. Bằng việc xác nhận, Người bán đồng ý tuân thủ toàn bộ nội dung dưới đây cùng các quy định pháp luật hiện hành của Việt Nam, bao gồm Luật Thương mại, Luật Bảo vệ quyền lợi người tiêu dùng, Luật Quản lý thuế và Nghị định về thương mại điện tử.'

export interface TermsSection {
  title: string
  items: readonly string[]
}

export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: 'Điều 1. Giải thích từ ngữ',
    items: [
      '"Nền tảng" là hệ thống SellerOps cùng các dịch vụ, công cụ quản lý đi kèm.',
      '"Người bán" là tổ chức, hộ kinh doanh hoặc cá nhân kinh doanh đã đăng ký và được Nền tảng phê duyệt hồ sơ.',
      '"Khách hàng" là tổ chức, cá nhân mua hàng hóa của Người bán.',
      '"Ban quản trị" là bộ phận vận hành Nền tảng, có thẩm quyền xét duyệt hồ sơ, giám sát và xử lý vi phạm.',
    ],
  },
  {
    title: 'Điều 2. Tư cách pháp lý và trách nhiệm của Người bán',
    items: [
      'Người bán là chủ thể kinh doanh độc lập, tự chịu trách nhiệm trước pháp luật về toàn bộ hoạt động kinh doanh, nghĩa vụ thuế, hóa đơn và chứng từ của mình.',
      'Người bán bảo đảm có đầy đủ giấy chứng nhận đăng ký kinh doanh và các giấy phép, chứng nhận chuyên ngành theo quy định đối với ngành hàng kinh doanh, đồng thời duy trì hiệu lực của chúng trong suốt thời gian hoạt động.',
      'Người bán chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình.',
      'Nền tảng là đơn vị cung cấp công cụ quản lý, không phải là bên mua bán trong giao dịch giữa Người bán và Khách hàng.',
    ],
  },
  {
    title: 'Điều 3. Hàng hóa kinh doanh',
    items: [
      'Chỉ kinh doanh hàng hóa có nguồn gốc, xuất xứ rõ ràng, hợp pháp; không thuộc danh mục hàng hóa cấm kinh doanh hoặc hạn chế kinh doanh theo quy định của pháp luật.',
      'Nghiêm cấm kinh doanh hàng giả, hàng nhái, hàng kém chất lượng, hàng nhập lậu, hàng hết hạn sử dụng và hàng hóa xâm phạm quyền sở hữu trí tuệ.',
      'Hàng hóa thuộc diện phải công bố tiêu chuẩn, kiểm định hoặc chứng nhận hợp quy phải có đầy đủ giấy tờ tương ứng và xuất trình khi Ban quản trị hoặc cơ quan có thẩm quyền yêu cầu.',
    ],
  },
  {
    title: 'Điều 4. Thông tin cung cấp và cập nhật',
    items: [
      'Thông tin doanh nghiệp và giấy tờ trong hồ sơ đăng ký phải trung thực, chính xác, đầy đủ; mọi thay đổi phải được cập nhật trong thời hạn 07 ngày làm việc kể từ ngày phát sinh.',
      'Thông tin sản phẩm (tên, mô tả, hình ảnh, giá bán, số lượng tồn kho) phải phản ánh đúng hàng hóa thực tế, không gây nhầm lẫn cho Khách hàng.',
      'Ban quản trị có quyền yêu cầu bổ sung, xác minh thông tin và tạm khóa gian hàng trong thời gian xác minh nếu phát hiện dấu hiệu sai lệch.',
    ],
  },
  {
    title: 'Điều 5. Xử lý đơn hàng, đổi trả và khiếu nại',
    items: [
      'Người bán xác nhận, đóng gói và giao hàng đúng thời hạn, đúng chủng loại, số lượng và chất lượng đã cam kết với Khách hàng.',
      'Người bán công bố rõ chính sách đổi trả, bảo hành, hoàn tiền và thực hiện đúng chính sách đã công bố.',
      'Người bán tiếp nhận và phản hồi khiếu nại của Khách hàng trong vòng 48 giờ, giải quyết theo quy định về bảo vệ quyền lợi người tiêu dùng.',
      'Người bán lưu giữ chứng từ giao nhận, thanh toán tối thiểu 12 tháng để phục vụ việc đối chiếu và giải quyết tranh chấp.',
    ],
  },
  {
    title: 'Điều 6. Bảo vệ dữ liệu cá nhân',
    items: [
      'Người bán chỉ sử dụng thông tin của Khách hàng (họ tên, số điện thoại, địa chỉ) cho mục đích thực hiện đơn hàng và chăm sóc khách hàng.',
      'Nghiêm cấm mua bán, chia sẻ hoặc sử dụng dữ liệu cá nhân của Khách hàng cho mục đích khác khi chưa có sự đồng ý của chủ thể dữ liệu, phù hợp quy định pháp luật về bảo vệ dữ liệu cá nhân.',
    ],
  },
  {
    title: 'Điều 7. Vi phạm và biện pháp xử lý',
    items: [
      'Tùy mức độ vi phạm, Ban quản trị có thể áp dụng một hoặc nhiều biện pháp: nhắc nhở, yêu cầu khắc phục, tạm khóa gian hàng, khóa tài khoản hoặc chấm dứt cung cấp dịch vụ.',
      'Trong thời gian bị tạm khóa, Người bán không thể thao tác trên dữ liệu kinh doanh cho tới khi vi phạm được khắc phục và Ban quản trị mở khóa.',
      'Trường hợp vi phạm nghiêm trọng hoặc tái phạm, tài khoản có thể bị xóa khỏi Nền tảng. Người bán được thông báo lý do qua email đăng ký; dữ liệu kinh doanh được lưu giữ phục vụ việc giải quyết khiếu nại.',
      'Vi phạm có dấu hiệu tội phạm sẽ được chuyển thông tin tới cơ quan có thẩm quyền theo quy định.',
    ],
  },
  {
    title: 'Điều 8. Khiếu nại quyết định của Ban quản trị',
    items: [
      'Người bán có quyền khiếu nại quyết định tạm khóa, khóa hoặc xóa tài khoản trong vòng 30 ngày kể từ ngày nhận thông báo, bằng cách phản hồi email thông báo kèm giải trình và tài liệu chứng minh.',
      'Ban quản trị xem xét và phản hồi khiếu nại trong vòng 10 ngày làm việc; tài khoản được khôi phục nếu khiếu nại được chấp nhận.',
    ],
  },
  {
    title: 'Điều 9. Hiệu lực và sửa đổi',
    items: [
      'Cam kết có hiệu lực kể từ thời điểm Người bán xác nhận và được lưu kèm phiên bản văn bản đã chấp nhận.',
      'Nền tảng có thể sửa đổi, bổ sung nội dung và sẽ thông báo cho Người bán trước khi áp dụng. Việc tiếp tục sử dụng Nền tảng sau thời điểm áp dụng được hiểu là Người bán chấp nhận nội dung sửa đổi.',
    ],
  },
]
