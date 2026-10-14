---
phase: 1
title: Rồng dạng động
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 1: Rồng dạng động

## Overview
Rồng "có hồn" hơn: thở squash/stretch + nhấp nhô toàn thân, ngủ nằm sụp thở chậm, cho ăn có động tác đớp mồi + tim/hạt thức ăn, chọc đầu vs chọc bụng phản ứng khác nhau, tụ lực trước đòn trong màn đấu, hit-stop 80ms.

## Requirements
- Idle: `sy = 1 + sin·0.025`, `sx = 1 − sin·0.012`, bob y = |sin|·2% chiều cao (lệch pha từng con).
- Sleep: sy 0.86, sx 1.05, thở chậm (chu kỳ ~3.5s), cánh `rest`.
- Feed (`feedDragon` thành công trong bảng chuồng): rồng ngửa (nghiêng ra sau) → há mồm đớp (nhún xuống) → `happy` nhảy 2 lần; hạt `heart` + vụn thức ăn từ miệng. Lên cấp: thêm `sparkle`.
- Click: UV v ≥ mouth.v − 0.12 (vùng đầu) → `flinch` (rụt nhỏ lại + rung + gầm nhỏ); còn lại → `dance` (nhảy 2 nhịp, lắc trái phải).
- Màn đấu: `charge` 0.35s trước đòn (nhấp sáng màu hệ + hạt tụ về); hit-stop 80ms (đang 90ms).
- Không đổi GameState.

## Architecture
- `AnimName` thêm `eat | flinch | dance | charge`.
- `DragonLike.pick()` trả thêm `zone: 'head' | 'body'` (sprite: theo UV + meta.mouth; GLB: theo độ cao điểm chạm).
- `DragonHerd.feed(dragonId, leveledUp)`, `react(dragonId, zone)`; `DragonBrain.react()` đã có (đứng yên 1.6s).
- `particles.ts` thêm kind `heart` (hồng, bay lên, nhỏ dần), `crumb` (vụn nâu, rơi).
- `DragonMesh` thêm uniform `uGlow` (màu + cường độ) cho tụ lực.
- Panel → hook `feed(dragonId, leveledUp)` (PanelHooks), main gọi herd.

## Related Code Files
- Modify: `src/render/dragonView.ts`, `src/render/dragonMesh.ts`, `src/render/herd.ts`, `src/render/particles.ts`, `src/render/battleView.ts`, `src/render/world.ts`, `src/ui/panels.ts`, `src/main.ts`

## Success Criteria
- [x] Idle thấy rồng thở + nhấp nhô; đêm rồng nằm sụp thở chậm.
- [x] Cho ăn: rồng ngửa cổ đớp mồi, nhảy, tim bay ra; lên cấp có lấp lánh.
- [x] Chọc đầu (rụt cổ, gầm, phì hơi) ≠ chọc bụng (nhảy múa, tim).
- [x] Màn đấu: tụ lực 0.35s (phát sáng màu hệ + lấp lánh), hit-stop 80ms + rung.
- [x] test (34) + tsc xanh.

## Ghi chú
- Hạt trái tim vẽ bằng SDF trong shader (aShape). Thêm `?dev=<tên>` để có save dev riêng khi thử.
- CSS animation (Zzz, chữ bay) bị đóng băng trong tab bị công cụ tự động điều khiển — kiểm tra bằng DOM, không thấy trên ảnh chụp.
