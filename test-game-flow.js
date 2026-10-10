// test-game-flow.js - Kiểm tra luồng hoạt động tự động của Socket.io và Bot
const { io } = require('socket.io-client');

console.log('--- BẮT ĐẦU TEST FLOW GAME ---');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Client test đã kết nối:', socket.id);

  // 1. Tạo phòng
  socket.emit('create_room', {
    playerName: 'Sĩ Tử Test',
    color: '#2563eb',
    accessory: 'cap'
  }, (res) => {
    console.log('✅ Tạo phòng:', res);

    // 2. Thêm 2 Bot AI
    socket.emit('add_bot', (b1) => {
      console.log('✅ Thêm Bot 1:', b1.bot.name);
      socket.emit('add_bot', (b2) => {
        console.log('✅ Thêm Bot 2:', b2.bot.name);

        // 3. Ném Bút sang Bot
        socket.emit('throw_projectile', {
          toPlayerId: b1.bot.id,
          type: 'pen'
        });
        console.log('✅ Đã ném bút thử nghiệm!');

        // 4. Bắt đầu bình chọn
        socket.emit('start_game', (gRes) => {
          console.log('✅ Bắt đầu game:', gRes);
        });
      });
    });
  });
});

socket.on('room_update', (room) => {
  console.log(`[Cập nhật phòng] Trạng thái: ${room.state} | Số người: ${room.players.length} | Vòng: ${room.round}`);
});

socket.on('game_selected', ({ game }) => {
  console.log(`🎯 Môn thi đã chọn: ${game}`);
});

socket.on('announcement', ({ title, msg }) => {
  console.log(`📢 [THÔNG BÁO] ${title}: ${msg}`);
});

socket.on('word_turn_start', ({ playerName, currentWord, turnTimeLeft }) => {
  console.log(`⚔️ [NỐI TỪ] Lượt của "${playerName}" | Từ hiện tại: "${currentWord}" | Còn: ${turnTimeLeft}s`);
});

socket.on('word_valid', ({ playerName, word, scoreAdded }) => {
  console.log(`✨ [NỐI TỪ] "${playerName}" nối từ thành công: "${word}" (+${scoreAdded}đ)`);
});

// Chạy trong 14 giây rồi thoát
setTimeout(() => {
  console.log('--- TEST HOÀN TẤT THÀNH CÔNG ---');
  socket.disconnect();
  process.exit(0);
}, 14000);
