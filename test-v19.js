const http = require('http');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

async function runTests() {
  console.log('--- BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG BẢN 1.9 (52 SKINS QUATERNIUS 3D) ---');

  // 1. Kiểm tra 52 skins trong danh sách và file vật lý
  console.log('\n[1/5] Kiểm tra tệp mô hình 3D trong public/models/characters/...');
  const charactersJs = fs.readFileSync(path.join(__dirname, 'public/js/characters.js'), 'utf-8');
  const match = charactersJs.match(/const CHARACTER_SKINS = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Không tìm thấy mảng CHARACTER_SKINS trong characters.js');
  }
  const skins = eval(match[1]);
  console.log(`✓ Đã định nghĩa ${skins.length} skins trong CHARACTER_SKINS metadata.`);

  let missingFiles = 0;
  for (const s of skins) {
    const filePath = path.join(__dirname, 'public/models/characters', s.file);
    if (!fs.existsSync(filePath)) {
      console.error(`✗ Thiếu file: ${s.file}`);
      missingFiles++;
    }
  }
  if (missingFiles > 0) {
    throw new Error(`Có ${missingFiles} file GLTF bị thiếu!`);
  }
  console.log(`✓ Toàn bộ ${skins.length} file .gltf đều tồn tại đầy đủ trong thư mục.`);

  // 2. Kiểm tra thư viện Three.js, GLTFLoader, SkeletonUtils
  console.log('\n[2/5] Kiểm tra thư viện Three.js cục bộ...');
  const threeFiles = ['three.min.js', 'GLTFLoader.js', 'SkeletonUtils.js'];
  for (const tf of threeFiles) {
    const p = path.join(__dirname, 'public/js', tf);
    if (!fs.existsSync(p)) {
      throw new Error(`Thiếu thư viện public/js/${tf}`);
    }
    const stat = fs.statSync(p);
    console.log(`✓ public/js/${tf} tồn tại (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  // 3. Khởi động server nội bộ để test Socket.io và HTTP
  console.log('\n[3/5] Khởi động kiểm thử máy chủ HTTP và Socket.io...');
  const app = require('./server'); // server exports server or app
  // server.js starts server on port 3000 directly.
  // We'll test against http://localhost:3000

  // Đợi 1 giây để server sẵn sàng
  await new Promise(r => setTimeout(r, 1000));

  // Kiểm tra HTTP requests
  const checkHttp = (urlPath) => new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      if (res.statusCode === 200) {
        resolve(res.statusCode);
      } else {
        reject(new Error(`HTTP ${urlPath} returned ${res.statusCode}`));
      }
    }).on('error', reject);
  });

  console.log('✓ HTTP /: ' + await checkHttp('/'));
  console.log('✓ HTTP /js/three.min.js: ' + await checkHttp('/js/three.min.js'));
  console.log('✓ HTTP /js/GLTFLoader.js: ' + await checkHttp('/js/GLTFLoader.js'));
  console.log('✓ HTTP /js/SkeletonUtils.js: ' + await checkHttp('/js/SkeletonUtils.js'));
  console.log('✓ HTTP /models/characters/Casual_Male.gltf: ' + await checkHttp('/models/characters/Casual_Male.gltf'));
  console.log('✓ HTTP /models/characters/Ninja_Male.gltf: ' + await checkHttp('/models/characters/Ninja_Male.gltf'));
  console.log('✓ HTTP /models/characters/Cow.gltf: ' + await checkHttp('/models/characters/Cow.gltf'));

  // 4. Kiểm tra Socket.io Tạo phòng & Chọn Skin
  console.log('\n[4/5] Kiểm tra Socket.io tạo phòng và đồng bộ Skin 3D...');
  const client1 = io('http://localhost:3000', { reconnection: false });
  const client2 = io('http://localhost:3000', { reconnection: false });

  await new Promise(r => client1.on('connect', r));
  await new Promise(r => client2.on('connect', r));
  console.log('✓ Cả 2 client Socket.io đã kết nối thành công.');

  let roomCode = '';
  // Client 1 tạo phòng với Ninja_Male
  await new Promise((resolve, reject) => {
    client1.emit('create_room', {
      playerName: 'Ninja Master',
      characterModel: 'Ninja_Male',
      characterType: 'Ninja_Male'
    }, (res) => {
      if (res.success) {
        roomCode = res.roomCode;
        console.log(`✓ Client 1 tạo phòng thành công: ${roomCode} với skin Ninja_Male`);
        resolve();
      } else {
        reject(new Error(res.message));
      }
    });
  });

  // Client 2 vào phòng với Doctor_Female_Young
  await new Promise((resolve, reject) => {
    client2.emit('join_room', {
      roomCode: roomCode,
      playerName: 'Bác Sĩ Hoa Súng',
      characterModel: 'Doctor_Female_Young',
      characterType: 'Doctor_Female_Young'
    }, (res) => {
      if (res.success) {
        console.log(`✓ Client 2 vào phòng thành công với skin Doctor_Female_Young`);
        resolve();
      } else {
        reject(new Error(res.message));
      }
    });
  });

  // 5. Kiểm tra đổi skin realtime qua update_customization
  console.log('\n[5/5] Kiểm tra đổi skin realtime trong phòng...');
  const skinUpdatePromise = new Promise((resolve) => {
    client2.on('room_update', (roomState) => {
      const p1 = roomState.players.find(p => p.name === 'Ninja Master');
      if (p1 && p1.characterModel === 'Knight_Golden_Male') {
        console.log('✓ Client 2 nhận được cập nhật skin mới của Client 1: Knight_Golden_Male');
        resolve();
      }
    });
  });

  client1.emit('update_customization', {
    characterModel: 'Knight_Golden_Male',
    characterType: 'Knight_Golden_Male'
  });

  await skinUpdatePromise;

  client1.disconnect();
  client2.disconnect();

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ 5 HẠNG MỤC KIỂM THỬ BẢN 1.9 ĐỀU ĐẠT 100%! 🎉');
  console.log('======================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
