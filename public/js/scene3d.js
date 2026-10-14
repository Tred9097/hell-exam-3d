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

    return group;
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

    // 1. Quả cầu lửa chớp sáng bung rộng
    const flashGeo = new THREE.SphereGeometry(0.35, 14, 14);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    explosionGroup.add(flashMesh);

    // 2. Vòng sóng xung kích lan nhanh trên sàn
    const ringGeo = new THREE.RingGeometry(0.1, 0.35, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -pos.y + 0.04;
    explosionGroup.add(ringMesh);

    // 3. Mảnh vỡ nổ tung và tia lửa đỏ/vàng/khói
    const particleCount = 28;
    const particles = [];
    const shardGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const colors = [0xff2200, 0xff7700, 0xffcc00, 0x333333, 0xffffff];

    for (let i = 0; i < particleCount; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const shardMat = new THREE.MeshBasicMaterial({ color: col });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      
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
        // Cập nhật lại nhân vật nếu đổi skin hoặc màu da (Yêu cầu 2.0)
        const newModelId = p.characterModel || p.characterType || 'Casual_Male';
        const newSkinColor = p.skinColor || '#f2c190';
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
        } else if (newSkinColor !== char.skinColor) {
          char.setSkinColor(newSkinColor);
        }
      }

      char.updateHUD(p.name, p.score);
      char.lastScore = p.score;
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

    // Chỉ cho phép di chuyển ở sảnh chờ LOBBY (cameraMode === 'OVERVIEW')
    if (this.cameraMode !== 'OVERVIEW') return;

    const mx = this.moveInput.x;
    const mz = this.moveInput.z;
    const isMoving = (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05);

    if (isMoving) {
      if (myChar.isSitting) {
        myChar.setSitting(false);
        if (this.onSeatInteracted) this.onSeatInteracted(false, null);
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

      // Throttled emit move socket (85ms ~ 11 lần/giây, tối ưu mạng)
      const now = Date.now();
      if (now - this.lastMoveEmitTime > 85 && this.onMyMoveCallback) {
        this.lastMoveEmitTime = now;
        this.onMyMoveCallback({
          x: Number(nextX.toFixed(2)),
          z: Number(nextZ.toFixed(2)),
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

    // Đang đứng: Tìm ghế gần nhất trong tầm 1.25m
    let closestSeat = null;
    let minDist = 1.25;

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
      if (this.onSeatInteracted) this.onSeatInteracted(false, myChar.sittingSeatIndex);
      if (this.onMyMoveCallback) {
        this.onMyMoveCallback({
          x: Number(myChar.group.position.x.toFixed(2)),
          z: Number(myChar.group.position.z.toFixed(2)),
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
      if (this.onSeatInteracted) this.onSeatInteracted(true, seat.seatIndex);
      if (this.onMyMoveCallback) {
        this.onMyMoveCallback({
          x: Number(seat.pos.x.toFixed(2)),
          z: Number(seat.pos.z.toFixed(2)),
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

    // Lưu tọa độ đích để nội suy Lerp mượt mà (chống giật lag khi mạng ping cao)
    char.targetX = data.x;
    char.targetZ = data.z;
    char.targetRot = data.rot;
    char.isMoving = !!data.isMoving;

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
        const p = char.group.position;
        this.camTargetPos.set(p.x, p.y + 2.5, p.z + 3.8);
        this.camTargetLookAt.set(p.x, p.y + 0.8, p.z);
      } else {
        this.camTargetPos.set(0, 5.2, 9.8);
        this.camTargetLookAt.set(0, 1.2, -1.0);
      }
    }
  }

  // NÚT ĐỔI GÓC NHÌN (CAMERA PRESETS CYCLING)
  cycleCameraView(myPlayerId = null) {
    this.lastUserDragTime = 0;
    this.currentPresetIndex = (this.currentPresetIndex + 1) % 4;

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
        if (myPlayerId) {
          const pos = this.getCharacterWorldPosition(myPlayerId);
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

    // 2. Di chuyển nhân vật của chính mình (Yêu cầu 1.7)
    this.updateMyPlayerMovement(delta);

    // 3. Nhân vật & Nội suy Lerp cho người chơi từ xa
    for (const [id, char] of this.characters.entries()) {
      if (id !== this.myPlayerId && !char.isSitting && char.targetX !== undefined) {
        char.group.position.x += (char.targetX - char.group.position.x) * Math.min(1.0, 14 * delta);
        char.group.position.z += (char.targetZ - char.group.position.z) * Math.min(1.0, 14 * delta);
        char.group.position.y = 0.02;
        if (char.targetRot !== undefined) {
          let diff = char.targetRot - char.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          char.group.rotation.y += diff * Math.min(1.0, 14 * delta);
        }
      }
      char.update(delta);
    }

    // 4. Ném bút / phao
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta / p.duration;

      if (p.progress >= 1.0) {
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
    } else if (this.cameraMode === 'OVERVIEW' && this.myPlayerId && this.characters.has(this.myPlayerId)) {
      // Yêu cầu 1.7: Camera đi theo cố định sau lưng nhân vật khi di chuyển ở sảnh chờ
      const myChar = this.characters.get(this.myPlayerId);
      const cp = myChar.group.position;
      this.camTargetPos.set(cp.x, cp.y + 2.5, cp.z + 3.8);
      this.camTargetLookAt.set(cp.x, cp.y + 0.8, cp.z);
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
