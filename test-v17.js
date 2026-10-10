const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🧪 Bắt đầu kiểm thử cập nhật phiên bản 1.7...');

  const p1 = io(SERVER_URL);
  await new Promise((resolve) => {
    if (p1.connected) resolve();
    else p1.once('connect', resolve);
  });
  const p1Id = p1.id;

  const res1 = await new Promise((resolve) => {
    p1.emit('create_room', {
      playerName: 'Sĩ Tử Nam',
      characterType: 'nam',
      color: '#dc2626',
      accessory: 'cap',
      hatColor: '#2563eb'
    }, resolve);
  });
  if (!res1.success) throw new Error('Tạo phòng thất bại: ' + res1.message);
  const roomCode = res1.roomCode;
  console.log(`✅ P1 (${p1Id}) đã tạo phòng: ${roomCode}`);

  const p2 = io(SERVER_URL);
  await new Promise((resolve) => {
    if (p2.connected) resolve();
    else p2.once('connect', resolve);
  });
  const p2Id = p2.id;

  const res2 = await new Promise((resolve) => {
    p2.emit('join_room', {
      roomCode: roomCode,
      playerName: 'Sĩ Tử Gà',
      characterType: 'chicken',
      color: '#facc15',
      accessory: 'none',
      hatColor: '#dc2626'
    }, resolve);
  });
  if (!res2.success) throw new Error('Vào phòng thất bại: ' + res2.message);
  console.log(`✅ P2 (${p2Id}) đã vào phòng: ${roomCode}`);

  // 1. Kiểm thử đồng bộ Di chuyển tự do (player_move)
  console.log('🧪 1. Kiểm thử di chuyển tự do (Free Roam WASD)...');
  const movePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for player_moved')), 5000);
    p2.on('player_moved', (data) => {
      if (data.playerId === p1Id && data.x === 1.5 && data.z === -2.0) {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  p1.emit('player_move', { x: 1.5, y: 0.45, z: -2.0, rot: 1.57, isMoving: true, isSitting: false });
  const moveResult = await movePromise;
  console.log('✅ Đồng bộ di chuyển tự do (player_move -> player_moved) thành công:', moveResult);

  // 2. Kiểm thử tương tác Ghế (player_seat_interact: Ngồi)
  console.log('🧪 2. Kiểm thử tương tác Ngồi ghế (phím E)...');
  const seatPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for player_seated')), 5000);
    p2.on('player_seated', (data) => {
      if (data.playerId === p1Id && data.isSitting === true && data.seatIndex === 3) {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  p1.emit('player_seat_interact', { isSitting: true, seatIndex: 3 });
  const seatResult = await seatPromise;
  console.log('✅ Đồng bộ ngồi ghế (player_seat_interact -> player_seated) thành công:', seatResult);

  // 3. Kiểm thử Đứng dậy
  const standPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for player_seated stand')), 5000);
    p2.on('player_seated', (data) => {
      if (data.playerId === p1Id && data.isSitting === false) {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });
  p1.emit('player_seat_interact', { isSitting: false, seatIndex: null });
  await standPromise;
  console.log('✅ Đồng bộ đứng dậy thành công!');

  // 4. Kiểm thử Hỏi xoáy đáp xoay (SpinQA) & Số lượng từ khóa chính xác
  console.log('🧪 3. Kiểm thử Hỏi xoáy đáp xoay (SpinQA)...');
  p1.emit('start_game');

  // Bình chọn SPIN_QA
  p1.emit('cast_vote', { choice: 'SPIN_QA' });
  p2.emit('cast_vote', { choice: 'SPIN_QA' });

  // Đợi setup bắt đầu (Sau 10s vote + 2.5s chọn)
  const setupPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for spinqa_setup_start')), 20000);
    p1.on('spinqa_setup_start', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const setupData = await setupPromise;
  const askerId = setupData.askerId;
  const answererId = (askerId === p1Id) ? p2Id : p1Id;
  const answererSocket = (answererId === p1Id) ? p1 : p2;
  const askerSocket = (askerId === p1Id) ? p1 : p2;

  console.log(`✅ SpinQA Setup bắt đầu! Người hỏi: ${setupData.persona.name}, Asker ID: ${askerId}`);

  // Người đáp gửi từ khóa (Yêu cầu 1.7: Chỉ đúng số lượng từ khóa người chơi nhập)
  answererSocket.emit('submit_spinqa_keyword', { keyword: 'Bánh Mì Kẹp Kem' });
  // Người hỏi gửi câu hỏi
  askerSocket.emit('submit_spinqa_question', { question: 'Tại sao lại thích ăn khuya?' });

  // Đợi chuyển sang phase trả lời
  const answeringPhasePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for spinqa_answering_start')), 10000);
    answererSocket.on('spinqa_answering_start', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const answeringData = await answeringPhasePromise;
  console.log(`✅ SpinQA Answering Phase! Số lượng từ khóa nhận được: ${answeringData.keywords.length}`);
  console.log('Danh sách từ khóa:', answeringData.keywords);

  if (answeringData.keywords.length === 1 && answeringData.keywords[0] === 'Bánh Mì Kẹp Kem') {
    console.log('🎯 KIỂM TRA CHÍNH XÁC: Số từ khóa đúng 100% bằng số người đáp (1 người đáp = 1 từ khóa), không bị chèn từ khóa dư!');
  } else {
    throw new Error(`Keywords count mismatch! Expected 1, got ${answeringData.keywords.length}`);
  }

  // Người đáp gửi câu trả lời
  answererSocket.emit('submit_spinqa_answer', { answerText: 'Vì Bánh Mì Kẹp Kem ngon số một thiên hà!' });

  // Đợi chuyển sang review phase (chấm điểm)
  const reviewPhasePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for SPIN_QA_REVIEW room update')), 10000);
    const onUpdate = (room) => {
      if (room.state === 'SPIN_QA_REVIEW' && room.spinQA && room.spinQA.currentReview) {
        clearTimeout(timer);
        p1.off('room_update', onUpdate);
        resolve(room.spinQA.currentReview);
      }
    };
    p1.on('room_update', onUpdate);
  });

  const reviewItem = await reviewPhasePromise;
  console.log(`✅ Bắt đầu chấm điểm câu đáp của "${reviewItem.responderName}": "${reviewItem.answerText}"`);

  // Người chấm vote điểm 9/10 (4 sao = 8đ, tim = 10đ, star 5 = 10đ)
  p1.emit('rate_spinqa_answer', { type: 'star', stars: 5 });
  p2.emit('rate_spinqa_answer', { type: 'star', stars: 5 });

  // Đợi round_summary_start kết thúc vòng thi
  console.log('🧪 4. Đợi kết quả bảng tổng kết round_summary_start...');
  const summaryPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for round_summary_start')), 25000);
    p1.on('round_summary_start', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const summaryData = await summaryPromise;
  console.log('✅ Nhận kết quả round_summary_start thành công!');
  console.log('Bảng xếp hạng vòng thi:', summaryData.leaderboard);

  const answererSummary = summaryData.leaderboard.find(p => p.id === answererId);
  const askerSummary = summaryData.leaderboard.find(p => p.id === askerId);

  console.log(`Điểm vòng thi của người đáp: ${answererSummary.roundScore} / 10 (Điểm tổng: ${answererSummary.score})`);
  console.log(`Điểm vòng thi của người hỏi: ${askerSummary.roundScore} / 10 (Điểm tổng: ${askerSummary.score})`);

  if (answererSummary.roundScore >= 1 && answererSummary.roundScore <= 10 &&
      askerSummary.roundScore >= 1 && askerSummary.roundScore <= 10) {
    console.log('🎯 KIỂM TRA CHÍNH XÁC: Điểm của bài thi hiển thị chuẩn hóa 1 - 10 điểm (Yêu cầu 1.7)!');
  } else {
    throw new Error(`Round score out of bounds: responder=${answererSummary.roundScore}, asker=${askerSummary.roundScore}`);
  }

  p1.disconnect();
  p2.disconnect();

  console.log('\n🎉 ========================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ PHIÊN BẢN 1.7 ĐÃ ĐẠT 100% PASS!');
  console.log('🎉 ========================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
