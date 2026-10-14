// Lưu/tải game bằng localStorage. Có version để sau này nâng cấp dữ liệu cũ.
import { createNewGame, SAVE_VERSION, type GameState } from '../logic/state';

/**
 * ?dev=1 dùng save riêng để test thoải mái mà không đụng tiến độ thật.
 * ?dev=<tên> (vd. ?dev=t1) dùng thêm một save dev riêng nữa — để thử nhiều kịch bản song song.
 */
const DEV = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('dev') : null;
const KEY = DEV === null ? 'dao-rong-3d-save' : `dao-rong-3d-save-dev${DEV && DEV !== '1' ? `-${DEV}` : ''}`;

export function loadGame(now: number): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createNewGame(now);
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION || !Array.isArray(data.buildings)) return createNewGame(now);
    return migrate(data);
  } catch {
    return createNewGame(now);
  }
}

/** Bổ sung field mới cho save cũ thay vì xóa — người chơi không mất tiến độ. */
function migrate(data: GameState): GameState {
  data.playerLevel ??= 1;
  data.xp ??= 0;
  return data;
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // hết dung lượng hoặc chế độ ẩn danh: bỏ qua, game vẫn chạy
  }
}

export function resetGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}
