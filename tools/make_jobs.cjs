// Sinh tools/sprites.json: danh sách ảnh cần vẽ + prompt đầy đủ (đã kèm phong cách).
// `ref` = ảnh nên dùng làm tham chiếu khi vẽ để giữ đồng bộ phong cách/nhân vật.
//   node tools/make_jobs.cjs && node tools/make_prompts.cjs
const fs = require('fs');

// Rồng: mạnh mẽ, ngầu, chi tiết — KHÔNG chibi/baby
const DRAGON_STYLE =
  'Premium fantasy mobile game creature art, like a high-end collectible dragon card game: ' +
  'detailed painterly digital illustration, dramatic rim lighting, rich saturated colors, finely detailed scales and armor plates, ' +
  'glowing elemental effects, sharp claws and fangs, intense glowing eyes, three-quarter view, ' +
  'body facing toward the left side of the image. Whole creature fully visible, centered with margin, ' +
  'isolated on a plain flat pure white background. No ground, no cast shadow, no text, no frame, no watermark. ' +
  'NOT chibi, NOT cute, NOT a baby, NOT cartoonish.';

// Công trình / cây cối: tranh vẽ fantasy tươi sáng
const WORLD_STYLE =
  'Detailed hand-painted fantasy mobile game art, vibrant saturated colors, soft painterly shading with glossy highlights, clean outline. ' +
  'Single object fully visible, centered with margin, isolated on a plain flat pure white background. ' +
  'No ground plane beyond the object itself, no cast shadow, no text, no frame, no watermark.';

const species = {
  fire: 'crimson and molten-orange scales, a blazing fire mane along the spine, flaming tail tip, smoldering ember eyes, curved black horns',
  water: 'deep sapphire and aqua scales, flowing fin-wings like crashing ocean waves, water spiraling around its body, pearl-white belly plates, coral-like horns',
  earth: 'bronze and granite rock-armored hide, jagged crystal-studded stone spikes, massive ram horns, cracked earth plates, heavy stance',
  plant: 'emerald green scales, wings made of giant leaves and vines, thorny wooden antler horns, glowing green spores, blossoms along the spine',
  steam: 'silver-white armored scales with copper accents, scalding steam jets venting from its back, glowing orange furnace core in the chest',
  lava: 'obsidian black rocky hide split by glowing magma cracks, dripping lava, burning orange eyes, smoke rising from its nostrils',
  blossom: 'crimson and gold scales, phoenix-like wings made of burning flower petals, a flaming lotus crest on its head, embers and petals swirling',
  mud: 'dark earthen brown hide with glowing teal markings, heavy tusks, thick dripping mud armor, swampy water splashing around its claws',
  swamp: 'dark teal serpentine body, moss and lily pads on its back, glowing bioluminescent spots, long vine whiskers, eerie green eyes',
  woodstone: 'ancient body half gnarled tree bark and half carved runic stone, glowing amber runes, moss, a small tree growing on its back',
};

// Mỗi giai đoạn khác hẳn nhau về TỈ LỆ CƠ THỂ + TƯ THẾ (không chỉ khác tính từ),
// để nhìn là biết rồng non / trưởng thành / huyền thoại.
const stage = [
  // _0 — rồng non (cấp 1-3): nhỏ, gầy, đầu to, cánh nhỏ cụp, bò 4 chân, dữ chứ không cute
  'STAGE 1 OF 3 — a JUVENILE dragon (adolescent whelp, NOT an adult): small slender lean body, short neck, ' +
    'proportionally larger head with big fierce glaring eyes, SMALL undeveloped wings folded close to its back ' +
    '(wingspan shorter than its body), only short stubby horn nubs, thin tail, small claws, few or no armor plates. ' +
    'Pose: crouched low on ALL FOUR legs, head forward, snarling and hissing, ready to pounce. ' +
    'Its elemental features appear only as small, faint, early signs',
  // _1 — trưởng thành (cấp 4-6): đứng 2 chân sau, cánh dang rộng, gầm
  'STAGE 2 OF 3 — a powerful ADULT dragon: muscular athletic body, long neck, full-size horns, ' +
    'large wings spread wide, rearing up on its hind legs, roaring, elemental energy swirling around it',
  // _2 — huyền thoại (cấp 7-10): to lớn, giáp dày, nhiều sừng, sẹo, hào quang, tư thế trùm cuối
  'STAGE 3 OF 3 — an ancient LEGENDARY ELDER dragon, far bigger and bulkier than an adult: massive heavy body ' +
    'covered in thick plate armor and bony spikes, a crown of many long branching horns, battle scars, glowing runes on its armor, ' +
    'enormous wings fully spread, a blazing elemental aura engulfing it. ' +
    'Pose: towering frontal three-quarter view, head raised high above the wings, chest forward, overwhelming boss presence',
];

const dragon = (s, look) => `${stage[s]}. Species features: ${look}. ${DRAGON_STYLE}`;

/** Dùng ảnh tham chiếu CHỈ để giữ màu & đặc điểm loài — không được sửa/đồ lại ảnh đó. */
const REF_RULE =
  'Use the reference image ONLY for the species color palette and signature features. ' +
  'Do NOT edit, trace or reuse the reference image: draw a completely NEW illustration with a DIFFERENT body size, ' +
  'proportions and pose as described below. ';
const world = (p) => `${p}. ${WORLD_STYLE}`;

const jobs = [];
// mỏ neo phong cách: rồng Lửa trưởng thành
jobs.push({ id: 'fire_1', prompt: dragon(1, species.fire) });
for (const [k, look] of Object.entries(species)) {
  if (k !== 'fire') jobs.push({ id: `${k}_1`, ref: ['fire_1'], prompt: dragon(1, look) });
}
for (const [k, look] of Object.entries(species)) {
  for (const s of [0, 2]) {
    jobs.push({ id: `${k}_${s}`, ref: [`${k}_1`], prompt: REF_RULE + dragon(s, look) });
  }
}
for (const [k, look] of Object.entries(species)) {
  jobs.push({
    id: `egg_${k}`,
    ref: [`${k}_1`],
    prompt: world(`a single ornate magical dragon egg standing upright, glowing faintly, its shell patterned with scales and colors inspired by: ${look}`),
  });
}

const iso = 'seen from an isometric three-quarter top-down view, round base, empty with no creatures';
const buildings = {
  habitat_fire: `a volcanic dragon lair: round rocky platform with a small erupting volcano, a bubbling lava pool and glowing orange crystals, ${iso}`,
  habitat_water: `a water dragon lair: round island with a clear turquoise pool, a little waterfall over rocks, seashells and coral, ${iso}`,
  habitat_earth: `an earth dragon lair: round rocky canyon with boulders, sandstone pillars, glowing crystals and a small cave, ${iso}`,
  habitat_plant: `a plant dragon lair: round lush jungle hill with giant leaves, vines, red mushrooms and flowers, ${iso}`,
  hatchery: `a dragon egg hatchery: round stone-and-wood tower with a glowing magical nest on top and warm lanterns, ${iso}`,
  breeding: `a mystical dragon breeding mountain: twin rocky peaks joined by a glowing pink heart-shaped crystal cave, sparkles, ${iso}`,
  farm: `a small square farm plot with neat rows of tilled brown soil and wooden fence posts at the corners, empty, ${iso}`,
};
for (const [id, p] of Object.entries(buildings)) jobs.push({ id, ref: ['fire_1'], prompt: world(p) });

const props = {
  crop_grass: 'a small bunch of golden ripe rice plants',
  crop_corn: 'a single corn plant with big fiery orange-red cobs',
  crop_berry: 'a small round berry bush with big glossy red berries',
  tree_sakura: 'a lush pink cherry blossom tree with a twisting trunk',
  tree_gold: 'a round lush golden yellow autumn tree',
  tree_palm: 'a tropical coconut palm tree',
  mushrooms: 'a cluster of three blue mushrooms with white spots',
  flowers: 'a small patch of white daisies and pink flowers with green leaves',
  lantern: 'a red Asian paper lantern hanging from a small wooden pole',
  rocks: 'a small cluster of mossy grey rocks',
};
for (const [id, p] of Object.entries(props)) jobs.push({ id, ref: ['fire_1'], prompt: world(p) });

// Icon giao diện: hiển thị nhỏ (24–48px) nên cần hình khối rõ, viền đậm
const ICON_STYLE =
  'Polished fantasy mobile game UI icon, bold readable silhouette that stays clear at 32 pixels, thick dark outline, ' +
  'glossy painted highlights, rich saturated colors, slight 3/4 view, single object centered and filling most of the frame, ' +
  'isolated on a plain flat pure white background. No text, no letters, no frame, no badge background, no shadow, no watermark';
const icons = {
  icon_gold: 'a small stack of shiny gold coins with a dragon emblem',
  icon_gem: 'a sparkling faceted magenta-violet diamond gem',
  icon_food: 'a juicy roasted meat drumstick on a bone',
  icon_xp: 'a glowing golden five-pointed star',
  icon_dragon: 'a fierce red dragon head emblem in side profile',
  icon_trophy: 'a golden trophy cup with two handles and a ruby',
  icon_build: 'a wooden hammer crossed with a carpenter saw',
  icon_arena: 'two crossed steel swords over a round wooden shield',
  icon_book: 'an old leather-bound book with a golden dragon emblem on the cover',
  icon_settings: 'a bronze gear cog',
  icon_collect: 'an open leather sack overflowing with gold coins',
  icon_fire: 'a stylized orange-red flame',
  icon_water: 'a stylized glossy blue water droplet',
  icon_earth: 'a stylized cracked brown boulder',
  icon_plant: 'a stylized fresh green leaf sprout',
  icon_egg: 'a spotted cream and orange dragon egg',
  icon_timer: 'a small brass hourglass with golden sand',
  icon_heart: 'a glossy pink heart',
  icon_speed: 'a bright yellow lightning bolt',
  icon_farm: 'a golden wheat sheaf tied with string',
  icon_lock: 'a closed iron padlock',
  icon_check: 'a bold green check mark',
};
jobs.push({ id: 'icon_gold', prompt: `${icons.icon_gold}. ${ICON_STYLE}` });
for (const [id, p] of Object.entries(icons)) {
  if (id !== 'icon_gold') jobs.push({ id, ref: ['icon_gold'], prompt: `${p}. ${ICON_STYLE}` });
}

fs.writeFileSync('tools/sprites.json', JSON.stringify(jobs, null, 1));
console.log(jobs.length, 'jobs');
