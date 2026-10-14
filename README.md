# 🐉 Đảo Rồng 3D

Game nuôi rồng lấy cảm hứng từ *Đảo Rồng* trên Zing Me ngày xưa, chạy trên trình duyệt (Three.js + TypeScript + Vite).

## Chạy game

```bash
npm install
npm run dev        # mở http://localhost:5173
npm test           # test logic (vàng, lai tạo, ruộng, đấu)
npm run build      # build ra dist/
```

## Cách chơi
1. 🌾 **Ruộng**: gieo cây → chờ chín → thu 🍖 thức ăn.
2. 🍖 **Chuồng → Cho ăn**: ăn 4 lần lên 1 cấp, rồng lớn dần, sinh nhiều 💰 hơn.
3. 💞 **Núi Lai Tạo**: 2 rồng cấp 4+ → trứng → 🐣 **Lò Ấp** → rồng mới (Lửa × Nước có thể ra Rồng Hơi Nước…).
4. 🏗️ **Xây dựng**: thêm chuồng đúng hệ để chứa rồng mới.
5. ⚔️ **Đấu trường**: 8 trận, đánh theo lượt. Khắc chế: 🔥 > 🌿 > 🪨 > 💧 > 🔥 (x2 sát thương).

Thêm:
- ⭐ **Cấp người chơi**: mọi hành động cho XP, lên cấp nhận 💎 + vàng.
- 💰 Bấm **đồng xu** trên chuồng để thu vàng nhanh.
- ✨ Rồng **tiến hóa** ở cấp 4 (Trưởng Thành) và 7 (Huyền Thoại) — đổi hình.
- 🔊 Âm thanh tổng hợp (tắt trong ⚙️ Hướng dẫn).
- 🛠 **Chế độ dev**: mở `http://localhost:5173/?dev=1` — save riêng, có nút thêm tài nguyên, xong ngay bộ đếm, tăng cấp rồng, tua thời gian.

Thời gian chạy theo giờ thật — tắt game mở lại vẫn sinh vàng, cây vẫn lớn. Game tự lưu trong trình duyệt.

## Hình ảnh: rồng tranh vẽ (2.5D)
Game dùng **sprite tranh vẽ** nếu có trong `public/sprites/`, chưa có thì tạm dùng model 3D GLB (CC0, Quaternius/Kenney).

Quy trình thêm sprite:
1. Đưa `art/PROMPTS.md` cho Antigravity (hoặc công cụ AI vẽ ảnh bất kỳ) → lưu ảnh **nền trắng** vào `art/raw/<id>.png` đúng tên id.
2. Chạy `npm run sprites` → tách nền, cắt sát, thu nhỏ vào `public/sprites/` + ghi `manifest.json` (cần ImageMagick 7).
3. Tải lại trang game.

Sửa danh sách ảnh / prompt: `tools/make_jobs.cjs` → chạy `node tools/make_jobs.cjs && node tools/make_prompts.cjs`.

## Cấu trúc
```
src/data/    số liệu: hệ, loài rồng, chiêu, cân bằng, đấu trường
src/logic/   luật chơi thuần TypeScript (không phụ thuộc 3D) — có test
src/render/  Three.js: cảnh đảo, công trình, rồng (sprite/GLB), màn đấu
src/ui/      HUD, các bảng, giao diện đấu
tools/       script tạo & xử lý sprite
```
