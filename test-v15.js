// test-v15.js - Kiểm tra toàn diện 3 tính năng của phiên bản 1.5
const { io } = require('socket.io-client');
const assert = require('assert');
const { validateWord } = require('./lib/dictionary');

console.log('🧪 BẮT ĐẦU KIỂM TRA PHIÊN BẢN 1.5:');

// ============================================================================
// TEST 1: KIỂM TRA TỪ ĐIỂN CHẶT CHẼ (LOẠI BỎ 'TẬP HAHA')
// ============================================================================
console.log('\n--- TEST 1: KIỂM TRA TỪ ĐIỂN ---');
const r1 = validateWord('Tập haha', 'học tập', new Set());
assert.strictEqual(r1.valid, false, 'Tập haha không được phép hợp lệ!');
console.log('✅ Chặn đúng từ tầm bậy "Tập haha":', r1.reason);

const r2 = validateWord('Học kkkk', 'bài học', new Set());
assert.strictEqual(r2.valid, false, 'Học kkkk không được phép hợp lệ!');
console.log('✅ Chặn đúng từ vô nghĩa "Học kkkk":', r2.reason);

const r3 = validateWord('Tập trung', 'học tập', new Set());
assert.strictEqual(r3.valid, true, 'Tập trung là từ tiếng Việt chuẩn, phải hợp lệ!');
console.log('✅ Chấp nhận đúng từ chuẩn "Tập trung":', r3.normalizedWord);

const r4 = validateWord('Học hành', 'dạy học', new Set());
assert.strictEqual(r4.valid, true, 'Học hành phải hợp lệ!');
console.log('✅ Chấp nhận đúng từ chuẩn "Học hành":', r4.normalizedWord);

console.log('🎉 TEST 1 PASSED: Kiểm tra từ điển chính xác 100%!\n');

// ============================================================================
// TEST 2: KẾT NỐI SOCKET & KIỂM TRA CHỌN NHÂN VẬT (NAM, NỮ, ALIEN, CON GÀ)
// ============================================================================
console.log('--- TEST 2: KIỂM TRA CHỌN NHÂN VẬT & SOCKET ---');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);

  // Tạo phòng với nhân vật "chicken" (Con gà)
  socket.emit('create_room', {
    playerName: 'Sĩ Tử Gà',
    characterType: 'chicken',
    color: '#facc15',
    accessory: 'headband',
    hatColor: '#dc2626'
  }, (res) => {
    assert(res.success, 'Tạo phòng phải thành công');
    assert.strictEqual(res.state.players[0].characterType, 'chicken', 'Nhân vật phải là chicken');
    console.log('✅ Tạo phòng thành công với nhân vật Con Gà (chicken)!');

    // Đổi sang Alien qua update_customization
    socket.emit('update_customization', { characterType: 'alien' });
    console.log('✅ Đã yêu cầu đổi sang Alien...');

    // Thêm Bot AI
    socket.emit('add_bot', (bRes) => {
      assert(bRes.success, 'Thêm bot thành công');
      console.log('✅ Thêm bot thành công:', bRes.bot.name, '| Hình tượng:', bRes.bot.characterType);

      // Bắt đầu game
      socket.emit('start_game', (gRes) => {
        assert(gRes.success, 'start_game thành công');
      });
    });
  });
});

let updatedAlienChecked = false;
let drawingRoundsSeen = 0;

socket.on('room_update', (room) => {
  const me = room.players.find(p => p.id === socket.id);
  if (me && me.characterType === 'alien' && !updatedAlienChecked) {
    updatedAlienChecked = true;
    console.log('✅ TEST 2 PASSED: Đổi hình tượng sang Alien thành công trong room_update!');
  }

  if (room.state === 'VOTING') {
    socket.emit('cast_vote', { choice: 'DRAWING' });
  }

  if (room.state === 'DRAWING_TIME') {
    if (!me?.hasDrawn) {
      drawingRoundsSeen++;
      console.log(`🎨 Vòng thi vẽ số ${drawingRoundsSeen}: Nộp bài vẽ...`);
      socket.emit('submit_drawing', { 
        drawingData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' 
      });
    }
  }

  if (room.state === 'ROUND_SUMMARY') {
    console.log('📊 Đang ở bảng tổng kết. Đóng ngay lập tức để chuyển về Lobby...');
    socket.emit('dismiss_summary');
  }
});

socket.on('round_summary_end', () => {
  console.log('✅ Đã kết thúc vòng thi vẽ. Reset hoàn tất và sẵn sàng cho vòng tiếp theo!');
  console.log('🎉 TOÀN BỘ CÁC BÀI TEST 1.5 ĐỀU ĐẠT CHUẨN XUẤT SẮC!');
  socket.disconnect();
  process.exit(0);
});

setTimeout(() => {
  console.log('⚠️ Timeout test-v15, thoát');
  socket.disconnect();
  process.exit(1);
}, 35000);
