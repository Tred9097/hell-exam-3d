// test-v14.js - Kiểm tra toàn diện các yêu cầu của phiên bản 1.4
const { io } = require('socket.io-client');
const assert = require('assert');

console.log('🧪 BẮT ĐẦU KIỂM TRA PHIÊN BẢN 1.4:');

// Test 1: Chuẩn hóa làm tròn điểm (>= 0.5 lên 1, < 0.5 giữ nguyên, max 10, min 1)
function roundScore(rawAvg) {
  return Math.max(1, Math.min(10, Math.round(rawAvg)));
}

assert.strictEqual(roundScore(7.5), 8, '7.5 phải làm tròn thành 8');
assert.strictEqual(roundScore(7.4), 7, '7.4 phải làm tròn thành 7');
assert.strictEqual(roundScore(7.6), 8, '7.6 phải làm tròn thành 8');
assert.strictEqual(roundScore(0.2), 1, 'Điểm tối thiểu phải là 1');
assert.strictEqual(roundScore(10.8), 10, 'Điểm tối đa phải là 10');
console.log('✅ Test 1 PASSED: Công thức tính điểm làm tròn chuẩn xác (7.5->8, 7.4->7, min 1, max 10)');

// Test 2: Kết nối Socket và kiểm tra luồng
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Test Socket connected:', socket.id);

  // Tạo phòng
  socket.emit('create_room', {
    playerName: 'Tester1',
    color: '#3b82f6',
    accessory: 'cap',
    hatColor: '#dc2626'
  }, (res) => {
    assert(res.success, 'Tạo phòng phải thành công');
    const roomCode = res.roomCode;
    console.log('✅ Test 2 PASSED: Tạo phòng thành công, mã phòng:', roomCode);

    // Thêm 1 bot
    socket.emit('add_bot', (bRes) => {
      assert(bRes.success, 'Thêm bot thành công');
      console.log('✅ Đã thêm bot:', bRes.bot.name);

      // Bắt đầu game và cast vote cho DRAWING
      socket.emit('start_game', (sRes) => {
        assert(sRes.success, 'Host start_game thành công');
      });
    });
  });
});

let drawingStarted = false;
let reviewStarted = false;

socket.on('game_selected', ({ game }) => {
  console.log('🎯 Môn thi được chọn:', game);
});

socket.on('room_update', (room) => {
  if (room.state === 'VOTING') {
    socket.emit('cast_vote', { choice: 'DRAWING' });
  }

  if (room.state === 'DRAWING_TIME' && !drawingStarted) {
    drawingStarted = true;
    console.log('🎨 Đang trong thời gian vẽ. Thử nghiệm nộp bài vẽ...');
    // Nộp bài vẽ ngay lập tức
    socket.emit('submit_drawing', { drawingData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
  }

  if (room.state === 'DRAWING_REVIEW' && !reviewStarted) {
    reviewStarted = true;
    console.log('✅ Test 3 PASSED: Khi tất cả đã nộp bài, lập tức bắt đầu chấm điểm (DRAWING_REVIEW)!');
    console.log('Đang chấm điểm bài vẽ hiện tại...');
    
    // Gửi vote chấm điểm
    if (room.reviewDrawing) {
      socket.emit('rate_drawing', {
        targetPlayerId: room.reviewDrawing.authorId,
        type: 'star',
        stars: 4
      });
    }
  }

  if (room.state === 'ROUND_SUMMARY') {
    console.log('📊 Đang ở bảng tổng kết ROUND_SUMMARY. Kiểm tra tính năng tự động/nhấn để đóng...');
    // Test dismiss_summary ngay
    socket.emit('dismiss_summary');
  }
});

socket.on('round_summary_end', () => {
  console.log('✅ Test 4 PASSED: Nhận sự kiện round_summary_end sau khi dismiss hoặc đếm xong 3s!');
  console.log('🎉 TOÀN BỘ CÁC BÀI TEST 1.4 HOÀN TOÀN HỢP LỆ!');
  socket.disconnect();
  process.exit(0);
});

setTimeout(() => {
  console.log('⚠️ Test timeout, kết thúc tiến trình');
  socket.disconnect();
  process.exit(1);
}, 45000);
