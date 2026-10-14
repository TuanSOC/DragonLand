---
phase: 4
title: "Juice và nhạc nền"
status: pending
priority: P3
effort: "0.75d"
dependencies: [1, 2]
---

# Phase 4: Juice và nhạc nền

## Overview
Thao tác "đã tay" (xu bay vào HUD, số đếm chạy, công trình nảy, camera bay vào, khựng màn hình) và nhạc nền ngũ cung tổng hợp; vào trận đổi nhạc trống. Âm lượng nhạc/hiệu ứng riêng, lưu lại.

## Requirements
- Functional:
  - Thu vàng (đồng xu / Thu hết / bảng chuồng): 6–12 icon xu bay theo đường cong từ vị trí chuồng trên màn hình vào ô vàng HUD; số vàng tăng dần 0.6s; ô HUD nảy khi xu tới.
  - Tương tự cho thức ăn (thu hoạch) và kim cương (lên cấp/thưởng).
  - Xây công trình: nảy scale 0→1.15→1 trong 0.4s + vòng bụi (particles `dust`).
  - Mở game: camera từ cao/xa bay vào vị trí mặc định 2.2s (bỏ qua nếu `prefers-reduced-motion`).
  - Màn đấu: khựng 80ms khi trúng đòn khắc hệ (cộng với rung của phase 1).
  - Nhạc đảo: ngũ cung (C D E G A, 2 quãng tám), pluck Karplus–Strong (đàn tranh), sáo (sine + vibrato + hơi thở), pad nhẹ; tempo ~72; câu 2 ô nhịp, đi bước ngẫu nhiên trên thang, 40% nghỉ; reverb convolver tự sinh.
  - Nhạc trận: tempo ~120, taiko (sine 60Hz trượt + noise), ostinato pluck; crossfade 1.5s khi vào/ra trận.
  - Cài đặt: 2 thanh trượt Nhạc / Hiệu ứng (0–100), lưu localStorage; thay nút tắt âm cũ (0 = tắt).
- Non-functional: nhạc chỉ bắt đầu sau thao tác đầu tiên (autoplay policy); CPU nhạc < 3% (lập lịch trước 0.2s bằng `AudioContext.currentTime`).

## Architecture
```
src/ui/audio.ts    AudioContext dùng chung + master → musicGain / sfxGain; volume lưu localStorage
src/ui/sound.ts    sfx() nối vào sfxGain (bỏ ctx riêng)
src/ui/music.ts    MusicPlayer: setMode('island'|'battle'|'off'); scheduler lookahead 0.2s
src/ui/juice.ts    flyIcons(fromScreen, toEl, icon, n), tweenNumber(el, from, to, ms), bump(el)
```
- `world.screenPos(buildingId, camera)` → toạ độ màn hình để bắt đầu xu bay.
- HUD giữ "giá trị đang hiển thị" riêng để tween (không đọc thẳng state mỗi frame).
- Camera intro trong `main.ts` dùng tween đơn giản (đã có mẫu tween trong battleView — tách `core/tween.ts` nếu dùng ≥2 nơi).

## Related Code Files
- Create: `src/ui/audio.ts`, `src/ui/music.ts`, `src/ui/juice.ts`, (tuỳ) `src/core/tween.ts`
- Modify: `src/ui/sound.ts`, `src/main.ts` (HUD tween, coin flight, camera intro), `src/render/world.ts` (`screenPos`, pop khi xây), `src/render/battleView.ts` (hit-stop), `src/ui/battleUI.ts` (đổi nhạc), `src/ui/panels.ts` (thanh trượt âm lượng; thu vàng trong bảng → xu bay)

## Implementation Steps
1. `audio.ts` + chuyển `sound.ts` sang dùng chung; thanh trượt âm lượng (migrate key mute cũ → sfx 0).
2. `music.ts`: synth pluck/sáo/pad + scheduler + reverb; chế độ đảo; nghe thử chỉnh âm lượng mặc định thấp (~25%).
3. Nhạc trận + crossfade, nối vào `BattleUI.start/exit`.
4. `juice.ts`: xu bay + tween số + bump; nối 3 đường thu vàng, thu hoạch, thưởng.
5. Pop + bụi khi xây; camera intro; hit-stop.
6. Chơi thử 10 phút liên tục: nhạc không lặp nhàm, không rè/clip, không rò bộ nhớ (node âm thanh được disconnect).

## Success Criteria
- [ ] Thu vàng thấy xu bay vào HUD, số tăng dần, ô HUD nảy.
- [ ] Xây công trình có nảy + bụi; mở game có camera bay vào.
- [ ] Nhạc ngũ cung phát sau click đầu; vào trận đổi trống, ra trận đổi lại (crossfade).
- [ ] Thanh trượt Nhạc/Hiệu ứng hoạt động, giữ sau F5; 0 = im lặng.
- [ ] 10 phút chơi: không lỗi console, heap không tăng liên tục.

## Risk Assessment
- Nhạc tổng hợp nghe "điện tử/rẻ" → âm lượng thấp, nốt thưa, reverb nhẹ; có nút tắt; nếu vẫn tệ, đề xuất user dùng nhạc CC0 (ngoài phạm vi).
- Xu bay DOM nhiều gây giật → tối đa 12 phần tử/lần, dùng transform + `will-change`.
- Lệch toạ độ màn hình khi canvas resize → tính tại thời điểm bắn, không cache.
