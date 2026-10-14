---
phase: 4
title: "Sổ rồng và vòng quay"
status: pending
priority: P2
effort: "0.75d"
dependencies: [2]
---

# Phase 4: Sổ rồng và vòng quay

## Overview
Sổ Tay Rồng thành Bộ Sưu Tập: loài chưa khám phá hiện bóng tối + "???", loài đã có sáng lên với chỉ số, cốt truyện, phần thưởng kim cương lần đầu. Vòng quay may mắn mỗi ngày 1 lượt miễn phí: vàng / thức ăn / kim cương / mảnh trứng Sấm; đủ 5 mảnh → trứng Lôi Long.

## Requirements
- `discovered: SpeciesId[]`; khi rồng mới xuất hiện (nở, khởi tạo) lần đầu → thêm vào + thưởng `CODEX_REWARD` (thường 3💎, hiếm 8💎) + toast "Khám phá loài mới!".
- `SPECIES` thêm `lore` (2–3 câu); Sổ hiện tiến độ x/13 + mốc thưởng (đủ 50%/100%: +10💎/+30💎, mỗi mốc 1 lần — `codexMilestones: number[]`).
- Vòng quay: 8 ô có trọng số: 200 vàng, 500 vàng, 1000 vàng, 60 thức ăn, 150 thức ăn, 3💎, 8💎, 1 mảnh trứng Sấm (xác suất ~18%). `spinWheel(state, today, rng)`: 1 lượt/ngày theo ngày lịch máy (YYYY-MM-DD); trả về ô trúng.
- `fragments` ≥ 5 + lò ấp còn chỗ → nút "Ghép trứng Lôi Long" (trừ 5 mảnh, trứng `thunder` vào lò).
- UI: nút menu "Vòng quay" có chấm đỏ khi còn lượt; vòng quay vẽ bằng CSS conic-gradient + quay bằng transform, dừng đúng ô; nhạc/hiệu ứng.

## Related Code Files
- Create: `src/logic/codex.ts`, `src/logic/wheel.ts`, `tests/codex-wheel.test.ts`
- Modify: `src/logic/state.ts`, `src/core/save.ts` (migrate), `src/logic/hatchery.ts` (gọi discover), `src/data/dragons.ts` (lore), `src/ui/panels.ts` (Sổ + vòng quay), `index.html` (nút menu), `src/main.ts`, `src/style.css`

## Success Criteria
- [ ] Nở loài mới → +💎 đúng 1 lần (test); save cũ: loài đang có = đã khám phá, không thưởng lại (test migrate).
- [ ] Quay 1 lần/ngày; ngày mới quay lại được (test); phân phối trọng số đúng (test 10k lần rng seed).
- [ ] 5 mảnh → trứng Lôi Long vào lò ấp (test); thiếu chỗ báo lỗi.
- [ ] Sổ hiển thị bóng tối cho loài chưa có, tiến độ x/13, mốc thưởng.
- [ ] test + tsc + build xanh; thử trình duyệt.
