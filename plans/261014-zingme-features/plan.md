---
title: 'Đảo Rồng: rồng dạng động, hệ Sấm, khai hoang, sổ rồng & vòng quay'
description: >-
  4 module từ yêu cầu user: animation rồng (cho ăn, chọc đầu/bụng, ngủ, tụ lực),
  hệ Sấm + 3 loài, chướng ngại khai hoang + trang trí buff vàng, Sổ rồng khám
  phá + vòng quay hằng ngày
status: in-progress
priority: P2
branch: main
tags:
  - gameplay
  - render
  - ui
  - save-migration
blockedBy: []
blocks: []
created: '2026-10-14T06:59:39.269Z'
createdBy: 'ck:plan'
source: skill
---

# Đảo Rồng: rồng dạng động, hệ Sấm, khai hoang, sổ rồng & vòng quay

## Overview
Yêu cầu user (dán trực tiếp, 4 module). Quyết định đã chốt:
- Sấm > Nước, Đất > Sấm (giữ vòng cũ). Chiêu Sấm: 15% chí mạng x1.5, 20% choáng (đối thủ mất lượt).
- Lôi Long đầu tiên: **ghép 5 mảnh trứng** từ vòng quay hằng ngày → trứng vào lò ấp.
- Khai hoang: rồng đúng hệ được cử **đi tới** chướng ngại vật, **bận** (không lai/đấu) tới khi xong.

## Ràng buộc (từ user, bắt buộc)
- `src/logic`, `src/data` không import three; mọi luật mới có Vitest.
- Sau mỗi bước: `npm test` + `npx tsc --noEmit` xanh.
- Comment tiếng Việt; **save cũ không hỏng**: field mới thêm qua `migrate()` trong `src/core/save.ts`, giữ `SAVE_VERSION = 1`.

## Thay đổi GameState (tất cả có migrate)
| Field | Phase | Migrate save cũ |
|---|---|---|
| `Element` thêm `'lightning'` | 2 | không cần (chỉ mở rộng union) |
| `obstacles: Obstacle[]` | 3 | sinh chướng ngại xác định (seed) trên ô trống, tránh công trình |
| Building `decor` (`kind: 'totem' \| 'statue'`) | 3 | không cần |
| `discovered: SpeciesId[]` | 4 | = loài đang sở hữu (không thưởng) |
| `wheel: { lastSpinDay: string \| null }`, `fragments: number` | 4 | null / 0 |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Rồng dạng động](./phase-01-r-ng-d-ng-ng.md) | In Progress |
| 2 | [Hệ Sấm Sét](./phase-02-h-s-m-s-t.md) | Pending |
| 3 | [Khai hoang và trang trí](./phase-03-khai-hoang-v-trang-tr.md) | Pending |
| 4 | [Sổ rồng và vòng quay](./phase-04-s-r-ng-v-v-ng-quay.md) | Pending |

Thứ tự: 1 → 2 → 3 → 4 (4 cần loài Sấm của 2; 3 dùng rồng đi tới đích của 1). Mỗi phase xong: test + tsc + build + thử trình duyệt (`?dev=1`) + commit git.

## Dependencies
Tiếp nối plan `261014-dragon-life-polish` (đã xong). Ảnh mới (rồng Sấm, chuồng Sấm, totem/tượng, chướng ngại) thêm vào `art/PROMPTS.md`; thiếu ảnh dùng fallback.
