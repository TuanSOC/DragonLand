// Thân rồng tranh vẽ: tấm phẳng chia lưới + shader uốn ảnh (vỗ cánh, thở, vẫy đuôi).
// Luôn đứng thẳng và quay mặt về camera quanh trục Y.
import * as THREE from 'three';
import type { SpriteMeta } from '../data/spriteMeta';
import { sceneLight } from './sprites';

export type FlapMode = 'rest' | 'idle' | 'fly';

/** [biên độ, tốc độ] vỗ cánh theo chế độ — biên độ tính theo chiều cao ảnh */
const FLAP: Record<FlapMode, [number, number]> = {
  rest: [0.015, 2],
  idle: [0.04, 3],
  fly: [0.13, 9],
};

const vertexShader = /* glsl */ `
  uniform float uTime, uPhase, uFlapAmp, uFlapSpeed, uBreath, uTail, uFlip;
  uniform float uBodyU, uWingInner, uWingTop;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float bodyX = uFlip > 0.5 ? 1.0 - uBodyU : uBodyU;   // tâm thân trên màn hình
    float side = uv.x - bodyX;
    // vùng cánh: xa tâm thân theo chiều ngang + nằm ở nửa trên
    float wing = smoothstep(uWingInner, uWingInner + 0.25, abs(side)) * smoothstep(uWingTop, 1.0, uv.y);
    float flap = sin(uTime * uFlapSpeed + uPhase);
    p.y += flap * uFlapAmp * wing;
    p.x -= sign(side) * abs(flap) * uFlapAmp * 0.3 * wing;   // cánh co vào ở hai đầu nhịp
    // ngực phập phồng
    float cs = side / 0.15;
    float chest = exp(-cs * cs) * smoothstep(0.2, 0.45, uv.y) * (1.0 - smoothstep(0.5, 0.75, uv.y));
    p.x += side * uBreath * chest * sin(uTime * 2.2 + uPhase);
    // đuôi (thấp, xa tâm thân) vẫy ngang
    float tail = (1.0 - smoothstep(0.0, 0.35, uv.y)) * smoothstep(0.1, 0.4, abs(side));
    p.x += sin(uTime * 1.7 + uPhase) * uTail * tail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uFlip, uFlash, uOpacity;
  uniform vec3 uLight;
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(uFlip > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
    vec4 tex = texture2D(map, uv);
    if (tex.a < 0.08) discard;
    vec3 rgb = tex.rgb * uLight;
    rgb = mix(rgb, vec3(1.0, 0.25, 0.2), uFlash * 0.55);
    gl_FragColor = vec4(rgb, tex.a * uOpacity);
    #include <colorspace_fragment>
  }`;

/** Một tấm lưới dùng chung cho mọi con rồng (gốc ở giữa-dưới). */
const SHARED_GEO = new THREE.PlaneGeometry(1, 1, 24, 16).translate(0, 0.5, 0);

const _wp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, 1);
const _tq = new THREE.Quaternion();

export class DragonMesh extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  readonly w: number;
  readonly h: number;
  /** nghiêng ảnh (radian) quanh trục nhìn — dùng khi rồng gục */
  tilt = 0;
  private amp: number;
  private speed: number;
  private target: [number, number];

  constructor(texture: THREE.Texture, width: number, height: number, readonly meta: SpriteMeta) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        uTime: { value: 0 },
        uPhase: { value: Math.random() * Math.PI * 2 },
        uFlapAmp: { value: 0 },
        uFlapSpeed: { value: 3 },
        uBreath: { value: 0.05 },
        uTail: { value: 0.012 },
        uFlip: { value: 0 },
        uFlash: { value: 0 },
        uOpacity: { value: 1 },
        uLight: { value: sceneLight.clone() },
        uBodyU: { value: meta.bodyU },
        uWingInner: { value: meta.wingInner },
        uWingTop: { value: meta.wingTop },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    mat.userData.unlitUniform = true; // sky.ts cập nhật uLight theo giờ
    super(SHARED_GEO, mat);
    this.w = width;
    this.h = height;
    this.scale.set(width, height, 1);
    this.position.y = -meta.footV * height;
    this.target = FLAP.idle;
    [this.amp, this.speed] = this.target;
  }

  get u() {
    return this.material.uniforms;
  }

  setFlapMode(mode: FlapMode): void {
    this.target = FLAP[mode];
  }

  setFlip(flip: boolean): void {
    this.u.uFlip.value = flip ? 1 : 0;
  }

  get flipped(): boolean {
    return this.u.uFlip.value > 0.5;
  }

  /** Toạ độ cục bộ (trong khung của root) của miệng, tính cả khi ảnh bị lật. */
  mouthLocal(out: THREE.Vector3): THREE.Vector3 {
    const [mu, mv] = this.meta.mouth;
    const u = this.flipped ? 1 - mu : mu;
    return out.set((u - 0.5) * this.w, this.position.y + mv * this.h, 0.05).applyQuaternion(this.quaternion);
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    // chuyển dần sang chế độ vỗ cánh mới cho mượt
    const k = Math.min(1, dt * 4);
    this.amp += (this.target[0] * this.meta.flapAmp - this.amp) * k;
    this.speed += (this.target[1] - this.speed) * k;
    this.u.uFlapAmp.value = this.amp;
    this.u.uFlapSpeed.value = this.speed;
    this.u.uTime.value = time;

    // billboard quanh trục Y, bù xoay của node cha (màn đấu có lookAt)
    this.getWorldPosition(_wp);
    _q.setFromAxisAngle(_up, Math.atan2(camera.position.x - _wp.x, camera.position.z - _wp.z));
    if (this.parent) {
      this.parent.getWorldQuaternion(_pq);
      this.quaternion.copy(_pq.invert().multiply(_q));
    } else this.quaternion.copy(_q);
    if (this.tilt) this.quaternion.multiply(_tq.setFromAxisAngle(_fwd, this.tilt));
  }
}
