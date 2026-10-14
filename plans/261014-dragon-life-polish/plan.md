---
title: Rồng sống động và game hoàn thiện
description: >-
  Rồng tự đi/bay/vỗ cánh/phun hơi thở (shader + FSM + hạt), UI thủ công (icon
  vẽ, Baloo 2, khung gỗ), đảo sống + ngày đêm theo giờ máy, juice + nhạc ngũ
  cung
status: pending
priority: P2
branch: ''
tags:
  - render
  - ui
  - audio
  - gameplay-feel
blockedBy: []
blocks: []
created: '2026-10-14T05:04:40.600Z'
createdBy: 'ck:plan'
source: skill
---

# Rồng sống động và game hoàn thiện

## Overview
Game hiện đã chơi được (xem `README.md`), nhưng rồng là sprite PNG tĩnh đứng im, UI dùng emoji, đảo tĩnh. Plan này làm game "sống" và trông thủ công.
Nguồn quyết định: `plans/reports/brainstorm-261014-dragon-life-polish.md` (user đã duyệt).

Quyết định chốt:
- Vỗ cánh = **shader uốn ảnh** trên plane chia lưới (không vẽ thêm ảnh, không tách bộ phận).
- Rồng **đi quanh chuồng + thỉnh thoảng bay vòng đảo**, bấm rồng → phản ứng. Không cho rồng tương tác nhau.
- UI: **icon Antigravity vẽ** (fallback emoji) + **Baloo 2** + **khung gỗ CSS**.
- Ngày đêm **theo giờ máy**; PC chính, mobile tự giảm hiệu ứng.
- Nhạc **ngũ cung** tổng hợp WebAudio; nhạc trận trống.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Rồng sống động](./phase-01-r-ng-s-ng-ng.md) | Completed |
| 2 | [Giao diện thủ công](./phase-02-giao-di-n-th-c-ng.md) | Completed |
| 3 | [Đảo sống và ngày đêm](./phase-03-o-s-ng-v-ng-y-m.md) | Pending |
| 4 | [Juice và nhạc nền](./phase-04-juice-v-nh-c-n-n.md) | Pending |

Thứ tự bắt buộc 1 → 2 → 3 → 4 (3 dùng `particles` + `uLight` của 1; 4 dùng `particles` + hệ âm thanh). Sau mỗi phase: `npm test`, `npx tsc --noEmit`, `npm run build` xanh + user chơi thử.

## Ràng buộc chung
- Không phá save: field mới trong `GameState` phải có migrate trong `src/core/save.ts`. (Plan này dự kiến KHÔNG đổi GameState — mọi thứ là hiển thị.)
- Logic thuần (`src/logic`, `src/data`) không import three. Hành vi rồng (`behavior.ts`) chỉ dùng số thuần để test được bằng Vitest.
- Mọi con số tinh chỉnh (tốc độ, biên độ, xác suất) đặt trong data/hằng số đầu file, không rải trong code.
- Thiếu sprite/icon → luôn có fallback (GLB / emoji). Game không được vỡ khi chưa có ảnh.
- Giữ ≥ 55fps trên laptop phổ thông với 12 rồng, 20 công trình.

## Dependencies
Không phụ thuộc plan khác. Ảnh `_0`/`_2` và icon do user tạo bằng Antigravity — không chặn plan (có fallback).
