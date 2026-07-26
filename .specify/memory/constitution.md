# MediEdu (anti-hunchback) Constitution

Bản hiến pháp này là bộ quy tắc tối cao chi phối mọi thay đổi, bổ sung và phát triển
trong dự án MediEdu / anti-hunchback. Mọi commit, PR và thay đổi code đều phải tuân thủ
các nguyên tắc dưới đây. Khi có xung đột với các quy ước khác, hiến pháp này được ưu tiên.

Bản hiến pháp này đã **hợp nhất** nội dung từ file `.agents/AGENTS.md` cũ (vốn chứa 2
quy tắc vận hành cho agent: Auto Commit & Push và Verification) vào phần "Agent
Workflow Rules" bên dưới, để toàn bộ quy định dự án nằm trong một nguồn duy nhất. File
`.agents/AGENTS.md` đã được xóa sau khi hợp nhất.

## Core Principles

### I. Theme & Dark Mode Consistency (BẮT BUỘC)

Mọi thành phần UI mới hoặc sửa chữa phải sử dụng **hệ thống CSS variables trong
`src/styles/tokens.css`**, không được hardcode màu bằng hex/rgba/Tailwind gray utility
trong component.

- Token hai tầng của `tokens.css` (`--stu-*`/`--par-*` ở tầng 1, alias `--bg-page`,
  `--bg-card`, `--text-main`, `--text-secondary`, `--text-muted`, `--border-*`,
  `--primary`, `--accent`, `--danger`, `--shadow-*` ở tầng 2) tự động thích ứng với
  `data-theme` (student/parent) và `.dark` (dark mode) trên `<html>`.
- Component phải tham chiếu alias (tầng 2) qua inline `style` hoặc CSS Modules
  (`var(--bg-card)`, `var(--text-main)`...) để được theme-aware miễn phí.
- KHÔNG hardcode màu cố định (ví dụ `#1a1333`, `rgba(255,255,255,0.3)`,
  `bg-gray-800`) — đây là nguyên nhân gốc của các bug UI sáng/tối đã xảy ra.
- Khi cần một màu mới, khai báo nó thành token trong `tokens.css` rồi dùng.

### II. Contrast & Readability (BẮT BUỘC)

Độ tương phản giữa chữ/icon và nền phải đạt tối thiểu **WCAG AA (~4.5:1)** cho text
body, **~3:1** cho text lớn và icon, ở **cả hai chế độ light và dark**.

- Trước khi coi một thay đổi UI là hoàn thành, lập trình viên phải kiểm tra bằng mắt
  (hoặc công cụ contrast) component đó trong cả light lẫn dark mode, với cả
  `data-theme='student'` và `data-theme='parent'`.
- Đặc biệt cẩn trọng với các overlay/badge/description dùng opacity thấp — chúng dễ
  đạt contrast ở dark mode nhưng thất bại ở light mode (và ngược lại).
- Khi token màu hiện có không đủ tương phản cho một ngữ cảnh mới, tạo biến mới trong
  `tokens.css` thay vì ghi đè cục bộ bằng hex.

### III. Color Palette Consistency (BẮT BUỘC)

Phải đồng bộ màu sắc với bảng màu mà toàn bộ trang web đang dùng. Không tự ý phát minh
màu mới ngoài palette hiện có.

- Palette chuẩn nằm trong `tokens.css`: role-prefixed `--stu-*` (student theme) và
  `--par-*` (parent theme), mỗi bộ có biến thể light và dark.
- Mọi màu hiển thị (primary, accent, danger, success, warning, surface, border,
  text...) đều phải được trích xuất từ token, không import hex tùy tiện.
- Nếu một tính năng cần màu mới (ví dụ màu pet mới, màu badge mới), bước đầu tiên là
  bổ sung biến vào `tokens.css` ở cả 2 chế độ sáng/tối, sau đó mới dùng trong
  component.

### IV. i18n Compatibility — Vietnamese / English (BẮT BUỘC)

Mọi chuỗi văn bản hiển thị cho người dùng phải đi qua hàm `t()` của
`LanguageContext`. Cấm hardcode text hiển thị bằng tiếng Việt (hoặc bất kỳ ngôn ngữ
nào) trực tiếp trong JSX/JS.

- Hệ i18n tự custom (không phải react-i18next): `t(key)` lookup trong `src/i18n/en.ts`
  và `src/i18n/vi.ts`. Khi thiếu key ở **cả hai** file, fallback hiện raw key — đây là
  bug phải triệt tiêu.
- Khi thêm key mới: PHẢI thêm **đồng thời** vào cả `en.ts` và `vi.ts` trong cùng một
  thay đổi. Không được để lệch namespace.
- Tên key theo namespace chấm (ví dụ `settings.header`, `layout.notifications`,
  `profile.linkCodeLabel`, `calibration.idle`).
- Với text động (alert, confirm, toast), cũng phải dùng `t()`.
- Với text tĩnh trong dropdown/select option, cũng phải dùng `t()`.
- Trước khi merge, grep lại component xem còn chuỗi Việt/Anh hardcode nào không.

## Additional Constraints

- **Stack**: Vite + React 19 + TypeScript; Tailwind + CSS Modules hybrid; React
  Context + localStorage (không Redux/Zustand); Supabase-or-localStorage backend.
- **Hai chế độ role**: `student` và `parent`, đặt qua `data-theme` trên `<html>`.
  Component phải hoạt động đúng cho cả hai role khi có thể.
- **Dark mode**: bật/tắt qua class `.dark` trên `<html>`, persist qua
  `localStorage['oliver_dark_mode']`. Không hardcode dark-mode variant riêng cho từng
  component — dùng token.
- **Lazy loading**: các component nặng (`StudentView`, `ParentView`, `Settings`,
  `PetProfile`, `FloatingPet`, `EyeExercise`) đã được `React.lazy`. Khi thêm component
  lớn mới, cân nhắc lazy load tương tự.
- **Performance**: ưu tiên CSS-first animation; hạn chế JS rAF loop không cần thiết;
  khi dùng framer-motion, tránh re-render không cần thiết và transform leak giữa các
  nhánh `motion.div`.

## Development Workflow

1. **Trước khi code**: xác định component có dùng token CSS không, có text hiển thị
   không — nếu có, lên danh sách key i18n cần thêm.
2. **Trong khi code**: kiểm tra liên tục component ở cả light & dark mode bằng DevTools.
3. **Trước khi commit**: chạy checklist 4 nguyên tắc (theme, contrast, palette, i18n).
4. **Khi sửa bug UI**: ưu tiên tìm nguyên nhân gốc (thường là hardcode màu hoặc thiếu
   key i18n) thay vì workaround cục bộ.

## Agent Workflow Rules

Đây là các quy tắc vận hành dành cho agent AI (GLM Code, Codex, và các agent tương
tự) khi làm việc trong repo này. Nguyên tắc được di chuyển từ file `.agents/AGENTS.md`
cũ vào hiến pháp để tập trung toàn bộ quy định vào một nguồn duy nhất.

### V. Auto Commit & Push (BẮT BUỘC)

Sau khi hoàn thành bất kỳ thao tác chỉnh sửa code nào (fix bug, thêm feature, refactor,
cập nhật docs...), agent phải **tự động** chạy lần lượt:

```bash
git add .
git commit -m "<tin nhắn commit ngắn gọn, mô tả đúng nội dung thay đổi>"
git push
```

lên GitHub repository `anti-hunchback` **mà không cần hỏi lại** người dùng.

- Tin nhắn commit phải phản ánh đúng nội dung thay đổi (theo conventional commits
  khi có thể: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`...).
- Nếu thay đổi trải nhiều commit logic, có thể tách thành nhiều commit liên tiếp, mỗi
  commit tự đứng được một mình (build vẫn pass).
- Nếu `git push` bị reject do remote có commit mới (non-fast-forward), agent phải
  `git pull --rebase` rồi `git push` lại, không ép buộc `--force` trừ khi người dùng
  yêu cầu rõ ràng.
- Quy tắc này không áp dụng cho các thao tác chỉ đọc (grep, cat, tsc --noEmit, build
  kiểm chứng) — chỉ commit/push khi có file thực sự bị thay đổi.

### VI. Verification (BẮT BUỘC)

Claude Code, Codex và các công cụ kiểm chứng khác sẽ rà soát những thứ agent làm.
Agent phải **luôn đảm bảo chất lượng code và tuân thủ các quy tắc** trong hiến pháp
này, không cần đợi reviewer nhắc.

- Trước khi commit, agent phải tự chạy `npx tsc --noEmit` (và `npx vite build` khi
  thay đổi đáng kể) để đảm bảo không phá vỡ build.
- Không được commit code có TypeScript error hoặc build error — phải sửa xong rồi mới
  commit.
- Agent tự kiểm tra 4 nguyên tắc Core Principles (theme, contrast, palette, i18n) trên
  diff của mình trước khi commit, như một lớp review nội bộ.
- Khi phát hiện vi phạm hiến pháp trong code cũ (ví dụ component có hardcode màu),
  agent nên ghi nhận trong commit message hoặc tạo issue, không im lặng bỏ qua.

## Governance

- Hiến pháp này **ưu tiên cao hơn** mọi quy ước khác trong dự án. Khi xung đột, hiến
  pháp thắng.
- Mọi PR/review phải xác nhận tuân thủ 4 nguyên tắc Core Principles ở trên. Reviewer
  có quyền reject PR vi phạm mà không cần lý do kỹ thuật khác.
- Sửa đổi hiến pháp phải: (a) ghi rõ lý do, (b) cập nhật `Last Amended`, (c) có kế
  hoạch migration cho code cũ không tuân thủ.
- Khi một bug UI xuất hiện, điều đầu tiên phải hỏi là "có vi phạm nguyên tắc nào
  trong hiến pháp không?" — phần lớn bug UI trong dự án này bắt nguồn từ vi phạm
  nguyên tắc I hoặc IV.

**Version**: 1.1.0 | **Ratified**: 2026-07-26 | **Last Amended**: 2026-07-26
