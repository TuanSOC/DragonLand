# Brainstorm: Đảo Rồng 3D (remake Zing Me) — 2026-10-14

## Problem / Requirements
- Remake game nuôi rồng "Đảo Rồng" (Zing Me) dạng 3D, chạy web.
- Repo trống, bắt đầu từ zero.
- Chốt với user:
  - Tech: Three.js + TypeScript + Vite, comment tiếng Việt (mục đích học).
  - Lưu: offline, localStorage, 1 người chơi, không server.
  - Đồ họa: low-poly dựng bằng code (không asset ngoài).
  - Nội dung: 4 hệ, 10 loài rồng.
  - Thời gian: giờ thật (timestamp), rút ngắn 30s–5p, kim cương tăng tốc.
  - Đấu: PvE theo lượt, chọn chiêu, 1v1 rồi 3v3.
  - MVP gồm cả 4 hệ thống: đảo+chuồng, ấp+lai tạo, ruộng+nuôi lớn, đấu rồng.

## Approaches đã cân nhắc
| Approach | Pros | Cons |
|---|---|---|
| **A. Three.js thuần + DOM UI + logic TS thuần** (CHỌN) | nhẹ, dễ học, logic test được độc lập 3D | tự viết raycast picking + panel UI |
| B. React Three Fiber + React | UI tiện, ecosystem lớn | thêm React, 2 vòng render, khó debug cho người mới |
| C. Babylon.js | GUI/inspector sẵn | ít ví dụ hơn, user đã chọn Three.js |

## Kiến trúc chốt
Nguyên tắc: **logic thuần (không import three) ← render/ui đọc state**. Mọi con số trong `data/`.

```
src/
  data/    elements.ts dragons.ts buildings.ts balance.ts
  logic/   state.ts economy.ts breeding.ts hatchery.ts farm.ts battle.ts   (pure, Vitest)
  core/    clock.ts save.ts(versioned JSON) events.ts
  render/  scene.ts camera.ts island.ts dragonFactory.ts buildingMeshes.ts picking.ts
  ui/      hud.ts panels/*.ts
  main.ts
tests/
```
- Timer = `{startedAt, durationMs}`; tiến độ = f(Date.now()) → offline progress miễn phí.
- Save có `version` để migrate sau này.
- Random có thể inject (seed) để test lai tạo/đấu deterministic.

## Gameplay spec
- Khắc chế vòng: Lửa > Cây > Đất > Nước > Lửa. Mạnh x2, yếu x0.5.
- Rồng (10): thuần Hỏa/Thủy/Thổ/Mộc Long; lai Hơi Nước(L+N), Dung Nham(L+Đ), Hỏa Hoa(L+C), Bùn Lầy(N+Đ), Đầm Lầy(N+C), Gỗ Đá(Đ+C).
- Chuồng theo hệ, sức chứa 2; rồng ở chuồng khớp 1 hệ của nó; sinh vàng/phút theo cấp+độ hiếm; có giới hạn kho, bấm thu.
- Núi lai: 2 rồng cấp ≥4 → trứng; pool = loài khớp hệ bố mẹ, weighted random; lai hiếm hơn, ấp lâu hơn.
- Lò ấp: 30s–5p; nở → đặt vào chuồng còn chỗ; kim cương nở ngay.
- Ruộng: trồng tốn vàng → chờ → thu thức ăn. 4 lần ăn = +1 cấp, max 10. Giai đoạn hình: 1-3 con, 4-6 nhỡ, 7+ trưởng thành.
- Đấu: 8 đối thủ AI tăng dần; 1v1 trước, mở 3v3; 2-4 chiêu/rồng theo hệ, mở theo cấp; thưởng vàng/kim cương.
- Camera isometric-ish, xoay/zoom; lưới đặt công trình.

## Milestones & acceptance
| M | Scope | Done khi |
|---|---|---|
| M1 | scaffold, đảo 3D, camera, lưới, chuồng, rồng khởi đầu, vàng, save/load | đặt chuồng; vàng tăng theo giờ thật cả khi đóng tab; F5 giữ dữ liệu |
| M2 | núi lai, lò ấp, trứng, nở, tăng tốc kim cương | Lửa+Nước có thể ra Hơi Nước; nở đúng giờ; test bảng lai |
| M3 | ruộng, thức ăn, cho ăn, lên cấp, hình lớn dần | đủ ăn → lên cấp → vàng/phút tăng, mesh đổi giai đoạn |
| M4 | màn đấu, chiêu, AI, khắc chế, chuỗi 8 trận | Lửa→Cây x2; thắng → thưởng + mở trận kế; test công thức sát thương |

## Out of scope
Server/tài khoản, bạn bè, PvP online, nạp tiền, nhiệm vụ/thành tựu, âm thanh, tối ưu mobile (chỉ touch cơ bản), nhiều đảo.

## Risks
- Rồng low-poly code → nhìn "đồ chơi"; cô lập trong `dragonFactory.ts` để sau đổi GLB.
- Balance cần chỉnh nhiều → tập trung `balance.ts`.
- UI panel tốn công hơn 3D → giữ DOM đơn giản, 1 panel manager.

## Success metrics
- `npm run dev` chạy, mở trình duyệt chơi được trọn vòng: thu vàng → trồng → cho ăn → lai → ấp → đấu.
- `npm test` xanh cho economy/breeding/farm/battle.
- Không lỗi console; 60fps trên laptop phổ thông với ~20 công trình.

## Next steps
/ck:plan (default) → implement M1 → M2 → M3 → M4.
