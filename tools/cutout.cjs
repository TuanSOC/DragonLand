// Tách nền trắng của ảnh AI → PNG trong suốt, cắt sát, thu nhỏ; ghi manifest.json.
//   node tools/cutout.cjs
// Cần ImageMagick 7 (lệnh `magick`).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'art', 'raw');
const OUT = path.join(ROOT, 'public', 'sprites');
fs.mkdirSync(OUT, { recursive: true });

const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8' }).trim();
const manifest = {};
const TMP = path.join(ROOT, 'art', '.tmp');
fs.mkdirSync(TMP, { recursive: true });

/** Ô trắng kẹt bên trong (giữa cánh và thân) lớn hơn ngần này px thì coi là nền; mắt/răng nhỏ hơn được giữ. */
const POCKET_MIN_AREA = 1500;

function isWhite(src, x, y) {
  const [r, g, b] = magick(src, '-format', `%[fx:int(255*p{${x},${y}}.r)] %[fx:int(255*p{${x},${y}}.g)] %[fx:int(255*p{${x},${y}}.b)]`, 'info:')
    .split(' ')
    .map(Number);
  return r > 235 && g > 235 && b > 235;
}

// nhận cả png/jpg/webp (công cụ AI có thể lưu định dạng khác nhau)
for (const file of fs.readdirSync(RAW).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
  const id = path.basename(file, path.extname(file)).toLowerCase();
  const src = path.join(RAW, file);
  const dst = path.join(OUT, `${id}.png`);
  const [w, h] = magick('identify', '-format', '%w %h', src).split(' ').map(Number);
  // 1) xóa vùng nền nối liền với các góc TRẮNG (góc bị nhân vật tràn ra thì bỏ qua,
  //    nếu không floodfill sẽ ăn mất cả thân rồng màu tối)
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
    .filter(([x, y]) => isWhite(src, x, y))
    .flatMap(([x, y]) => ['-draw', `alpha ${x},${y} floodfill`]);
  const flood = path.join(TMP, `${id}_flood.png`);
  magick(src, '-alpha', 'set', '-fuzz', '9%', '-fill', 'none', ...corners, flood);

  // 2) mặt nạ "ô trắng kẹt": pixel gần trắng tinh (3%), gộp vùng nhỏ (mắt, răng) vào xung quanh,
  //    còn lại vùng trắng lớn → trong suốt. Mặt nạ: trắng = giữ, đen = xóa.
  const keep = path.join(TMP, `${id}_keep.png`);
  magick(
    src, '-alpha', 'off', '-fuzz', '3%', '-fill', 'white', '-opaque', 'white',
    '-fuzz', '0', '-fill', 'black', '+opaque', 'white',
    '-define', `connected-components:area-threshold=${POCKET_MIN_AREA}`,
    '-define', 'connected-components:mean-color=true',
    '-connected-components', '8', '-negate', keep,
  );

  // 3) alpha cuối = alpha(floodfill) × mặt nạ; gặm 1px viền để bớt quầng trắng; cắt sát; thu nhỏ
  magick(
    flood, '(', flood, '-alpha', 'extract', keep, '-compose', 'multiply', '-composite', ')',
    '-alpha', 'off', '-compose', 'copy-opacity', '-composite',
    '-channel', 'A', '-morphology', 'Erode', 'Disk:1', '+channel',
    '-trim', '+repage', '-resize', '512x512>', dst,
  );
  const [ow, oh] = magick('identify', '-format', '%w %h', dst).split(' ').map(Number);
  manifest[id] = { w: ow, h: oh };
  console.log(`${id}: ${ow}x${oh}`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`Xong ${Object.keys(manifest).length} sprite → public/sprites/`);
