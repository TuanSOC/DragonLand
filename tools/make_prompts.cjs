// Sinh art/PROMPTS.md từ tools/sprites.json — đưa file này cho Antigravity (hoặc công cụ AI vẽ ảnh bất kỳ).
const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync('tools/sprites.json', 'utf8'));
const groups = [
  ['1. Ảnh mẫu phong cách — rồng Lửa trưởng thành (vẽ TRƯỚC TIÊN, duyệt xong mới vẽ tiếp)', (j) => j.id === 'fire_1'],
  ['2. Rồng trưởng thành (cấp 4-6) — mỗi loài 1 ảnh, tham chiếu fire_1', (j) => /_1$/.test(j.id) && j.id !== 'fire_1'],
  ['3. Rồng non (cấp 1-3, _0) & rồng huyền thoại (cấp 7-10, _2) — tham chiếu <loài>_1 cùng loài', (j) => /_(0|2)$/.test(j.id) && !j.id.startsWith('egg')],
  ['4. Trứng rồng', (j) => j.id.startsWith('egg_')],
  ['5. Công trình', (j) => /^(habitat_|hatchery|breeding|farm)/.test(j.id)],
  ['6. Cây trồng & trang trí', (j) => /^(crop_|tree_|mushrooms|flowers|lantern|rocks)/.test(j.id)],
  ['7. Icon giao diện — vẽ icon_gold trước, các icon sau tham chiếu icon_gold', (j) => j.id.startsWith('icon_')],
];

let md = `# Danh sách ảnh cần vẽ cho Đảo Rồng 3D

## Yêu cầu chung (áp dụng cho MỌI ảnh)
- Lưu mỗi ảnh thành **PNG** tại \`art/raw/<id>.png\` (đúng tên id bên dưới, chữ thường).
- **Nền trắng trơn tuyệt đối** (#FFFFFF), không bóng đổ, không mặt đất, không chữ, không khung, không watermark.
- Một vật thể duy nhất, nằm giữa, **thấy trọn vẹn**, chừa lề xung quanh. Kích thước khuyến nghị 1024×1024.
- Rồng: **mạnh mẽ, ngầu, chi tiết** như tranh game thẻ bài fantasy cao cấp — KHÔNG chibi, KHÔNG baby. Thân hướng **sang bên trái** ảnh.
- Prompt bên dưới đã kèm sẵn phong cách — dùng nguyên văn.
- **3 giai đoạn phải khác hẳn nhau về thân hình & tư thế**: \`_0\` rồng non nhỏ gầy, cánh nhỏ cụp, bò 4 chân · \`_1\` trưởng thành đứng 2 chân dang cánh · \`_2\` huyền thoại to lớn, giáp dày, nhiều sừng. Ảnh tham chiếu **chỉ để lấy màu & đặc điểm loài — KHÔNG sửa/đồ lại ảnh tham chiếu**, phải vẽ mới hoàn toàn.
- **Giữ cùng một phong cách cho cả bộ**: vẽ \`fire_1\` trước, sau đó dùng nó làm ảnh tham chiếu phong cách cho các ảnh còn lại. Mỗi loài rồng vẽ \`<loài>_1\` trước rồi dùng làm tham chiếu cho \`<loài>_0\` và \`<loài>_2\` để giữ đúng nhân vật.
- Không sao chép hình gốc của game Đảo Rồng / Dragon City — chỉ cùng phong cách.

Sau khi vẽ xong, chạy \`npm run sprites\` để tách nền → game tự dùng ảnh mới.

Tổng: **${jobs.length} ảnh**.
`;
for (const [title, pick] of groups) {
  const list = jobs.filter(pick);
  md += `\n## ${title}\n\n| id (tên file) | Prompt |\n|---|---|\n`;
  for (const j of list) {
    const ref = j.ref?.length ? ` _(tham chiếu: ${j.ref.join(', ')})_` : '';
    md += `| \`${j.id}\` | ${j.prompt.replace(/\|/g, '/')}${ref} |\n`;
  }
}
fs.writeFileSync('art/PROMPTS.md', md);
console.log('Đã ghi art/PROMPTS.md với', jobs.length, 'ảnh');
