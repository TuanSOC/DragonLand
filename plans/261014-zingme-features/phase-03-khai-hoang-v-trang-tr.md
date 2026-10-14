---
phase: 3
title: "Khai hoang và trang trí"
status: pending
priority: P2
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Khai hoang và trang trí

## Overview
Chướng ngại vật (đá tảng, cây cổ thụ) chiếm ô lưới; người chơi trả vàng + cử rồng đúng hệ (Lửa đốt cây, Đất đập đá) chờ một lúc để khai hoang. Vật trang trí Totem Nguyên Tố (+10%) / Tượng Rồng Thần (+15%) tăng vàng chuồng trong bán kính 2 ô.

## Requirements
- `Obstacle { id, kind: 'rock' | 'tree', x, z, size: 1 | 2, clearing: (Timer & { dragonId }) | null }`.
- Khai hoang: cây cần rồng có hệ `fire`, đá cần `earth`; giá: cây 80 / đá 150 vàng (size 2 x2); thời gian 60s / 120s (x size). Rồng đó **bận** tới khi xong (không lai, không đấu, không bị chọn khai hoang khác). Xong → bấm thu: xoá chướng ngại, +XP, 20% +1💎.
- `canPlace` chặn ô có chướng ngại. Game mới: ~10 chướng ngại; save cũ: migrate sinh xác định (seed theo nextId) trên ô trống, không đè công trình.
- Trang trí: shop thêm `totem` (300 vàng, +10%), `statue` (1 💎×? → 800 vàng, +15%), footprint 1 ô. Buff: chuồng có tâm cách tâm trang trí ≤ 2 ô (khoảng cách ô) nhận cộng dồn, tối đa +40%. Đặt/dời/xoá trang trí → settle mọi chuồng bị ảnh hưởng trước.
- Hiển thị: chướng ngại GLB (rockLarge / tree tô màu cổ thụ) hoặc sprite; nhãn "đang khai hoang m:ss"; rồng được cử bay tới đứng cạnh (herd: `task` target thay home) phun lửa/đập đá định kỳ; trang trí: sprite hoặc mô hình thủ tục (cột đá phát sáng / tượng rồng).
- Bảng chuồng hiển thị "+x% từ trang trí".

## Architecture
- Logic: `src/logic/obstacles.ts` (generate, startClearing, finishClearing, isBusy), `src/logic/decor.ts` (decorBonus(state, habitat)), `economy.habitatRate` nhân bonus; `grid.canPlace` xét obstacles; `breeding/battle/hatchery` kiểm `isBusy`.
- Render: `world.ts` view cho obstacles; `herd.ts` nhận `taskOf(dragonId)` → brain về chỗ làm việc (env.home = vị trí chướng ngại, radius 1).
- UI: bấm chướng ngại → bảng khai hoang (chọn rồng hợp lệ); shop thêm mục Trang trí.

## Success Criteria
- [ ] Không xây được lên ô có chướng ngại (test).
- [ ] Khai hoang: trừ vàng, rồng bận (không lai/đấu được — test), xong thì ô trống & +XP (test).
- [ ] Totem cạnh chuồng: vàng/phút tăng 10%; xa >2 ô không tăng; settle đúng (test).
- [ ] Save cũ mở lên có chướng ngại, không đè công trình (test migrate).
- [ ] Trình duyệt: rồng bay tới chướng ngại làm việc; trang trí hiển thị.
