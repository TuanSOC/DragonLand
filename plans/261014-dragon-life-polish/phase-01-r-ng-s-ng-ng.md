---
phase: 1
title: Rồng sống động
status: completed
priority: P1
effort: 1.5d
dependencies: []
---

# Phase 1: Rồng sống động

## Overview
Rồng sprite có "cơ thể" (vỗ cánh, thở, vẫy đuôi bằng shader) và "bộ não" (tự đi, ngồi, ngủ, gầm, phun hơi thở theo hệ, thỉnh thoảng bay vòng đảo). Bấm rồng → phản ứng. Màn đấu có luồng hơi thở + rung màn hình.

## Requirements
- Functional:
  - Cánh uốn lên xuống: nhẹ khi đứng, mạnh/nhanh khi bay. Ngực phập phồng, đuôi vẫy.
  - Rồng luôn đứng thẳng, quay mặt về camera quanh trục Y; lật trái/phải theo hướng di chuyển trên màn hình.
  - FSM: `idle, walk, sit, sleep, roar, breathe, takeoff, fly, land, react`. Trọng số theo hệ (cá tính).
  - Đi lang thang trong bán kính ~3.5 quanh chuồng, không vào footprint công trình khác, không ra khỏi đảo.
  - Bay vòng đảo: tối đa 1 con bay cùng lúc; cooldown 40–90s/con; đáp về đúng chuồng, có bụi.
  - Đêm (tạm: giờ máy ≥19h hoặc <6h) ưu tiên ngủ, hiện "Zzz".
  - Bấm rồng: gầm + phun + nhảy + âm thanh + tooltip tên/cấp 2s. Bấm rồng ưu tiên hơn bấm công trình.
  - Hơi thở theo hệ: lửa (cam→khói), nước (giọt xanh, rơi), đất (mảnh đá nâu, rơi), cây (lá xanh bay lượn). Rồng lai trộn 2 màu.
  - Màn đấu: rồng vỗ cánh khi chờ; đòn có luồng hơi thở từ miệng; đòn khắc hệ rung camera 0.25s.
- Non-functional: 12 rồng ≥55fps; tối đa 600 hạt (mobile 200) trong 1 draw call; FSM có test.

## Architecture
```
src/core/rng.ts              seeded(seed) — chuyển từ island.ts/world.ts (DRY)
src/data/personality.ts      trọng số hành vi theo hệ + tốc độ đi; lai = trung bình 2 hệ
src/data/spriteMeta.ts       DEFAULT {mouth:[u,v], bodyU, wingInner, wingTop, flapAmp} + override theo sprite id
src/render/dragonMesh.ts     Mesh(PlaneGeometry 1x1, 24x16 seg, gốc giữa-dưới) + ShaderMaterial
src/render/behavior.ts       DragonBrain (số thuần, không three) + FlightToken
src/render/particles.ts      ParticleSystem: pool THREE.Points, emit(kind, origin, dir, n)
src/render/dragonView.ts     SpriteDragonView dùng DragonMesh; DragonLike mở rộng
src/render/world.ts          dragonLayer (toạ độ thế giới) + map dragonId → {brain, view}
```

### Shader (dragonMesh.ts) — pseudo GLSL
```glsl
// uv.x đã lật khi uFlip: su = uFlip>0.5 ? 1.0-uv.x : uv.x  (dùng su để lấy texture)
float bodyX = uFlip > 0.5 ? 1.0 - uBodyU : uBodyU;      // tâm thân trên màn hình
float side  = uv.x - bodyX;
float wing  = smoothstep(uWingInner, uWingInner + 0.25, abs(side)) * smoothstep(uWingTop, 1.0, uv.y);
float flap  = sin(uTime * uFlapSpeed + uPhase);
p.y += flap * uFlapAmp * wing;                           // đơn vị: chiều cao plane (1.0)
p.x -= sign(side) * abs(flap) * uFlapAmp * 0.3 * wing;   // cánh co vào ở hai đầu nhịp
float chest = exp(-pow(side / 0.15, 2.0)) * smoothstep(0.2, 0.45, uv.y) * smoothstep(0.75, 0.5, uv.y);
p.x += side * uBreath * chest;
float tail = smoothstep(0.35, 0.0, uv.y) * smoothstep(0.1, 0.4, abs(side));
p.x += sin(uTime * 1.7 + uPhase) * uTail * tail;
```
Fragment: `tex = texture2D(map, vec2(su, uv.y))`; `discard` nếu a < 0.08; `rgb = tex.rgb * uLight`; `mix(rgb, red, uFlash*0.55)`; `a *= uOpacity`. `uLight` = trắng ở phase 1 (phase 3 điều khiển).
Billboard trục Y: `mesh.rotation.y = atan2(cam.x - wp.x, cam.z - wp.z)` mỗi frame.
Chế độ flap: `rest` (amp 0.02, speed 2), `idle` (0.05, 3), `fly` (0.16·flapAmp, 9).

### Bộ não (behavior.ts)
```ts
export interface BrainEnv {
  home: { x: number; z: number }; radius: number; night: boolean;
  isFree(x: number, z: number): boolean;   // trong đảo + ngoài footprint công trình khác
  flight: FlightToken;                      // { holder: number | null } — chỉ 1 con bay
}
export type BrainEvent = 'roar' | 'breathe' | 'takeoff' | 'land' | 'step';
export class DragonBrain {
  x; y; z; state; t; facing (-1|1 theo vận tốc thế giới, view tự đổi sang hướng màn hình)
  constructor(id: number, elements: Element[], rng: Rng, x, z)
  update(dt: number, env: BrainEnv): BrainEvent[]
  react(): void            // ép vào 'react' (nhảy + roar + breathe)
}
```
- Chọn state kế: random theo trọng số personality; đêm nhân `sleep` x4.
- `walk`: chọn đích (≤8 lần thử, `isFree`), tốc độ theo personality, nảy y nhẹ theo bước; tới đích → `idle`.
- `takeoff` (0.8s, y→7) → `fly` (8–12s, quỹ đạo tròn tâm đảo bán kính 14–17, độ cao 6–8, nhấp nhô) → `land` (1s, về home) → phát `land` (bụi). Cooldown bay 40–90s.
- `breathe`/`roar` phát event 1 lần; view + particles + sound xử lý.

### Particles (particles.ts)
BufferGeometry attributes: position, velocity (CPU), color, size, life. ShaderMaterial điểm tròn mềm, `depthWrite:false`, additive cho lửa/tia, normal cho đất/lá (2 Points: additive + normal). Kinds: `fire, water, earth, plant, dust, sparkle`. `breath(origin, dir, elements, duration)` phát luồng.

## Related Code Files
- Create: `src/core/rng.ts`, `src/data/personality.ts`, `src/data/spriteMeta.ts`, `src/render/dragonMesh.ts`, `src/render/behavior.ts`, `src/render/particles.ts`, `tests/behavior.test.ts`
- Modify: `src/render/dragonView.ts` (SpriteDragonView → DragonMesh; DragonLike thêm `setFlapMode`, `setFacing`, `mouthWorld(out)`, `react`), `src/render/world.ts` (bỏ slot cố định; dragonLayer; brains; pickDragon; tooltip/Zzz), `src/render/island.ts` + `src/render/world.ts` (dùng `core/rng`), `src/render/battleView.ts` (flap fly, breath, shake), `src/main.ts` (raycast rồng trước công trình; particles update), `src/ui/sound.ts` (+`roar`, `breathe`, `land`), `src/ui/devTools.ts` (+"Gọi 1 rồng bay", +"Hiện điểm miệng/vùng cánh")

## Implementation Steps
1. `core/rng.ts` + thay 2 bản `seeded` cũ.
2. `data/spriteMeta.ts` với DEFAULT; mở 10 ảnh `public/sprites/*_1.png`, đo điểm miệng/tâm thân, ghi override (ảnh đã trim nên đo trên bản trong `public/sprites`).
3. `dragonMesh.ts`: geometry + shader + API `setFlapMode`, `setFlip`, `flash`, `opacity`, `light`, `update(t, camera)`.
4. `SpriteDragonView` dùng DragonMesh; giữ animation cũ (attack/hit/death) bằng uniform + transform; GLB view implement API mới tối thiểu (mouthWorld = đầu bbox).
5. `particles.ts` + test thủ công qua dev button.
6. `data/personality.ts` + `behavior.ts` (số thuần) + `tests/behavior.test.ts`:
   - đi không ra khỏi bán kính & `isFree` luôn đúng tại điểm dừng (1000 bước, seed cố định);
   - không bao giờ 2 con cùng giữ flight token;
   - bay xong về đúng home (sai số < 0.1), có event `land`;
   - đêm: tỉ lệ thời gian `sleep` > ngày.
7. `world.ts`: `dragonLayer`; sync giữ brain theo dragonId (đổi cấp → chỉ thay view); update: brain → view.root.position, facing theo `dot(vel, camRight)`; event → particles/sound; Zzz CSS2D khi sleep; coin/nhãn chuồng đặt theo `baseTop` (không theo vị trí rồng nữa).
8. `pickDragon(raycaster)` + `main.ts`: bấm rồng → `react()` + tooltip 2s; ưu tiên trước đồng xu và công trình.
9. `battleView.ts`: flap `fly` lúc chờ; đòn nguyên tố = `particles.breath` từ `mouthWorld` tới đối thủ (giữ quả cầu cho đòn mạnh); khắc hệ → shake camera 0.25s.
10. Dev tools + chơi thử (`?dev=1`), đo fps bằng `renderer.info` + đồng hồ khung hình.

## Success Criteria
- [x] Để yên 60s: thấy rồng đi, ngồi, gầm, phun theo hệ; ≥1 lần có rồng bay vòng đảo rồi đáp về chuồng với bụi.
- [x] Cánh vỗ thấy rõ khi bay, rung nhẹ khi đứng; không méo vỡ ảnh `fire_1`…`woodstone_1`.
- [x] Bấm rồng: phản ứng + tooltip; bấm công trình/đồng xu vẫn hoạt động như cũ (rồng sau nhà không cướp click — so khoảng cách).
- [x] Không rồng nào đứng trong footprint công trình khác hoặc ngoài đảo (test + sửa lỗi lật gương viền đảo).
- [x] Màn đấu: luồng hơi thở đúng hệ, rung khi khắc hệ.
- [x] `tests/behavior.test.ts` xanh (7 test); toàn bộ 30 test xanh; 63fps với 21 rồng (dev "+6 rồng").

## Kết quả thực hiện (2026-10-14)
- Review (subagent) tìm 16 vấn đề; đã sửa #1–#15. #16 (`POCKET_MIN_AREA` có thể xoá vùng trắng tinh lớn trên thân) chưa sửa — theo dõi khi có ảnh mới.
- Ngoài plan: sửa `tools/cutout.cjs` (chỉ floodfill từ góc trắng, xoá ô trắng kẹt giữa cánh) vì `woodstone_1` bị cắt hỏng.
- Sự cố: `src/render/island.ts` bị cắt cụt do lệnh vá sai, đã viết lại; lỗi lật gương viền đảo có từ trước, đã sửa.

## Risk Assessment
- Bố cục ảnh khác nhau → cánh uốn sai chỗ: meta override per sprite + `flapAmp` = 0 cho ảnh xấu.
- Sprite gốc ở chân nhưng ảnh trim có khoảng trống dưới chân → rồng "lơ lửng": thêm `footV` vào meta.
- Rồng che nhau/công trình khi đi: z-order do depth test; nếu xấu thì giảm bán kính đi.
- Raycast plane trúng vùng trong suốt: kiểm tra alpha ở UV giao điểm (đọc từ canvas ảnh đã cache) trước khi nhận click.
