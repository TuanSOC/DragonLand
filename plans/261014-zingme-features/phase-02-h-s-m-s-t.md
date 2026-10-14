---
phase: 2
title: "Hệ Sấm Sét"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Hệ Sấm Sét

## Overview
Hệ thứ 5 `lightning` + 3 loài (Lôi Long, Rồng Lôi Hỏa, Rồng Lôi Thủy), chiêu Sấm có chí mạng & choáng, chuồng Sấm, hạt tia sét.

## Requirements
- `BEATS: Record<Element, Element[]>`: fire→[plant], plant→[earth], earth→[water, lightning], water→[fire], lightning→[water]. `elementMultiplier` giữ kẹp [0.5, 2].
- Loài: `thunder` (Lôi Long, thuần), `stormfire` (Lôi Hỏa = lightning+fire), `stormwater` (Lôi Thủy = lightning+water). Hiếm `rare`, hatch 180–240s.
- Chiêu: `lightning1` Tia Chớp (1.0, cấp 1), `lightning2` Sấm Sét Giáng Trần (1.9, cấp 5, hồi 2). `Attack` thêm `crit?`, `stun?` (xác suất). Sấm: crit 0.15, stun 0.2.
- Battle: chí mạng x1.5; choáng → bên bị choáng mất lượt kế tiếp (`TurnEvent` thêm `crit`, `stun`, và event `skipped`). AI/người chơi đều áp dụng.
- Chuồng Sấm `HABITAT_COST.lightning = 400`; personality Sấm (hay bay, hay gầm); hạt `lightning` (tia xanh trắng, additive, nhanh); màu nền chuồng fallback.
- Lôi Long KHÔNG lai ra được từ 4 hệ cũ (chỉ từ mảnh trứng — phase 4). Lai Lôi Long × Lửa/Nước → có thể ra lai Sấm (đã đúng theo luật pool hiện tại).
- Prompt ảnh: 3 loài × 3 giai đoạn, trứng, `habitat_lightning`, `icon_lightning`.

## Related Code Files
- Modify: `src/data/elements.ts`, `src/data/dragons.ts`, `src/data/attacks.ts`, `src/data/balance.ts`, `src/data/personality.ts`, `src/logic/battle.ts`, `src/render/particles.ts`, `src/render/world.ts` (PLATFORM_COLOR), `src/ui/icons.ts`, `src/ui/panels.ts` (gợi ý khắc chế dùng mảng), `src/ui/battleUI.ts` (hiện chí mạng/choáng), `tools/make_jobs.cjs`
- Tests: `tests/logic.test.ts` (+khắc chế Sấm, lai), `tests/lightning.test.ts` (crit/stun với rng cố định)

## Success Criteria
- [ ] Sấm đánh Nước x2, Đất đánh Sấm x2; khắc cũ không đổi (test).
- [ ] Chí mạng x1.5, choáng làm mất lượt (test rng cố định).
- [ ] Xây được Chuồng Sấm; Lôi Long × Lửa có thể ra Lôi Hỏa (test).
- [ ] Màn đấu hiện "CHÍ MẠNG!" / "CHOÁNG!"; hạt sét khi dùng chiêu Sấm.
- [ ] test + tsc + build xanh; save cũ chạy.
