// public/js/characters.js - Quaternius 3D Modular Character System v1.9
// Tích hợp GLTFLoader, SkeletonUtils và AnimationMixer cho hơn 50 skins 3D

const CHARACTER_SKINS = [
  // --- HỌC ĐƯỜNG & CASUAL ---
  { id: 'Casual_Male', name: 'Nam Sinh Năng Động', category: 'casual', icon: '🎒', file: 'Casual_Male.gltf' },
  { id: 'Casual_Female', name: 'Nữ Sinh Dịu Dàng', category: 'casual', icon: '🎀', file: 'Casual_Female.gltf' },
  { id: 'Casual2_Male', name: 'Nam Sinh Thể Thao', category: 'casual', icon: '👟', file: 'Casual2_Male.gltf' },
  { id: 'Casual2_Female', name: 'Nữ Sinh Năng Động', category: 'casual', icon: '✨', file: 'Casual2_Female.gltf' },
  { id: 'Casual3_Male', name: 'Nam Sinh Học Bá', category: 'casual', icon: '👓', file: 'Casual3_Male.gltf' },
  { id: 'Casual3_Female', name: 'Lớp Phó Học Tập', category: 'casual', icon: '📚', file: 'Casual3_Female.gltf' },
  { id: 'Casual_Bald', name: 'Học Sinh Đầu Trọc', category: 'casual', icon: '🧑‍🦲', file: 'Casual_Bald.gltf' },
  { id: 'BaseCharacter', name: 'Ma Nơ Canh Chuẩn', category: 'casual', icon: '🧍', file: 'BaseCharacter.gltf' },

  // --- NGHỀ NGHIỆP & CÔNG SỞ ---
  { id: 'Doctor_Male_Young', name: 'Bác Sĩ Trẻ', category: 'career', icon: '🩺', file: 'Doctor_Male_Young.gltf' },
  { id: 'Doctor_Female_Young', name: 'Nữ Bác Sĩ Trẻ', category: 'career', icon: '👩‍⚕️', file: 'Doctor_Female_Young.gltf' },
  { id: 'Doctor_Male_Old', name: 'Giáo Sư Y Khoa', category: 'career', icon: '👨‍⚕️', file: 'Doctor_Male_Old.gltf' },
  { id: 'Doctor_Female_Old', name: 'Trưởng Khoa Y Tế', category: 'career', icon: '👵', file: 'Doctor_Female_Old.gltf' },
  { id: 'Chef_Male', name: 'Bếp Trưởng Siêu Cấp', category: 'career', icon: '👨‍🍳', file: 'Chef_Male.gltf' },
  { id: 'Chef_Female', name: 'Nữ Đầu Bếp Bánh Ngọt', category: 'career', icon: '👩‍🍳', file: 'Chef_Female.gltf' },
  { id: 'Chef_Hat', name: 'Vua Đầu Bếp', category: 'career', icon: '🍳', file: 'Chef_Hat.gltf' },
  { id: 'Worker_Male', name: 'Kỹ Sư Công Trình', category: 'career', icon: '👷‍♂️', file: 'Worker_Male.gltf' },
  { id: 'Worker_Female', name: 'Nữ Giám Sát Thi Công', category: 'career', icon: '👷‍♀️', file: 'Worker_Female.gltf' },
  { id: 'Suit_Male', name: 'Doanh Nhân Thành Đạt', category: 'career', icon: '💼', file: 'Suit_Male.gltf' },
  { id: 'Suit_Female', name: 'Nữ Tổng Tài', category: 'career', icon: '👠', file: 'Suit_Female.gltf' },
  { id: 'OldClassy_Male', name: 'Quý Ông Lịch Lãm', category: 'career', icon: '🎩', file: 'OldClassy_Male.gltf' },
  { id: 'OldClassy_Female', name: 'Quý Bà Sang Trọng', category: 'career', icon: '🦚', file: 'OldClassy_Female.gltf' },

  // --- CHIẾN BINH & HIỆP SĨ & QUÂN ĐỘI ---
  { id: 'Knight_Male', name: 'Hiệp Sĩ Giáp Sắt', category: 'warrior', icon: '🛡️', file: 'Knight_Male.gltf' },
  { id: 'Knight_Golden_Male', name: 'Đại Hiệp Sĩ Giáp Vàng', category: 'warrior', icon: '⚔️', file: 'Knight_Golden_Male.gltf' },
  { id: 'Knight_Golden_Female', name: 'Nữ Thánh Hiệp Sĩ', category: 'warrior', icon: '👑', file: 'Knight_Golden_Female.gltf' },
  { id: 'BlueSoldier_Male', name: 'Lính Hoàng Gia', category: 'warrior', icon: '🎖️', file: 'BlueSoldier_Male.gltf' },
  { id: 'BlueSoldier_Female', name: 'Nữ Vệ Binh Hoàng Gia', category: 'warrior', icon: '🏅', file: 'BlueSoldier_Female.gltf' },
  { id: 'Soldier_Male', name: 'Đặc Nhiệm Chiến Trường', category: 'warrior', icon: '🪖', file: 'Soldier_Male.gltf' },
  { id: 'Soldier_Female', name: 'Nữ Đặc Nhiệm Bắn Tỉa', category: 'warrior', icon: '🎯', file: 'Soldier_Female.gltf' },
  { id: 'Viking_Male', name: 'Chiến Binh Viking', category: 'warrior', icon: '🪓', file: 'Viking_Male.gltf' },
  { id: 'Viking_Female', name: 'Nữ Chiến Binh Bắc Âu', category: 'warrior', icon: '🛡️', file: 'Viking_Female.gltf' },
  { id: 'VikingHelmet', name: 'Dũng Sĩ Mũ Sừng', category: 'warrior', icon: '🏔️', file: 'VikingHelmet.gltf' },

  // --- NINJA & Á ĐÔNG ---
  { id: 'Ninja_Male', name: 'Ninja Bóng Đêm', category: 'ninja', icon: '🥷', file: 'Ninja_Male.gltf' },
  { id: 'Ninja_Female', name: 'Nữ Ninja Ám Sát', category: 'ninja', icon: '🗡️', file: 'Ninja_Female.gltf' },
  { id: 'Ninja_Male_Hair', name: 'Ninja Lãng Khách', category: 'ninja', icon: '🌪️', file: 'Ninja_Male_Hair.gltf' },
  { id: 'Ninja_Sand', name: 'Ninja Sa Mạc', category: 'ninja', icon: '🏜️', file: 'Ninja_Sand.gltf' },
  { id: 'Ninja_Sand_Female', name: 'Nữ Ninja Bão Cát', category: 'ninja', icon: '🦂', file: 'Ninja_Sand_Female.gltf' },
  { id: 'Kimono_Male', name: 'Kiếm Khách Kimono', category: 'ninja', icon: '👘', file: 'Kimono_Male.gltf' },
  { id: 'Kimono_Female', name: 'Thiếu Nữ Kimono', category: 'ninja', icon: '🌸', file: 'Kimono_Female.gltf' },

  // --- CAO BỒI & HẢI TẶC ---
  { id: 'Cowboy_Male', name: 'Cao Bồi Viễn Tây', category: 'adventure', icon: '🤠', file: 'Cowboy_Male.gltf' },
  { id: 'Cowboy_Female', name: 'Nữ Xạ Thủ Viễn Tây', category: 'adventure', icon: '👢', file: 'Cowboy_Female.gltf' },
  { id: 'Cowboy_Hair', name: 'Tay Súng Lãng Tử', category: 'adventure', icon: '🌾', file: 'Cowboy_Hair.gltf' },
  { id: 'Pirate_Male', name: 'Thuyền Trưởng Hải Tặc', category: 'adventure', icon: '🏴‍☠️', file: 'Pirate_Male.gltf' },
  { id: 'Pirate_Female', name: 'Nữ Hải Tặc Biển Sâu', category: 'adventure', icon: '⚓', file: 'Pirate_Female.gltf' },

  // --- GIẢ TƯỞNG & QUÁI DỊ ---
  { id: 'Wizard', name: 'Pháp Sư Tối Thượng', category: 'fantasy', icon: '🧙‍♂️', file: 'Wizard.gltf' },
  { id: 'Witch', name: 'Phù Thủy Huyền Bí', category: 'fantasy', icon: '🧙‍♀️', file: 'Witch.gltf' },
  { id: 'Elf', name: 'Tiên Tộc Rừng Xanh', category: 'fantasy', icon: '🧝', file: 'Elf.gltf' },
  { id: 'Goblin_Male', name: 'Yêu Tinh Tinh Quái', category: 'fantasy', icon: '👺', file: 'Goblin_Male.gltf' },
  { id: 'Goblin_Female', name: 'Nữ Yêu Tinh Tinh Nghịch', category: 'fantasy', icon: '👹', file: 'Goblin_Female.gltf' },
  { id: 'Zombie_Male', name: 'Thây Ma Bất Tử', category: 'fantasy', icon: '🧟‍♂️', file: 'Zombie_Male.gltf' },
  { id: 'Zombie_Female', name: 'Nữ Thây Ma Hồi Sinh', category: 'fantasy', icon: '🧟‍♀️', file: 'Zombie_Female.gltf' },

  // --- ĐỘNG VẬT & LINH VẬT ---
  { id: 'Cow', name: 'Bò Sữa Dễ Thương', category: 'animal', icon: '🐮', file: 'Cow.gltf' },
  { id: 'Pug', name: 'Chó Pug Đáng Yêu', category: 'animal', icon: '🐶', file: 'Pug.gltf' }
];

// Singleton quản lý tải và Cache Model 3D Quaternius
class CharacterModelManager {
  constructor() {
    this.loader = (typeof THREE !== 'undefined' && THREE.GLTFLoader) ? new THREE.GLTFLoader() : null;
    this.cache = new Map(); // modelId -> { scene, animations }
    this.loading = new Map(); // modelId -> Promise
  }

  getSkinMeta(modelId) {
    if (!modelId) return CHARACTER_SKINS[0];
    // Map ngược tương thích nếu client cũ gửi 'nam', 'nu', 'alien', 'chicken'
    if (modelId === 'nam') return this.getSkinMeta('Casual_Male');
    if (modelId === 'nu') return this.getSkinMeta('Casual_Female');
    if (modelId === 'alien') return this.getSkinMeta('Goblin_Male');
    if (modelId === 'chicken') return this.getSkinMeta('Pug');

    const found = CHARACTER_SKINS.find(s => s.id.toLowerCase() === modelId.toLowerCase());
    return found || CHARACTER_SKINS[0];
  }

  async loadModel(modelId) {
    if (!this.loader && typeof THREE !== 'undefined' && THREE.GLTFLoader) {
      this.loader = new THREE.GLTFLoader();
    }
    if (!this.loader) {
      console.error('THREE.GLTFLoader is not available yet');
      return null;
    }

    const meta = this.getSkinMeta(modelId);
    const key = meta.id;

    if (this.cache.has(key)) {
      return this._instantiate(key);
    }

    if (this.loading.has(key)) {
      await this.loading.get(key);
      return this._instantiate(key);
    }

    const promise = new Promise((resolve, reject) => {
      const url = `/models/characters/${meta.file}`;
      this.loader.load(
        url,
        (gltf) => {
          this.cache.set(key, {
            scene: gltf.scene,
            animations: gltf.animations || []
          });
          resolve();
        },
        undefined,
        (err) => {
          console.error(`Không thể tải model ${meta.file}:`, err);
          // Dự phòng sang BaseCharacter
          if (key !== 'BaseCharacter' && !this.cache.has('BaseCharacter')) {
            this.loader.load(
              '/models/characters/BaseCharacter.gltf',
              (fallbackGltf) => {
                this.cache.set(key, {
                  scene: fallbackGltf.scene,
                  animations: fallbackGltf.animations || []
                });
                resolve();
              },
              undefined,
              reject
            );
          } else {
            resolve();
          }
        }
      );
    });

    this.loading.set(key, promise);
    try {
      await promise;
    } finally {
      this.loading.delete(key);
    }

    return this._instantiate(key);
  }

  _instantiate(key) {
    const cached = this.cache.get(key) || this.cache.get('BaseCharacter');
    if (!cached) return null;

    // Nhân bản Model SkinnedMesh chuẩn xác bằng THREE.SkeletonUtils
    const clonedScene = (typeof THREE !== 'undefined' && THREE.SkeletonUtils)
      ? THREE.SkeletonUtils.clone(cached.scene)
      : cached.scene.clone(true);

    return {
      model: clonedScene,
      animations: cached.animations
    };
  }
}

const charModelMgr = new CharacterModelManager();

// BẢNG MÀU DA NHÂN VẬT THỜI TRANG (YÊU CẦU 2.0)
const SKIN_TONE_PALETTE = [
  { id: 'fair', name: 'Trắng hồng', color: '#ffd5b8', hex: '#ffd5b8' },
  { id: 'natural', name: 'Vàng Châu Á', color: '#f2c190', hex: '#f2c190' },
  { id: 'porcelain', name: 'Trắng sứ', color: '#fae7db', hex: '#fae7db' },
  { id: 'tan', name: 'Bánh mật', color: '#cb8a58', hex: '#cb8a58' },
  { id: 'sun_kissed', name: 'Rám nắng', color: '#a5653b', hex: '#a5653b' },
  { id: 'chocolate', name: 'Socola đậm', color: '#60381e', hex: '#60381e' },
  { id: 'alien', name: 'Alien dạ quang', color: '#34d399', hex: '#34d399' },
  { id: 'mystic', name: 'Tím huyền bí', color: '#a855f7', hex: '#a855f7' }
];

class StudentCharacter {
  constructor(playerData, deskPosition, seatOffset) {
    this.id = playerData.id;
    this.name = playerData.name || 'Sĩ Tử';
    this.modelId = playerData.characterModel || playerData.characterType || 'Casual_Male';
    this.skinColor = playerData.skinColor || '#f2c190';
    this.seatIndex = playerData.seatIndex || 0;
    this.deskPosition = deskPosition || new THREE.Vector3(0, 0, 0);
    this.seatOffset = seatOffset || { x: 0, y: 0, z: 0.62 };

    this.group = new THREE.Group();
    this.modelRoot = null;
    this.mixer = null;
    this.actions = {};
    this.bones = {};
    this.currentAction = null;
    this.currentActionName = null;

    this.isSitting = true;
    this.isMoving = false;
    this.isKnockedOut = false;
    this.isAnimal = this.modelId === 'Cow' || this.modelId === 'Pug';
    this.sittingSeatIndex = this.seatIndex;
    this.animTimer = null;

    // YÊU CẦU 2.0: Đặt vị trí ban đầu lùi sâu vào lòng ghế, sát tựa lưng, chân chạm sàn
    const initX = this.deskPosition.x + this.seatOffset.x;
    const initZ = this.deskPosition.z + this.seatOffset.z - 0.05;
    // Độ cao mặt sàn: y = 0.02m (chân phẳng trên mặt gạch lớp học)
    this.group.position.set(initX, 0.02, initZ);
    this.group.rotation.y = Math.PI; // Hướng mặt về phía bảng đen

    // Tạo bảng tên học sinh nổi phía trên đầu (Overhead HUD) & Bong bóng cảm xúc
    this.createOverheadHUD();
    this.createBubbleHUD();
    this.updateHUD(this.name);

    // Tải và khởi tạo Model 3D Quaternius
    this.load3DModel(this.modelId);
  }

  createOverheadHUD() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    this.hudCanvas = canvas;
    this.hudCtx = canvas.getContext('2d');

    this.hudTexture = new THREE.CanvasTexture(canvas);
    this.hudTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.hudTexture,
      transparent: true,
      depthTest: false
    });
    this.hudSprite = new THREE.Sprite(spriteMat);
    this.hudSprite.position.set(0, 1.65, 0);
    this.hudSprite.scale.set(1.4, 0.46, 1);
    this.group.add(this.hudSprite);
  }

  updateHUD(name) {
    if (!this.hudCtx) return;
    const ctx = this.hudCtx;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Nền tag mờ sang trọng, thanh mảnh
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    this._roundRect(ctx, 24, 28, w - 48, h - 56, 24);
    ctx.fill();
    ctx.stroke();

    // Tên thí sinh (Căn giữa hoàn hảo, không còn hiển thị điểm số - Yêu cầu 2.1)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(name || this.name, w / 2, h / 2);

    this.hudTexture.needsUpdate = true;
  }

  createBubbleHUD() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 192;
    this.bubbleCanvas = canvas;
    this.bubbleCtx = canvas.getContext('2d');

    this.bubbleTexture = new THREE.CanvasTexture(canvas);
    this.bubbleTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.bubbleTexture,
      transparent: true,
      depthTest: false
    });
    this.bubbleSprite = new THREE.Sprite(spriteMat);
    this.bubbleSprite.position.set(0, 2.15, 0);
    this.bubbleSprite.scale.set(1.4, 0.7, 1);
    this.bubbleSprite.visible = false;
    this.group.add(this.bubbleSprite);
    this.bubbleTimer = null;
  }

  // Nổi biểu tượng cảm xúc (Ăn mừng, cầu may, khóc...) lên đầu nhân vật 3D (Yêu cầu 2.1)
  showEmoji(emoji, duration = 3.5) {
    if (!this.bubbleCtx) return;
    const ctx = this.bubbleCtx;
    const w = this.bubbleCanvas.width;
    const h = this.bubbleCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Khung bóng tròn nổi phía trên đầu
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    this._roundRect(ctx, w / 2 - 58, 10, 116, 116, 36);
    ctx.fill();
    ctx.stroke();

    // Mũi nhọn bóng thoại trỏ xuống
    ctx.beginPath();
    ctx.moveTo(w / 2 - 14, 126);
    ctx.lineTo(w / 2 + 14, 126);
    ctx.lineTo(w / 2, 148);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.stroke();

    // Icon emoji nổi bật
    ctx.font = '68px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji || '🎉', w / 2, 68);

    this.bubbleTexture.needsUpdate = true;
    this.bubbleSprite.position.set(0, 2.15, 0);
    this.bubbleSprite.scale.set(1.3, 0.65, 1);
    this.bubbleSprite.visible = true;

    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      if (this.bubbleSprite) this.bubbleSprite.visible = false;
    }, duration * 1000);

    // Kích hoạt animation nhân vật đồng bộ nếu có (chỉ chạy khi không bị nằm gục)
    if (!this.isKnockedOut) {
      if (emoji === '🎉') this.triggerAnimation('victory', duration);
      else if (emoji === '😭') this.triggerAnimation('cry', duration);
      else if (emoji === '🙏') this.triggerAnimation('pray', duration);
    }
  }

  // Nổi tin nhắn nói chuyện lên đầu nhân vật 3D (Yêu cầu 2.1)
  showChat(text, duration = 4.0) {
    if (!this.bubbleCtx) return;
    const ctx = this.bubbleCtx;
    const w = this.bubbleCanvas.width;
    const h = this.bubbleCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Bong bóng chat học đường
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    this._roundRect(ctx, 16, 12, w - 32, 116, 24);
    ctx.fill();
    ctx.stroke();

    // Mũi nhọn bóng thoại
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, 128);
    ctx.lineTo(w / 2 + 12, 128);
    ctx.lineTo(w / 2, 148);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fill();
    ctx.stroke();

    // Text tin nhắn
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let displayStr = (text || '').trim();
    if (displayStr.length > 22) {
      displayStr = displayStr.substring(0, 20) + '...';
    }
    ctx.fillText(displayStr, w / 2, 70);

    this.bubbleTexture.needsUpdate = true;
    this.bubbleSprite.position.set(0, 2.15, 0);
    this.bubbleSprite.scale.set(1.6, 0.8, 1);
    this.bubbleSprite.visible = true;

    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      if (this.bubbleSprite) this.bubbleSprite.visible = false;
    }, duration * 1000);
  }

  setAnimation(animName, duration = 3.0) {
    return this.triggerAnimation(animName, duration);
  }

  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  async load3DModel(modelId) {
    this.modelId = modelId;
    this.isAnimal = modelId === 'Cow' || modelId === 'Pug';

    const data = await charModelMgr.loadModel(modelId);
    if (!data || !data.model) return;

    // Gỡ model cũ nếu có
    if (this.modelRoot) {
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer = null;
      }
      this.group.remove(this.modelRoot);
      this.modelRoot = null;
      this.actions = {};
      this.bones = {};
    }

    const model = data.model;
    this.modelRoot = model;

    // Yêu cầu 1.9 & 2.0: Scale kích thước model đồng đều
    const scale = this.isAnimal ? 0.50 : 0.44;
    model.scale.set(scale, scale, scale);

    // YÊU CẦU 2.0: Căn chỉnh đế giày nâng 2cm để đế chân luôn đứng phẳng trên mặt gạch patio (y = 0.01)
    // Chấm dứt hoàn toàn hiện tượng bàn chân bị lún sâu xuống nền đất
    model.position.y = 0.02;

    // Thu thập xương để điều khiển tư thế ngồi
    this.bones = {};
    model.traverse((child) => {
      if (child.isBone) {
        this.bones[child.name] = child;
        const normalized = child.name.replace(/[\._]/g, '');
        this.bones[normalized] = child;
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.55;
          child.material.metalness = 0.08;
        }
      }
    });

    this.group.add(model);

    // Áp dụng màu da nhân vật (Yêu cầu 2.0)
    this.setSkinColor(this.skinColor);

    // Kích hoạt AnimationMixer cho Model 3D
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};

    if (data.animations && data.animations.length > 0) {
      data.animations.forEach((clip) => {
        const action = this.mixer.clipAction(clip);
        this.actions[clip.name] = action;
      });
    }

    // Áp dụng thế ban đầu (Ngồi ghế hoặc Đứng)
    if (this.isSitting) {
      this._applySittingPoseImmediate();
    } else {
      this.playAction(this.isMoving ? 'Walk' : 'Idle', true);
    }
  }

  // Tùy chỉnh màu da nhân vật trực tiếp trên vật liệu 3D (Yêu cầu 2.0)
  setSkinColor(hexColor) {
    this.skinColor = hexColor || this.skinColor || '#f2c190';
    if (!this.modelRoot) return;
    const col = new THREE.Color(this.skinColor);

    this.modelRoot.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat.name && mat.name.toLowerCase().includes('skin')) {
            if (!mat._isClonedCustom) {
              child.material = mat.clone();
              child.material._isClonedCustom = true;
            }
            child.material.color.copy(col);
          }
        });
      }
    });
  }

  // Phát hoạt ảnh nhịp nhàng qua AnimationMixer (Yêu cầu 2.3: Chuyển đổi êm ái, chống giật xương)
  playAction(actionName, loop = true, fadeDuration = 0.2) {
    if (!this.actions || !this.actions[actionName]) return null;
    const nextAction = this.actions[actionName];

    if (this.currentAction === nextAction && nextAction.isRunning()) {
      return nextAction;
    }

    nextAction.reset();
    if (!loop) {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    }

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.fadeOut(fadeDuration);
      nextAction.fadeIn(fadeDuration).play();
    } else {
      nextAction.play();
    }
    this.currentAction = nextAction;
    this.currentActionName = actionName;
    return nextAction;
  }

  // Áp dụng tư thế ngồi chuẩn xác (Yêu cầu 2.0 & 2.3: Dừng sạch sẽ các action trước, chống giật hông)
  _applySittingPoseImmediate() {
    this.group.position.y = 0.02; // Chân chạm sàn
    this.group.rotation.y = Math.PI; // Hướng mặt về phía bảng đen

    // Dừng dứt điểm toàn bộ các action khác để không xung đột kênh Hips/Body trong Mixer
    if (this.actions) {
      Object.keys(this.actions).forEach(key => {
        if (key !== 'Idle') {
          this.actions[key].stop();
        }
      });
    }

    const idle = this.actions['Idle'];
    if (idle) {
      idle.reset();
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.clampWhenFinished = false;
      idle.fadeIn(0.25).play();
      this.currentAction = idle;
      this.currentActionName = 'Idle';
    }
  }

  setSitting(isSitting, seatPos, seatIndex) {
    if (this.isKnockedOut) return;
    this.isSitting = isSitting;
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }

    if (isSitting) {
      this.isMoving = false;
      this.sittingSeatIndex = seatIndex !== undefined ? seatIndex : this.sittingSeatIndex;
      if (seatPos) {
        // Ngồi lùi sâu 5cm sát tựa lưng ghế
        this.group.position.set(seatPos.x, 0.02, seatPos.z - 0.05);
      } else {
        this.group.position.y = 0.02;
      }
      this.group.rotation.y = Math.PI;
      this._applySittingPoseImmediate();
    } else {
      // Đứng dậy đi lại tự do: đế chân luôn tiếp xúc hoàn hảo ở y = 0.02m (chống lún chân)
      this.group.position.y = 0.02;
      this.playAction(this.isMoving ? 'Walk' : 'Idle', true, 0.25);
    }
  }

  // YÊU CẦU 2.5: Trạng thái nằm gục khi bị loại & nổ tung, tự động hồi phục khi hết game/vòng
  setKnockedOut(isKnockedOut) {
    this.isKnockedOut = !!isKnockedOut;
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }

    if (this.isKnockedOut) {
      this.showEmoji('💥', 6.0);

      if (this.actions && this.actions['Death']) {
        Object.keys(this.actions).forEach(key => {
          if (key !== 'Death') {
            this.actions[key].stop();
          }
        });
        const death = this.actions['Death'];
        death.reset();
        death.setLoop(THREE.LoopOnce, 1);
        death.clampWhenFinished = true; // Kẹp ở frame cuối: nằm gục hoàn toàn
        death.fadeIn(0.12).play();
        this.currentAction = death;
        this.currentActionName = 'Death';
      } else {
        // Fallback ngã nằm trên sàn nếu model không có clip Death
        this.group.rotation.z = Math.PI / 2;
        this.group.position.y = 0.06;
      }
    } else {
      // Hồi phục: đứng hoặc ngồi dậy bình thường
      this.group.rotation.z = 0;
      if (this.actions && this.actions['Death']) {
        this.actions['Death'].stop();
      }
      if (this.isSitting) {
        this._applySittingPoseImmediate();
      } else {
        this.group.position.y = 0.02;
        this.playAction(this.isMoving ? 'Walk' : 'Idle', true, 0.25);
      }
    }
  }

  // Kích hoạt biểu cảm / phản ứng nhân vật (Cheer khi ăn mừng, Defeat khi bị điểm kém, Hit khi bị ném trúng...)
  triggerAnimation(animName, duration = 2.5) {
    if (this.isKnockedOut) return;
    if (!this.actions) return;

    let targetClip = null;
    if (animName === 'cheer' || animName === 'victory') targetClip = 'Victory';
    else if (animName === 'cry' || animName === 'defeat') targetClip = 'Defeat';
    else if (animName === 'pray') targetClip = 'PickUp';
    else if (animName === 'hit') targetClip = 'RecieveHit';
    else if (animName === 'throw' || animName === 'punch') targetClip = 'Punch';
    else if (animName === 'jump') targetClip = 'Jump';
    else targetClip = 'Victory';

    if (this.actions[targetClip]) {
      const act = this.actions[targetClip];

      // Dừng êm ái action hiện tại
      if (this.currentAction && this.currentAction !== act) {
        this.currentAction.fadeOut(0.15);
      }

      act.reset();
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = false; // Yêu cầu 2.3: Không kẹp frame cuối, tránh giữ tư thế làm giật hông
      act.fadeIn(0.15).play();
      this.currentAction = act;
      this.currentActionName = targetClip;

      if (this.animTimer) clearTimeout(this.animTimer);
      this.animTimer = setTimeout(() => {
        act.fadeOut(0.2);
        setTimeout(() => {
          act.stop();
        }, 200);

        if (this.isSitting) {
          this._applySittingPoseImmediate();
        } else {
          this.playAction(this.isMoving ? 'Walk' : 'Idle', true, 0.25);
        }
      }, duration * 1000);
    }
  }

  update(delta) {
    // 1. Cập nhật AnimationMixer của mô hình 3D Quaternius
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // YÊU CẦU 2.5: Nếu đang bị loại (nằm gục do nổ), không can thiệp xoay xương ngồi ghế hay chuyển Walk/Idle
    if (this.isKnockedOut) {
      return;
    }

    // 2. YÊU CẦU 2.0: KHẮC PHỤC NGỒI CHỒM HỔM (SQUAT) & LƠ LỬNG
    // Áp dụng tư thế ngồi ghế chuẩn mực cho nhân vật người:
    // Đùi đưa ngang về phía trước (-1.35 rad), bắp chân gập vuông góc xuống sàn (+1.35 rad)
    if (this.isSitting && !this.isAnimal) {
      const upL = this.bones['UpperLegL'] || this.bones['UpperLeg.L'];
      const upR = this.bones['UpperLegR'] || this.bones['UpperLeg.R'];
      const lowL = this.bones['LowerLegL'] || this.bones['LowerLeg.L'];
      const lowR = this.bones['LowerLegR'] || this.bones['LowerLeg.R'];
      if (upL && lowL) {
        upL.rotation.x -= 1.35;
        upR.rotation.x -= 1.35;
        lowL.rotation.x += 1.35;
        lowR.rotation.x += 1.35;
      }
    }

    // 3. Tự động chuyển đổi giữa Walk và Idle khi nhân vật đang đứng tự do
    if (!this.isSitting) {
      const isOneShot = this.currentActionName === 'Victory' || 
                        this.currentActionName === 'Defeat' || 
                        this.currentActionName === 'RecieveHit' || 
                        this.currentActionName === 'Punch' || 
                        this.currentActionName === 'Jump';

      if (!isOneShot) {
        if (this.isMoving) {
          if (this.currentActionName !== 'Walk') {
            this.playAction('Walk', true, 0.2);
          }
        } else {
          if (this.currentActionName !== 'Idle') {
            this.playAction('Idle', true, 0.2);
          }
        }
      }
    }
  }

  destroy() {
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }
    if (this.bubbleTimer) {
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    if (this.hudTexture) {
      this.hudTexture.dispose();
    }
    if (this.bubbleTexture) {
      this.bubbleTexture.dispose();
    }
  }
}

// ============================================================================
// CHARACTER PREVIEW VIEWER (YÊU CẦU 2.0)
// Bộ hiển thị xem trước nhân vật 3D tương tác xoay 360 độ và đổi màu da tức thì
// ============================================================================
class CharacterPreviewViewer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) return;

    this.options = Object.assign({
      autoRotate: false,
      interactive: true,
      cameraDist: 2.2,
      cameraY: 0.92,
      lookAtY: 0.72,
      alpha: true
    }, options);

    this.width = this.container.clientWidth || 240;
    this.height = this.container.clientHeight || 200;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.1, 20);
    this.camera.position.set(0, this.options.cameraY, this.options.cameraDist);
    this.camera.lookAt(0, this.options.lookAtY, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: this.options.alpha });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Ánh sáng Studio dịu mắt
    const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 0.95);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-3, 2, -2);
    this.scene.add(rimLight);

    // Bục đứng tròn tinh tế
    const podGeo = new THREE.CylinderGeometry(0.55, 0.58, 0.04, 32);
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4
    });
    this.pedestal = new THREE.Mesh(podGeo, podMat);
    this.pedestal.position.y = -0.02;
    this.scene.add(this.pedestal);

    this.characterGroup = new THREE.Group();
    this.scene.add(this.characterGroup);

    this.currentModelId = null;
    this.currentSkinColor = '#f2c190';
    this.mixer = null;
    this.clock = new THREE.Clock();

    this.isDragging = false;
    this.prevX = 0;
    this.rotationSpeed = this.options.autoRotate ? 0.6 : 0;

    if (this.options.interactive) {
      this._setupEvents();
    }

    this.animate = this.animate.bind(this);
    this.isRunning = true;
    requestAnimationFrame(this.animate);
  }

  _setupEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevX = e.clientX;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevX;
      this.characterGroup.rotation.y += dx * 0.015;
      this.pedestal.rotation.y += dx * 0.015;
      this.prevX = e.clientX;
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });

    el.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        this.isDragging = true;
        this.prevX = e.touches[0].clientX;
      }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || !e.touches || !e.touches.length) return;
      const dx = e.touches[0].clientX - this.prevX;
      this.characterGroup.rotation.y += dx * 0.015;
      this.pedestal.rotation.y += dx * 0.015;
      this.prevX = e.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchend', () => { this.isDragging = false; });
  }

  async setCharacter(modelId, skinColor) {
    this.currentModelId = modelId;
    if (skinColor) this.currentSkinColor = skinColor;

    const data = await charModelMgr.loadModel(modelId);
    if (!data || !data.model) return;

    // Dọn dẹp model cũ
    while (this.characterGroup.children.length > 0) {
      this.characterGroup.remove(this.characterGroup.children[0]);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    const model = data.model;
    const isAnimal = modelId === 'Cow' || modelId === 'Pug';
    const scale = isAnimal ? 0.50 : 0.44;
    model.scale.set(scale, scale, scale);
    model.position.set(0, 0, 0);

    this.characterGroup.add(model);

    // Áp dụng màu da
    this.setSkinColor(this.currentSkinColor);

    // Chạy animation Idle
    this.mixer = new THREE.AnimationMixer(model);
    if (data.animations && data.animations.length > 0) {
      const idleClip = data.animations.find(a => a.name === 'Idle') || data.animations[0];
      if (idleClip) {
        const act = this.mixer.clipAction(idleClip);
        act.play();
      }
    }
  }

  loadCharacter(modelId, skinColor) {
    return this.setCharacter(modelId, skinColor);
  }

  setSkinColor(hexColor) {
    this.currentSkinColor = hexColor || '#f2c190';
    if (!this.characterGroup) return;
    const col = new THREE.Color(this.currentSkinColor);
    this.characterGroup.traverse((c) => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (m.name && m.name.toLowerCase().includes('skin')) {
            if (!m._isClonedCustom) {
              c.material = m.clone();
              c.material._isClonedCustom = true;
            }
            c.material.color.copy(col);
          }
        });
      }
    });
  }

  resize() {
    if (!this.container || !this.renderer) return;
    this.width = this.container.clientWidth || 240;
    this.height = this.container.clientHeight || 200;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate);

    // TỐI ƯU CỰC MẠNH: Nếu khung container bị ẩn (đang chơi game / đóng modal), dừng render tiết kiệm 100% GPU
    if (!this.container || this.container.offsetParent === null) {
      return;
    }

    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (!this.isDragging && this.options.autoRotate) {
      this.characterGroup.rotation.y += this.rotationSpeed * delta;
      this.pedestal.rotation.y += this.rotationSpeed * delta;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.isRunning = false;
    if (this.mixer) this.mixer.stopAllAction();
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

// Xuất các đối tượng toàn cục
window.CHARACTER_SKINS = CHARACTER_SKINS;
window.SKIN_TONE_PALETTE = SKIN_TONE_PALETTE;
window.CharacterModelManager = CharacterModelManager;
window.charModelMgr = charModelMgr;
window.StudentCharacter = StudentCharacter;
window.CharacterPreviewViewer = CharacterPreviewViewer;

