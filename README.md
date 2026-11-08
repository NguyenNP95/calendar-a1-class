# Lịch sinh nhật lớp A1

Web lịch sinh nhật đọc dữ liệu từ Google Sheet, deploy GitHub Pages. Source public nhưng thông tin cá nhân được mã hoá (AES-256-GCM, PBKDF2 210.000 vòng) bằng mật khẩu lớp.

## Tính năng

- **3 chế độ xem**: Tháng (lịch chi tiết + panel ngày), Năm (tổng quan 12 tháng), Danh sách (hợp nhất cho điện thoại, có tìm kiếm không dấu).
- **Âm lịch**: mỗi ô ngày hiện ngày âm; hỗ trợ người tổ chức sinh nhật theo âm lịch; tuổi Can Chi.
- **Banner "Hôm nay"** khi có sinh nhật, mục **Sắp tới** có đếm ngược và số tuổi.
- **Kỷ niệm ngày cưới** từ cột "Đã lấy chồng / vợ".
- Bấm vào một người để xem đầy đủ thông tin, có nút **Gọi / Zalo / Sao chép số / Xem bản đồ**.
- **Dark mode** (tự theo hệ thống, hoặc bấm nút để chọn Sáng / Tối).
- Mobile: chấm màu trong ô ngày, vuốt trái/phải để chuyển tháng. Desktop: hover xem nhanh, phím tắt `←` `→` chuyển, `T` về hôm nay, `1` `2` `3` đổi chế độ xem, `Esc` đóng.
- Link trực tiếp tới một chế độ xem: `?view=month`, `?view=year`, `?view=list`.

## Dữ liệu Sheet

Script đọc theo **tên cột** (không phân biệt hoa thường, có dấu hay không dấu), không phụ thuộc vị trí cột:

| Cột trên Sheet | Trường | Ghi chú |
|---|---|---|
| STT | stt | |
| Họ tên / Họ và tên | name | bắt buộc |
| Ngày sinh | birthday | `DD/MM/YYYY`, `D/M/YY`, `YYYY-MM-DD`, hoặc `DD/MM` nếu không rõ năm |
| Số điện thoại / SĐT | phone | |
| Giới tính | gender | `Nam` / `Nữ` |
| Địa chỉ | address | |
| Ghi chú | note | |
| Đã lấy chồng / vợ / Ngày cưới | marriedAt | nếu là ngày, lịch hiện kỷ niệm cưới hằng năm |
| Âm lịch / Sinh nhật âm *(tuỳ chọn)* | lunar | điền `x` / `có` nếu người đó tổ chức sinh nhật theo âm lịch |
| Ảnh / Avatar *(tuỳ chọn)* | avatar | URL ảnh; ô trống thì hiện chữ cái tên |

Người sinh 29/2 được tổ chức vào 28/2 ở năm không nhuận.

## Tuỳ chỉnh

Sửa [src/config.js](src/config.js):

- `colorBy`: `'person'` (mỗi người một màu, mặc định) hoặc `'gender'` (xanh nam / hồng nữ)
- `showLunar`: hiện ngày âm trong ô lịch
- `showAnniversaries`: hiện kỷ niệm ngày cưới
- `upcomingCount`: số mục trong "Sắp tới"

## Chạy local

```bash
npm install
npm run sync:sample   # dữ liệu mẫu, mật khẩu: a1-class
npm run dev
```

Đồng bộ Sheet thật (cần Service Account):

1. Tạo Google Cloud project → bật **Google Sheets API**.
2. Tạo Service Account, tải JSON key, đặt thành `service-account.json` (file này đã được `.gitignore`).
3. Share Google Sheet cho email Service Account (quyền Viewer). **Không** bật "anyone with the link".
4. Copy `.env.example` thành `.env`, điền `SHEET_ID` và `APP_PASSWORD` (bắt buộc, script sẽ dừng nếu thiếu).
5. `npm run sync` rồi `npm run dev`.

## GitHub Pages

Repo **Settings → Pages → Source = GitHub Actions**.

**Secrets** (Settings → Secrets and variables → Actions):

- `SHEET_ID`: ID trong URL Sheet (`/d/<SHEET_ID>/edit`)
- `APP_PASSWORD`: mật khẩu đăng nhập. Nên dài và khó đoán, vì `data.enc` là file công khai nên ai cũng có thể tải về và thử dò mật khẩu.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: toàn bộ nội dung file JSON key (một dòng hoặc base64 đều được)

Thiếu `SHEET_ID` hoặc `APP_PASSWORD` thì workflow **báo lỗi và dừng**, không deploy dữ liệu mẫu hay dữ liệu mã hoá bằng mật khẩu mặc định.

**Variables** (tuỳ chọn):

- `VITE_BASE`: nếu site là `https://user.github.io/calendar-a1-class/` thì đặt `/calendar-a1-class/`
- `REQUIRE_AUTH`: mặc định bật login. Đặt `false` khi muốn public, không cần mật khẩu.

Mỗi lần push `main`, hoặc 00:00 giờ Việt Nam hằng ngày, Action đọc Sheet → mã hoá → build → deploy.

## Tắt login (bản public)

1. GitHub Variable `REQUIRE_AUTH=false`
2. Chạy lại workflow

Khi đó script ghi `data.json` không mã hoá. Chỉ làm khi chấp nhận họ tên / SĐT / địa chỉ nằm công khai trên Pages.

Local: `.env` đặt `VITE_REQUIRE_AUTH=false` và `REQUIRE_AUTH=false` rồi `npm run sync`.

## Cấu trúc

```
src/
  App.vue                  tải & giải mã dữ liệu, đăng nhập / đăng xuất
  components/
    CalendarApp.vue        khung chính: header, toolbar, 3 chế độ xem, phím tắt, vuốt
    MonthView.vue          lưới tháng (6 hàng cố định), chip / chấm màu, ngày âm
    YearView.vue           12 tháng thu nhỏ
    ListView.vue           danh sách + tìm kiếm
    DayPanel.vue           ngày đang chọn + sự kiện trong tháng
    UpcomingStrip.vue      "Sắp tới"
    TodayBanner.vue        banner sinh nhật hôm nay
    PersonModal.vue        chi tiết một người
    HoverCard.vue          tooltip khi hover (desktop)
  utils/
    events.js              sinh sự kiện theo năm (sinh nhật dương/âm, kỷ niệm cưới, 29/2)
    lunar.js               chuyển đổi âm – dương lịch (thuật toán Hồ Ngọc Đức)
    people.js, dates.js, crypto.js, storage.js
scripts/fetch-and-encrypt.mjs   đọc Sheet → mã hoá → public/data.enc
```
