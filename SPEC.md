# SPEC: Kế Hoạch Phát Triển & Thiết Kế "Đảo Rồng 3D — Hồi Ức Zing Me"

## 1. Tầm Nhìn Dự Án (Project Vision)
Tái hiện trọn vẹn linh hồn và sự cuốn hút của tựa game **Đảo Rồng** kinh điển trên mạng xã hội Zing Me (2012–2015), nhưng được nâng cấp trên nền công nghệ web hiện đại (Three.js 3D/2.5D, TypeScript, Vite, WebAudio).
Mục tiêu là biến các con rồng từ dạng ảnh tĩnh đơn thuần thành **sinh vật sống động thực sự**, có tương tác cảm xúc, động tác ngộ nghĩnh, gameplay sưu tập lai tạo gây nghiện, khai phá đảo và chiến đấu chiến thuật chiều sâu.

---

## 2. Hệ Thống Animation Rồng Sống Động (Dragon Dynamic Life)

### 2.1. Các trạng thái hoạt ảnh (Animation States)
1. **Nhịp thở tự nhiên (Idle Breathing):** Toàn thân nhấp nhô nhẹ, ngực phập phồng, cánh mở khép nhịp nhàng, đuôi lắc lư theo sóng sin tự nhiên.
2. **Chớp mắt & Tò mò (Eye Blinking & Look Around):** Đôi mắt chớp ngẫu nhiên mỗi 3–6s, đầu nghiêng nhẹ sang hai bên quan sát đảo.
3. **Đớp mồi (Feeding / Chow Down):** Khi người chơi thả thức ăn, thức ăn bay từ trên rơi xuống, rồng ngước đầu há to miệng ngoạm lấy, nhai nuốt rung lắc rồi nhảy cẫng lên thỏa mãn.
4. **Chọc ghẹo / Tương tác (Petting / Poke Reaction):**
   - Click đầu: Rụt cổ giật mình, sau đó gầm nhẹ hoặc thở phì phò.
   - Click bụng: Ưỡn ngực cười tít mắt, tim bay lên (`❤️`), phát ra tiếng rừ rừ (purr).
5. **Ngủ say (Sleeping with Zzz):** Nằm sụp xuống, nhắm mắt, ngực phập phồng chậm rãi, bong bóng ngủ phập phồng trên mũi.
6. **Cất cánh & Sải cánh lượn (Flight Loop):** Vỗ cánh dồn dập cất cánh, sải cánh lượn vòng tròn trên không, bóng râm lướt trên mặt đất rồi hạ cánh tung bụi.
7. **Tung chiêu nộ (Ultimate Attack):** Tụ năng lượng nguyên tố rực sáng ở miệng/sừng, vươn người gầm thét, phóng tia nguyên tố kèm hiệu ứng chấn động camera.

### 2.2. Giải pháp kỹ thuật đồ họa 2.5D
- **Tầng 1: Shader Vertex Deformation** (Nâng cấp từ `dragonMesh.ts`):
  - Nhịp thở ngực, sải cánh uốn lượn đa tần số, vẫy đuôi mượt mà 60fps mà không cần vẽ thêm hàng trăm frame.
  - Thêm hiệu ứng nhấp nhô trọng tâm (vertical bobbing) và nghiêng thân (sway) theo bước chân.
- **Tầng 2: Dynamic Decals / Overlays (Mắt & Miệng):**
  - Mắt chớp (Blink decal) và Miệng há khi phun/ăn (Mouth open overlay) dựa trên toạ độ `mouth` và `eye` trong `spriteMeta.ts`.
- **Tầng 3: GPU Particle FX:**
  - Vòng hào quang nguyên tố quanh rồng cấp Huyền Thoại (`_2`).
  - Hạt thức ăn văng ra khi rồng nhai mồi, bong bóng tim bay khi rồng vui mừng.

---

## 3. Thiết Kế Tính Năng Gây Nghiện Của Đảo Rồng Zing Me (Feature Design)

### 3.1. Hệ thống Ngũ Hành & 15 Loài Rồng Mới
- **5 Hệ cơ bản:**
  - 🔥 **Hỏa** (Công kích cao, thiêu đốt theo lượt).
  - 💧 **Thủy** (Hồi phục sinh lực, làm chậm đối phương).
  - 🪨 **Thổ** (Giáp dày phản đòn, phòng thủ kiên cố).
  - 🌿 **Mộc** (Trúng độc tích tụ, sinh sôi nảy nở).
  - ⚡ **Lôi / Sấm** (Bạo kích cực đại, làm choáng mục tiêu - Hệ mới).
- **2 Hệ Thần Bí (Mở khóa cấp cao):**
  - ❄️ **Băng** (Đóng băng khống chế).
  - 🌑 **Ám / Hắc Long** (Hút máu, giảm công kẻ thù).
- **Bộ sưu tập Rồng Thần (Dragon Codex):** Thống kê 100% loài rồng đã thu thập, mở khóa tiểu sử truyền thuyết, tặng kim cương thưởng danh hiệu.

### 3.2. Bí Quyết Lai Tạo & Trứng Đột Biến (Breeding Deep Dive)
- **Công thức lai đặc biệt:**
  - Không chỉ lai 2 hệ đơn giản, kết hợp rồng cấp cao có thể kích hoạt **Đột biến gen (Mutation)** tạo ra Rồng Quý Tộc / Rồng Nguyên Thủy với màu sắc dị bản (Shiny/Albino).
  - Dùng **Hoa Tinh Tú / Bùa May Mắn** trồng từ vườn đặc biệt để tăng 25% cơ hội ra rồng Huyền Thoại.
- **Cảm giác mở trứng hồi hộp:**
  - Vỏ trứng rung lắc theo thời gian. Khi trứng nở, xuất hiện màn hình đập vỏ trứng với ánh sáng chói lòa và hiệu ứng âm thanh kịch tính.

### 3.3. Tương Tác Trực Quan & Thức Ăn Thần Bí (Care & Farm)
- **Nông trại đa dạng:**
  - Thêm Quả Cầu Gai, Bắp Lửa, Dâu Tuyết, Nấm Sấm Sét.
  - Cơ chế cho ăn "kéo-thả" (Drag & Drop) hoặc click liên hoàn: Người chơi quẳng từng miếng thịt/quả vào chuồng, rồng tranh nhau đớp.
- **Chỉ số Vui Vẻ (Happiness / Mood):**
  - Rồng được vuốt ve và cho ăn đúng giờ sẽ có tâm trạng Hưng Phấn (+20% tốc độ sinh vàng).

### 3.4. Khai Phá Đảo & Mở Rộng Quần Đảo (Island Expansion)
- **Chặt cây & Phá đá:**
  - Đảo ban đầu bị bao phủ bởi cây gai, đá ma thuật. Cần điều động rồng có hệ tương ứng (Hỏa đốt cây gai, Thổ phá đá tảng) để giải phóng diện tích.
- **Quần đảo mới:**
  - Đảo 1: Đảo Thảo Nguyên (Khởi đầu).
  - Đảo 2: Đảo Hỏa Diệm (Mở khóa khi đạt cấp 15, tăng 15% sản lượng rồng hệ Hỏa).
  - Đảo 3: Đảo Thiên Giới / Bồng Lai (Mở khóa cấp 30).
- **Đồ trang trí phong thủy (Decorations):**
  - Cột totem nguyên tố, đài phun nước rồng, tượng rồng đá... Tăng thẩm mỹ và buff chỉ số chuồng lân cận.

### 3.5. Chế Độ Thám Hiểm & Săn Boss Khổng Lồ (Adventure & Raid Boss)
- **Bản đồ Viễn Chinh (Campaign Map):**
  - Chinh phục 30 ải thám hiểm qua các vùng đất hiểm trở (Đầm Lầy Tử Thần, Núi Lửa Bất Diệt, Vực Thẳm Đáy Biển).
- **Trùm Thế Giới (World Boss Raid):**
  - Xuất hiện rồng khổng lồ (kích thước gấp 3 lần bình thường) tấn công đảo. Người chơi cử đội 3 rồng mạnh nhất dốc toàn lực đánh Boss để nhận Trang bị Thần Long.
- **Trang bị Rồng (Dragon Relics):**
  - 4 ô trang bị: Móng Vuốt (Tăng Công), Áo Giáp Gai (Tăng Máu & Giáp), Vòng Cổ Phép (Tăng tốc hồi chiêu), Cánh Thần (Tăng tốc đánh).

### 3.6. Mini-Game Giải Trí & Sự Kiện (Engagement Loops)
- **Vòng Quay May Mắn (Fortune Wheel):** Quay mỗi ngày nhận thức ăn, kim cương, mảnh trứng rồng hiếm.
- **Đào Kho Báu Rồng:** Mini-game lật ô đất tìm ngọc thần.

---

## 4. Danh Sách File Cần Can Thiệp & Tạo Mới

### 4.1. Dữ liệu & Logic
- `src/data/dragons.ts`: Thêm các loài rồng hệ Sấm, Băng, Hắc Ám.
- `src/data/elements.ts`: Bổ sung hệ Sấm (`lightning`), Băng (`ice`), Ám (`dark`) vào ma trận khắc chế.
- `src/data/attacks.ts`: Thêm chiêu thức diện rộng (AoE), hiệu ứng choáng, đốt máu, đóng băng.
- `src/logic/breeding.ts`: Bổ sung công thức đột biến và trứng quý hiếm.
- `src/logic/grid.ts`: Thêm cơ chế chướng ngại vật (cây/đá) và mở rộng đảo.

### 4.2. Render & Đồ họa
- `src/render/dragonMesh.ts`: Nâng cấp shader uốn nhịp thở, chớp mắt, há mồm, sway toàn thân.
- `src/render/behavior.ts`: Thêm trạng thái `feed` (đớp mồi), `pet` (được vuốt ve vui vẻ), `cheer` (nhảy múa).
- `src/render/particles.ts`: Bổ sung hạt sấm sét, bông tuyết, tim vui vẻ, mảnh vỏ trứng vỡ.
- `src/render/island.ts`: Thêm chướng ngại vật có thể dọn dẹp, đồ trang trí buff diện tích.

### 4.3. Giao diện & Âm thanh
- `src/ui/juice.ts`: Hiệu ứng ném thức ăn vào chuồng, rồng há mồm đón mồi.
- `src/ui/panels.ts`: Bổ sung giao diện Thư Viện Rồng (Dragon Codex), Vòng Quay May Mắn, Trang bị.
- `src/ui/sound.ts` & `src/ui/music.ts`: Thêm hiệu ứng rồng đớp thức ăn (`chomp`), tiếng rừ rừ (`purr`), tiếng sấm sét và trứng nứt vỏ.

---

## 5. Kế Hoạch Triển Khai Từng Bước (Roadmap)
- **Sprint 1:** Nâng cấp Shader & Animation động của Rồng (Nhịp thở sống động, tương tác click chọc ghẹo rồng, rồng ngước đầu đớp thức ăn).
- **Sprint 2:** Mở rộng Hệ Nguyên Tố & Thêm Rồng Mới (Hệ Sấm & Băng, 6 loài rồng mới, cập nhật bảng khắc chế).
- **Sprint 3:** Hệ thống Nông Trại Kéo Thả & Chăm Sóc Vui Vẻ (Mood/Happiness buff sản lượng vàng).
- **Sprint 4:** Khai Hoang Chướng Ngại Vật & Mở Rộng Đảo 2.
- **Sprint 5:** Bản đồ Thám Hiểm Phó Bản & Mini-Game Vòng Quay May Mắn.
