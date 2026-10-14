---
phase: 2
title: "Giao diện thủ công"
status: pending
priority: P2
effort: "0.75d"
dependencies: [1]
---

# Phase 2: Giao diện thủ công

## Overview
Bỏ cảm giác "AI làm, rẻ tiền": thay emoji bằng icon tranh vẽ (Antigravity), font Baloo 2, khung bảng/nút dạng gỗ chạm viền vàng, nền giấy da.

## Requirements
- Functional:
  - ~18 icon: `icon_gold, icon_gem, icon_food, icon_xp, icon_dragon, icon_trophy, icon_build, icon_arena, icon_book, icon_settings, icon_collect, icon_fire, icon_water, icon_earth, icon_plant, icon_egg, icon_timer, icon_heart, icon_speed`.
  - `icon(name)` → `<img>` nếu có sprite, không thì emoji fallback (giữ map emoji hiện tại).
  - Áp dụng: HUD, menu, nhãn trên công trình, bảng, đấu trường, màn đấu, toast, badge hệ.
  - Font Baloo 2 (400/600/800, subset vietnamese) cho toàn bộ UI.
  - Khung gỗ: bảng, nút menu tròn kiểu huy hiệu, HUD dạng biển gỗ, nút bóng nổi khối.
- Non-functional: không ảnh hưởng fps; font lỗi mạng → fallback system font không vỡ layout.

## Architecture
- `tools/make_jobs.cjs`: thêm nhóm icon với `ICON_STYLE` ("polished casual fantasy game UI icon, bold readable silhouette, thick dark outline, glossy highlights, centered, plain flat pure white background, no text"). `make_prompts.cjs` thêm mục "7. Icon giao diện".
- `tools/cutout.cjs`: không đổi (icon đi cùng pipeline sprite → `public/sprites/icon_*.png`).
- `src/ui/icons.ts`:
```ts
export type IconName = 'gold' | 'gem' | ... ;
const EMOJI: Record<IconName, string> = { gold: '💰', gem: '💎', ... };
export function icon(name: IconName, size: 'xs'|'sm'|'md'|'lg' = 'sm'): HTMLElement
export function elementIcon(e: Element, size?): HTMLElement
```
- Text có icon: hàm `h()` đã nhận Node → dùng `icon()` trực tiếp; toast nhận `(text, kind, iconName?)`; nhãn công trình dựng bằng DOM thay vì textContent emoji.
- CSS: biến màu gỗ/vàng/giấy trong `:root`; `.panel-box` = viền gỗ (repeating-linear-gradient vân gỗ + inset shadow) + đinh vàng 4 góc (pseudo-element) + thân giấy da; `.btn` 3 lớp gradient + bevel + chữ viền.

## Related Code Files
- Create: `src/ui/icons.ts`
- Modify: `tools/make_jobs.cjs`, `tools/make_prompts.cjs` (regen `art/PROMPTS.md`), `index.html` (font link; HUD/menu sinh icon bằng JS), `src/style.css`, `src/ui/panels.ts`, `src/ui/battleUI.ts`, `src/ui/toast.ts`, `src/render/world.ts` (`updateLabels`), `src/main.ts` (HUD), `src/data/elements.ts` (giữ `icon` emoji làm fallback)

## Implementation Steps
1. Thêm job icon + regen `art/PROMPTS.md`; báo user cho Antigravity vẽ.
2. `icons.ts` với fallback emoji; `hasSprite` dùng chung.
3. Thay emoji trong HUD/menu (`index.html` → container rỗng, `main.ts` dựng), nhãn công trình, panels, battle, toast.
4. Font Baloo 2 (Google Fonts `display=swap`) + CSS theme gỗ/giấy.
5. Script kiểm tra: `node -e` quét `src/ui/*.ts`, `src/render/world.ts` tìm ký tự emoji ngoài `icons.ts`/`elements.ts` → phải 0.
6. Chụp màn hình so trước/sau.

## Success Criteria
- [ ] Khi đủ icon: không còn emoji hiển thị trên HUD, menu, bảng, nhãn (script quét = 0).
- [ ] Chưa có icon: UI vẫn đầy đủ bằng emoji fallback.
- [ ] Baloo 2 hiển thị đúng dấu tiếng Việt (ạ, ữ, ỗ, ặ…).
- [ ] Bảng/nút/HUD có khung gỗ; hiển thị ổn ở 375px chiều ngang.

## Risk Assessment
- Icon AI không đồng bộ phong cách → vẽ `icon_gold` trước làm tham chiếu (giống quy trình rồng).
- Icon nhỏ 24px mất chi tiết → prompt "bold readable silhouette"; cutout resize xuống 128.
- CSS vân gỗ nặng tay trông "plastic" → giữ tông trầm, ít gradient, kiểm tra trên màn hình thật.
