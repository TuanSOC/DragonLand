# Brainstorm: Rồng sống động + game hoàn thiện — 2026-10-14

## Problem
- Rồng sprite = 1 PNG tĩnh (`render/sprites.ts` THREE.Sprite); "animation" chỉ co giãn/nhảy/nháy (`SpriteDragonView`).
- Rồng đứng cố định trước chuồng (`world.ts` slot theo camera); không đi, không bay, bấm rồng không phản ứng.
- UI dùng emoji → trông "AI làm", rẻ. Đảo tĩnh, không ngày đêm, không nhạc.
- 10/30 ảnh rồng (`_1`) có; `_0`, `_2` chờ Antigravity.

## Requirements (chốt với user)
- Vỗ cánh: **A. shader uốn ảnh** (không vẽ thêm).
- Di chuyển: **đi quanh chuồng + thỉnh thoảng bay dạo đảo**; bấm rồng → phản ứng.
- "Tránh AI" = **game trông như AI làm/rẻ** → UI thủ công.
- Thêm: sự sống môi trường, ngày–đêm **theo giờ máy**, juice, nhạc nền **phương Đông** (ngũ cung).
- UI: **icon do Antigravity vẽ + font Baloo 2 + khung gỗ/đá CSS**, emoji fallback.
- Thiết bị: **PC chính, điện thoại chạy được** (auto giảm hiệu ứng).

## Approaches — vỗ cánh
| | Pros | Cons |
|---|---|---|
| **A shader uốn ảnh (chọn)** | 0 art mới, áp mọi rồng | biên độ giới hạn, phụ thuộc bố cục ảnh |
| B tách bộ phận | vỗ thật | vẽ lại x3, AI lệch khớp |
| C sprite sheet | hoạt hình thật | AI vẽ frame không đồng nhất → giật |

## Design
```
render/dragonMesh.ts   thân: plane lưới + ShaderMaterial (uFlap, uFlapSpeed, uBreath, uTailSway, uFlip, uFlash, uOpacity, uLight)
                       billboard trục Y (đứng thẳng, quay về camera)
render/behavior.ts     não: FSM idle/wander/sit/sleep/roar/breathe/takeoff/fly/land/react; rng+time inject → test
render/particles.ts    pool hạt: lửa/nước/đá/lá/bụi/khói; Zzz CSS2D
public/sprites/meta.json  {id: {mouth:[u,v], bodyU, wingInner, wingTop, flapAmp}} + default
render/sky.ts          ngày đêm theo giờ máy: sun/hemi/sky gradient/sea tint/fog/stars/moon/lanterns/fireflies
render/ambient.ts      cánh hoa, bướm, chim, cá nhảy, bóng mây
ui/icons.ts            icon(name) → img hoặc emoji fallback
ui/music.ts            WebAudio ngũ cung: pluck Karplus-Strong + sáo + pad; nhạc trận trống
```

### Shader uốn cánh
- weight cánh = smoothstep(wingInner, 0.5, |u-bodyU|) * smoothstep(wingTop, 1, v)
- y += sin(t*speed)*amp*weight*H; x co nhẹ theo pha; thân: scale quanh bodyU theo breath; đuôi (v thấp, phía sau) lắc x.
- uLight nhân màu theo trời (đêm tối hơn); uFlash đỏ khi trúng đòn.

### Hành vi
- Cá tính theo hệ (trọng số state): fire roar/breathe nhiều; earth đi chậm; plant ngủ nhiều; water bay nhiều; lai = trộn.
- Wander: điểm ngẫu nhiên bán kính ~3.5 quanh chuồng, trong đảo, ngoài footprint công trình khác; hop nhẹ khi đi; lật mặt theo hướng màn hình.
- Fly tour: tối đa 1 con bay cùng lúc, cooldown 40–90s/con; cất cánh → vòng quanh đảo cao 6–8 → đáp về + bụi.
- Đêm: ngủ ưu tiên, Zzz.
- Click rồng: react (gầm + phun + nhảy + sfx) + tooltip tên/cấp.
- GLB fallback dùng chung behavior (bay sẵn).

## Phases & acceptance
| GĐ | Done khi |
|---|---|
| 1 Rồng sống | để yên 1' thấy đi/ngồi/gầm/phun theo hệ; có con bay vòng đảo & đáp; cánh vỗ rõ khi bay; click có phản ứng; không xuyên công trình/ra ngoài đảo; 60fps với 12 rồng; test FSM |
| 2 UI thủ công | HUD/menu/bảng không còn emoji khi đủ icon; Baloo 2 đúng dấu; khung gỗ |
| 3 Đảo sống + ngày đêm | 20h thấy đêm + đèn lồng + đom đóm; ngày có hoa rơi/chim/bóng mây; mobile chạy được (tier thấp) |
| 4 Juice + nhạc | xu bay vào HUD; nhạc ngũ cung, vào trận đổi nhạc; volume nhạc/sfx riêng, lưu lại |

## Out of scope
Tách bộ phận cánh (B), rồng tương tác nhau, loài mới, PvP/server, redesign UI riêng mobile.

## Touchpoints
`render/dragonView.ts` (SpriteDragonView → dragonMesh), `render/world.ts` (slot cố định → behavior), `render/sprites.ts`, `render/battleView.ts`, `render/island.ts`, `ui/panels.ts`, `ui/battleUI.ts`, `ui/devTools.ts` (chỉnh giờ), `ui/sound.ts`, `main.ts`, `index.html`, `style.css`, `tools/make_jobs.cjs` (+icons), `tools/cutout.cjs`.

## Risks
- Shader cánh phụ thuộc bố cục ảnh → meta per-sprite + giảm amp khi xấu.
- Sprite unlit sáng chói ban đêm → uLight theo trời.
- Nhạc tổng hợp dễ "điện tử" → volume thấp mặc định, thưa nốt, nút tắt.
- Perf mobile → tier theo fps 3s đầu: giảm hạt, tắt bóng.
- Khối lượng: GĐ1 ≈ 50%.

## Next
`/ck:plan` → GĐ1 → GĐ2 → GĐ3 → GĐ4, mỗi GĐ user chơi thử.
