export const config = {
  title: 'Lịch sinh nhật lớp A1',
  subtitle: 'Bạn bè · gia đình · một lớp',
  // Chấp nhận "false", "False", " false ", "0", "no", "off", "không"… (khớp với script sync)
  requireAuth: !['false', '0', 'no', 'off', 'khong', 'không'].includes(
    String(import.meta.env.VITE_REQUIRE_AUTH ?? '').trim().toLowerCase(),
  ),
  /** 'person' = mỗi người một màu riêng, 'gender' = xanh nam / hồng nữ */
  colorBy: 'person',
  /** Hiện ngày âm lịch trong ô ngày */
  showLunar: true,
  /** Hiện kỷ niệm ngày cưới (cột "Đã lấy chồng / vợ") trên lịch */
  showAnniversaries: true,
  /** Số sự kiện trong mục "Sắp tới" */
  upcomingCount: 8,
}
