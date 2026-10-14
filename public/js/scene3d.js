// public/js/scene3d.js - Quản lý Không gian 3D Sân Trường & Lớp Học Ngoài Trời v1.2
// Bản 1.2:
// 1. Ánh sáng dịu mát, chống chói, màu sân và màu cỏ tự nhiên.
// 2. Chia thành 3 DÃY BÀN (Trái, Giữa, Phải) thay vì 2 dãy.
// 3. Cho phép một chạm / rê chuột (Touch/Mouse Drag) tự do xoay góc nhìn camera qua lại.
// 4. Hỗ trợ nút chuyển đổi các góc nhìn camera (Toàn cảnh, Bảng đen, Bàn của tôi, Góc nghiêng).

class SchoolScene3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = window.innerWidth || containerElement.clientWidth || document.documentElement.clientWidth;
    this.height = window.innerHeight || containerElement.clientHeight || document.documentElement.clientHeight;

    this.desks = [];
    this.seatOffsets = [
      { x: -0.6, y: 0, z: 0.62 }, // Ghế trái
      { x: 0.6, y: 0, z: 0.62 }   // Ghế phải
    ];
    this.characters = new Map();
    this.projectiles = [];
    this.confettiParticles = [];
    this.explosions = [];
    this.cameraShakeTime = 0;
    this.cameraShakeIntensity = 0;

    // Camera animation targets
    this.camTargetPos = new THREE.Vector3(0, 5.2, 9.8);
    this.camTargetLookAt = new THREE.Vector3(0, 1.2, -1.0);
    this.camCurrentLookAt = new THREE.Vector3(0, 1.2, -1.0);

    // Điều khiển xoay camera tự do bằng cảm ứng / chuột (One-touch drag)
    this.isPointerDown = false;
    this.pointerStartX = 0;
    this.pointerStartY = 0;
    this.azimuthAngle = 0; // Góc quay ngang
    this.polarAngle = 0.52; // Góc nhìn nghiêng từ trên xuống
    this.cameraDistance = 11.2;
    this.lastUserDragTime = 0;
    this.currentPresetIndex = 0;
    this.cameraMode = 'OVERVIEW';
    this.isLobby = true;

    // Di chuyển và tương tác sảnh chờ (Yêu cầu 1.7)
    this.seatSpots = [];
    this.myPlayerId = null;
    this.moveInput = { x: 0, z: 0 };
    this.nearbySeat = null;
    this.nearbyAction = null;
    this.onInteractionPromptChange = null;
    this.onMyMoveCallback = null;
    this.onSeatInteracted = null;
    this.lastMoveEmitTime = 0;

    // Shared geometries để tái sử dụng và tránh memory leak
    this.sharedFlashGeo = new THREE.SphereGeometry(0.35, 12, 12);
    this.sharedRingGeo = new THREE.RingGeometry(0.1, 0.35, 20);
    this.sharedShardGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);

    this.initThree();
    this.setupCameraTouchDrag();
    this.createEnvironment();
    this.createClassroomFurniture();
    this.initSeatSpots();
    this.createBlackboardAndBanner();
    this.initConfetti();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onWindowResize(), 100);
    });
    setTimeout(() => this.onWindowResize(), 50);
    setTimeout(() => this.onWindowResize(), 250);
  }

  initThree() {
    this.width = window.innerWidth || this.container.clientWidth;
    this.height = window.innerHeight || this.container.clientHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec5db); // Bầu trời xanh dịu mát, không chói
    this.scene.fog = new THREE.FogExp2(0x8ec5db, 0.014);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 5.2, 9.8);

    // 3. Renderer với Tone Mapping chống chói sáng & Hiệu năng cao
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    const isMobile = window.innerWidth < 768;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82; // Giảm phơi sáng để dịu mắt tuyệt đối

    // Ép toàn bộ khung canvas tràn màn hình không phụ thuộc timing DOM
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';

    this.container.appendChild(this.renderer.domElement);

    // 4. Ánh sáng dịu mát ngoài trời
    const hemiLight = new THREE.HemisphereLight(0xd0e8f5, 0x3d5a36, 0.4);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 0.5); // Ánh nắng vàng ấm dịu
    sunLight.position.set(10, 18, 12);
    sunLight.castShadow = true;
    // Tối ưu hóa shadow map: 1024 trên desktop, 512 trên mobile (tiết kiệm 75% GPU VRAM)
    const shadowRes = isMobile ? 512 : 1024;
    sunLight.shadow.mapSize.width = shadowRes;
    sunLight.shadow.mapSize.height = shadowRes;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;
    const d = 14;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    const ambientFill = new THREE.AmbientLight(0xffffff, 0.12);
    this.scene.add(ambientFill);
  }

  // Thiết lập một chạm / rê chuột di chuyển camera tự do
  setupCameraTouchDrag() {
    const onStart = (clientX, clientY, target) => {
      // Bỏ qua nếu chạm vào các modal, button, input hay khung chat
      if (target && target.closest && target.closest('.pointer-events-auto, button, input, .glass-panel, .glass-panel-gold')) {
        return;
      }
      this.isPointerDown = true;
      this.pointerStartX = clientX;
      this.pointerStartY = clientY;
      this.lastUserDragTime = Date.now();
    };

    const onMove = (clientX, clientY) => {
      if (!this.isPointerDown) return;
      const dx = clientX - this.pointerStartX;
      const dy = clientY - this.pointerStartY;
      this.pointerStartX = clientX;
      this.pointerStartY = clientY;

      // Xoay góc ngang và góc dọc (Đảo chiều dy để vuốt lên/xuống tự nhiên theo cử chỉ người dùng)
      this.azimuthAngle -= dx * 0.0055;
      this.polarAngle = Math.max(0.12, Math.min(1.32, this.polarAngle - dy * 0.0045));
      this.lastUserDragTime = Date.now();
    };

    const onEnd = () => {
      this.isPointerDown = false;
    };

    // Chuột
    window.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY, e.target));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    // Cảm ứng (Mobile / Tablet 1 chạm)
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', onEnd);
  }

  createEnvironment() {
    // 1. Mặt sân cỏ tự nhiên (Màu xanh cỏ êm dịu, không neon)
    const groundGeo = new THREE.PlaneGeometry(70, 70);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3e7a37 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sân lát gạch đỏ khu vực lớp học (Màu gạch nung ấm áp, chống chói)
    const patioGeo = new THREE.PlaneGeometry(16, 14);
    const patioMat = new THREE.MeshLambertMaterial({ color: 0x9c5a4e });
    const patio = new THREE.Mesh(patioGeo, patioMat);
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(0, 0.01, 2.5);
    patio.receiveShadow = true;
    this.scene.add(patio);

    // 2. Mây bồng bềnh trôi
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      const nPuffs = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < nPuffs; j++) {
        const puffGeo = new THREE.DodecahedronGeometry(1.5 + Math.random() * 1.5, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((j - 1.5) * 1.8, Math.random() * 0.6, (Math.random() - 0.5) * 1.5);
        cloud.add(puff);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 50,
        14 + Math.random() * 6,
        -15 + (Math.random() - 0.5) * 35
      );
      cloud.speed = 0.35 + Math.random() * 0.35;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    // 3. Hoa dại nhiều màu rải rác trên cỏ
    const flowerColors = [0xef4444, 0xfacc15, 0xa855f7, 0x38bdf8, 0xffffff];
    const flowerGeo = new THREE.DodecahedronGeometry(0.12, 0);
    for (let i = 0; i < 80; i++) {
      const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const fMat = new THREE.MeshBasicMaterial({ color: col });
      const flower = new THREE.Mesh(flowerGeo, fMat);
      
      let fx = (Math.random() - 0.5) * 44;
      let fz = (Math.random() - 0.5) * 44;
      if (Math.abs(fx) < 9 && fz > -5 && fz < 9) {
        fx += fx > 0 ? 9 : -9;
      }
      flower.position.set(fx, 0.1, fz);
      this.scene.add(flower);
    }

    // 4. Cây Phượng Vĩ và bóng mát sân trường
    this.createSchoolTree(-10, -2, true);
    this.createSchoolTree(10, -2, true);
    this.createSchoolTree(-12, 6, false);
    this.createSchoolTree(12, 6, false);

    // 5. Cột cờ
    this.createFlagPole(-8.5, -8);

    // 6. Kiếm cắm trong đá (Excalibur in Stone) bên trái ngoài phạm vi di chuyển (Yêu cầu 3.1)
    this.createExcaliburInStone(-11.5, 2.0);

    // 7. Tên lửa vũ trụ (Space Rocket) bên phải ngoài phạm vi di chuyển (Yêu cầu 3.1)
    this.createGardenRocket(11.5, 2.0);

    // 8. Vài chú chim nhỏ đậu trên tường lớp học & bảng đen (Yêu cầu 3.1)
    this.createWallBirds();

    // 9. Người ngoài hành tinh đứng dựa tường tạo dáng meme kinh điển (Yêu cầu 3.1)
    this.createWallLeaningAlien(-4.9, -3.0);
  }

  createSchoolTree(x, z, hasRedFlowers = true) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c2b09, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 4.5, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.25;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x166534, flatShading: true });
    const layer1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), leavesMat);
    layer1.position.y = 4.8;
    layer1.castShadow = true;
    tree.add(layer1);

    const layer2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 1), leavesMat);
    layer2.position.set(0.6, 6.0, 0.4);
    layer2.castShadow = true;
    tree.add(layer2);

    if (hasRedFlowers) {
      const redFlowerMat = new THREE.MeshLambertMaterial({ color: 0xdc2626, flatShading: true });
      for (let i = 0; i < 7; i++) {
        const cluster = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), redFlowerMat);
        const theta = (i / 7) * Math.PI * 2;
        cluster.position.set(
          1.8 * Math.cos(theta),
          4.5 + Math.random() * 1.5,
          1.8 * Math.sin(theta)
        );
        tree.add(cluster);
      }
    }

    this.scene.add(tree);
  }

  createFlagPole(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const baseMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), baseMat);
    b1.position.y = 0.15;
    group.add(b1);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.2 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), poleMat);
    pole.position.y = 4.8;
    pole.castShadow = true;
    group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(1.6, 1.0);
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 256;
    flagCanvas.height = 160;
    const fctx = flagCanvas.getContext('2d');
    fctx.fillStyle = '#da251d';
    fctx.fillRect(0, 0, 256, 160);

    fctx.fillStyle = '#ffff00';
    this._drawStar(fctx, 128, 80, 5, 38, 16);
    fctx.fill();

    const flagTex = new THREE.CanvasTexture(flagCanvas);
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.8, 8.6, 0);
    group.add(flag);

    this.scene.add(group);
  }

  _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  createClassroomFurniture() {
    // 6 BÀN ĐÔI HỌC SINH (CHIA LÀM 3 DÃY BÀN x 2 HÀNG)
    // Dãy 1 (Trái): x = -3.4 | Dãy 2 (Giữa): x = 0.0 | Dãy 3 (Phải): x = 3.4
    // Hàng 1 (Trước): z = 1.0 | Hàng 2 (Sau): z = 4.8
    const rowZ = [1.0, 4.8];
    const colX = [-3.4, 0.0, 3.4];

    let deskIdx = 0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = colX[c];
        const z = rowZ[r];
        const deskGroup = this.buildDoubleDesk(x, z, deskIdx);
        this.scene.add(deskGroup);
        this.desks.push({
          index: deskIdx,
          position: new THREE.Vector3(x, 0, z),
          group: deskGroup
        });
        deskIdx++;
      }
    }
  }

  initSeatSpots() {
    this.seatSpots = [];
    for (let d = 0; d < this.desks.length; d++) {
      const desk = this.desks[d];
      this.seatOffsets.forEach((off, sIdx) => {
        this.seatSpots.push({
          seatIndex: d * 2 + sIdx,
          deskIndex: d,
          pos: new THREE.Vector3(desk.position.x + off.x, 0.02, desk.position.z + off.z)
        });
      });
    }
  }

  buildDoubleDesk(x, z, deskIndex) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Gỗ sồi ấm áp, dịu mắt
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xb36829 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.5 });

    // 1. Mặt bàn gỗ đôi (Kích thước chuẩn: rộng 2.1m, sâu 0.65m, cao 0.76m)
    const topGeo = new THREE.BoxGeometry(2.1, 0.045, 0.65);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 2. Ngăn bàn (Thụt vào trong phía trước để chừa chỗ đùi học sinh ngồi thoải mái)
    const shelfGeo = new THREE.BoxGeometry(2.0, 0.03, 0.45);
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x9a501a });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(0, 0.64, -0.08);
    shelf.castShadow = true;
    group.add(shelf);

    // 3. Tấm chắn trước bàn
    const panelGeo = new THREE.BoxGeometry(2.0, 0.38, 0.03);
    const panel = new THREE.Mesh(panelGeo, shelfMat);
    panel.position.set(0, 0.52, -0.30);
    panel.castShadow = true;
    group.add(panel);

    // 4. Bốn chân sắt (Chiều cao 0.76m)
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.76, 8);
    const legPositions = [
      [-0.95, 0.38, -0.27],
      [0.95, 0.38, -0.27],
      [-0.95, 0.38, 0.27],
      [0.95, 0.38, 0.27]
    ];
    legPositions.forEach(p => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      group.add(leg);
    });

    // 5. Đạo cụ trên bàn: Giấy thi & Bút bi học sinh
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const paperGeo = new THREE.PlaneGeometry(0.38, 0.48);
    const paperL = new THREE.Mesh(paperGeo, paperMat);
    paperL.rotation.x = -Math.PI / 2;
    paperL.position.set(-0.55, 0.785, 0.02);
    paperL.rotation.z = 0.08;
    group.add(paperL);

    const paperR = new THREE.Mesh(paperGeo, paperMat);
    paperR.rotation.x = -Math.PI / 2;
    paperR.position.set(0.55, 0.785, 0.02);
    paperR.rotation.z = -0.06;
    group.add(paperR);

    // Bút bi xanh
    const penMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
    const penGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6);
    const penL = new THREE.Mesh(penGeo, penMat);
    penL.rotation.z = Math.PI / 2;
    penL.position.set(-0.3, 0.785, 0.08);
    group.add(penL);

    // 6. Ghế ngồi phía sau bàn
    this.seatOffsets.forEach(offset => {
      const chairGroup = this.buildChair();
      chairGroup.position.set(offset.x, offset.y, offset.z);
      group.add(chairGroup);
    });

    // 7. Đồ dùng học sinh: Hộp bút & Cặp sách/Balo (Yêu cầu 3.1)
    this.addDeskStationeryAndBags(group, deskIndex);

    return group;
  }

  addDeskStationeryAndBags(group, deskIndex) {
    // 1. HỘP BÚT HỌC SINH TRÊN BÀN (Yêu cầu 3.1: Màu sắc đa dạng, bố trí tự nhiên)
    const caseColors = [0x2563eb, 0xdc2626, 0x16a34a, 0xd97706, 0x9333ea, 0xdb2777];

    const createPencilCase = (color, xPos, zPos, rotY = 0) => {
      const caseGroup = new THREE.Group();
      caseGroup.position.set(xPos, 0.785, zPos);
      caseGroup.rotation.y = rotY;

      // Thân hộp bút bo mềm
      const caseMat = new THREE.MeshLambertMaterial({ color });
      const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.09), caseMat);
      caseBody.position.y = 0.022;
      caseBody.castShadow = true;
      caseGroup.add(caseBody);

      // Dây khóa kéo trên đỉnh
      const zipMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.8, roughness: 0.2 });
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.012), zipMat);
      zip.position.y = 0.046;
      caseGroup.add(zip);

      // Đầu kéo khóa
      const puller = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.025), zipMat);
      puller.position.set(-0.10, 0.046, 0);
      caseGroup.add(puller);

      return caseGroup;
    };

    // Thước kẻ nhựa trong
    const createRuler = (xPos, zPos, rotY = 0) => {
      const rulerMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, roughness: 0.1 });
      const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.003, 0.035), rulerMat);
      ruler.position.set(xPos, 0.784, zPos);
      ruler.rotation.y = rotY;
      return ruler;
    };

    // Cục gôm tẩy trắng
    const createEraser = (xPos, zPos, rotY = 0) => {
      const eraserMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
      const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.03), eraserMat);
      eraser.position.set(xPos, 0.795, zPos);
      eraser.rotation.y = rotY;
      return eraser;
    };

    // Đặt hộp bút theo từng bàn khác nhau
    if (deskIndex === 0) {
      group.add(createPencilCase(caseColors[0], -0.35, 0.10, 0.18));
    } else if (deskIndex === 1) {
      group.add(createPencilCase(caseColors[1], 0.35, -0.08, -0.15));
      group.add(createRuler(0.38, 0.12, 0.05));
    } else if (deskIndex === 2) {
      group.add(createPencilCase(caseColors[2], -0.34, 0.10, 0.12));
      group.add(createPencilCase(caseColors[5], 0.36, -0.09, -0.2));
    } else if (deskIndex === 3) {
      group.add(createPencilCase(caseColors[3], -0.35, -0.09, -0.12));
      group.add(createEraser(-0.35, 0.10, 0.25));
    } else if (deskIndex === 4) {
      group.add(createPencilCase(caseColors[4], 0.35, 0.08, 0.22));
    } else {
      group.add(createPencilCase(caseColors[0], -0.34, 0.11, 0.15));
      group.add(createPencilCase(caseColors[1], 0.35, -0.08, -0.18));
      group.add(createRuler(-0.35, -0.09, 0));
    }

    // 2. CẶP SÁCH / BALO HỌC SINH (Yêu cầu 3.1: Treo bên hông ghế hoặc đặt dưới đất cạnh chân bàn)
    if (deskIndex === 0) {
      // Đặt dưới đất cạnh chân bàn bên trái, hơi nghiêng tựa vào chân bàn
      const bag = this.buildBackpackMesh(0x1e3a8a, 0xef4444);
      bag.position.set(-0.96, 0.19, 0.05);
      bag.rotation.set(0, 0.1, 0.16);
      group.add(bag);
    } else if (deskIndex === 1) {
      // Treo bên hông ghế bên phải
      const bag = this.buildBackpackMesh(0x991b1b, 0xfef08a);
      bag.position.set(0.88, 0.38, 0.72);
      bag.rotation.y = Math.PI / 2;
      group.add(bag);
    } else if (deskIndex === 2) {
      // Đặt dưới đất cạnh chân bàn bên phải
      const bag = this.buildBackpackMesh(0x15803d, 0xf59e0b);
      bag.position.set(0.96, 0.19, -0.06);
      bag.rotation.set(0, -0.15, -0.15);
      group.add(bag);
    } else if (deskIndex === 3) {
      // Bàn này có 2 chiếc: 1 chiếc treo bên hông ghế trái, 1 chiếc đặt dưới sàn chân bàn phải
      const bag1 = this.buildBackpackMesh(0xea580c, 0x1e293b);
      bag1.position.set(-0.88, 0.38, 0.72);
      bag1.rotation.y = -Math.PI / 2;
      group.add(bag1);

      const bag2 = this.buildBackpackMesh(0x6b21a8, 0xa855f7);
      bag2.position.set(0.96, 0.19, 0.08);
      bag2.rotation.set(0, 0.2, -0.14);
      group.add(bag2);
    } else if (deskIndex === 4) {
      // Đặt dưới đất bên trái
      const bag = this.buildBackpackMesh(0x0284c7, 0x475569);
      bag.position.set(-0.96, 0.19, -0.06);
      bag.rotation.set(0, -0.1, 0.15);
      group.add(bag);
    } else {
      // Bàn 5: 1 chiếc treo bên hông ghế trái, 1 chiếc để dưới đất bên phải
      const bag1 = this.buildBackpackMesh(0xdb2777, 0xfce7f3);
      bag1.position.set(-0.88, 0.38, 0.72);
      bag1.rotation.y = -Math.PI / 2;
      group.add(bag1);

      const bag2 = this.buildBackpackMesh(0x1e293b, 0x38bdf8);
      bag2.position.set(0.96, 0.19, 0.05);
      bag2.rotation.set(0, 0.15, -0.16);
      group.add(bag2);
    }
  }

  buildBackpackMesh(mainColor, pocketColor) {
    const bagGroup = new THREE.Group();
    const bagMat = new THREE.MeshLambertMaterial({ color: mainColor });
    const pocketMat = new THREE.MeshLambertMaterial({ color: pocketColor });
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    // 1. Thân balo
    const bodyGeo = new THREE.BoxGeometry(0.28, 0.38, 0.18);
    const body = new THREE.Mesh(bodyGeo, bagMat);
    body.castShadow = true;
    bagGroup.add(body);

    // 2. Ngăn phụ phía trước
    const pocketGeo = new THREE.BoxGeometry(0.22, 0.22, 0.07);
    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(0, -0.06, 0.12);
    pocket.castShadow = true;
    bagGroup.add(pocket);

    // 3. Quai xách trên đỉnh
    const handleGeo = new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI);
    const handle = new THREE.Mesh(handleGeo, strapMat);
    handle.rotation.x = Math.PI;
    handle.position.set(0, 0.19, 0);
    bagGroup.add(handle);

    // 4. Dải phản quang trên túi phụ
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.02, 0.005), stripeMat);
    stripe.position.set(0, -0.03, 0.158);
    bagGroup.add(stripe);

    return bagGroup;
  }

  buildChair() {
    const chair = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x9a501a });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.5 });

    // Mặt ghế gỗ: Độ cao chuẩn xác y = 0.44m (vừa vặn chiều cao hông học sinh)
    const seatGeo = new THREE.BoxGeometry(0.48, 0.035, 0.42);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    chair.add(seat);

    // Tựa lưng ghế
    const backGeo = new THREE.BoxGeometry(0.46, 0.20, 0.025);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.78, 0.20);
    back.castShadow = true;
    chair.add(back);

    // Thanh chống tựa lưng
    const backPoleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6);
    const poleL = new THREE.Mesh(backPoleGeo, metalMat);
    poleL.position.set(-0.19, 0.61, 0.20);
    const poleR = new THREE.Mesh(backPoleGeo, metalMat);
    poleR.position.set(0.19, 0.61, 0.20);
    chair.add(poleL);
    chair.add(poleR);

    // Bốn chân ghế chạm sàn y = 0
    const legGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6);
    const legs = [
      [-0.19, 0.22, -0.17],
      [0.19, 0.22, -0.17],
      [-0.19, 0.22, 0.17],
      [0.19, 0.22, 0.17]
    ];
    legs.forEach(p => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      chair.add(leg);
    });

    return chair;
  }

  // Vài chú chim nhỏ đậu trên tường và gờ bảng đen (Yêu cầu 3.1)
  createWallBirds() {
    this.wallBirds = [];

    const birdConfigs = [
      // 1. Đậu trên thanh khung gỗ đỉnh bảng đen (nhìn xuống lớp học)
      { x: -2.2, y: 3.52, z: -2.96, rotY: 0.35, color: 0xa16207 },
      // 2. Đậu trên mép mái ngói đỏ bên phải
      { x: 2.8, y: 4.98, z: -2.85, rotY: -0.4, color: 0x0284c7 },
      // 3. Đậu trên đỉnh bờ tường bên trái
      { x: -4.2, y: 4.82, z: -3.0, rotY: 0.6, color: 0x65a30d }
    ];

    birdConfigs.forEach((cfg) => {
      const bird = new THREE.Group();
      bird.position.set(cfg.x, cfg.y, cfg.z);
      bird.rotation.y = cfg.rotY;

      const bodyMat = new THREE.MeshLambertMaterial({ color: cfg.color });
      const bellyMat = new THREE.MeshLambertMaterial({ color: 0xfef08a });
      const beakMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const legMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });

      // Thân chim (hình oval)
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bodyMat);
      body.scale.set(0.9, 1.0, 1.25);
      body.position.y = 0.08;
      body.castShadow = true;
      bird.add(body);

      // Bụng chim sáng màu
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), bellyMat);
      belly.scale.set(0.85, 0.95, 1.0);
      belly.position.set(0, 0.065, 0.04);
      bird.add(belly);

      // Đầu chim
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.14, 0.08);

      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), bodyMat);
      headGroup.add(headMesh);

      // Mỏ chim vàng nhọn
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 5), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0, 0.065);
      headGroup.add(beak);

      // Hai mắt đen tí hon
      const eyeGeo = new THREE.SphereGeometry(0.012, 6, 6);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.035, 0.015, 0.035);
      headGroup.add(eyeL);

      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.035, 0.015, 0.035);
      headGroup.add(eyeR);

      bird.add(headGroup);

      // Cánh 2 bên
      const wingGeo = new THREE.BoxGeometry(0.02, 0.07, 0.12);
      const wingL = new THREE.Mesh(wingGeo, bodyMat);
      wingL.position.set(-0.08, 0.09, -0.01);
      wingL.rotation.z = -0.15;
      bird.add(wingL);

      const wingR = new THREE.Mesh(wingGeo, bodyMat);
      wingR.position.set(0.08, 0.09, -0.01);
      wingR.rotation.z = 0.15;
      bird.add(wingR);

      // Đuôi chim vểnh nhẹ
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.10), bodyMat);
      tail.position.set(0, 0.10, -0.12);
      tail.rotation.x = -0.25;
      bird.add(tail);

      // Chân chim bám gờ
      const legGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.05, 5);
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.03, 0.025, 0.01);
      bird.add(legL);

      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.03, 0.025, 0.01);
      bird.add(legR);

      this.scene.add(bird);
      this.wallBirds.push({ group: bird, head: headGroup, baseY: cfg.y });
    });
  }

  // Người ngoài hành tinh đứng dựa tường tạo dáng meme kinh điển (Yêu cầu 3.1)
  createWallLeaningAlien(x = -4.9, z = -3.0) {
    const alienGroup = new THREE.Group();
    alienGroup.position.set(x, 0, z);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0x4ade80 }); // Xanh Alien
    const clothesMat = new THREE.MeshLambertMaterial({ color: 0x334155 }); // Áo xám trầm ngầu
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Quần đen
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x09090b }); // Mắt đen tuyền sâu thẳm
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x475569 }); // Giày
    const maneMat = new THREE.MeshLambertMaterial({ color: 0x3d1a04 }); // Bờm tóc nâu sẫm như meme

    // Thân hơi nghiêng nhẹ tựa lưng vào tường
    const bodyTiltGroup = new THREE.Group();
    bodyTiltGroup.rotation.set(-0.05, 0.15, -0.08);

    // 1. Thân áo (Torso)
    const torsoGeo = new THREE.BoxGeometry(0.38, 0.62, 0.22);
    const torso = new THREE.Mesh(torsoGeo, clothesMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    bodyTiltGroup.add(torso);

    // 2. Hai tay đút túi áo cực chill
    const armGeo = new THREE.BoxGeometry(0.09, 0.44, 0.10);
    const armL = new THREE.Mesh(armGeo, clothesMat);
    armL.position.set(-0.23, 1.0, 0.04);
    armL.rotation.z = -0.15;
    armL.rotation.x = -0.18;
    bodyTiltGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, clothesMat);
    armR.position.set(0.23, 1.0, 0.04);
    armR.rotation.z = 0.15;
    armR.rotation.x = -0.18;
    bodyTiltGroup.add(armR);

    // 3. Cổ thon Alien
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), skinMat);
    neck.position.y = 1.40;
    bodyTiltGroup.add(neck);

    // 4. Đầu Alien to quả lê kinh điển (cúi gục suy tư như meme)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.62, 0.02);
    headGroup.rotation.set(0.24, -0.1, 0.05); // Cúi đầu sâu sắc

    // Hộp sọ trên to bè
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    cranium.scale.set(1.05, 1.25, 1.0);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Cằm thon nhọn
    const chin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 8), skinMat);
    chin.rotation.x = Math.PI;
    chin.position.set(0, -0.15, 0.03);
    headGroup.add(chin);

    // Hai mắt Alien to hình quả hạnh nhân xếch chéo
    const eyeGeo = new THREE.SphereGeometry(0.075, 10, 10);
    eyeGeo.scale(1.2, 0.65, 0.5);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 0.03, 0.17);
    eyeL.rotation.set(-0.15, 0.35, -0.35);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 0.03, 0.17);
    eyeR.rotation.set(-0.15, -0.35, 0.35);
    headGroup.add(eyeR);

    // Bờm tóc nâu sẫm vuốt rũ như nhân vật meme
    const hair = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), maneMat);
    hair.scale.set(0.9, 1.2, 1.4);
    hair.position.set(0, 0.18, -0.06);
    headGroup.add(hair);

    bodyTiltGroup.add(headGroup);

    // 5. CHÂN ĐỨNG & CHÂN CO ĐẠP TƯỜNG (DÁNG MEME ĐẶC TRƯNG)
    // Chân trái: Chân trụ đứng thẳng chạm đất
    const legLGroup = new THREE.Group();
    legLGroup.position.set(-0.12, 0.74, 0);

    const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.40, 0.13), pantsMat);
    thighL.position.y = -0.18;
    thighL.castShadow = true;
    legLGroup.add(thighL);

    const calfL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.38, 0.11), pantsMat);
    calfL.position.y = -0.52;
    calfL.castShadow = true;
    legLGroup.add(calfL);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.20), shoeMat);
    footL.position.set(0, -0.70, 0.04);
    footL.castShadow = true;
    legLGroup.add(footL);

    alienGroup.add(legLGroup);

    // Chân phải: Chân co gập đạp tựa vào tường sau (Y HỆT BỨC ẢNH MEME)
    const legRGroup = new THREE.Group();
    legRGroup.position.set(0.12, 0.74, 0);

    // Đùi phải đưa ra phía trước
    const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.13), pantsMat);
    thighR.position.set(0, -0.10, 0.14);
    thighR.rotation.x = -1.05; // Đùi gập nâng lên trước
    thighR.castShadow = true;
    legRGroup.add(thighR);

    // Cẳng chân phải gập ngược ra sau về phía tường
    const calfR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.38, 0.11), pantsMat);
    calfR.position.set(0, -0.18, -0.06);
    calfR.rotation.x = 0.95; // Cẳng chân xiên về sau
    calfR.castShadow = true;
    legRGroup.add(calfR);

    // Bàn chân phải: Đế giày áp phẳng vào mặt tường phía sau z = -0.18 (tương đương z tường -3.18)
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.20), shoeMat);
    footR.position.set(0, -0.28, -0.16);
    footR.rotation.x = Math.PI / 2; // Đế giày quay thẳng vào tường
    footR.castShadow = true;
    legRGroup.add(footR);

    alienGroup.add(legRGroup);
    alienGroup.add(bodyTiltGroup);

    // Bong bóng suy tư meme trên đầu
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 128;
    bubbleCanvas.height = 128;
    const bctx = bubbleCanvas.getContext('2d');
    bctx.font = '72px "Segoe UI Emoji", sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('💭', 64, 64);

    const bubbleTex = new THREE.CanvasTexture(bubbleCanvas);
    const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex });
    const bubbleSprite = new THREE.Sprite(bubbleMat);
    bubbleSprite.position.set(0.28, 2.05, 0.1);
    bubbleSprite.scale.set(0.65, 0.65, 0.65);
    alienGroup.add(bubbleSprite);

    this.scene.add(alienGroup);
  }

  // Kiếm cắm trong đá (Excalibur in Stone) bên trái ngoài phạm vi di chuyển (Yêu cầu 3.1)
  createExcaliburInStone(x = -11.5, z = 2.0) {
    const swordGroup = new THREE.Group();
    swordGroup.position.set(x, 0, z);

    // 1. Tảng đá cổ rêu phong (Ancient Rock)
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x475569, flatShading: true });
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x15803d, flatShading: true });

    // Khối đá chính
    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), rockMat);
    mainRock.scale.set(1.45, 1.05, 1.25);
    mainRock.position.y = 1.05;
    mainRock.rotation.set(0.2, 0.4, -0.1);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    swordGroup.add(mainRock);

    // Mảng rêu phong xanh trên sườn đá
    const moss1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), mossMat);
    moss1.scale.set(1.2, 0.6, 1.0);
    moss1.position.set(0.8, 0.7, 0.6);
    swordGroup.add(moss1);

    const moss2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mossMat);
    moss2.position.set(-0.7, 0.5, -0.5);
    swordGroup.add(moss2);

    // 2-3 tảng đá nhỏ vệ tinh xung quanh chân đế
    const subRock1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
    subRock1.position.set(-1.3, 0.35, 0.8);
    swordGroup.add(subRock1);

    const subRock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), rockMat);
    subRock2.position.set(1.2, 0.3, -0.9);
    swordGroup.add(subRock2);

    // 2. Vòng hào quang cổ ngữ ma thuật xoay nhẹ quanh chân kiếm
    const runeRingGeo = new THREE.RingGeometry(0.35, 0.55, 24);
    const runeRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    const runeRing = new THREE.Mesh(runeRingGeo, runeRingMat);
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.set(0, 2.06, 0);
    swordGroup.add(runeRing);
    this.excaliburRuneRing = runeRing;

    // 3. THANH KIẾM EXCALIBUR HUYỀN THOẠI
    const swordModel = new THREE.Group();
    swordModel.position.set(0, 2.05, 0);
    swordModel.rotation.set(0.08, 0.25, -0.06); // Nghiêng nhẹ dũng mãnh

    // Lưỡi kiếm bạc ánh kim bóng loáng
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.15
    });
    const bladeGeo = new THREE.BoxGeometry(0.11, 1.4, 0.022);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.55; // Cắm 1/3 lưỡi xuống dưới mặt đá
    blade.castShadow = true;
    swordModel.add(blade);

    // Mũi kiếm nhọn cắm vào đá
    const tipGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.rotation.y = Math.PI / 4;
    tip.position.y = -0.18;
    swordModel.add(tip);

    // Rãnh sống kiếm phát sáng ma thuật xanh cyan
    const runeCoreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const runeCore = new THREE.Mesh(new THREE.BoxGeometry(0.024, 1.25, 0.026), runeCoreMat);
    runeCore.position.y = 0.60;
    swordModel.add(runeCore);

    // Chuôi kiếm chắn ngang (Crossguard) bằng vàng kim chạm khắc
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.25
    });
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.065, 0.07), goldMat);
    crossguard.position.y = 1.28;
    crossguard.castShadow = true;
    swordModel.add(crossguard);

    // Cán cầm kiếm (Grip) bọc da đỏ hoàng gia
    const gripMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 8), gripMat);
    grip.position.y = 1.48;
    swordModel.add(grip);

    // Đốc kiếm (Pommel) vàng đính viên đá ngọc bích phát sáng
    const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 1), goldMat);
    pommel.position.y = 1.68;
    swordModel.add(pommel);

    const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    gem.position.y = 1.68;
    swordModel.add(gem);

    swordGroup.add(swordModel);
    this.scene.add(swordGroup);
  }

  // Tên lửa vũ trụ (Space Rocket) bên phải ngoài phạm vi di chuyển (Yêu cầu 3.1)
  createGardenRocket(x = 11.5, z = 2.0) {
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(x, 0, z);

    // Vật liệu
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.6 });

    // 1. Chân đế bệ phóng 3 càng kim loại cắm xuống cỏ
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), darkMat);
      leg.position.set(Math.cos(angle) * 1.1, 0.75, Math.sin(angle) * 1.1);
      leg.rotation.z = Math.cos(angle) * 0.35;
      leg.rotation.x = -Math.sin(angle) * 0.35;
      leg.castShadow = true;
      rocketGroup.add(leg);
    }

    // 2. Ống xả phản lực (Thruster Nozzle) ở đáy
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.42, 0.65, 16), darkMat);
    thruster.position.y = 0.85;
    rocketGroup.add(thruster);

    // 3. Thân tên lửa chính hình trụ trắng sứ (cao 4.6m)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.95, 4.6, 20), whiteMat);
    body.position.y = 3.45;
    body.castShadow = true;
    rocketGroup.add(body);

    // Vạch trang trí đỏ quanh thân
    const redStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.85, 0.38, 20), redMat);
    redStripe.position.y = 2.0;
    rocketGroup.add(redStripe);

    // 4. Vòng đai vàng kim nối thân và chóp
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.045, 8, 24), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5.75;
    rocketGroup.add(ring);

    // 5. Chóp nón tên lửa màu đỏ cờ tươi
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.9, 20), redMat);
    nose.position.y = 6.70;
    nose.castShadow = true;
    rocketGroup.add(nose);

    // Đầu kim thu sét trên đỉnh chóp
    const tipNeedle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.7, 8), goldMat);
    tipNeedle.position.y = 7.95;
    rocketGroup.add(tipNeedle);

    // 6. Cửa sổ tròn phi hành gia (Porthole)
    const windowRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20), goldMat);
    windowRing.position.set(0, 4.35, 0.86);
    rocketGroup.add(windowRing);

    const windowGlass = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 16), glassMat);
    windowGlass.scale.set(1.0, 1.0, 0.25);
    windowGlass.position.set(0, 4.35, 0.86);
    rocketGroup.add(windowGlass);

    // 7. Bốn cánh đuôi tam giác đỏ ổn định (Fins)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const finGroup = new THREE.Group();
      finGroup.rotation.y = angle;

      const finShape = new THREE.Shape();
      finShape.moveTo(0.88, 1.2);
      finShape.lineTo(1.85, 0.4);
      finShape.lineTo(1.85, 1.6);
      finShape.lineTo(0.88, 2.7);
      finShape.closePath();

      const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.015, bevelThickness: 0.015 };
      const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
      const fin = new THREE.Mesh(finGeo, redMat);
      fin.position.z = -0.03;
      fin.castShadow = true;
      finGroup.add(fin);

      rocketGroup.add(finGroup);
    }

    // 8. Logo / Chữ trang trí trên thân tên lửa
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 256;
    logoCanvas.height = 128;
    const lctx = logoCanvas.getContext('2d');
    lctx.fillStyle = '#dc2626';
    lctx.font = 'bold 36px "Segoe UI", sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText('HELL EXAM', 128, 48);
    lctx.fillStyle = '#eab308';
    lctx.font = 'bold 26px "Segoe UI", sans-serif';
    lctx.fillText('★ VN-01 ★', 128, 92);

    const logoTex = new THREE.CanvasTexture(logoCanvas);
    const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }));
    logoPlane.position.set(0, 3.2, 0.90);
    rocketGroup.add(logoPlane);

    this.scene.add(rocketGroup);
  }

  createBlackboardAndBanner() {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(0, 0, -3.2);

    // Tường vàng ấm
    const wallGeo = new THREE.BoxGeometry(10.5, 4.8, 0.4);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 2.4;
    wall.receiveShadow = true;
    wallGroup.add(wall);

    // Mái ngói đỏ
    const roofGeo = new THREE.BoxGeometry(11.0, 0.25, 0.9);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 4.85, 0.2);
    wallGroup.add(roof);

    // Băng rôn đỏ: "TIÊN HỌC LỄ • HẬU HỌC VĂN • TRƯỜNG THPT BÁ KHÍ"
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#991b1b';
    bctx.fillRect(0, 0, 1024, 128);

    bctx.strokeStyle = '#fde047';
    bctx.lineWidth = 6;
    bctx.strokeRect(8, 8, 1008, 112);

    bctx.fillStyle = '#fde047';
    bctx.font = 'bold 36px "Segoe UI", sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('TIÊN HỌC LỄ • HẬU HỌC VĂN • TRƯỜNG THPT BÁ KHÍ', 512, 64);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerGeo = new THREE.PlaneGeometry(7.2, 0.9);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 4.1, 0.22);
    wallGroup.add(banner);

    // Bảng đen Canvas động
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 1024;
    boardCanvas.height = 512;
    this.boardCanvas = boardCanvas;
    this.boardCtx = boardCanvas.getContext('2d');

    this.boardTexture = new THREE.CanvasTexture(boardCanvas);
    this.boardTexture.minFilter = THREE.LinearFilter;

    const frameGeo = new THREE.BoxGeometry(6.6, 2.8, 0.08);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x5c2b09 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 2.1, 0.22);
    wallGroup.add(frame);

    const boardGeo = new THREE.PlaneGeometry(6.4, 2.6);
    const boardMat = new THREE.MeshLambertMaterial({ map: this.boardTexture });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 2.1, 0.27);
    wallGroup.add(board);

    const trayGeo = new THREE.BoxGeometry(6.4, 0.06, 0.2);
    const trayMat = new THREE.MeshLambertMaterial({ color: 0x3d1a04 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.set(0, 0.78, 0.35);
    wallGroup.add(tray);

    const chalkGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6);
    const chalkWhite = new THREE.Mesh(chalkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    chalkWhite.rotation.z = Math.PI / 2;
    chalkWhite.position.set(-1.2, 0.83, 0.35);
    wallGroup.add(chalkWhite);

    const chalkRed = new THREE.Mesh(chalkGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    chalkRed.rotation.z = Math.PI / 2;
    chalkRed.position.set(-1.0, 0.83, 0.35);
    wallGroup.add(chalkRed);

    this.scene.add(wallGroup);

    this.updateBlackboard([], "SẴN SÀNG THI ĐẤU", "Nghiêm cấm quay cóp • Giữ trật tự phòng thi");
  }

  updateBlackboard(leaderboard = [], statusTitle = "KÌ THI ĐỊA NGỤC", subNote = "") {
    const ctx = this.boardCtx;
    const w = this.boardCanvas.width;
    const h = this.boardCanvas.height;

    // Nền bảng xanh rêu dịu mắt
    ctx.fillStyle = '#1e382b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${statusTitle.toUpperCase()} ★`, w / 2, 50);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 250, 65);
    ctx.lineTo(w / 2 + 250, 65);
    ctx.stroke();

    if (leaderboard && leaderboard.length > 0) {
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('BẢNG VÀNG THÀNH TÍCH (TOP ĐIỂM SỐ)', w / 2, 110);

      const topList = leaderboard.slice(0, 5);
      topList.forEach((player, idx) => {
        const y = 160 + idx * 55;
        let medal = `${idx + 1}.`;
        if (idx === 0) medal = '🥇 TOP 1';
        if (idx === 1) medal = '🥈 TOP 2';
        if (idx === 2) medal = '🥉 TOP 3';

        ctx.fillStyle = idx === 0 ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(80, y - 28, w - 160, 44);

        ctx.textAlign = 'left';
        ctx.font = 'bold 22px "Segoe UI", sans-serif';
        ctx.fillStyle = idx === 0 ? '#fde047' : '#ffffff';
        ctx.fillText(medal, 110, y);
        ctx.fillText(player.name, 260, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`${player.score} Điểm`, w - 110, y);
      });
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.font = '26px "Segoe UI", sans-serif';
      ctx.fillText(subNote || "Nghiêm cấm quay cóp • Giữ trật tự phòng thi", w / 2, 200);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '20px "Segoe UI", sans-serif';
      ctx.fillText("Quy chế: Nối từ không quá 7 giây • Vẽ tranh đẹp nhận tim", w / 2, 270);
      ctx.fillText("Ném cà chua -2đ • Bị loại khi hết giờ hoặc bí từ", w / 2, 320);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(w / 2 - 180, 370, 360, 70);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillText("CHÚC CÁC SĨ TỬ THI TỐT!", w / 2, 412);
    }

    this.boardTexture.needsUpdate = true;
  }

  initConfetti() {
    this.confettiGroup = new THREE.Group();
    this.scene.add(this.confettiGroup);
    this.confettiPool = [];

    const colors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0xec4899, 0xa855f7];
    const geo = new THREE.PlaneGeometry(0.12, 0.08);

    for (let i = 0; i < 180; i++) {
      const col = colors[i % colors.length];
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const piece = new THREE.Mesh(geo, mat);
      piece.visible = false;
      this.confettiGroup.add(piece);
      this.confettiPool.push({
        mesh: piece,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        active: false,
        life: 0
      });
    }
  }

  burstConfetti(origin = new THREE.Vector3(0, 3, 0)) {
    this.confettiPool.forEach(p => {
      p.mesh.position.copy(origin);
      p.mesh.position.x += (Math.random() - 0.5) * 2;
      p.mesh.position.z += (Math.random() - 0.5) * 2;
      p.mesh.visible = true;
      p.active = true;
      p.life = 3.5 + Math.random() * 2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 5;
      p.vel.set(
        Math.cos(angle) * (1 + Math.random() * 2),
        speed,
        Math.sin(angle) * (1 + Math.random() * 2)
      );

      p.rotVel.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
    });
  }

  throwProjectile(fromPos, toPos, type = 'pen') {
    const group = new THREE.Group();
    group.position.copy(fromPos);

    if (type === 'paper') {
      const paperMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const paperGeo = new THREE.ConeGeometry(0.12, 0.35, 3);
      const paper = new THREE.Mesh(paperGeo, paperMat);
      paper.rotation.x = Math.PI / 2;
      group.add(paper);
    } else {
      const penMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), penMat);
      group.add(pen);
    }

    this.scene.add(group);

    const projectile = {
      group: group,
      start: fromPos.clone(),
      end: toPos.clone(),
      type: type,
      progress: 0,
      duration: 0.75,
      peakHeight: 2.2 + Math.random() * 0.8
    };

    this.projectiles.push(projectile);
  }

  // YÊU CẦU 2.5: Hoạt ảnh vụ nổ 3D bùng nổ ngay tại vị trí nhân vật bị loại
  triggerExplosionAtPlayer(playerId) {
    const char = this.characters.get(playerId);
    let pos = new THREE.Vector3(0, 0.8, 0);
    if (char) {
      char.setKnockedOut(true);
      pos.copy(char.group.position);
      pos.y += 0.8;
    }

    // Rung camera chấn động nhẹ
    this.cameraShakeTime = 0.45;
    this.cameraShakeIntensity = 0.25;

    const explosionGroup = new THREE.Group();
    explosionGroup.position.copy(pos);
    this.scene.add(explosionGroup);

    // 1. Quả cầu lửa chớp sáng bung rộng (dùng shared geometry tối ưu bộ nhớ)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const flashMesh = new THREE.Mesh(this.sharedFlashGeo, flashMat);
    explosionGroup.add(flashMesh);

    // 2. Vòng sóng xung kích lan nhanh trên sàn (dùng shared geometry)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(this.sharedRingGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -pos.y + 0.04;
    explosionGroup.add(ringMesh);

    // 3. Mảnh vỡ nổ tung và tia lửa đỏ/vàng/khói (dùng shared geometry)
    const particleCount = 28;
    const particles = [];
    const colors = [0xff2200, 0xff7700, 0xffcc00, 0x333333, 0xffffff];

    for (let i = 0; i < particleCount; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const shardMat = new THREE.MeshBasicMaterial({ color: col });
      const shard = new THREE.Mesh(this.sharedShardGeo, shardMat);
      
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 4.5;
      const upSpeed = 2.5 + Math.random() * 4.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        upSpeed,
        Math.sin(angle) * speed
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
      explosionGroup.add(shard);
      particles.push({ mesh: shard, vel, rotVel });
    }

    this.explosions.push({
      group: explosionGroup,
      flashMesh,
      ringMesh,
      particles,
      elapsed: 0,
      duration: 1.2
    });
  }

  // YÊU CẦU 2.5: Phục hồi toàn bộ nhân vật đứng/ngồi dậy bình thường sau khi hết game/vòng
  resetAllKnockedOut() {
    for (const char of this.characters.values()) {
      if (char.isKnockedOut) {
        char.setKnockedOut(false);
      }
    }
  }

  syncPlayers(playerList) {
    const currentIds = new Set(playerList.map(p => p.id));

    for (const [id, char] of this.characters.entries()) {
      if (!currentIds.has(id)) {
        char.destroy();
        this.characters.delete(id);
      }
    }

    playerList.forEach(p => {
      let char = this.characters.get(p.id);
      const deskIdx = Math.floor((p.seatIndex || 0) / 2) % this.desks.length;
      const isRightSeat = (p.seatIndex || 0) % 2 === 1;
      const desk = this.desks[deskIdx];
      const offset = this.seatOffsets[isRightSeat ? 1 : 0];

      if (!char) {
        char = new StudentCharacter(p, desk.position, offset);
        this.scene.add(char.group);
        this.characters.set(p.id, char);
      } else {
        // Cập nhật lại nhân vật nếu đổi skin, màu da hoặc màu mắt/lông mày (Yêu cầu 2.0 & 2.9)
        const newModelId = p.characterModel || p.characterType || 'Casual_Male';
        const newSkinColor = p.skinColor || '#f2c190';
        const newFaceColor = p.faceColor || '#111111';
        if (newModelId !== char.modelId) {
          const wasSitting = char.isSitting;
          const curPos = char.group.position.clone();
          const curRot = char.group.rotation.y;
          char.destroy();
          char = new StudentCharacter(p, desk.position, offset);
          if (!wasSitting) {
            char.setSitting(false);
            char.group.position.copy(curPos);
            char.group.rotation.y = curRot;
          }
          this.scene.add(char.group);
          this.characters.set(p.id, char);
        } else {
          if (newSkinColor !== char.skinColor) {
            char.setSkinColor(newSkinColor);
          }
          if (newFaceColor !== char.faceColor) {
            char.setFaceColor(newFaceColor);
          }
        }
      }

      char.updateHUD(p.name, p.score);
      char.lastScore = p.score;
    });
  }

  setIsLobby(isLobby) {
    this.isLobby = !!isLobby;
    if (!this.isLobby) {
      this.nearbyAction = null;
      this.nearbySeat = null;
      if (this.onInteractionPromptChange) {
        this.onInteractionPromptChange(null);
      }
    }
  }

  disposeHierarchy(node) {
    if (!node) return;
    node.traverse(child => {
      if (child.isMesh) {
        if (child.geometry && child.geometry !== this.sharedFlashGeo && child.geometry !== this.sharedRingGeo && child.geometry !== this.sharedShardGeo) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m && m.dispose && m.dispose());
          } else if (child.material.dispose) {
            child.material.dispose();
          }
        }
      }
    });
  }

  setMyPlayerId(id) {
    this.myPlayerId = id;
  }

  setMoveInput(x, z) {
    this.moveInput.x = x;
    this.moveInput.z = z;
  }

  updateMyPlayerMovement(delta) {
    if (!this.myPlayerId) return;
    const myChar = this.characters.get(this.myPlayerId);
    if (!myChar) return;

    // Không cho phép di chuyển khi không ở sảnh chờ LOBBY (ví dụ khi đang thi mini-game)
    if (!this.isLobby) {
      if (myChar.isMoving) myChar.isMoving = false;
      return;
    }

    const mx = this.moveInput.x;
    const mz = this.moveInput.z;
    const isMoving = (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05);

    if (isMoving) {
      if (myChar.isSitting) {
        myChar.setSitting(false);
        this.cameraMode = 'STAND_FOLLOW';
        this.standingCameraIndex = 0;
        if (this.onSeatInteracted) this.onSeatInteracted(false, null);
      } else if (this.cameraMode === 'BLACKBOARD') {
        // Tự động chuyển về góc nhìn theo sau nhân vật khi đang đứng và bắt đầu di chuyển
        this.cameraMode = 'STAND_FOLLOW';
        this.standingCameraIndex = 0;
      }

      myChar.isMoving = true;
      const speed = 3.6; // m/s
      const nextX = Math.max(-7.2, Math.min(7.2, myChar.group.position.x + mx * speed * delta));
      const nextZ = Math.max(-2.5, Math.min(7.8, myChar.group.position.z + mz * speed * delta));

      myChar.group.position.x = nextX;
      myChar.group.position.z = nextZ;
      myChar.group.position.y = 0.02;

      // Xoay nhân vật theo hướng di chuyển
      const targetRot = Math.atan2(mx, mz);
      let diff = targetRot - myChar.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      myChar.group.rotation.y += diff * Math.min(1.0, 14 * delta);

      // Throttled emit move socket (45ms ~ 22 lần/giây, tối ưu mạng và triệt tiêu giật lag)
      const now = Date.now();
      if (now - this.lastMoveEmitTime > 45 && this.onMyMoveCallback) {
        this.lastMoveEmitTime = now;
        this.onMyMoveCallback({
          x: Number(nextX.toFixed(2)),
          z: Number(nextZ.toFixed(2)),
          vx: Number((mx * speed).toFixed(2)),
          vz: Number((mz * speed).toFixed(2)),
          rot: Number(myChar.group.rotation.y.toFixed(2)),
          isMoving: true,
          isSitting: false,
          seatIndex: myChar.sittingSeatIndex
        });
      }
    } else {
      if (myChar.isMoving) {
        myChar.isMoving = false;
        if (this.onMyMoveCallback) {
          this.onMyMoveCallback({
            x: Number(myChar.group.position.x.toFixed(2)),
            z: Number(myChar.group.position.z.toFixed(2)),
            vx: 0,
            vz: 0,
            rot: Number(myChar.group.rotation.y.toFixed(2)),
            isMoving: false,
            isSitting: myChar.isSitting,
            seatIndex: myChar.sittingSeatIndex
          });
        }
      }
    }

    // Kiểm tra tương tác bàn ghế
    this.checkSeatInteraction(myChar);
  }

  checkSeatInteraction(myChar) {
    if (myChar.isSitting) {
      if (this.nearbyAction !== 'stand') {
        this.nearbyAction = 'stand';
        if (this.onInteractionPromptChange) {
          this.onInteractionPromptChange({ type: 'stand', text: 'Đứng dậy (E)' });
        }
      }
      return;
    }

    // Đang đứng: Tìm ghế gần nhất trong tầm 1.8m (thoải mái, nhạy trên mobile)
    let closestSeat = null;
    let minDist = 1.8;

    for (const seat of this.seatSpots) {
      const dx = myChar.group.position.x - seat.pos.x;
      const dz = myChar.group.position.z - seat.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closestSeat = seat;
      }
    }

    if (closestSeat) {
      this.nearbySeat = closestSeat;
      if (this.nearbyAction !== 'sit_' + closestSeat.seatIndex) {
        this.nearbyAction = 'sit_' + closestSeat.seatIndex;
        if (this.onInteractionPromptChange) {
          this.onInteractionPromptChange({ type: 'sit', seat: closestSeat, text: 'Ngồi vào ghế (E)' });
        }
      }
    } else {
      this.nearbySeat = null;
      if (this.nearbyAction !== null) {
        this.nearbyAction = null;
        if (this.onInteractionPromptChange) {
          this.onInteractionPromptChange(null);
        }
      }
    }
  }

  interactMyPlayer() {
    if (!this.myPlayerId) return;
    const myChar = this.characters.get(this.myPlayerId);
    if (!myChar) return;

    if (myChar.isSitting) {
      // Đang ngồi -> Đứng dậy
      myChar.setSitting(false);
      this.cameraMode = 'STAND_FOLLOW';
      this.standingCameraIndex = 0;
       if (this.onSeatInteracted) this.onSeatInteracted(false, myChar.sittingSeatIndex);
      if (this.onMyMoveCallback) {
        this.onMyMoveCallback({
          x: Number(myChar.group.position.x.toFixed(2)),
          z: Number(myChar.group.position.z.toFixed(2)),
          vx: 0,
          vz: 0,
          rot: Number(myChar.group.rotation.y.toFixed(2)),
          isMoving: false,
          isSitting: false,
          seatIndex: myChar.sittingSeatIndex
        });
      }
    } else if (this.nearbySeat) {
      // Đang đứng gần ghế -> Ngồi xuống
      const seat = this.nearbySeat;
      myChar.setSitting(true, seat.pos, seat.seatIndex);
      this.cameraMode = 'PRESET';
      this.currentPresetIndex = 2; // Bàn của tôi
      if (this.onSeatInteracted) this.onSeatInteracted(true, seat.seatIndex);
      if (this.onMyMoveCallback) {
        this.onMyMoveCallback({
          x: Number(seat.pos.x.toFixed(2)),
          z: Number(seat.pos.z.toFixed(2)),
          vx: 0,
          vz: 0,
          rot: Math.PI,
          isMoving: false,
          isSitting: true,
          seatIndex: seat.seatIndex
        });
      }
    }
  }

  handleRemotePlayerMove(data) {
    if (data.playerId === this.myPlayerId) return;
    const char = this.characters.get(data.playerId);
    if (!char) return;

    // Ghi nhận thời điểm nhận gói tin để kiểm soát timeout
    char.lastMovePacketTime = Date.now();
    char.targetX = data.x;
    char.targetZ = data.z;
    char.targetRot = data.rot;
    char.isMoving = !!data.isMoving;

    // Vận tốc để dự đoán chuyển động (Dead Reckoning - Yêu cầu 2.8)
    if (data.vx !== undefined && data.vz !== undefined) {
      char.vx = data.vx;
      char.vz = data.vz;
    } else if (char.isMoving && char.targetRot !== undefined) {
      char.vx = Math.sin(char.targetRot) * 3.6;
      char.vz = Math.cos(char.targetRot) * 3.6;
    } else {
      char.vx = 0;
      char.vz = 0;
    }

    if (data.isSitting !== undefined && data.isSitting !== char.isSitting) {
      if (data.isSitting) {
        const seat = this.seatSpots[data.seatIndex || 0];
        char.setSitting(true, seat ? seat.pos : null, data.seatIndex);
      } else {
        char.setSitting(false);
      }
    }
  }

  handleRemotePlayerSeated(data) {
    if (data.playerId === this.myPlayerId) return;
    const char = this.characters.get(data.playerId);
    if (!char) return;
    if (data.isSitting) {
      const seat = this.seatSpots[data.seatIndex || 0];
      char.setSitting(true, seat ? seat.pos : null, data.seatIndex);
    } else {
      char.setSitting(false);
    }
  }

  getCharacterWorldPosition(playerId) {
    const char = this.characters.get(playerId);
    if (char) {
      const v = new THREE.Vector3();
      char.group.getWorldPosition(v);
      v.y += 0.8;
      return v;
    }
    return new THREE.Vector3(0, 1, 0);
  }

  setCameraMode(mode, targetPlayerId = null) {
    this.cameraMode = mode;
    this.lastUserDragTime = 0; // Đặt lại để áp dụng góc nhìn theo kịch bản game
    if (mode === 'BLACKBOARD') {
      this.camTargetPos.set(0, 2.5, 1.8);
      this.camTargetLookAt.set(0, 2.2, -3.2);
    } else if (mode === 'STUDENT' && targetPlayerId) {
      const pos = this.getCharacterWorldPosition(targetPlayerId);
      this.camTargetPos.set(pos.x + 0.8, pos.y + 1.2, pos.z + 2.2);
      this.camTargetLookAt.copy(pos);
    } else {
      // OVERVIEW / LOBBY Follow mode
      if (this.myPlayerId && this.characters.has(this.myPlayerId)) {
        const char = this.characters.get(this.myPlayerId);
        if (char && !char.isSitting) {
          this.cameraMode = 'STAND_FOLLOW';
          this.standingCameraIndex = 0;
          const cp = char.group.position;
          this.camTargetPos.set(cp.x, cp.y + 2.5, cp.z + 3.8);
          this.camTargetLookAt.set(cp.x, cp.y + 0.8, cp.z);
        } else {
          this.cameraMode = 'PRESET';
          this.currentPresetIndex = 0;
          this.camTargetPos.set(0, 5.2, 9.8);
          this.camTargetLookAt.set(0, 1.2, -1.0);
        }
      } else {
        this.camTargetPos.set(0, 5.2, 9.8);
        this.camTargetLookAt.set(0, 1.2, -1.0);
      }
    }
  }

  // NÚT ĐỔI GÓC NHÌN (CAMERA PRESETS CYCLING - YÊU CẦU 2.6)
  cycleCameraView(myPlayerId = null) {
    this.lastUserDragTime = 0;
    const targetId = this.myPlayerId || myPlayerId;
    const myChar = targetId ? this.characters.get(targetId) : null;

    // YÊU CẦU 2.6: Khi đứng dậy, chỉ có 2 góc nhìn: Bảng đen và Vị trí hiện tại
    if (myChar && !myChar.isSitting) {
      if (this.standingCameraIndex === undefined) {
        this.standingCameraIndex = 0;
      }
      this.standingCameraIndex = (this.standingCameraIndex + 1) % 2;

      if (this.standingCameraIndex === 1) {
        this.cameraMode = 'BLACKBOARD';
        this.camTargetPos.set(0, 2.5, 1.8);
        this.camTargetLookAt.set(0, 2.2, -3.2);
        return 'Cận Cảnh Bảng Đen';
      } else {
        this.cameraMode = 'STAND_FOLLOW';
        const cp = myChar.group.position;
        this.camTargetPos.set(cp.x, cp.y + 2.5, cp.z + 3.8);
        this.camTargetLookAt.set(cp.x, cp.y + 0.8, cp.z);
        return 'Vị Trí Hiện Tại';
      }
    }

    // Khi ngồi ghế: chuyển qua 4 góc nhìn chuẩn phòng thi
    this.cameraMode = 'PRESET';
    this.currentPresetIndex = ((this.currentPresetIndex || 0) + 1) % 4;

    let viewName = 'Toàn Cảnh Lớp Học';
    switch (this.currentPresetIndex) {
      case 0: // Toàn cảnh
        this.camTargetPos.set(0, 5.2, 9.8);
        this.camTargetLookAt.set(0, 1.2, -1.0);
        viewName = 'Toàn Cảnh Lớp Học';
        break;
      case 1: // Bảng đen
        this.camTargetPos.set(0, 2.5, 1.8);
        this.camTargetLookAt.set(0, 2.2, -3.2);
        viewName = 'Cận Cảnh Bảng Đen';
        break;
      case 2: // Bàn của tôi
        if (targetId) {
          const pos = this.getCharacterWorldPosition(targetId);
          this.camTargetPos.set(pos.x, pos.y + 0.9, pos.z + 1.8);
          this.camTargetLookAt.set(pos.x, pos.y, -3.2);
        } else {
          this.camTargetPos.set(0, 3.2, 5.0);
          this.camTargetLookAt.set(0, 1.2, -3.2);
        }
        viewName = 'Bàn Học Của Tôi';
        break;
      case 3: // Góc nghiêng lớp học
        this.camTargetPos.set(6.8, 4.0, 4.2);
        this.camTargetLookAt.set(0, 1.5, 0.0);
        viewName = 'Góc Nghiêng Lớp Học';
        break;
    }
    return viewName;
  }

  onWindowResize() {
    this.width = window.innerWidth || document.documentElement.clientWidth || this.container.clientWidth;
    this.height = window.innerHeight || document.documentElement.clientHeight || this.container.clientHeight;
    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    // 1. Mây trôi
    this.clouds.forEach(cloud => {
      cloud.position.x += cloud.speed * delta;
      if (cloud.position.x > 30) {
        cloud.position.x = -30;
      }
    });

    // 1.5. Hoạt ảnh chim nhỏ trên tường quay đầu tò mò (Yêu cầu 3.1)
    if (this.wallBirds && this.wallBirds.length > 0) {
      const time = this.clock.getElapsedTime();
      this.wallBirds.forEach((b, i) => {
        if (b.head) {
          b.head.rotation.y = Math.sin(time * 2.2 + i * 2.1) * 0.45;
        }
      });
    }

    // Hoạt ảnh vòng hào quang ma thuật thanh kiếm Excalibur xoay nhẹ (Yêu cầu 3.1)
    if (this.excaliburRuneRing) {
      this.excaliburRuneRing.rotation.z += 0.5 * delta;
    }

    // 2. Di chuyển nhân vật của chính mình (Yêu cầu 1.7)
    this.updateMyPlayerMovement(delta);

    // 3. Nhân vật & Nội suy Lerp + Dead Reckoning cho người chơi từ xa (Yêu cầu 2.8: Triệt tiêu khựng lag)
    for (const [id, char] of this.characters.entries()) {
      if (id !== this.myPlayerId && !char.isSitting) {
        // Hết hạn packet nếu quá 450ms không có dữ liệu mới -> Tự động dừng bước
        if (char.isMoving && Date.now() - (char.lastMovePacketTime || 0) > 450) {
          char.isMoving = false;
          char.vx = 0;
          char.vz = 0;
        }

        // Dead Reckoning: Tự động tiếp tục đẩy vị trí mục tiêu theo vận tốc trong lúc chờ packet tiếp theo
        // Điều này đảm bảo tốc độ di chuyển đều đặn liên tục, loại bỏ hoàn toàn độ trễ và khựng giật theo nhịp
        if (char.isMoving && (char.vx || char.vz)) {
          char.targetX = (char.targetX !== undefined ? char.targetX : char.group.position.x) + char.vx * delta;
          char.targetZ = (char.targetZ !== undefined ? char.targetZ : char.group.position.z) + char.vz * delta;

          // Giới hạn trong phạm vi phòng học
          char.targetX = Math.max(-7.2, Math.min(7.2, char.targetX));
          char.targetZ = Math.max(-2.5, Math.min(7.8, char.targetZ));
        }

        if (char.targetX !== undefined) {
          const dx = char.targetX - char.group.position.x;
          const dz = char.targetZ - char.group.position.z;
          const distSq = dx * dx + dz * dz;

          if (distSq > 9.0) {
            // Lệch quá xa (>3m do lag mạng), snap ngay lập tức
            char.group.position.x = char.targetX;
            char.group.position.z = char.targetZ;
          } else {
            // Nội suy siêu mượt với hệ số lerp 18 * delta bám sát vị trí liên tục
            const lerpFactor = Math.min(1.0, 18 * delta);
            char.group.position.x += dx * lerpFactor;
            char.group.position.z += dz * lerpFactor;
          }
          char.group.position.y = 0.02;

          if (char.targetRot !== undefined) {
            let diff = char.targetRot - char.group.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            char.group.rotation.y += diff * Math.min(1.0, 16 * delta);
          }
        }
      }
      char.update(delta);
    }

    // 4. Ném bút / phao
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta / p.duration;

      if (p.progress >= 1.0) {
        this.disposeHierarchy(p.group);
        this.scene.remove(p.group);
        this.projectiles.splice(i, 1);
        if (window.audioMgr) window.audioMgr.playDeskTap();
      } else {
        const t = p.progress;
        p.group.position.lerpVectors(p.start, p.end, t);
        p.group.position.y += Math.sin(t * Math.PI) * p.peakHeight;
        p.group.rotation.x += 10 * delta;
        p.group.rotation.y += 12 * delta;
      }
    }

    // 5. Pháo hoa giấy
    this.confettiPool.forEach(p => {
      if (p.active) {
        p.life -= delta;
        if (p.life <= 0 || p.mesh.position.y <= 0) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vel.y -= 7.5 * delta;
          p.vel.x *= 0.985;
          p.vel.z *= 0.985;
          p.mesh.position.addScaledVector(p.vel, delta);
          p.mesh.rotation.x += p.rotVel.x * delta;
          p.mesh.rotation.y += p.rotVel.y * delta;
          p.mesh.rotation.z += p.rotVel.z * delta;
        }
      }
    });

    // 5B. Cập nhật các vụ nổ (Yêu cầu 2.5)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.elapsed += delta;
      const t = exp.elapsed / exp.duration;

      if (t >= 1.0) {
        this.disposeHierarchy(exp.group);
        this.scene.remove(exp.group);
        this.explosions.splice(i, 1);
      } else {
        const flashScale = 1.0 + t * 6.5;
        exp.flashMesh.scale.set(flashScale, flashScale, flashScale);
        exp.flashMesh.material.opacity = Math.max(0, 1.0 - t * 2.2);

        const ringScale = 1.0 + t * 11.0;
        exp.ringMesh.scale.set(ringScale, ringScale, 1.0);
        exp.ringMesh.material.opacity = Math.max(0, 0.9 * (1.0 - t));

        exp.particles.forEach(p => {
          p.vel.y -= 9.8 * delta;
          p.vel.x *= 0.96;
          p.vel.z *= 0.96;
          p.mesh.position.addScaledVector(p.vel, delta);
          p.mesh.rotation.x += p.rotVel.x * delta;
          p.mesh.rotation.y += p.rotVel.y * delta;
          p.mesh.rotation.z += p.rotVel.z * delta;
          if (p.mesh.position.y < -exp.group.position.y + 0.04) {
            p.mesh.position.y = -exp.group.position.y + 0.04;
            p.vel.y = -p.vel.y * 0.25;
          }
        });
      }
    }

    // 6. CẬP NHẬT CAMERA: Follow camera hoặc xoay tự do theo chuột/chạm
    if (Date.now() - this.lastUserDragTime < 4000) {
      const x = this.camCurrentLookAt.x + this.cameraDistance * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
      const y = this.camCurrentLookAt.y + this.cameraDistance * Math.cos(this.polarAngle);
      const z = this.camCurrentLookAt.z + this.cameraDistance * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);
      this.camTargetPos.set(x, Math.max(1.2, y), z);
    } else if (this.cameraMode === 'STAND_FOLLOW' || (this.cameraMode === 'OVERVIEW' && this.myPlayerId && this.characters.has(this.myPlayerId))) {
      // Yêu cầu 1.7 & 2.6: Camera đi theo cố định sau lưng nhân vật khi đang đứng/di chuyển ở vị trí hiện tại
      const myChar = this.characters.get(this.myPlayerId);
      if (myChar && !myChar.isSitting) {
        const cp = myChar.group.position;
        this.camTargetPos.set(cp.x, cp.y + 2.5, cp.z + 3.8);
        this.camTargetLookAt.set(cp.x, cp.y + 0.8, cp.z);
      }
    }

    // Camera di chuyển êm mượt (Lerp)
    this.camera.position.lerp(this.camTargetPos, 0.08);
    this.camCurrentLookAt.lerp(this.camTargetLookAt, 0.08);
    this.camera.lookAt(this.camCurrentLookAt);

    // Chấn động camera khi nổ (Yêu cầu 2.5)
    if (this.cameraShakeTime > 0) {
      this.cameraShakeTime -= delta;
      const shakeAmt = this.cameraShakeIntensity * (this.cameraShakeTime / 0.45);
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.SchoolScene3D = SchoolScene3D;
