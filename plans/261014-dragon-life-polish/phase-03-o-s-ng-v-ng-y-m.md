---
phase: 3
title: "Đảo sống và ngày đêm"
status: pending
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 3: Đảo sống và ngày đêm

## Overview
Đảo có sự sống (cánh hoa rơi, bướm, chim, cá nhảy, bóng mây) và chu kỳ ngày–đêm theo giờ máy (bình minh, ngày, hoàng hôn, đêm sao trăng, đèn lồng, đom đóm). Tự giảm hiệu ứng trên máy yếu.

## Requirements
- Functional:
  - Keyframe theo giờ: 0 đêm · 5 rạng đông · 6.5 bình minh · 8 ngày · 17 nắng vàng · 18.5 hoàng hôn · 19.5 chạng vạng · 21 đêm. Nội suy mượt.
  - Điều khiển: hướng/màu/cường độ mặt trời, hemisphere, gradient trời, fog, màu biển (`uTint`), `uLight` cho rồng + `material.color` cho sprite công trình/trang trí.
  - Đêm: sao (Points), trăng, đèn lồng phát sáng (sprite glow + tối đa 4 PointLight gần camera), đom đóm quanh cây; rồng `night=true`.
  - Ngày: cánh hoa rơi quanh cây anh đào, 6–10 bướm, 3 hải âu lượn, cá nhảy gần bờ mỗi 5–10s (có tia nước), 2–3 bóng mây trôi trên cỏ.
  - Dev: nút giờ Sáng/Trưa/Chiều/Tối/Đêm/Thực.
- Non-functional: tier `high`/`low` (mobile/coarse pointer/≤4 lõi hoặc fps 3s đầu < 45): low → tắt bóng, pixelRatio 1, hạt x0.35, ambient giảm.

## Architecture
```
src/render/sky.ts       DayNight: setHour(h|null); update(now) → áp dụng lên scene/lights/sea/sprites; isNight
src/render/ambient.ts   Petals, Butterflies, Gulls, FishJumps, CloudShadows — mỗi cái có update(dt, t, light)
src/render/quality.ts   detectTier() + FpsProbe (3s) → 'high'|'low'
```
- `IslandScenery` (island.ts) trả ra: `skyTexture` cập nhật được, `seaMaterial`, danh sách vị trí `lantern`/`sakura`/cây để ambient dùng.
- Gradient trời: vẽ lại CanvasTexture tối đa mỗi 10s hoặc khi dev đổi giờ.
- Biển: thêm uniform `uTint` (nhân màu) + giảm lấp lánh ban đêm, thêm phản chiếu trăng (đốm sáng) khi đêm.
- Sprite unlit: DragonMesh `uLight`; SpriteMaterial công trình/trang trí `color = light`.

## Related Code Files
- Create: `src/render/sky.ts`, `src/render/ambient.ts`, `src/render/quality.ts`
- Modify: `src/render/island.ts` (xuất vị trí đèn/cây, biển `uTint`), `src/render/world.ts` (truyền `night` cho brain, light cho sprite), `src/render/dragonMesh.ts` (`uLight` đã có), `src/main.ts` (lights do sky điều khiển, tier áp dụng renderer), `src/ui/devTools.ts` (chọn giờ), `src/render/particles.ts` (đom đóm, tia nước dùng chung pool)

## Implementation Steps
1. `quality.ts` + áp dụng tier vào renderer/particles.
2. `sky.ts` keyframes + nội suy; nối lights/fog/sky/sea; dev chọn giờ.
3. `uLight` cho rồng & sprite; kiểm tra rồng không chói ban đêm.
4. Đêm: sao, trăng, đèn lồng glow + PointLight, đom đóm.
5. `ambient.ts`: cánh hoa → bướm → chim → cá nhảy → bóng mây (từng cái chơi thử).
6. Brain nhận `night` từ sky thay cho kiểm tra giờ tạm ở phase 1.
7. Chụp màn hình 5 mốc giờ; đo fps high/low.

## Success Criteria
- [ ] Dev chọn 20h: trời đêm có sao/trăng, đèn lồng sáng, đom đóm, rồng ngủ nhiều; rồng không chói.
- [ ] Dev chọn 6h/18h: bình minh cam, hoàng hôn tím–cam rõ rệt.
- [ ] Ban ngày thấy cánh hoa rơi, bướm, chim, cá nhảy, bóng mây.
- [ ] Giả lập mobile (DevTools) → tier low, vẫn ≥40fps.
- [ ] Không đổi `GameState`, save cũ vẫn chạy.

## Risk Assessment
- Quá nhiều PointLight làm tụt fps → tối đa 4, chọn đèn gần camera; tier low chỉ dùng glow sprite.
- Gradient trời đổi đột ngột khi nội suy màu HSL → nội suy RGB tuyến tính trong không gian linear.
- Ambient làm rối mắt → mật độ thấp, chuyển động chậm.
