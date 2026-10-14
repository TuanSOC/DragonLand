// Chế độ đặt/di chuyển công trình: bóng mờ đi theo chuột, ô xanh = đặt được, đỏ = không.
import * as THREE from 'three';
import { canPlace, FOOTPRINT } from '../logic/grid';
import type { BuildingType, GameState } from '../logic/state';
import type { Element } from '../data/elements';
import { makeGhost } from './assets';
import { buildingModel, CELL, cellToWorld, worldToCell } from './world';

export class Placement {
  private group = new THREE.Group();
  private tile: THREE.Mesh;
  private type: BuildingType | null = null;
  private ignoreId?: number;
  cell: { x: number; z: number } | null = null;
  valid = false;

  constructor(scene: THREE.Scene) {
    this.tile = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#3cff6a', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.tile.rotation.x = -Math.PI / 2;
    this.tile.position.y = 0.03;
    this.group.visible = false;
    scene.add(this.group);
  }

  get active(): boolean {
    return this.type !== null;
  }

  begin(type: BuildingType, element?: Element, ignoreId?: number): void {
    this.cancel();
    this.type = type;
    this.ignoreId = ignoreId;
    const size = FOOTPRINT[type] * CELL;
    this.tile.scale.set(size, size, 1);
    const ghost = buildingModel(type, element);
    makeGhost(ghost);
    this.group.add(this.tile, ghost);
    this.group.visible = false;
  }

  /** Cập nhật vị trí theo điểm chuột trên mặt đất. */
  hover(state: GameState, ground: THREE.Vector3 | null): void {
    if (!this.type || !ground) return;
    const size = FOOTPRINT[this.type];
    this.cell = worldToCell(ground, size);
    this.valid = canPlace(state, this.type, this.cell.x, this.cell.z, this.ignoreId);
    this.group.position.copy(cellToWorld(this.cell.x, this.cell.z, size));
    this.group.visible = true;
    (this.tile.material as THREE.MeshBasicMaterial).color.set(this.valid ? '#3cff6a' : '#ff3c3c');
  }

  cancel(): void {
    this.type = null;
    this.cell = null;
    this.group.clear();
    this.group.visible = false;
  }
}
