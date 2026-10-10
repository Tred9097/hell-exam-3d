const io = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ CẬP NHẬT PHIÊN BẢN 1.8...\n');

  // =========================================================================
  // TEST 1: KIỂM TRA SUBTITLE MENU CHÍNH "Web Party Game" (YÊU CẦU 5)
  // =========================================================================
  console.log('--- TEST 1: KIỂM TRA SUBTITLE MENU CHÍNH ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  assert(indexHtml.includes('Web Party Game'), 'Phải có text "Web Party Game"');
  assert(!indexHtml.includes('Web 3D Party Game Học Đường Hài Hước Việt Nam'), 'Không được còn text cũ');
  console.log('✅ Đã đổi thành công tiêu đề phụ menu chính thành: "Web Party Game"\n');

  // =========================================================================
  // TEST 2: KIỂM TRA ĐỊA CHỈ PC MÁY CHỦ THỰC TẾ & /api/info (YÊU CẦU 4)
  // =========================================================================
  console.log('--- TEST 2: KIỂM TRA ĐỊA CHỈ PC MÁY CHỦ THỰC TẾ ---');
  const infoData = await new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/info', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log('Thông tin nhận từ /api/info:', infoData);
  assert(infoData.pcHost, 'Phải có tên máy chủ PC');
  assert(infoData.lanIp, 'Phải có IP mạng LAN');
  assert(infoData.url.startsWith('http://'), 'Phải có đường dẫn link hợp lệ');
  console.log(`✅ Server đọc chính xác PC máy chủ: "${infoData.pcHost}" | IP LAN: ${infoData.lanIp} | Link: ${infoData.url}\n`);

  // =========================================================================
  // TEST 3: KẾT NỐI SOCKET & TEST EVENT server_network_info (YÊU CẦU 4)
  // =========================================================================
  console.log('--- TEST 3: KIỂM TRA SOCKET server_network_info & ẨN HIỆN ĐIỀU KHIỂN (YÊU CẦU 1) ---');
  const p1 = io(SERVER_URL);
  const p2 = io(SERVER_URL);

  const netInfoPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for server_network_info')), 5000);
    p1.on('server_network_info', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const netInfo = await netInfoPromise;
  assert.strictEqual(netInfo.pcHost, infoData.pcHost);
  assert.strictEqual(netInfo.lanIp, infoData.lanIp);
  console.log('✅ Client nhận thành công sự kiện socket "server_network_info":', netInfo);

  // Kiểm tra HTML có nút sao chép và các id phần tử
  assert(indexHtml.includes('id="btn-copy-lan-url"'), 'HTML phải có nút sao chép link');
  assert(indexHtml.includes('id="server-pc-name-badge"'), 'HTML phải có badge tên PC');
  assert(indexHtml.includes('id="virtual-joystick-container" class="hidden'), 'Joystick phải ẩn mặc định');
  console.log('✅ Cấu trúc giao diện LAN banner và Joystick ẩn mặc định hợp lệ!\n');

  // =========================================================================
  // TEST 4: TẠO PHÒNG & TEST ĐẾM NGƯỢC 2S KHI TẤT CẢ ĐÃ CHỌN (YÊU CẦU 2)
  // =========================================================================
  console.log('--- TEST 4: KIỂM TRA ĐẾM NGƯỢC 2 GIÂY KHI TẤT CẢ ĐÃ CHỌN BÀI THI ---');
  const p1Id = p1.id;
  const res1 = await new Promise(resolve => {
    p1.emit('create_room', { playerName: 'Chủ Phòng PC', characterType: 'nam' }, resolve);
  });
  const roomCode = res1.roomCode;
  console.log(`✅ P1 tạo phòng: ${roomCode}`);

  await new Promise(resolve => {
    p2.emit('join_room', { roomCode, playerName: 'Khách Di Động', characterType: 'nu' }, resolve);
  });
  console.log(`✅ P2 vào phòng: ${roomCode}`);

  // Bắt đầu game -> Trạng thái VOTING (ban đầu 10s)
  p1.emit('start_game');

  await new Promise(resolve => setTimeout(resolve, 800));

  // Kiểm tra: Khi cả 2 người cùng vote, timer đếm ngược phải ngay lập tức chuyển thành <= 2 giây!
  let timerDroppedTo2 = false;
  p1.on('timer_tick', ({ timer }) => {
    if (timer <= 2) {
      timerDroppedTo2 = true;
    }
  });

  p1.emit('cast_vote', { choice: 'SPIN_QA' });
  p2.emit('cast_vote', { choice: 'SPIN_QA' });

  // Đợi 500ms để server nhận cả 2 vote
  await new Promise(resolve => setTimeout(resolve, 600));

  assert(timerDroppedTo2, 'Timer phải ngay lập tức đếm ngược xuống còn <= 2 giây khi tất cả đã vote!');
  console.log('🎯 KIỂM TRA CHÍNH XÁC: Khi tất cả người chơi đã chọn bài thi thì ngay lập tức đếm ngược xuống còn 2 giây!\n');

  // =========================================================================
  // TEST 5: THỜI GIAN HỎI XOÁY ĐÁP XOAY TĂNG LÊN 120 GIÂY (YÊU CẦU 3)
  // =========================================================================
  console.log('--- TEST 5: KIỂM TRA THỜI GIAN HỎI XOÁY ĐÁP XOAY 120 GIÂY ---');
  const setupPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for spinqa_setup_start')), 10000);
    p1.on('spinqa_setup_start', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const setupData = await setupPromise;
  console.log(`✅ SpinQA bắt đầu! Người hỏi: ${setupData.persona.name} | Thời gian: ${setupData.timer}s`);
  assert.strictEqual(setupData.timer, 120, 'Thời gian setup / đặt câu hỏi phải là 120 giây');
  console.log('🎯 KIỂM TRA CHÍNH XÁC: Thời gian hỏi của người hỏi được nâng lên đúng 120 giây!\n');

  p1.disconnect();
  p2.disconnect();

  console.log('🎉 ================================================================');
  console.log('🎉 TẤT CẢ 5 YÊU CẦU CỦA PHIÊN BẢN 1.8 ĐÃ VƯỢT QUA TEST 100% PASS!');
  console.log('🎉 ================================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử 1.8 thất bại:', err);
  process.exit(1);
});
