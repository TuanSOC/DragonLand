// Điểm khởi động: nạp model, dựng cảnh 3D, nối input + UI + vòng lặp game.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import './style.css';
import { ARENA } from './data/arena';
import { loadGame } from './core/save';
import { Game } from './game';
import { startBattle } from './logic/battle';
import { collectAllGold, collectGold, habitatGold } from './logic/economy';
import { moveBuilding, placeBuilding, type ShopItem } from './logic/grid';
import { xpToNext } from './logic/progression';
import { loadAllModels } from './render/assets';
import { loadSprites } from './render/sprites';
import { BattleView } from './render/battleView';
import { Placement } from './render/placement';
import { IslandWorld } from './render/world';
import { BattleUI } from './ui/battleUI';
import { fmtNum } from './ui/format';
import { setupDevTools } from './ui/devTools';
import { Panels } from './ui/panels';
import { icon, type IconName, type IconSize } from './ui/icons';
import { sfx } from './ui/sound';
import { toast } from './ui/toast';

const $ = (id: string) => document.getElementById(id)!;

/** Tạm thời: đêm theo giờ máy (phase 3 sẽ thay bằng chu kỳ ngày–đêm đầy đủ). Cập nhật mỗi 0.25s. */
let night = false;
function refreshNight(): void {
  const h = new Date().getHours();
  night = h >= 19 || h < 6;
}

async function boot(): Promise<void> {
  const bar = $('loading-bar');
  await Promise.all([loadAllModels((done, total) => (bar.style.width = `${(done / total) * 100}%`)), loadSprites()]);
  $('loading').classList.add('hide');

  const game = new Game(loadGame(Date.now()));
  // icon trên HUD/menu (ảnh vẽ nếu có, không thì emoji)
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.replaceChildren(icon(el.dataset.icon as IconName, (el.dataset.size as IconSize) ?? 'sm'));
  });
  const app = $('app');

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  app.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  app.appendChild(labels.domElement);

  // ── Cảnh đảo ──
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  camera.position.set(19, 21, 19);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 12;
  controls.maxDistance = 75;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.2;
  controls.screenSpacePanning = false;

  scene.add(new THREE.HemisphereLight('#ffffff', '#5a7a3a', 1.5));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
  sun.position.set(20, 35, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const world = new IslandWorld(scene);
  const placement = new Placement(scene);
  const battleView = new BattleView(1);
  let mode: 'island' | 'battle' = 'island';
  let placing: { item?: ShopItem; moveId?: number } | null = null;

  // ── UI ──
  const setPlacingHint = (text: string | null) => {
    $('hint-text').textContent = text ?? '';
    $('hint').classList.toggle('show', !!text);
  };
  const cancelPlacing = () => {
    placing = null;
    placement.cancel();
    setPlacingHint(null);
  };

  const battleUI = new BattleUI(game, battleView, () => {
    mode = 'island';
    document.body.classList.remove('in-battle');
  });

  const panels = new Panels(game, {
    place(item) {
      placing = { item };
      placement.begin(item.type, item.type === 'habitat' ? item.element : undefined);
      setPlacingHint('Bấm vào ô trống trên đảo để xây');
    },
    move(id) {
      const b = game.state.buildings.find((x) => x.id === id);
      if (!b) return;
      placing = { moveId: id };
      placement.begin(b.type, b.type === 'habitat' ? b.element : undefined, id);
      setPlacingHint('Bấm chỗ mới để chuyển công trình');
    },
    battle(stage, ids) {
      const r = startBattle(game.state, stage, ids);
      if ('ok' in r) {
        if (!r.ok) toast(r.reason, 'error');
        return;
      }
      cancelPlacing();
      mode = 'battle';
      document.body.classList.add('in-battle');
      battleUI.start(r);
    },
  });

  const updateHud = () => {
    const s = game.state;
    $('gold').textContent = fmtNum(s.gold);
    $('gems').textContent = fmtNum(s.gems);
    $('food').textContent = fmtNum(s.food);
    $('arena').textContent = `${s.arenaWins}/${ARENA.length}`;
    $('dragons').textContent = String(s.dragons.length);
    $('plevel').textContent = String(s.playerLevel);
    $('xpfill').style.width = `${(s.xp / xpToNext(s.playerLevel)) * 100}%`;
    $('plevel').parentElement!.title = `Cấp ${s.playerLevel} — ${s.xp}/${xpToNext(s.playerLevel)} XP`;
  };

  setupDevTools(game, panels, { flyNow: () => world.herd.flyNow() });

  game.onChange(() => {
    world.sync(game.state);
    panels.refresh();
    updateHud();
  });

  $('btn-build').onclick = () => panels.openShop();
  $('btn-arena').onclick = () => panels.openArena();
  $('btn-book').onclick = () => panels.openBook();
  $('btn-settings').onclick = () => panels.openSettings();
  $('btn-collect').onclick = () => {
    const now = game.now();
    const snap = game.snapshot();
    // hiện chữ bay lên trên từng chuồng trước khi thu
    for (const b of game.state.buildings) {
      if (b.type !== 'habitat') continue;
      const g = Math.floor(habitatGold(game.state, b, now));
      if (g >= 1) world.floatText(b.id, `+${fmtNum(g)} 💰`);
    }
    const got = collectAllGold(game.state, now);
    if (got > 0) {
      toast(`+${fmtNum(got)} vàng`, 'ok');
      sfx('coin');
    } else {
      toast('Chưa có vàng để thu', 'info');
      sfx('error');
    }
    game.celebrate(snap);
    game.changed();
  };
  $('hint-cancel').onclick = cancelPlacing;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelPlacing();
      panels.close();
    }
  });

  // ── Chuột: bấm (không kéo) để chọn công trình / đặt công trình ──
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let downAt: { x: number; y: number } | null = null;

  const setPointer = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const groundPoint = () => raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  /** Công trình bị bấm trúng + khoảng cách (để so với rồng đứng trước/sau). */
  const pickBuildingHit = (): { id: number; distance: number } | null => {
    const hit = raycaster.intersectObjects(world.pickables(), true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.buildingId === undefined) o = o.parent;
    return o && hit ? { id: o.userData.buildingId as number, distance: hit.distance } : null;
  };
  const pickBuilding = (): number | null => pickBuildingHit()?.id ?? null;

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'island') return;
    setPointer(e);
    if (placement.active) placement.hover(game.state, groundPoint());
    else canvas.style.cursor = pickBuilding() !== null || world.pickDragon(raycaster) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerup', (e) => {
    if (mode !== 'island' || e.button !== 0 || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // là thao tác kéo xoay camera
    setPointer(e);
    if (placing && placement.active) {
      placement.hover(game.state, groundPoint());
      const cell = placement.cell;
      if (!cell) return;
      const p = placing;
      const okDone = p.item
        ? game.act((s, now) => placeBuilding(s, p.item!, cell.x, cell.z, now))
        : game.act((s) => moveBuilding(s, p.moveId!, cell.x, cell.z));
      if (okDone) cancelPlacing();
      return;
    }
    // bấm đồng xu trên chuồng = thu vàng luôn (như Đảo Rồng gốc)
    const coinOf = world.pickCoin(raycaster);
    if (coinOf !== null) {
      const hb = game.state.buildings.find((b) => b.id === coinOf);
      if (hb?.type === 'habitat') {
        const g = Math.floor(habitatGold(game.state, hb, game.now()));
        if (game.act((s, now) => collectGold(s, hb, now), { quiet: true, sfx: 'coin' })) world.floatText(hb.id, `+${fmtNum(g)} 💰`);
      }
      return;
    }
    // bấm vào rồng → rồng phản ứng (gầm, phun, nhảy) + hiện tên
    const dragon = world.pickDragon(raycaster);
    const bHit = pickBuildingHit();
    if (dragon && (!bHit || dragon.distance <= bHit.distance)) {
      world.herd.react(dragon.id);
      return;
    }
    const id = pickBuilding();
    if (id !== null) {
      sfx('click');
      panels.openBuilding(id);
    }
  });

  // ── Kích thước màn hình ──
  const resize = () => {
    const w = app.clientWidth;
    const hgt = app.clientHeight;
    renderer.setSize(w, hgt);
    labels.setSize(w, hgt);
    camera.aspect = w / hgt;
    // màn hình dọc (điện thoại): mở rộng góc nhìn để thấy cả đảo
    camera.fov = camera.aspect < 1 ? 42 + (1 - camera.aspect) * 30 : 42;
    camera.updateProjectionMatrix();
    battleView.resize(w / hgt, hgt * renderer.getPixelRatio());
    world.particles.resize(hgt * renderer.getPixelRatio(), camera.fov);
  };
  window.addEventListener('resize', resize);
  resize();

  // ── Lưu tự động ──
  setInterval(() => game.save(), 10000);
  window.addEventListener('beforeunload', () => game.save());
  document.addEventListener('visibilitychange', () => document.hidden && game.save());

  world.sync(game.state);
  updateHud();
  toast('Chào mừng tới Đảo Rồng! Bấm vào công trình để tương tác 🐉', 'info');

  // ── Vòng lặp ──
  const clock = new THREE.Clock();
  let slowTimer = 0;
  // dev: số đo hiệu năng đọc qua window.__perf
  const perf = { cpu: 0, update: 0, calls: 0, tris: 0 };
  if (location.search.includes('dev')) (window as unknown as { __perf: typeof perf }).__perf = perf;
  renderer.setAnimationLoop(() => {
    const f0 = performance.now();
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    const now = game.now();
    slowTimer += dt;
    const slowTick = slowTimer > 0.25;
    if (slowTick) slowTimer = 0;

    if (mode === 'island') {
      controls.update();
      // không cho kéo camera ra quá xa đảo
      controls.target.clampLength(0, 16);
      const u0 = performance.now();
      world.update(game.state, now, dt, t, camera, night);
      perf.update = perf.update * 0.9 + (performance.now() - u0) * 0.1;
      if (slowTick) world.updateLabels(game.state, now);
      renderer.render(scene, camera);
      labels.render(scene, camera);
    } else {
      battleView.update(dt);
      renderer.render(battleView.scene, battleView.camera);
    }
    if (slowTick) {
      refreshNight();
      panels.tick();
      updateHud();
    }
    perf.cpu = perf.cpu * 0.9 + (performance.now() - f0) * 0.1;
    perf.calls = renderer.info.render.calls;
    perf.tris = renderer.info.render.triangles;
  });
}

boot().catch((err) => {
  console.error(err);
  $('loading-text').textContent = 'Lỗi khi tải game: ' + (err as Error).message;
});
