// Quét code giao diện tìm emoji KHÔNG có icon thay thế (sẽ vẫn hiện emoji kể cả khi đủ ảnh icon).
//   node tools/check-emoji.cjs   → in danh sách, thoát mã 1 nếu còn
// Bỏ qua: src/ui/icons.ts (bảng emoji dự phòng), src/ui/devTools.ts (chỉ dev thấy).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const icons = fs.readFileSync(path.join(ROOT, 'src/ui/icons.ts'), 'utf8');
const mapBlock = icons.slice(icons.indexOf('const FROM_EMOJI'), icons.indexOf('const EMOJI_RE'));
const mapped = new Set([...mapBlock.matchAll(/'([^']+)':/g)].map((m) => m[1]));

const files = [
  'index.html',
  ...fs.readdirSync(path.join(ROOT, 'src/ui')).map((f) => `src/ui/${f}`),
  'src/render/world.ts',
  'src/render/herd.ts',
  'src/game.ts',
  'src/main.ts',
  'src/data/elements.ts',
  ...fs.readdirSync(path.join(ROOT, 'src/logic')).map((f) => `src/logic/${f}`),
].filter((f) => !/icons\.ts$|devTools\.ts$/.test(f));

const re = /\p{Extended_Pictographic}/gu;
const found = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return; // bỏ qua comment
    for (const m of line.matchAll(re)) {
      if (!mapped.has(m[0])) found.push(`${f}:${i + 1}  ${m[0]}`);
    }
  });
}
if (found.length) {
  console.log(`Còn ${found.length} emoji không có icon thay thế:\n${found.join('\n')}`);
  process.exit(1);
}
console.log('OK — mọi emoji trên giao diện đều có icon thay thế.');
