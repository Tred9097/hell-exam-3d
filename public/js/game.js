// public/js/game.js - Xử lý Logic Client, Socket.io, Giao diện vẽ tranh & Nối từ
let socket = null;
let scene3d = null;
let myPlayerId = null;
let currentRoom = null;
let isHost = false;
let selectedSkinId = 'Casual_Male'; // Quaternius 3D Modular Skin v2.0
let selectedSkinColor = '#f2c190';  // Vàng Châu Á mặc định (Yêu cầu 2.0)
let selectedFaceColor = '#111111';  // Đen mặc định cho mắt và lông mày (Yêu cầu 2.9)
try {
  const savedFace = localStorage.getItem('hell_exam_face_color');
  if (savedFace) selectedFaceColor = savedFace;
} catch (e) {}
let tempWardrobeSkinId = 'Casual_Male';
let tempWardrobeSkinColor = '#f2c190';
let tempWardrobeFaceColor = selectedFaceColor;
let startPreviewViewer = null;
let wardrobePreviewViewer = null;

// Drawing Canvas State
let isDrawing = false;
let drawColor = '#000000';
let drawSize = 4;
let isEraser = false;
let drawingCanvas = null;
let drawingCtx = null;

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  init3DScene();
  initDrawingCanvas();
  bindUIEvents();
  setupMovementControls();
  initCharacterSystem();
  fetchServerInfo();
});

function initSocket() {
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  // Nhận thông tin mạng LAN & tên máy chủ PC thực tế (Yêu cầu 1.8)
  socket.on('server_network_info', (data) => {
    updateServerNetworkUI(data);
  });

  // Nhận link Online toàn cầu khi Cloudflare Tunnel sẵn sàng
  socket.on('online_url_ready', ({ onlineUrl }) => {
    if (onlineUrl) {
      const box = document.getElementById('online-tunnel-box');
      const link = document.getElementById('online-server-url');
      if (box) box.classList.remove('hidden');
      if (link) {
        link.innerText = onlineUrl;
        link.href = onlineUrl;
      }
      showToast('🌐 Link chơi Online đã sẵn sàng! Có thể gửi cho bạn bè ở xa / 4G.');
    }
  });

  socket.on('connect', () => {
    myPlayerId = socket.id;
    if (scene3d) scene3d.setMyPlayerId(myPlayerId);
    console.log('Connected with socket ID:', myPlayerId);
    startPingInterval();
  });

  socket.on('client_pong', (clientTime) => {
    handlePongResponse(clientTime);
  });

  // Nhận thông tin phòng cập nhật
  socket.on('room_update', (roomState) => {
    currentRoom = roomState;
    isHost = roomState.hostId === myPlayerId;
    updateUIWithRoomState(roomState);
  });

  // Nhận cập nhật bình chọn (3 Môn)
  socket.on('vote_update', ({ votes }) => {
    updateVoteUI(votes);
  });

  // Thông báo game được chọn
  socket.on('game_selected', ({ game }) => {
    let gameTitle = '🎨 VẼ TRANH XOAY VÒNG';
    if (game === 'WORD_CHAIN') gameTitle = '⚔️ ĐẠI CHIẾN NỐI TỪ';
    if (game === 'SPIN_QA') gameTitle = '🌀 HỎI XOÁY ĐÁP XOAY';

    showBannerToast(`TRÒ CHƠI ĐƯỢC CHỌN: ${gameTitle}!`);
    if (window.audioMgr) window.audioMgr.playSchoolDrum(3);
  });

  // Thông báo loa phát thanh trường học
  socket.on('announcement', ({ title, msg }) => {
    showAnnouncementModal(title, msg);
  });

  // Bộ đếm thời gian chung
  socket.on('timer_tick', ({ timer }) => {
    updateTimerDisplay(timer);
  });

  // --- SỰ KIỆN VẼ TRANH XOAY VÒNG 2.0 ---
  socket.on('drawing_prompt_phase_start', ({ timer }) => {
    const input = document.getElementById('input-drawing-prompt');
    const submitBtn = document.getElementById('btn-submit-drawing-prompt');
    const statusMsg = document.getElementById('drawing-prompt-status-msg');
    if (input) { input.value = ''; input.disabled = false; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'GỬI ĐỀ VẼ 🚀'; }
    if (statusMsg) statusMsg.innerText = '';
  });

  socket.on('prompt_submitted', ({ playerId }) => {
    if (playerId === myPlayerId) {
      const statusMsg = document.getElementById('drawing-prompt-status-msg');
      const submitBtn = document.getElementById('btn-submit-drawing-prompt');
      if (statusMsg) statusMsg.innerText = '✅ Đã gửi đề vẽ! Đang đợi các bạn khác...';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'ĐÃ GỬI ĐỀ ✅'; }
    }
  });

  socket.on('drawing_assigned_turn', ({ roundIndex, totalRounds, promptAuthorId, promptAuthorName, promptText, timer }) => {
    const badge = document.getElementById('drawing-round-badge');
    const authorDesktop = document.getElementById('drawing-prompt-author-text');
    const authorMobile = document.getElementById('drawing-prompt-author-mobile');
    const promptTextEl = document.getElementById('drawing-prompt-text');
    const submitBtn = document.getElementById('draw-submit-btn');

    if (badge) badge.innerText = `LƯỢT ${roundIndex} / ${totalRounds}`;
    if (authorDesktop) authorDesktop.innerText = `Đề của: ${promptAuthorName}`;
    if (authorMobile) authorMobile.innerText = `Đề của: ${promptAuthorName}`;
    if (promptTextEl) promptTextEl.innerText = `"${promptText}"`;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'NỘP BÀI 📝';
    }

    // Xóa sạch canvas chuẩn bị cho lượt vẽ mới
    if (drawingCtx && drawingCanvas) {
      drawingCtx.fillStyle = '#ffffff';
      drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
  });

  // Đã có người nộp bài vẽ
  socket.on('player_submitted_drawing', ({ playerId }) => {
    const p = currentRoom?.players?.find(item => item.id === playerId);
    if (p) {
      showToast(`📝 ${p.name} đã hoàn thành bài vẽ!`);
      const char = scene3d.characters.get(playerId);
      if (char) char.showEmoji('✅', 2.0);
    }
  });

  // Phản ứng chấm tranh (sao, cà chua, tim)
  socket.on('drawing_reaction', ({ authorId, fromPlayerId, type, stars, voteScore }) => {
    handleDrawingReaction(authorId, fromPlayerId, type, stars, voteScore);
  });

  // Khi bài vẽ được chấm điểm chính thức theo chuẩn 1 - 10đ
  socket.on('drawing_graded', ({ authorId, authorName, avg, finalScore, totalScore }) => {
    showToast(`🎨 Tác phẩm "${authorName}": Điểm TB ${avg}/10 ➔ Nhận ${finalScore} điểm!`);
    const char = scene3d.characters.get(authorId);
    if (char) {
      char.showEmoji('💯', 3.0);
      char.setAnimation('cheer', 3.0);
      char.updateHUD(char.name, totalScore);
    }
  });

  // --- SỰ KIỆN HỎI XOÁY ĐÁP XOAY (MỚI 1.6) ---
  socket.on('spinqa_setup_start', ({ askerId, askerName, persona, timer }) => {
    setupSpinQAInitialUI(askerId, askerName, persona, timer);
  });

  socket.on('spinqa_question_submitted', () => {
    const msgEl = document.getElementById('spinqa-asker-status-msg');
    const submitBtn = document.getElementById('btn-submit-spinqa-question');
    if (msgEl) msgEl.innerText = '✅ Đã gửi câu hỏi! Đang đợi các bạn hoàn thành từ khóa...';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'ĐÃ GỬI CÂU HỎI ✅'; }
  });

  socket.on('spinqa_keyword_submitted', ({ playerId }) => {
    if (playerId === myPlayerId) {
      const msgEl = document.getElementById('spinqa-responder-status-msg');
      const submitBtn = document.getElementById('btn-submit-spinqa-keyword');
      if (msgEl) msgEl.innerText = '✅ Đã gửi từ khóa! Đang đợi các bạn khác...';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'ĐÃ GỬI TỪ KHÓA ✅'; }
    }
  });

  socket.on('spinqa_answering_start', ({ asker, question, keywords, timer }) => {
    setupSpinQAAnsweringUI(asker, question, keywords, timer);
  });

  socket.on('spinqa_player_submitted', ({ responderId, responderName }) => {
    showToast(`🎤 ${responderName} đã nộp câu đáp xoay!`);
    const monitorItem = document.getElementById(`monitor-item-${responderId}`);
    if (monitorItem) {
      monitorItem.innerHTML = `<span class="text-white font-bold">${responderName}</span><span class="text-emerald-400 font-bold">Đã nộp ✅</span>`;
    }
  });

  socket.on('spinqa_reaction', ({ responderId, fromPlayerId, type, stars, voteScore }) => {
    handleSpinQAReaction(responderId, fromPlayerId, type, stars, voteScore);
  });

  socket.on('spinqa_answer_graded', ({ responderId, responderName, avg, finalScore, askerId, askerBonus, responderTotalScore, askerTotalScore }) => {
    const bonusText = askerBonus > 0 ? ` (Người hỏi được thưởng +${askerBonus}đ!)` : '';
    showToast(`🎤 Thí sinh "${responderName}": ${avg}/10đ ➔ +${finalScore} điểm!${bonusText}`);

    const respChar = scene3d.characters.get(responderId);
    if (respChar) {
      respChar.showEmoji('💯', 3.0);
      respChar.setAnimation('cheer', 3.0);
      respChar.updateHUD(respChar.name, responderTotalScore);
    }
    const askerChar = scene3d.characters.get(askerId);
    if (askerChar && askerBonus > 0) {
      askerChar.showEmoji('😈', 3.0);
      askerChar.setAnimation('cheer', 3.0);
      askerChar.updateHUD(askerChar.name, askerTotalScore);
    }
  });

  // Khi kết thúc bảng tổng kết vòng (Reset dữ liệu thi)
  socket.on('round_summary_end', () => {
    document.getElementById('summary-overlay')?.classList.add('hidden');
    document.getElementById('lobby-overlay')?.classList.remove('hidden');
    resetExamClientState();
    if (scene3d) {
      scene3d.setIsLobby(true);
      scene3d.setCameraMode('OVERVIEW');
      const myChar = scene3d.characters.get(myPlayerId);
      if (myChar) scene3d.checkSeatInteraction(myChar);
    }
  });

  // --- SỰ KIỆN NỐI TỪ (WORD CHAIN) ---
  socket.on('word_turn_start', ({ playerId, playerName, currentWord, turnTimeLeft }) => {
    handleWordTurnStart(playerId, playerName, currentWord, turnTimeLeft);
  });

  socket.on('turn_timer_tick', ({ turnTimeLeft }) => {
    updateTurnTimer(turnTimeLeft);
  });

  socket.on('word_valid', ({ playerId, playerName, word, scoreAdded, newScore }) => {
    handleWordValid(playerId, playerName, word, scoreAdded, newScore);
  });

  socket.on('word_invalid', ({ playerId, word, reason }) => {
    if (playerId === myPlayerId) {
      showWordError(reason);
      if (window.audioMgr) window.audioMgr.playBuzzer();
    }
  });

  socket.on('player_eliminated', ({ playerId, playerName, reason, newWord }) => {
    showBannerToast(`💥 ${playerName} BỊ LOẠI! (${reason})`);
    if (window.audioMgr) {
      window.audioMgr.playBuzzer();
      window.audioMgr.playExplosion();
    }
    if (scene3d) {
      scene3d.triggerExplosionAtPlayer(playerId);
    }
    if (newWord) {
      const currentWordEl = document.getElementById('wc-current-word');
      if (currentWordEl) currentWordEl.innerText = newWord.toUpperCase();

      const syllables = newWord.trim().split(/\s+/).filter(Boolean);
      const lastSyllable = syllables.length > 0 ? syllables[syllables.length - 1] : '';
      const prefixBadge = document.getElementById('wc-prefix-badge');
      if (prefixBadge) {
        prefixBadge.innerText = lastSyllable ? `${lastSyllable.toUpperCase()} +` : '... +';
      }
      const wordInput = document.getElementById('wc-word-input');
      if (wordInput && lastSyllable) {
        wordInput.placeholder = `Nhập từ nối tiếp (VD: ${lastSyllable} ... hoặc 1 từ)`;
      }

      showToast(`⚡ Giám thị đổi từ mới: "${newWord.toUpperCase()}"!`);
    }
  });

  // --- SỰ KIỆN ĐỒNG BỘ DI CHUYỂN & NGỒI SẢNH CHỜ (YÊU CẦU 1.7) ---
  socket.on('player_moved', (data) => {
    if (scene3d) scene3d.handleRemotePlayerMove(data);
  });

  socket.on('player_seated', (data) => {
    if (scene3d) scene3d.handleRemotePlayerSeated(data);
  });

  // --- SỰ KIỆN TỔNG KẾT VÒNG (ROUND SUMMARY) ---
  socket.on('round_summary_start', ({ round, leaderboard }) => {
    handleRoundSummary(round, leaderboard);
    if (scene3d) scene3d.resetAllKnockedOut();
  });

  socket.on('trigger_confetti', ({ topPlayerId }) => {
    if (scene3d) {
      const pos = scene3d.getCharacterWorldPosition(topPlayerId);
      scene3d.burstConfetti(pos);
      if (window.audioMgr) window.audioMgr.playFanfare();
    }
  });

  socket.on('trigger_animation', ({ playerId, anim }) => {
    const char = scene3d.characters.get(playerId);
    if (char) char.setAnimation(anim, 3.5);
  });

  // Ném bút / phao 3D
  socket.on('projectile_thrown', ({ fromPlayerId, toPlayerId, type }) => {
    if (scene3d) {
      const fromPos = scene3d.getCharacterWorldPosition(fromPlayerId);
      const toPos = scene3d.getCharacterWorldPosition(toPlayerId);
      scene3d.throwProjectile(fromPos, toPos, type);
      if (window.audioMgr) window.audioMgr.playWhoosh();

      // Nạn nhân giật nảy mình sau khi bay tới
      setTimeout(() => {
        const victim = scene3d.characters.get(toPlayerId);
        if (victim) {
          victim.setAnimation('hit', 2.0);
          victim.showEmoji('💢', 2.0);
        }
      }, 700);
    }
  });

  // Phản ứng biểu cảm học sinh (Tự động dừng sau 3.0s, showEmoji tự kích hoạt triggerAnimation chuẩn & âm thanh sống động)
  socket.on('player_reaction', ({ playerId, emoji }) => {
    const char = scene3d.characters.get(playerId);
    if (char) {
      char.showEmoji(emoji, 3.0);
    }
    if (window.audioMgr) {
      if (emoji === '🎉') window.audioMgr.playCheer();
      else if (emoji === '😭') window.audioMgr.playCry();
      else if (emoji === '🙏') window.audioMgr.playPray();
      else if (emoji === '😵') window.audioMgr.playDizzy();
    }
  });

  // Tin nhắn chat học đường
  socket.on('chat_message', ({ playerId, playerName, text }) => {
    addChatMessage(playerName, text, playerId === myPlayerId);
    const char = scene3d.characters.get(playerId);
    if (char) char.showChat(text, 3.5);
  });
}

// --- KIỂM TRA ĐỘ TRỄ MẠNG (PING / PONG RTT - YÊU CẦU 3.0) ---
let pingIntervalId = null;

function startPingInterval() {
  if (pingIntervalId) clearInterval(pingIntervalId);
  if (socket && socket.connected) {
    socket.emit('client_ping', Date.now());
  }
  pingIntervalId = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('client_ping', Date.now());
    }
  }, 4000);
}

function handlePongResponse(clientTime) {
  const rtt = Math.max(1, Date.now() - (clientTime || Date.now()));
  const pingBadge = document.getElementById('header-ping-badge');
  const pingText = document.getElementById('header-ping-text');
  if (pingBadge && pingText) {
    pingBadge.classList.remove('hidden');
    pingBadge.classList.add('flex');
    pingText.innerText = `${rtt}ms`;

    if (rtt < 80) {
      pingBadge.className = 'font-mono text-[10px] sm:text-xs text-emerald-400 font-bold flex items-center space-x-0.5';
    } else if (rtt < 180) {
      pingBadge.className = 'font-mono text-[10px] sm:text-xs text-yellow-400 font-bold flex items-center space-x-0.5';
    } else {
      pingBadge.className = 'font-mono text-[10px] sm:text-xs text-orange-400 font-bold flex items-center space-x-0.5';
    }
  }
}

function init3DScene() {
  const container = document.getElementById('canvas3d-container');
  scene3d = new SchoolScene3D(container);
}

function updateServerNetworkUI(data) {
  if (!data) return;
  const lanUrlEl = document.getElementById('lan-server-url');
  const pcBadge = document.getElementById('server-pc-name-badge');
  const headerLanBadge = document.getElementById('header-lan-ip');
  const lanLabel = document.getElementById('lan-connection-label');
  const lanIcon = document.getElementById('lan-connection-icon');
  const onlineTunnelBox = document.getElementById('online-tunnel-box');
  const onlineServerUrl = document.getElementById('online-server-url');

  // 1. Cập nhật Banner Online Toàn Cầu (Cloudflare Tunnel)
  const effectiveOnlineUrl = data.onlineUrl || (
    window.location.hostname && (
      window.location.hostname.includes('trycloudflare.com') || 
      window.location.hostname.includes('.loca.lt') || 
      window.location.hostname.includes('.ngrok')
    ) ? window.location.origin : null
  );

  if (effectiveOnlineUrl) {
    if (onlineTunnelBox) onlineTunnelBox.classList.remove('hidden');
    if (onlineServerUrl) {
      onlineServerUrl.innerText = effectiveOnlineUrl;
      onlineServerUrl.href = effectiveOnlineUrl;
    }
  }

  // 2. Cập nhật Banner Wi-Fi / Mobile Hotspot nội bộ
  const isHotspot = !!data.hotspotIp;
  const localIp = data.hotspotIp || data.lanIp || 'localhost';
  const localTargetUrl = `http://${localIp}:${data.port || window.location.port || 3000}`;

  if (lanLabel) {
    lanLabel.innerText = isHotspot ? 'Mobile Hotspot (Máy tính phát):' : 'Chơi chung Wi-Fi / LAN:';
  }
  if (lanIcon) {
    lanIcon.innerText = isHotspot ? '📱' : '📶';
  }
  if (lanUrlEl) {
    lanUrlEl.innerText = localTargetUrl;
    lanUrlEl.href = localTargetUrl;
  }
  if (pcBadge) {
    if (isHotspot) {
      pcBadge.innerText = `Hotspot: ${data.hotspotIp}`;
      pcBadge.title = `Đang phát Mobile Hotspot từ máy tính - Điện thoại bắt sóng hotspot nhập địa chỉ này!`;
    } else if (data.pcHost) {
      pcBadge.innerText = `PC: ${data.pcHost}`;
      pcBadge.title = `Máy chủ PC: ${data.pcHost} (${data.lanIp})`;
    }
  }
  if (headerLanBadge) {
    if (effectiveOnlineUrl) {
      headerLanBadge.innerText = 'ONLINE 🌐';
    } else if (isHotspot) {
      headerLanBadge.innerText = `HOTSPOT ${data.hotspotIp}`;
    } else {
      headerLanBadge.innerText = `${data.lanIp || window.location.hostname}:${data.port || window.location.port || 3000}`;
    }
  }
}

function fetchServerInfo() {
  fetch('/api/info')
    .then(res => res.json())
    .then(data => {
      updateServerNetworkUI(data);
    })
    .catch(err => {
      console.warn('Fetch info error, fallback to current origin:', err);
      updateServerNetworkUI({
        lanIp: window.location.hostname,
        pcHost: 'Server',
        port: window.location.port || 3000,
        url: window.location.origin
      });
    });
}

// --- CANVAS VẼ TRANH HỌC SINH NÂNG CẤP (YÊU CẦU 1.7) ---
let drawTool = 'brush'; // 'brush', 'bucket', 'eraser'
let undoStack = [];

function pushUndoSnapshot() {
  if (!drawingCtx || !drawingCanvas) return;
  if (undoStack.length >= 20) undoStack.shift();
  undoStack.push(drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height));
}

function hexToRgbComponents(hex) {
  let c = (hex || '#000000').replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function performFloodFill(startX, startY, fillColorHex) {
  if (!drawingCtx || !drawingCanvas) return;
  const w = drawingCanvas.width;
  const h = drawingCanvas.height;
  const imgData = drawingCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const rgb = hexToRgbComponents(fillColorHex);
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

  const startIdx = (sy * w + sx) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  // Nếu màu trùng thì không cần fill
  if (targetR === rgb.r && targetG === rgb.g && targetB === rgb.b && targetA === 255) return;

  pushUndoSnapshot();

  const queue = [sx, sy];
  const visited = new Uint8Array(w * h);

  function match(idx) {
    const dr = Math.abs(data[idx] - targetR);
    const dg = Math.abs(data[idx + 1] - targetG);
    const db = Math.abs(data[idx + 2] - targetB);
    const da = Math.abs(data[idx + 3] - targetA);
    return dr + dg + db + da < 36;
  }

  while (queue.length > 0) {
    const cy = queue.pop();
    const cx = queue.pop();
    const pixelIdx = cy * w + cx;
    if (visited[pixelIdx]) continue;
    visited[pixelIdx] = 1;

    const idx = pixelIdx * 4;
    if (!match(idx)) continue;

    data[idx] = rgb.r;
    data[idx + 1] = rgb.g;
    data[idx + 2] = rgb.b;
    data[idx + 3] = 255;

    if (cx > 0 && !visited[pixelIdx - 1]) queue.push(cx - 1, cy);
    if (cx < w - 1 && !visited[pixelIdx + 1]) queue.push(cx + 1, cy);
    if (cy > 0 && !visited[pixelIdx - w]) queue.push(cx, cy - 1);
    if (cy < h - 1 && !visited[pixelIdx + w]) queue.push(cx, cy + 1);
  }

  drawingCtx.putImageData(imgData, 0, 0);
  if (window.audioMgr) window.audioMgr.playDeskTap();
}

function initDrawingCanvas() {
  drawingCanvas = document.getElementById('exam-drawing-canvas');
  if (!drawingCanvas) return;
  drawingCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });

  // Khởi tạo nền trắng
  drawingCtx.fillStyle = '#ffffff';
  drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  undoStack = [];

  function getPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = drawingCanvas.width / rect.width;
    const scaleY = drawingCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    e.preventDefault();
    const pos = getPos(e);

    if (drawTool === 'bucket') {
      performFloodFill(pos.x, pos.y, drawColor);
      return;
    }

    pushUndoSnapshot();
    isDrawing = true;
    drawingCtx.beginPath();
    drawingCtx.moveTo(pos.x, pos.y);
  }

  function drawMove(e) {
    if (!isDrawing || drawTool === 'bucket') return;
    e.preventDefault();
    const pos = getPos(e);

    const isErasing = drawTool === 'eraser';
    drawingCtx.lineWidth = isErasing ? drawSize * 3.5 : drawSize;
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.strokeStyle = isErasing ? '#ffffff' : drawColor;

    drawingCtx.lineTo(pos.x, pos.y);
    drawingCtx.stroke();
  }

  function stopDraw() {
    isDrawing = false;
  }

  drawingCanvas.addEventListener('mousedown', startDraw);
  drawingCanvas.addEventListener('mousemove', drawMove);
  window.addEventListener('mouseup', stopDraw);

  drawingCanvas.addEventListener('touchstart', startDraw, { passive: false });
  drawingCanvas.addEventListener('touchmove', drawMove, { passive: false });
  window.addEventListener('touchend', stopDraw);

  // Chọn công cụ: Bút, Đổ màu, Tẩy
  const setTool = (tool) => {
    drawTool = tool;
    document.querySelectorAll('.draw-tool-btn').forEach(b => {
      b.classList.remove('bg-amber-500', 'text-slate-950');
      b.classList.add('bg-slate-800', 'text-white');
    });

    if (tool === 'brush') {
      document.getElementById('draw-tool-brush')?.classList.add('bg-amber-500', 'text-slate-950');
      document.getElementById('draw-tool-brush')?.classList.remove('bg-slate-800', 'text-white');
    } else if (tool === 'bucket') {
      document.getElementById('draw-tool-bucket')?.classList.add('bg-amber-500', 'text-slate-950');
      document.getElementById('draw-tool-bucket')?.classList.remove('bg-slate-800', 'text-white');
    } else if (tool === 'eraser') {
      document.getElementById('draw-tool-eraser')?.classList.add('bg-amber-500', 'text-slate-950');
      document.getElementById('draw-tool-eraser')?.classList.remove('bg-slate-800', 'text-white');
    }
  };

  document.getElementById('draw-tool-brush')?.addEventListener('click', () => setTool('brush'));
  document.getElementById('draw-tool-bucket')?.addEventListener('click', () => setTool('bucket'));
  document.getElementById('draw-tool-eraser')?.addEventListener('click', () => setTool('eraser'));

  // Nút Hoàn tác (Undo)
  document.getElementById('draw-undo-btn')?.addEventListener('click', () => {
    if (undoStack.length > 0) {
      const prev = undoStack.pop();
      drawingCtx.putImageData(prev, 0, 0);
      showToast('↩️ Đã hoàn tác nét vẽ!');
    } else {
      showToast('Chưa có nét vẽ để hoàn tác!');
    }
  });

  // Chọn màu vẽ (16 màu)
  document.querySelectorAll('.draw-color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (drawTool === 'eraser') setTool('brush');
      drawColor = btn.dataset.color;
      document.querySelectorAll('.draw-color-btn').forEach(b => b.classList.remove('ring-4', 'ring-yellow-400'));
      btn.classList.add('ring-4', 'ring-yellow-400');
    });
  });

  // Màu tự chọn từ color picker
  const customColorInput = document.getElementById('draw-custom-color');
  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      if (drawTool === 'eraser') setTool('brush');
      drawColor = e.target.value;
      document.querySelectorAll('.draw-color-btn').forEach(b => b.classList.remove('ring-4', 'ring-yellow-400'));
    });
  }

  // Presets cỡ nét cọ (3, 8, 16, 28)
  document.querySelectorAll('.draw-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sz = parseInt(btn.dataset.size) || 8;
      drawSize = sz;
      const brushSizeSlider = document.getElementById('draw-brush-size');
      if (brushSizeSlider) brushSizeSlider.value = sz;
      document.querySelectorAll('.draw-size-btn').forEach(b => {
        b.classList.remove('ring-1', 'ring-yellow-400', 'text-yellow-400');
        b.classList.add('text-slate-300');
      });
      btn.classList.add('ring-1', 'ring-yellow-400', 'text-yellow-400');
      btn.classList.remove('text-slate-300');
    });
  });

  // Slider chỉnh kích thước cọ
  const brushSizeInput = document.getElementById('draw-brush-size');
  if (brushSizeInput) {
    brushSizeInput.addEventListener('input', (e) => {
      drawSize = parseInt(e.target.value) || 8;
      document.querySelectorAll('.draw-size-btn').forEach(b => {
        const matches = parseInt(b.dataset.size) === drawSize;
        b.classList.toggle('ring-1', matches);
        b.classList.toggle('ring-yellow-400', matches);
        b.classList.toggle('text-yellow-400', matches);
      });
    });
  }

  // Xóa trắng toàn bộ
  const clearBtn = document.getElementById('draw-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pushUndoSnapshot();
      drawingCtx.fillStyle = '#ffffff';
      drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      showToast('🗑️ Đã xóa sạch trang vẽ!');
    });
  }

  // Nộp bài vẽ
  const submitBtn = document.getElementById('draw-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const dataUrl = drawingCanvas.toDataURL('image/png', 0.8);
      socket.emit('submit_drawing', { drawingData: dataUrl });
      submitBtn.disabled = true;
      submitBtn.innerText = 'ĐÃ NỘP BÀI ✅';
      showToast('Đã nộp bài vẽ cho giám thị!');
      if (window.audioMgr) window.audioMgr.playHeartChime();
    });
  }
}

// --- CẬP NHẬT GIAO DIỆN THEO TRẠNG THÁI PHÒNG ---
function updateUIWithRoomState(room) {
  // Đồng bộ người chơi vào 3D
  if (scene3d) {
    scene3d.setIsLobby(room.state === 'LOBBY');
    scene3d.syncPlayers(room.players);
  }

  // Cập nhật Bảng Đen 3D
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  if (scene3d) {
    scene3d.updateBlackboard(sorted, `VÒNG THI SỐ ${room.round}`);
  }

  // Nút Bắt Đầu dành cho Host
  const hostBtn = document.getElementById('host-start-btn');
  if (hostBtn) {
    if (isHost && room.state === 'LOBBY') {
      hostBtn.classList.remove('hidden');
    } else {
      hostBtn.classList.add('hidden');
    }
  }

  // Mã phòng trên Header
  const roomCodeHeader = document.getElementById('header-room-code');
  if (roomCodeHeader) {
    roomCodeHeader.innerText = room.code;
  }

  // Danh sách sĩ tử trong lớp (Modal hoặc Drawer)
  renderPlayerList(room.players);

  // Cập nhật màn hình tương ứng với State
  hideAllPhaseOverlays();

  switch (room.state) {
    case 'LOBBY':
      document.getElementById('lobby-overlay')?.classList.remove('hidden');
      if (scene3d) {
        scene3d.setIsLobby(true);
        scene3d.setCameraMode('OVERVIEW');
        const myChar = scene3d.characters.get(myPlayerId);
        if (myChar) scene3d.checkSeatInteraction(myChar);
      }
      break;

    case 'VOTING':
      document.getElementById('voting-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('OVERVIEW');
      break;

    case 'DRAWING_PROMPT_INPUT':
      document.getElementById('drawing-prompt-input-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('OVERVIEW');
      break;

    case 'DRAWING_TIME':
      document.getElementById('drawing-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('STUDENT', myPlayerId);
      break;

    case 'DRAWING_REVIEW':
      document.getElementById('review-overlay')?.classList.remove('hidden');
      renderDrawingReview(room.reviewDrawing);
      if (scene3d) scene3d.setCameraMode('BLACKBOARD');
      break;

    case 'SPIN_QA_SETUP':
      document.getElementById('spinqa-setup-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('OVERVIEW');
      break;

    case 'SPIN_QA_ANSWERING':
      document.getElementById('spinqa-answer-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('STUDENT', myPlayerId);
      break;

    case 'SPIN_QA_REVIEW':
      document.getElementById('spinqa-review-overlay')?.classList.remove('hidden');
      renderSpinQAReview(room.spinQA?.currentReview);
      if (scene3d) scene3d.setCameraMode('BLACKBOARD');
      break;

    case 'WORD_CHAIN':
      document.getElementById('wordchain-overlay')?.classList.remove('hidden');
      if (room.wordChain) {
        updateWordChainUI(room.wordChain);
      }
      break;

    case 'ROUND_SUMMARY':
      document.getElementById('summary-overlay')?.classList.remove('hidden');
      renderSummaryUI(room.round, sorted);
      if (scene3d) scene3d.setCameraMode('BLACKBOARD');
      break;
  }

  // Cập nhật ẩn/hiện điều khiển joystick / pc hint theo trạng thái phòng (Yêu cầu 2.9)
  applyDeviceControlsVisibility();
}

function hideAllPhaseOverlays() {
  const ids = [
    'lobby-overlay', 'voting-overlay', 'drawing-prompt-input-overlay',
    'drawing-overlay', 'review-overlay', 'spinqa-setup-overlay',
    'spinqa-answer-overlay', 'spinqa-review-overlay',
    'wordchain-overlay', 'summary-overlay'
  ];
  ids.forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  // YÊU CẦU 2.6: Ẩn nút tương tác cảm ứng di động và cửa sổ nổi khi vào các giai đoạn chọn bài thi & thi đấu
  document.getElementById('btn-touch-interact')?.classList.add('hidden');
  document.getElementById('interaction-prompt')?.classList.add('hidden');
  applyDeviceControlsVisibility();
}

function renderPlayerList(players) {
  const container = document.getElementById('lobby-player-list');
  if (!container) return;

  container.innerHTML = players.map(p => `
    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700">
      <div class="flex items-center space-x-2">
        <span class="w-4 h-4 rounded-full border border-white/50" style="background-color: ${p.color}"></span>
        <span class="font-bold text-white text-sm">${p.name}</span>
      </div>
      <span class="text-xs bg-slate-700 text-yellow-300 px-2 py-0.5 rounded font-mono">${p.score}đ</span>
    </div>
  `).join('');

  const countBadge = document.getElementById('player-count-badge');
  if (countBadge) countBadge.innerText = `${players.length}/12`;
  const countChip = document.getElementById('lobby-count-chip');
  if (countChip) countChip.innerText = `${players.length}/12`;
}

function updateVoteUI(votes) {
  const drawVotes = votes.DRAWING || 0;
  const wordVotes = votes.WORD_CHAIN || 0;
  const spinVotes = votes.SPIN_QA || 0;
  const total = Math.max(1, drawVotes + wordVotes + spinVotes);

  const drawBar = document.getElementById('vote-bar-drawing');
  const wordBar = document.getElementById('vote-bar-wordchain');
  const spinBar = document.getElementById('vote-bar-spinqa');
  const drawCount = document.getElementById('vote-count-drawing');
  const wordCount = document.getElementById('vote-count-wordchain');
  const spinCount = document.getElementById('vote-count-spinqa');

  if (drawBar) drawBar.style.width = `${(drawVotes / total) * 100}%`;
  if (wordBar) wordBar.style.width = `${(wordVotes / total) * 100}%`;
  if (spinBar) spinBar.style.width = `${(spinVotes / total) * 100}%`;

  if (drawCount) drawCount.innerText = `${drawVotes} phiếu`;
  if (wordCount) wordCount.innerText = `${wordVotes} phiếu`;
  if (spinCount) spinCount.innerText = `${spinVotes} phiếu`;
}

function renderDrawingReview(reviewData) {
  if (!reviewData) return;

  const authorEl = document.getElementById('review-author-name');
  const promptDetailEl = document.getElementById('review-prompt-detail');
  const imgEl = document.getElementById('review-image-display');
  const botEl = document.getElementById('review-bot-drawing-text');
  const progressEl = document.getElementById('review-progress');

  if (authorEl) authorEl.innerText = reviewData.drawerName;
  if (promptDetailEl) {
    promptDetailEl.innerText = `Đề: "${reviewData.promptText}" (Ra đề: ${reviewData.promptAuthorName})`;
  }
  if (progressEl) progressEl.innerText = `Bài ${reviewData.currentIndex} / ${reviewData.total}`;

  if (botEl) botEl.classList.add('hidden');
  if (imgEl) {
    imgEl.classList.remove('hidden');
    imgEl.src = reviewData.drawingData || '';
  }

  // Ẩn nút tự chấm mình
  const ratingControls = document.getElementById('review-rating-controls');
  if (ratingControls) {
    ratingControls.style.display = (reviewData.drawerId === myPlayerId) ? 'none' : 'flex';
  }
}

function setupSpinQAInitialUI(askerId, askerName, persona, timer) {
  const isMeAsker = askerId === myPlayerId;
  const askerBox = document.getElementById('spinqa-asker-setup-box');
  const respBox = document.getElementById('spinqa-responder-setup-box');

  if (isMeAsker) {
    if (askerBox) askerBox.classList.remove('hidden');
    if (respBox) respBox.classList.add('hidden');

    const iconEl = document.getElementById('spinqa-persona-icon');
    const titleEl = document.getElementById('spinqa-persona-title');
    const descEl = document.getElementById('spinqa-persona-desc');
    const inputQ = document.getElementById('spinqa-asker-question-input');
    const btnSubmitQ = document.getElementById('btn-submit-spinqa-question');
    const statusMsg = document.getElementById('spinqa-asker-status-msg');

    if (iconEl) iconEl.innerText = persona.icon;
    if (titleEl) titleEl.innerText = persona.name;
    if (descEl) descEl.innerText = `"${persona.desc}"`;
    if (inputQ) { inputQ.value = ''; inputQ.disabled = false; }
    if (btnSubmitQ) { btnSubmitQ.disabled = false; btnSubmitQ.innerText = 'GỬI CÂU HỎI XOÁY 🎯'; }
    if (statusMsg) statusMsg.innerText = '';
  } else {
    if (askerBox) askerBox.classList.add('hidden');
    if (respBox) respBox.classList.remove('hidden');

    const inputKw = document.getElementById('spinqa-keyword-input');
    const btnSubmitKw = document.getElementById('btn-submit-spinqa-keyword');
    const statusMsg = document.getElementById('spinqa-responder-status-msg');

    if (inputKw) { inputKw.value = ''; inputKw.disabled = false; }
    if (btnSubmitKw) { btnSubmitKw.disabled = false; btnSubmitKw.innerText = 'GỬI TỪ KHÓA 🏷️'; }
    if (statusMsg) statusMsg.innerText = '';
  }
}

function setupSpinQAAnsweringUI(asker, question, keywords, timer) {
  const isMeAsker = asker.id === myPlayerId;
  const headerAskerBadge = document.getElementById('spinqa-header-asker-badge');
  const headerQuestion = document.getElementById('spinqa-header-question');
  const kwContainer = document.getElementById('spinqa-keywords-container');

  if (headerAskerBadge) {
    headerAskerBadge.innerText = `${asker.persona.icon} ${asker.persona.name}: ${asker.name}`;
  }
  if (headerQuestion) {
    headerQuestion.innerText = `"${question}"`;
  }

  const countBadge = document.getElementById('spinqa-keywords-count-badge');
  if (countBadge) {
    countBadge.innerText = `${(keywords || []).length} từ khóa`;
  }

  if (kwContainer) {
    kwContainer.innerHTML = (keywords || []).map(kw => `
      <span class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-900/80 to-indigo-900/80 text-yellow-300 font-extrabold text-xs sm:text-sm border border-purple-400/50 shadow-sm flex items-center space-x-1 break-words max-w-[220px]">
        <span class="text-amber-400">🏷️</span>
        <span>${kw}</span>
      </span>
    `).join('');
  }

  const respBox = document.getElementById('spinqa-responder-answer-box');
  const askerBox = document.getElementById('spinqa-asker-monitor-box');

  if (isMeAsker) {
    if (respBox) respBox.classList.add('hidden');
    if (askerBox) askerBox.classList.remove('hidden');

    const monitorList = document.getElementById('spinqa-monitor-list');
    if (monitorList && currentRoom?.players) {
      const otherPlayers = currentRoom.players.filter(p => p.id !== asker.id);
      monitorList.innerHTML = otherPlayers.map(p => `
        <div id="monitor-item-${p.id}" class="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs">
          <span class="text-white font-bold">${p.name}</span>
          <span class="text-amber-400 font-mono">Đang suy nghĩ... ⏳</span>
        </div>
      `).join('');
    }
  } else {
    if (respBox) respBox.classList.remove('hidden');
    if (askerBox) askerBox.classList.add('hidden');

    const ansInput = document.getElementById('spinqa-answer-input');
    const submitBtn = document.getElementById('btn-submit-spinqa-answer');
    const statusMsg = document.getElementById('spinqa-answer-status-msg');

    if (ansInput) { ansInput.value = ''; ansInput.disabled = false; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'NỘP CÂU ĐÁP 🎤'; }
    if (statusMsg) statusMsg.innerText = '';
  }
}

function renderSpinQAReview(reviewData) {
  if (!reviewData) return;

  const askerNameEl = document.getElementById('spinqa-review-asker-name');
  const questionEl = document.getElementById('spinqa-review-question-text');
  const countEl = document.getElementById('spinqa-review-keywords-count');
  const keywordsBox = document.getElementById('spinqa-review-keywords-box');
  const authorNameEl = document.getElementById('spinqa-review-author-name');
  const answerTextEl = document.getElementById('spinqa-review-answer-text');
  const progressEl = document.getElementById('spinqa-review-progress');

  if (askerNameEl) askerNameEl.innerText = `${reviewData.persona.icon} ${reviewData.persona.name}: ${reviewData.askerName}`;
  if (questionEl) questionEl.innerText = `"${reviewData.question}"`;
  if (progressEl) progressEl.innerText = `Câu ${reviewData.currentIndex} / ${reviewData.total}`;
  if (countEl) countEl.innerText = `(${(reviewData.keywords || []).length} từ)`;

  if (keywordsBox) {
    keywordsBox.innerHTML = (reviewData.keywords || []).map(kw => `
      <span class="px-2 py-0.5 rounded-lg bg-purple-900/70 text-purple-200 font-bold text-[10px] sm:text-[11px] border border-purple-400/40 break-words max-w-[180px]">
        🏷️ ${kw}
      </span>
    `).join('');
  }

  if (authorNameEl) authorNameEl.innerText = reviewData.responderName;
  if (answerTextEl) answerTextEl.innerText = `"${reviewData.answerText}"`;

  // Ẩn nút tự chấm nếu là câu đáp của mình
  const ratingControls = document.getElementById('spinqa-review-rating-controls');
  if (ratingControls) {
    ratingControls.style.display = (reviewData.responderId === myPlayerId) ? 'none' : 'flex';
  }
}

function handleSpinQAReaction(responderId, fromPlayerId, type, stars, voteScore) {
  if (type === 'tomato') {
    if (window.audioMgr) window.audioMgr.playTomatoSplat();
    showFloatingEffect('🍅', '1đ');
    spawnTomatoSplatScreen();
  } else if (type === 'heart') {
    if (window.audioMgr) window.audioMgr.playHeartChime();
    showFloatingEffect('❤️', '10đ');
  } else if (type === 'star') {
    const s = stars || 3;
    const pts = voteScore || (s * 2);
    if (window.audioMgr) window.audioMgr.playStarDing(s);
    showFloatingEffect('⭐'.repeat(s), `${pts}đ`);
  }
}

function handleDrawingReaction(authorId, fromPlayerId, type, stars, voteScore) {
  const fromP = currentRoom?.players?.find(p => p.id === fromPlayerId);
  const authorP = currentRoom?.players?.find(p => p.id === authorId);

  if (type === 'tomato') {
    if (window.audioMgr) window.audioMgr.playTomatoSplat();
    showFloatingEffect('🍅', '1đ');
    // Hiệu ứng giọt cà chua văng trên màn hình
    spawnTomatoSplatScreen();
  } else if (type === 'heart') {
    if (window.audioMgr) window.audioMgr.playHeartChime();
    showFloatingEffect('❤️', '10đ');
  } else if (type === 'star') {
    const s = stars || 3;
    const pts = voteScore || (s * 2);
    if (window.audioMgr) window.audioMgr.playStarDing(s);
    showFloatingEffect('⭐'.repeat(s), `${pts}đ`);
  }
}

function spawnTomatoSplatScreen() {
  const splat = document.createElement('div');
  splat.className = 'fixed pointer-events-none z-50 text-5xl animate-bounce';
  splat.style.left = `${20 + Math.random() * 60}%`;
  splat.style.top = `${20 + Math.random() * 60}%`;
  splat.innerHTML = '🍅💥';
  document.body.appendChild(splat);
  setTimeout(() => splat.remove(), 1200);
}

function showFloatingEffect(icon, text) {
  const floater = document.createElement('div');
  floater.className = 'fixed pointer-events-none z-50 flex items-center space-x-1 font-bold text-xl px-3 py-1 bg-black/70 rounded-full text-yellow-300 shadow-xl';
  floater.style.left = '50%';
  floater.style.top = '40%';
  floater.style.transform = 'translate(-50%, -50%)';
  floater.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
  document.body.appendChild(floater);

  floater.animate([
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
    { opacity: 0, transform: 'translate(-50%, -120%) scale(1.5)' }
  ], { duration: 1000, easing: 'ease-out' });

  setTimeout(() => floater.remove(), 1000);
}

// --- XỬ LÝ NỐI TỪ (WORD CHAIN) ---
function updateWordChainUI(wc) {
  const currentWordEl = document.getElementById('wc-current-word');
  if (currentWordEl) currentWordEl.innerText = wc.currentWord.toUpperCase();

  const isMyTurn = wc.currentTurnPlayerId === myPlayerId;
  const inputContainer = document.getElementById('wc-input-container');
  const turnLabel = document.getElementById('wc-turn-label');

  if (inputContainer) {
    inputContainer.style.display = isMyTurn ? 'flex' : 'none';
  }

  // Tách tiếng cuối của từ hiện tại để hiển thị huy hiệu gợi ý (Yêu cầu 2.5)
  const syllables = (wc.currentWord || '').trim().split(/\s+/).filter(Boolean);
  const lastSyllable = syllables.length > 0 ? syllables[syllables.length - 1] : '';
  const prefixBadge = document.getElementById('wc-prefix-badge');
  if (prefixBadge) {
    prefixBadge.innerText = lastSyllable ? `${lastSyllable.toUpperCase()} +` : '... +';
  }
  const wordInput = document.getElementById('wc-word-input');
  if (wordInput && lastSyllable) {
    wordInput.placeholder = `Nhập từ nối tiếp (VD: ${lastSyllable} ... hoặc 1 từ)`;
  }

  const turnPlayer = currentRoom?.players?.find(p => p.id === wc.currentTurnPlayerId);
  if (turnLabel) {
    turnLabel.innerText = isMyTurn ? '👉 LƯỢT CỦA BẠN! HÃY NỐI TỪ NHANH LÊN!' : `Đang đợi: ${turnPlayer ? turnPlayer.name : '...'}`;
    turnLabel.className = isMyTurn ? 'text-lg font-black text-yellow-300 animate-pulse' : 'text-sm font-semibold text-slate-300';
  }

  // Camera tập trung vào người đang tới lượt
  if (scene3d) {
    scene3d.setCameraMode('STUDENT', wc.currentTurnPlayerId);
  }

  // Render lịch sử nối từ
  const historyContainer = document.getElementById('wc-history-list');
  if (historyContainer && wc.history) {
    historyContainer.innerHTML = wc.history.map(item => `
      <div class="px-2 py-1 rounded bg-slate-800/70 border border-slate-700 text-xs">
        <span class="text-sky-300 font-bold">${item.player}:</span>
        <span class="text-yellow-300 font-mono font-bold">${item.word}</span>
      </div>
    `).join('');
    historyContainer.scrollTop = historyContainer.scrollHeight;
  }
}

function handleWordTurnStart(playerId, playerName, currentWord, turnTimeLeft) {
  const isMyTurn = playerId === myPlayerId;
  if (isMyTurn) {
    if (window.audioMgr) window.audioMgr.playSchoolBell();
    const input = document.getElementById('wc-word-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  if (currentWord) {
    const currentWordEl = document.getElementById('wc-current-word');
    if (currentWordEl) currentWordEl.innerText = currentWord.toUpperCase();
    const syllables = currentWord.trim().split(/\s+/).filter(Boolean);
    const lastSyllable = syllables.length > 0 ? syllables[syllables.length - 1] : '';
    const prefixBadge = document.getElementById('wc-prefix-badge');
    if (prefixBadge) {
      prefixBadge.innerText = lastSyllable ? `${lastSyllable.toUpperCase()} +` : '... +';
    }
    const wordInput = document.getElementById('wc-word-input');
    if (wordInput && lastSyllable) {
      wordInput.placeholder = `Nhập từ nối tiếp (VD: ${lastSyllable} ... hoặc 1 từ)`;
    }
  }

  updateTurnTimer(turnTimeLeft);
}

function updateTurnTimer(timeLeft) {
  const timerBar = document.getElementById('wc-turn-timer-bar');
  const timerText = document.getElementById('wc-turn-timer-text');
  if (!timerBar) return;

  const pct = Math.max(0, Math.min(100, (timeLeft / 15) * 100));
  timerBar.style.width = `${pct}%`;
  if (timerText) timerText.innerText = `${timeLeft}s`;

  if (timeLeft <= 4) {
    timerBar.classList.remove('bg-emerald-500');
    timerBar.classList.add('bg-rose-500');
  } else {
    timerBar.classList.remove('bg-rose-500');
    timerBar.classList.add('bg-emerald-500');
  }
}

function handleWordValid(playerId, playerName, word, scoreAdded, newScore) {
  if (window.audioMgr) window.audioMgr.playStarDing(2);
  showToast(`✨ ${playerName} nối từ thành công: "${word.toUpperCase()}"!`);

  const char = scene3d.characters.get(playerId);
  if (char) {
    char.showEmoji('💡', 2.0);
    char.setAnimation('cheer');
    setTimeout(() => char.setAnimation('idle'), 1500);
  }

  // Xóa thông báo lỗi
  const errEl = document.getElementById('wc-error-msg');
  if (errEl) errEl.innerText = '';
}

function showWordError(reason) {
  const errEl = document.getElementById('wc-error-msg');
  if (errEl) {
    errEl.innerText = reason;
    errEl.classList.add('shake-anim');
    setTimeout(() => errEl.classList.remove('shake-anim'), 500);
  }
}

// --- TỔNG KẾT VÒNG (ROUND SUMMARY) ---
function handleRoundSummary(round, leaderboard) {
  const overlay = document.getElementById('summary-overlay');
  if (overlay) overlay.classList.remove('hidden');
  renderSummaryUI(round, leaderboard);
  if (scene3d) {
    scene3d.setCameraMode('BLACKBOARD');
    scene3d.updateBlackboard(leaderboard, `KẾT QUẢ BÀI THI`, 'Điểm số bài thi vừa rồi (1 - 10đ)');
  }
}

function resetExamClientState() {
  // 1. Reset vẽ tranh 2.0
  if (drawingCtx && drawingCanvas) {
    drawingCtx.fillStyle = '#ffffff';
    drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  }
  const promptEl = document.getElementById('drawing-prompt-text');
  if (promptEl) promptEl.innerText = '';
  const promptAuthorDesktop = document.getElementById('drawing-prompt-author-text');
  if (promptAuthorDesktop) promptAuthorDesktop.innerText = '';
  const promptAuthorMobile = document.getElementById('drawing-prompt-author-mobile');
  if (promptAuthorMobile) promptAuthorMobile.innerText = '';
  const imgEl = document.getElementById('review-image-display');
  if (imgEl) imgEl.src = '';
  const botEl = document.getElementById('review-bot-drawing-text');
  if (botEl) {
    botEl.innerText = '';
    botEl.classList.add('hidden');
  }

  // Reset nút nộp bài thi vẽ
  const submitBtn = document.getElementById('draw-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = 'NỘP BÀI 📝';
  }
  const promptInput = document.getElementById('input-drawing-prompt');
  if (promptInput) { promptInput.value = ''; promptInput.disabled = false; }
  const btnSubmitPrompt = document.getElementById('btn-submit-drawing-prompt');
  if (btnSubmitPrompt) { btnSubmitPrompt.disabled = false; btnSubmitPrompt.innerText = 'GỬI ĐỀ VẼ 🚀'; }

  // 2. Reset bình chọn (3 môn)
  const drawBar = document.getElementById('vote-bar-drawing');
  const wordBar = document.getElementById('vote-bar-wordchain');
  const spinBar = document.getElementById('vote-bar-spinqa');
  const drawCount = document.getElementById('vote-count-drawing');
  const wordCount = document.getElementById('vote-count-wordchain');
  const spinCount = document.getElementById('vote-count-spinqa');

  if (drawBar) drawBar.style.width = '0%';
  if (wordBar) wordBar.style.width = '0%';
  if (spinBar) spinBar.style.width = '0%';
  if (drawCount) drawCount.innerText = '0 phiếu';
  if (wordCount) wordCount.innerText = '0 phiếu';
  if (spinCount) spinCount.innerText = '0 phiếu';

  ['btn-vote-drawing', 'btn-vote-wordchain', 'btn-vote-spinqa'].forEach(id => {
    document.getElementById(id)?.classList.remove('ring-4', 'ring-yellow-400');
  });

  // 3. Reset nối từ
  const wcInput = document.getElementById('wc-word-input');
  if (wcInput) wcInput.value = '';
  const wcBadge = document.getElementById('wc-prefix-badge');
  if (wcBadge) wcBadge.innerText = '... +';
  const wcHistory = document.getElementById('wc-history-list');
  if (wcHistory) wcHistory.innerHTML = '';
  const wcErr = document.getElementById('wc-error-msg');
  if (wcErr) wcErr.innerText = '';

  // 4. Reset Hỏi Xoáy Đáp Xoay
  const qInput = document.getElementById('spinqa-asker-question-input');
  if (qInput) { qInput.value = ''; qInput.disabled = false; }
  const kwInput = document.getElementById('spinqa-keyword-input');
  if (kwInput) { kwInput.value = ''; kwInput.disabled = false; }
  const ansInput = document.getElementById('spinqa-answer-input');
  if (ansInput) { ansInput.value = ''; ansInput.disabled = false; }

  const btnQ = document.getElementById('btn-submit-spinqa-question');
  if (btnQ) { btnQ.disabled = false; btnQ.innerText = 'GỬI CÂU HỎI XOÁY 🎯'; }
  const btnKw = document.getElementById('btn-submit-spinqa-keyword');
  if (btnKw) { btnKw.disabled = false; btnKw.innerText = 'GỬI TỪ KHÓA 🏷️'; }
  const btnAns = document.getElementById('btn-submit-spinqa-answer');
  if (btnAns) { btnAns.disabled = false; btnAns.innerText = 'NỘP CÂU ĐÁP 🎤'; }

  document.getElementById('spinqa-asker-status-msg') && (document.getElementById('spinqa-asker-status-msg').innerText = '');
  document.getElementById('spinqa-responder-status-msg') && (document.getElementById('spinqa-responder-status-msg').innerText = '');
  document.getElementById('spinqa-answer-status-msg') && (document.getElementById('spinqa-answer-status-msg').innerText = '');

  // 5. Phục hồi toàn bộ nhân vật đứng hoặc ngồi dậy bình thường (Yêu cầu 2.5)
  if (scene3d) scene3d.resetAllKnockedOut();
}

function renderSummaryUI(round, leaderboard) {
  const listEl = document.getElementById('summary-leaderboard-list');
  if (!listEl) return;

  listEl.innerHTML = leaderboard.map((p, idx) => {
    let medal = `${idx + 1}`;
    let badgeClass = 'bg-slate-700 text-white';
    if (idx === 0) { medal = '🥇'; badgeClass = 'bg-yellow-500 text-black font-extrabold text-lg'; }
    if (idx === 1) { medal = '🥈'; badgeClass = 'bg-slate-300 text-black font-bold'; }
    if (idx === 2) { medal = '🥉'; badgeClass = 'bg-amber-700 text-white font-bold'; }

    const roundScore = p.roundScore !== undefined ? p.roundScore : p.score;
    const totalScore = p.totalScore !== undefined ? p.totalScore : p.score;

    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/90 border border-slate-600 shadow-md">
        <div class="flex items-center space-x-3">
          <span class="w-8 h-8 rounded-full flex items-center justify-center ${badgeClass}">${medal}</span>
          <div>
            <span class="font-bold text-white text-base block">${p.name}</span>
            <span class="text-[11px] text-slate-400">Tổng tích lũy: ${totalScore}đ</span>
          </div>
        </div>
        <span class="text-lg font-black text-yellow-400 font-mono">+${roundScore} Điểm</span>
      </div>
    `;
  }).join('');
}

// --- CÁC SỰ KIỆN GIAO DIỆN & TƯƠNG TÁC ---
function bindUIEvents() {
  // 1. Tạo phòng
  document.getElementById('btn-create-room')?.addEventListener('click', () => {
    window.audioMgr.init();
    const name = document.getElementById('input-player-name')?.value.trim() || 'Học Sinh Gương Mẫu';

    socket.emit('create_room', { playerName: name, characterModel: selectedSkinId, skinColor: selectedSkinColor, faceColor: selectedFaceColor, characterType: selectedSkinId }, (res) => {
      if (res.success) {
        addChatMessage('📢 HỆ THỐNG', `Tạo phòng thành công! Mã phòng: ${res.roomCode}`, false, 'system');
        document.getElementById('start-screen-modal')?.classList.add('hidden');
        document.getElementById('chat-and-emotes-wrapper')?.classList.remove('hidden');
        if (scene3d) scene3d.setMyPlayerId(myPlayerId);
        applyDeviceControlsVisibility();
      }
    });
  });

  // 2. Vào phòng
  document.getElementById('btn-join-room')?.addEventListener('click', () => {
    window.audioMgr.init();
    const code = document.getElementById('input-room-code')?.value.trim();
    const name = document.getElementById('input-player-name')?.value.trim() || 'Học Sinh Gương Mẫu';

    if (!code) {
      alert('Vui lòng nhập mã phòng (4 chữ cái)!');
      return;
    }

    socket.emit('join_room', { roomCode: code, playerName: name, characterModel: selectedSkinId, skinColor: selectedSkinColor, faceColor: selectedFaceColor, characterType: selectedSkinId }, (res) => {
      if (res.success) {
        addChatMessage('📢 HỆ THỐNG', `Đã vào phòng ${res.roomCode}!`, false, 'system');
        document.getElementById('start-screen-modal')?.classList.add('hidden');
        document.getElementById('chat-and-emotes-wrapper')?.classList.remove('hidden');
        if (scene3d) scene3d.setMyPlayerId(myPlayerId);
        applyDeviceControlsVisibility();
      } else {
        alert(res.message);
      }
    });
  });

  // 2B. Sao chép link mạng LAN / Wi-Fi máy chủ (Yêu cầu 1.8)
  document.getElementById('btn-copy-lan-url')?.addEventListener('click', () => {
    const lanUrlEl = document.getElementById('lan-server-url');
    const url = lanUrlEl?.href || lanUrlEl?.innerText;
    if (url && url !== '#' && !url.includes('Đang đọc')) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(`📋 Đã sao chép link PC máy chủ: ${url}`);
        }).catch(() => {
          showToast(`Link máy chủ: ${url}`);
        });
      } else {
        showToast(`Link máy chủ: ${url}`);
      }
      if (window.audioMgr) window.audioMgr.playClick();
    }
  });

  // 2C. Sao chép link Online toàn cầu (Cloudflare Tunnel)
  document.getElementById('btn-copy-online-url')?.addEventListener('click', () => {
    const onlineUrlEl = document.getElementById('online-server-url');
    const url = onlineUrlEl?.href || onlineUrlEl?.innerText;
    if (url && url !== '#' && !url.includes('Đang kết nối')) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(`📋 Đã sao chép link chơi Online: ${url}`);
        }).catch(() => {
          showToast(`Link Online: ${url}`);
        });
      } else {
        showToast(`Link Online: ${url}`);
      }
      if (window.audioMgr) window.audioMgr.playClick();
    }
  });

  // 3. Nút Bắt Đầu (Host mở Modal)
  document.getElementById('host-start-btn')?.addEventListener('click', () => {
    document.getElementById('host-control-modal')?.classList.remove('hidden');
    if (window.audioMgr) window.audioMgr.playClick();
  });

  document.getElementById('btn-close-host-modal')?.addEventListener('click', () => {
    document.getElementById('host-control-modal')?.classList.add('hidden');
  });

  // 4. Host kích hoạt bắt đầu thi
  document.getElementById('btn-trigger-start')?.addEventListener('click', () => {
    socket.emit('start_game', (res) => {
      if (res.success) {
        document.getElementById('host-control-modal')?.classList.add('hidden');
        if (window.audioMgr) window.audioMgr.playSchoolDrum(4);
      } else {
        alert(res.message);
      }
    });
  });

  // 5. Bình chọn môn thi (3 môn)
  document.getElementById('btn-vote-drawing')?.addEventListener('click', () => {
    socket.emit('cast_vote', { choice: 'DRAWING' });
    highlightVoteSelection('btn-vote-drawing');
    if (window.audioMgr) window.audioMgr.playClick();
  });

  document.getElementById('btn-vote-wordchain')?.addEventListener('click', () => {
    socket.emit('cast_vote', { choice: 'WORD_CHAIN' });
    highlightVoteSelection('btn-vote-wordchain');
    if (window.audioMgr) window.audioMgr.playClick();
  });

  document.getElementById('btn-vote-spinqa')?.addEventListener('click', () => {
    socket.emit('cast_vote', { choice: 'SPIN_QA' });
    highlightVoteSelection('btn-vote-spinqa');
    if (window.audioMgr) window.audioMgr.playClick();
  });

  // 6. Gửi đề bài vẽ 2.0 (30s)
  document.getElementById('btn-submit-drawing-prompt')?.addEventListener('click', () => {
    const promptInput = document.getElementById('input-drawing-prompt');
    const text = promptInput?.value.trim();
    if (text) {
      socket.emit('submit_drawing_prompt', { promptText: text });
      if (window.audioMgr) window.audioMgr.playClick();
    } else {
      showToast('Vui lòng nhập nội dung đề bài vẽ!');
    }
  });

  // 7. Chấm điểm bài vẽ (Sao, Cà chua, Tim)
  document.querySelectorAll('.btn-rate-star').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stars = parseInt(btn.dataset.stars) || 3;
      socket.emit('rate_drawing', { type: 'star', stars });
    });
  });

  document.getElementById('btn-rate-tomato')?.addEventListener('click', () => {
    socket.emit('rate_drawing', { type: 'tomato' });
  });

  document.getElementById('btn-rate-heart')?.addEventListener('click', () => {
    socket.emit('rate_drawing', { type: 'heart' });
  });

  // 8. HỎI XOÁY ĐÁP XOAY: Các sự kiện gửi câu hỏi, từ khóa, câu đáp & chấm điểm
  document.getElementById('btn-submit-spinqa-question')?.addEventListener('click', () => {
    const qInput = document.getElementById('spinqa-asker-question-input');
    const text = qInput?.value.trim();
    if (text) {
      socket.emit('submit_spinqa_question', { question: text });
      if (window.audioMgr) window.audioMgr.playClick();
    } else {
      showToast('Vui lòng nhập câu hỏi hiểm hóc!');
    }
  });

  document.getElementById('btn-submit-spinqa-keyword')?.addEventListener('click', () => {
    const kwInput = document.getElementById('spinqa-keyword-input');
    const text = kwInput?.value.trim();
    if (text) {
      socket.emit('submit_spinqa_keyword', { keyword: text });
      if (window.audioMgr) window.audioMgr.playClick();
    } else {
      showToast('Vui lòng nhập từ khóa oái oăm!');
    }
  });

  document.getElementById('btn-submit-spinqa-answer')?.addEventListener('click', () => {
    const ansInput = document.getElementById('spinqa-answer-input');
    const text = ansInput?.value.trim();
    if (text) {
      socket.emit('submit_spinqa_answer', { answerText: text });
      const submitBtn = document.getElementById('btn-submit-spinqa-answer');
      const statusMsg = document.getElementById('spinqa-answer-status-msg');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'ĐÃ NỘP CÂU ĐÁP ✅'; }
      if (statusMsg) statusMsg.innerText = '✅ Đã nộp câu đáp cho giám thị!';
      if (window.audioMgr) window.audioMgr.playHeartChime();
    } else {
      showToast('Vui lòng viết câu trả lời đáp xoay!');
    }
  });

  // Chấm điểm câu đáp Hỏi Xoáy Đáp Xoay
  document.querySelectorAll('.btn-spinqa-star').forEach(btn => {
    btn.addEventListener('click', () => {
      const stars = parseInt(btn.dataset.stars) || 3;
      socket.emit('rate_spinqa_answer', { type: 'star', stars });
    });
  });

  document.getElementById('btn-spinqa-tomato')?.addEventListener('click', () => {
    socket.emit('rate_spinqa_answer', { type: 'tomato' });
  });

  document.getElementById('btn-spinqa-heart')?.addEventListener('click', () => {
    socket.emit('rate_spinqa_answer', { type: 'heart' });
  });

  // 8. Nộp từ Nối từ
  const wcSubmit = () => {
    const input = document.getElementById('wc-word-input');
    const word = input?.value.trim();
    if (word) {
      socket.emit('submit_word', { word: word });
      input.value = '';
    }
  };

  document.getElementById('wc-submit-btn')?.addEventListener('click', wcSubmit);
  document.getElementById('wc-word-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') wcSubmit();
  });

  // 9. Nút Biểu Cảm (Reactions)
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      socket.emit('send_reaction', { emoji: emoji });
      if (window.audioMgr) window.audioMgr.playClick();
    });
  });

  // 10. Ném Bút / Phao
  document.getElementById('btn-open-throw-modal')?.addEventListener('click', () => {
    openThrowModal();
  });

  document.getElementById('btn-close-throw-modal')?.addEventListener('click', () => {
    document.getElementById('throw-modal')?.classList.add('hidden');
  });

  // 11. Chat học đường & Thu gọn/Mở rộng khung Chat
  const chatCollapsible = document.getElementById('chat-container-collapsible');
  const btnToggleChat = document.getElementById('btn-toggle-chat-open');
  const btnCollapseChat = document.getElementById('btn-collapse-chat');
  const unreadBadge = document.getElementById('chat-unread-badge');

  const toggleChatUI = () => {
    if (!chatCollapsible) return;
    const isHidden = chatCollapsible.classList.toggle('hidden');
    if (!isHidden && unreadBadge) {
      unreadBadge.classList.add('hidden');
    }
    if (window.audioMgr) window.audioMgr.playClick();
  };

  btnToggleChat?.addEventListener('click', toggleChatUI);
  btnCollapseChat?.addEventListener('click', toggleChatUI);

  // Thu gọn / Mở rộng Danh sách lớp học
  const lobbyToggle = document.getElementById('lobby-header-toggle');
  const lobbyListContainer = document.getElementById('lobby-player-list-container');
  const lobbyArrowIcon = document.getElementById('lobby-arrow-icon');
  if (lobbyToggle && lobbyListContainer) {
    lobbyToggle.addEventListener('click', () => {
      const isHidden = lobbyListContainer.classList.toggle('hidden');
      if (lobbyArrowIcon) lobbyArrowIcon.innerText = isHidden ? '▴' : '▾';
      if (window.audioMgr) window.audioMgr.playClick();
    });
  }

  // Trên Mobile (<640px), tự động thu gọn chat và danh sách lớp để không che khuất màn hình 3D
  if (window.innerWidth < 640) {
    chatCollapsible?.classList.add('hidden');
    lobbyListContainer?.classList.add('hidden');
    if (lobbyArrowIcon) lobbyArrowIcon.innerText = '▴';
  }

  const sendChat = () => {
    const input = document.getElementById('chat-input-text');
    const msg = input?.value.trim();
    if (msg) {
      if (activeChatTab !== 'messages') {
        switchChatTab('messages');
      }
      socket.emit('send_chat', { message: msg });
      input.value = '';
    }
  };

  document.getElementById('btn-send-chat')?.addEventListener('click', sendChat);
  document.getElementById('chat-input-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // Sự kiện chuyển tab phân loại chat (Trò chuyện & Hệ thống - Yêu cầu 2.7)
  document.getElementById('chat-tab-messages')?.addEventListener('click', () => switchChatTab('messages'));
  document.getElementById('chat-tab-system')?.addEventListener('click', () => switchChatTab('system'));

  // 12. Cài Đặt (Settings Modal)
  const settingsModal = document.getElementById('settings-modal');
  const settingsNameInput = document.getElementById('settings-player-name');
  const soundIcon = document.getElementById('settings-sound-icon');
  const soundText = document.getElementById('settings-sound-text');

  document.getElementById('btn-toggle-settings')?.addEventListener('click', () => {
    if (!settingsModal) return;
    const me = currentRoom?.players?.find(p => p.id === myPlayerId);
    if (me && settingsNameInput) {
      settingsNameInput.value = me.name;
    }
    // Cập nhật skin hiện tại của bản thân trong Settings
    if (me) {
      if (me.characterModel) selectedSkinId = me.characterModel;
      else if (me.characterType) selectedSkinId = me.characterType;
      if (me.skinColor) selectedSkinColor = me.skinColor;
    }
    const curSkin = getSkinById(selectedSkinId);
    const settingsBadge = document.getElementById('settings-preview-skin-badge');
    if (settingsBadge && curSkin) {
      settingsBadge.innerText = `${curSkin.icon} ${curSkin.name}`;
    }
    // Cập nhật trạng thái âm thanh
    if (soundIcon && soundText) {
      const isMuted = window.audioMgr.muted;
      soundIcon.innerText = isMuted ? '🔇' : '🔊';
      soundText.innerText = isMuted ? 'Âm thanh: ĐÃ TẮT' : 'Âm thanh: ĐANG BẬT';
    }
    settingsModal.classList.remove('hidden');
    if (window.audioMgr) window.audioMgr.playClick();
  });

  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    settingsModal?.classList.add('hidden');
  });

  // Đổi tên từ cài đặt
  document.getElementById('btn-save-settings-name')?.addEventListener('click', () => {
    const newName = settingsNameInput?.value.trim();
    if (newName) {
      socket.emit('update_customization', { name: newName });
      showToast(`Đã đổi tên thành: "${newName}"!`);
      settingsModal?.classList.add('hidden');
    }
  });

  // Bật/tắt âm thanh từ cài đặt
  document.getElementById('settings-sound-toggle-btn')?.addEventListener('click', () => {
    const isMuted = window.audioMgr.toggleMute();
    if (soundIcon && soundText) {
      soundIcon.innerText = isMuted ? '🔇' : '🔊';
      soundText.innerText = isMuted ? 'Âm thanh: ĐÃ TẮT' : 'Âm thanh: ĐANG BẬT';
    }
    showToast(isMuted ? 'Đã tắt âm thanh 🔇' : 'Đã bật âm thanh 🔊');
  });

  // Rời phòng thi
  document.getElementById('btn-leave-room')?.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn rời khỏi phòng thi?')) {
      if (socket) socket.disconnect();
      window.location.reload();
    }
  });

  // 13. Nút Đổi Góc Nhìn Camera (Camera Presets Cycler)
  document.getElementById('btn-cycle-camera')?.addEventListener('click', () => {
    if (scene3d) {
      scene3d.cycleCameraView(myPlayerId);
      if (window.audioMgr) window.audioMgr.playClick();
    }
  });

  // 14. Chạm bất kì đâu để đóng bảng tổng kết ngay (Yêu cầu 1.4)
  const summaryOverlay = document.getElementById('summary-overlay');
  if (summaryOverlay) {
    summaryOverlay.addEventListener('click', () => {
      summaryOverlay.classList.add('hidden');
      socket.emit('dismiss_summary');
      resetExamClientState();
      document.getElementById('lobby-overlay')?.classList.remove('hidden');
      if (scene3d) scene3d.setCameraMode('OVERVIEW');
      if (window.audioMgr) window.audioMgr.playClick();
    });
  }
}

// --- HỆ THỐNG CHỌN NHÂN VẬT & MÀU DA 3D 2.1 (YÊU CẦU 2.1) ---
function getSkinById(id) {
  if (!window.CHARACTER_SKINS || !window.CHARACTER_SKINS.length) return null;
  return window.CHARACTER_SKINS.find(s => s.id === id) || window.CHARACTER_SKINS[0];
}

function getSkinToneByColor(hex) {
  if (!window.SKIN_TONE_PALETTE || !window.SKIN_TONE_PALETTE.length) {
    return { name: 'Vàng Châu Á', color: hex || '#f2c190' };
  }
  const target = (hex || '').toLowerCase();
  const found = window.SKIN_TONE_PALETTE.find(t => (t.color || t.hex || '').toLowerCase() === target);
  return found || window.SKIN_TONE_PALETTE[1] || { name: 'Vàng Châu Á', color: '#f2c190' };
}

function updateStartPreviewBadges() {
  const dot = document.getElementById('start-preview-color-dot');
  if (dot) {
    dot.style.backgroundColor = selectedSkinColor;
    const tone = getSkinToneByColor(selectedSkinColor);
    dot.title = `Màu da: ${tone.name}`;
  }
}

function initCharacterSystem() {
  // 1. Khởi tạo 3D Preview ở Start Screen (bọc try-catch an toàn, không tự xoay vòng)
  try {
    const startPreviewEl = document.getElementById('start-screen-3d-preview');
    if (startPreviewEl && window.CharacterPreviewViewer) {
      startPreviewViewer = new CharacterPreviewViewer('start-screen-3d-preview', {
        autoRotate: false,
        interactive: true,
        cameraDist: 2.25,
        cameraY: 0.92,
        lookAtY: 0.72
      });
      startPreviewViewer.setCharacter(selectedSkinId, selectedSkinColor, selectedFaceColor);
    }
  } catch (err) {
    console.warn('Lỗi khi khởi tạo Start 3D Preview:', err);
  }
  updateStartPreviewBadges();

  // 2. Logic cho Menu Đặc Biệt (Wardrobe Modal)
  const wardrobeModal = document.getElementById('wardrobe-modal');
  const btnOpenWardrobe = document.getElementById('btn-open-wardrobe-modal');
  const btnSettingsOpenWardrobe = document.getElementById('btn-settings-open-wardrobe');
  const btnWardrobeCloseX = document.getElementById('btn-wardrobe-close-x');
  const btnWardrobeCancel = document.getElementById('btn-wardrobe-cancel');
  const btnWardrobeSave = document.getElementById('btn-wardrobe-save');

  const wardrobePaletteEl = document.getElementById('wardrobe-skin-tones-palette');
  const wardrobeGridEl = document.getElementById('wardrobe-skins-grid');

  // Cập nhật trạng thái nút chọn màu mắt & lông mày (Yêu cầu 2.9)
  const updateFaceColorButtonsUI = (color) => {
    const btnBlack = document.getElementById('btn-face-color-black');
    const btnWhite = document.getElementById('btn-face-color-white');
    const isBlack = (color || '#111111').toLowerCase() === '#111111';
    if (btnBlack) {
      btnBlack.className = `btn-face-color flex-1 py-1.5 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ${
        isBlack ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400 shadow-md' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
      }`;
    }
    if (btnWhite) {
      btnWhite.className = `btn-face-color flex-1 py-1.5 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ${
        !isBlack ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400 shadow-md' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
      }`;
    }
  };

  document.getElementById('btn-face-color-black')?.addEventListener('click', () => {
    tempWardrobeFaceColor = '#111111';
    if (wardrobePreviewViewer) {
      wardrobePreviewViewer.setFaceColor(tempWardrobeFaceColor);
    }
    updateFaceColorButtonsUI(tempWardrobeFaceColor);
    if (window.audioMgr) window.audioMgr.playClick();
  });

  document.getElementById('btn-face-color-white')?.addEventListener('click', () => {
    tempWardrobeFaceColor = '#ffffff';
    if (wardrobePreviewViewer) {
      wardrobePreviewViewer.setFaceColor(tempWardrobeFaceColor);
    }
    updateFaceColorButtonsUI(tempWardrobeFaceColor);
    if (window.audioMgr) window.audioMgr.playClick();
  });

  // Render palette màu da (Yêu cầu 2.2: Bỏ hoàn toàn text mô tả, chỉ giữ các nút màu da)
  const renderWardrobePalette = () => {
    if (!wardrobePaletteEl || !window.SKIN_TONE_PALETTE) return;
    const currentHex = (tempWardrobeSkinColor || '').toLowerCase();

    wardrobePaletteEl.innerHTML = window.SKIN_TONE_PALETTE.map(tone => {
      const col = tone.color || tone.hex || '#f2c190';
      const isSelected = col.toLowerCase() === currentHex;
      return `
        <button type="button" 
                class="wardrobe-tone-btn flex items-center justify-center p-1.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                  isSelected 
                    ? 'border-yellow-400 bg-yellow-400/20 ring-2 ring-yellow-400 shadow-lg scale-110' 
                    : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                }"
                data-color="${col}" 
                title="${tone.name}">
          <span class="w-6 h-6 rounded-full border border-white/80 shadow-md" style="background-color: ${col};"></span>
        </button>
      `;
    }).join('');

    wardrobePaletteEl.querySelectorAll('.wardrobe-tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tempWardrobeSkinColor = btn.dataset.color;
        if (wardrobePreviewViewer) {
          wardrobePreviewViewer.setSkinColor(tempWardrobeSkinColor);
        }
        renderWardrobePalette();
        if (window.audioMgr) window.audioMgr.playClick();
      });
    });
  };

  let wardrobeSearchQuery = '';

  // Render lưới model nhân vật 3D (Yêu cầu 2.3 & 3.0: 4 hàng trọn vẹn, có icon + tên tiếng Việt, hỗ trợ tìm kiếm)
  const renderWardrobeGrid = () => {
    if (!wardrobeGridEl || !window.CHARACTER_SKINS) return;

    let skins = window.CHARACTER_SKINS;
    if (wardrobeSearchQuery) {
      skins = skins.filter(s => 
        (s.name && s.name.toLowerCase().includes(wardrobeSearchQuery)) || 
        (s.id && s.id.toLowerCase().includes(wardrobeSearchQuery))
      );
    }

    const countBadge = document.getElementById('wardrobe-count-badge');
    if (countBadge) {
      countBadge.innerText = `${skins.length} / 52`;
    }

    if (skins.length === 0) {
      wardrobeGridEl.innerHTML = `
        <div class="col-span-4 py-16 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center space-y-2">
          <span class="text-2xl">🔍</span>
          <span>Không tìm thấy nhân vật nào khớp với "${wardrobeSearchQuery}"</span>
        </div>
      `;
      return;
    }

    wardrobeGridEl.innerHTML = skins.map(skin => {
      const isSelected = skin.id === tempWardrobeSkinId;
      return `
        <button type="button" 
                class="wardrobe-skin-card p-1 sm:p-1.5 rounded-2xl border text-center transition flex flex-col items-center justify-between cursor-pointer group relative overflow-hidden h-28 sm:h-32 min-h-[110px] sm:min-h-[124px] ${
                  isSelected 
                    ? 'bg-amber-500/25 border-yellow-400 ring-2 ring-yellow-400 shadow-xl shadow-yellow-500/20 scale-105' 
                    : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:border-slate-700 hover:scale-105'
                }" 
                data-skin-id="${skin.id}" 
                title="${skin.name} (${skin.id})">
          <div class="flex-1 w-full min-h-0 flex items-center justify-center p-0.5 pointer-events-none">
            <img src="/images/characters/${skin.id}.png" 
                 alt="${skin.name}" 
                 loading="lazy" 
                 class="max-w-full max-h-full object-contain filter drop-shadow-md group-hover:scale-110 transition duration-200 pointer-events-none">
          </div>
          <span class="text-[9px] sm:text-[10px] font-bold text-slate-300 group-hover:text-yellow-300 truncate w-full block mt-0.5 pointer-events-none text-center leading-tight">
            ${skin.icon} ${skin.name}
          </span>
        </button>
      `;
    }).join('');

    wardrobeGridEl.querySelectorAll('.wardrobe-skin-card').forEach(card => {
      card.addEventListener('click', () => {
        tempWardrobeSkinId = card.dataset.skinId;
        if (wardrobePreviewViewer) {
          wardrobePreviewViewer.setCharacter(tempWardrobeSkinId, tempWardrobeSkinColor, tempWardrobeFaceColor);
          if (wardrobePreviewViewer.playGesture) {
            wardrobePreviewViewer.playGesture('Victory');
          }
        }
        renderWardrobeGrid();
        if (window.audioMgr) window.audioMgr.playClick();
      });
    });
  };

  // Ô tìm kiếm nhân vật nhanh trong phòng thay đồ (Yêu cầu 3.0)
  document.getElementById('wardrobe-search-input')?.addEventListener('input', (e) => {
    wardrobeSearchQuery = (e.target.value || '').trim().toLowerCase();
    renderWardrobeGrid();
  });

  const openWardrobe = () => {
    tempWardrobeSkinId = selectedSkinId;
    tempWardrobeSkinColor = selectedSkinColor;
    tempWardrobeFaceColor = selectedFaceColor;
    wardrobeSearchQuery = '';

    const searchInput = document.getElementById('wardrobe-search-input');
    if (searchInput) searchInput.value = '';

    if (wardrobeModal) {
      wardrobeModal.classList.remove('hidden');
    }

    try {
      if (!wardrobePreviewViewer && window.CharacterPreviewViewer) {
        wardrobePreviewViewer = new CharacterPreviewViewer('wardrobe-3d-viewport', {
          autoRotate: false,
          interactive: true,
          cameraDist: 2.2,
          cameraY: 0.92,
          lookAtY: 0.72
        });
      }

      if (wardrobePreviewViewer) {
        wardrobePreviewViewer.setCharacter(tempWardrobeSkinId, tempWardrobeSkinColor, tempWardrobeFaceColor);
        setTimeout(() => {
          if (wardrobePreviewViewer) wardrobePreviewViewer.resize();
        }, 50);
      }
    } catch (err) {
      console.warn('Lỗi khi mở Wardrobe Viewer:', err);
    }

    renderWardrobePalette();
    renderWardrobeGrid();
    updateFaceColorButtonsUI(tempWardrobeFaceColor);

    if (window.audioMgr) window.audioMgr.playClick();
  };

  const closeWardrobe = () => {
    if (wardrobeModal) {
      wardrobeModal.classList.add('hidden');
    }
    if (window.audioMgr) window.audioMgr.playClick();
  };

  // Nút mở Menu Đặc Biệt (Yêu cầu 2.2: Chỉ mở khi nhấn vào nút Chọn nhân vật, không mở khi chạm/kéo khung preview)
  btnOpenWardrobe?.addEventListener('click', openWardrobe);
  btnSettingsOpenWardrobe?.addEventListener('click', openWardrobe);

  btnWardrobeCloseX?.addEventListener('click', closeWardrobe);
  btnWardrobeCancel?.addEventListener('click', closeWardrobe);

  // NÚT LƯU LỰA CHỌN
  btnWardrobeSave?.addEventListener('click', () => {
    selectedSkinId = tempWardrobeSkinId;
    selectedSkinColor = tempWardrobeSkinColor;
    selectedFaceColor = tempWardrobeFaceColor;
    try {
      localStorage.setItem('hell_exam_face_color', selectedFaceColor);
    } catch (e) {}

    // Cập nhật preview ở start screen
    if (startPreviewViewer) {
      startPreviewViewer.setCharacter(selectedSkinId, selectedSkinColor, selectedFaceColor);
    }
    updateStartPreviewBadges();

    // Nếu đang trong phòng, đồng bộ realtime qua Socket.io
    if (socket && currentRoom) {
      socket.emit('update_customization', {
        characterModel: selectedSkinId,
        skinColor: selectedSkinColor,
        faceColor: selectedFaceColor,
        characterType: selectedSkinId
      });
      showToast('Đã đổi nhân vật thành công!');
    } else {
      showToast('Đã lưu nhân vật thành công!');
    }

    closeWardrobe();
    if (window.audioMgr) window.audioMgr.playHeartChime();
  });

  // Xử lý resize cửa sổ cho viewers
  window.addEventListener('resize', () => {
    if (startPreviewViewer) startPreviewViewer.resize();
    if (wardrobePreviewViewer && wardrobeModal && !wardrobeModal.classList.contains('hidden')) {
      wardrobePreviewViewer.resize();
    }
  });
}

function highlightVoteSelection(btnId) {
  ['btn-vote-drawing', 'btn-vote-wordchain', 'btn-vote-spinqa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === btnId) {
        el.classList.add('ring-4', 'ring-yellow-400');
      } else {
        el.classList.remove('ring-4', 'ring-yellow-400');
      }
    }
  });
}

function openThrowModal() {
  const modal = document.getElementById('throw-modal');
  const targetList = document.getElementById('throw-target-list');
  if (!modal || !targetList || !currentRoom) return;

  const otherPlayers = currentRoom.players.filter(p => p.id !== myPlayerId);
  if (otherPlayers.length === 0) {
    showToast('Chưa có bạn cùng lớp để ném!');
    return;
  }

  targetList.innerHTML = otherPlayers.map(p => `
    <button class="throw-action-btn flex items-center justify-between p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition text-left" data-target-id="${p.id}">
      <span class="font-bold text-white">${p.name} (Bàn ${Math.floor(p.seatIndex / 2) + 1})</span>
      <span class="text-xl">🎯</span>
    </button>
  `).join('');

  modal.classList.remove('hidden');

  targetList.querySelectorAll('.throw-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.targetId;
      const type = Math.random() > 0.5 ? 'paper' : 'pen';
      socket.emit('throw_projectile', { toPlayerId: targetId, type: type });
      modal.classList.add('hidden');
      showToast(`Đã ném ${type === 'paper' ? 'máy bay phao thi ✈️' : 'bút bi 🖊️'}!`);
    });
  });
}

function updateTimerDisplay(seconds) {
  document.querySelectorAll('.phase-timer-display').forEach(el => {
    el.innerText = `${seconds}s`;
  });
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-24 right-6 z-50 bg-slate-900/90 text-yellow-300 font-bold px-4 py-2 rounded-xl border border-yellow-400/50 shadow-2xl backdrop-blur-md animate-fade-in';
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function showBannerToast(msg) {
  // YÊU CẦU 2.6: Loại bỏ cửa sổ nổi màu đỏ, hiển thị thông báo ngắn trực tiếp vào thanh chat lớp học
  addChatMessage('🔔 HỆ THỐNG', msg);
}

function showAnnouncementModal(title, msg) {
  // YÊU CẦU 2.6: Thay vì hiện modal nổi màu đỏ, hiển thị thông báo vào thanh chat lớp học
  const header = title ? `📢 ${title}` : '📢 THÔNG BÁO';
  addChatMessage(header, msg);
}

// --- QUẢN LÝ CHAT LỚP HỌC THEO TAB (YÊU CẦU 2.7) ---
let activeChatTab = 'messages'; // 'messages' | 'system'
const chatHistoryList = [];

function renderChatHistory() {
  const box = document.getElementById('chat-history-box');
  if (!box) return;
  box.innerHTML = '';

  const filtered = chatHistoryList.filter(msg => msg.category === activeChatTab);
  filtered.forEach(item => {
    const row = document.createElement('div');
    if (item.category === 'system') {
      row.className = 'p-1.5 rounded-lg text-xs leading-tight bg-amber-950/40 border border-amber-500/30 text-amber-200';
      row.innerHTML = `<span class="font-bold text-yellow-300">${item.name}:</span> ${item.text}`;
    } else {
      row.className = `p-1.5 rounded-lg text-xs leading-tight ${item.isSelf ? 'bg-blue-900/60 text-blue-200 ml-3' : 'bg-slate-800/80 text-white mr-3'}`;
      row.innerHTML = `<span class="font-bold text-yellow-400">${item.name}:</span> ${item.text}`;
    }
    box.appendChild(row);
  });
  box.scrollTop = box.scrollHeight;
}

function switchChatTab(tab) {
  activeChatTab = tab;
  const tabMsgBtn = document.getElementById('chat-tab-messages');
  const tabSysBtn = document.getElementById('chat-tab-system');
  const dotMsg = document.getElementById('chat-tab-messages-dot');
  const dotSys = document.getElementById('chat-tab-system-dot');

  if (tab === 'messages') {
    if (tabMsgBtn) {
      tabMsgBtn.className = 'px-2 py-0.5 rounded-lg bg-blue-600 text-white font-black text-[11px] transition flex items-center space-x-1 relative cursor-pointer';
    }
    if (tabSysBtn) {
      tabSysBtn.className = 'px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white font-bold text-[11px] transition flex items-center space-x-1 relative cursor-pointer';
    }
    if (dotMsg) dotMsg.classList.add('hidden');
  } else {
    if (tabSysBtn) {
      tabSysBtn.className = 'px-2 py-0.5 rounded-lg bg-amber-600 text-white font-black text-[11px] transition flex items-center space-x-1 relative cursor-pointer';
    }
    if (tabMsgBtn) {
      tabMsgBtn.className = 'px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white font-bold text-[11px] transition flex items-center space-x-1 relative cursor-pointer';
    }
    if (dotSys) dotSys.classList.add('hidden');
  }

  renderChatHistory();
}

function addChatMessage(name, text, isSelf = false, category = null) {
  if (!category) {
    const isSys = name.includes('HỆ THỐNG') || name.includes('THÔNG BÁO') || name.includes('GIÁM THỊ') ||
                  name.includes('📢') || name.includes('🔔') || name.includes('💥') ||
                  name.includes('🏆') || name.includes('✨') || name.includes('🎯');
    category = isSys ? 'system' : 'messages';
  }

  const msgItem = { name, text, isSelf, category, time: Date.now() };
  chatHistoryList.push(msgItem);

  const box = document.getElementById('chat-history-box');
  if (box && category === activeChatTab) {
    const row = document.createElement('div');
    if (category === 'system') {
      row.className = 'p-1.5 rounded-lg text-xs leading-tight bg-amber-950/40 border border-amber-500/30 text-amber-200';
      row.innerHTML = `<span class="font-bold text-yellow-300">${name}:</span> ${text}`;
    } else {
      row.className = `p-1.5 rounded-lg text-xs leading-tight ${isSelf ? 'bg-blue-900/60 text-blue-200 ml-3' : 'bg-slate-800/80 text-white mr-3'}`;
      row.innerHTML = `<span class="font-bold text-yellow-400">${name}:</span> ${text}`;
    }
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  } else {
    // Thông báo có tin mới ở tab chưa mở
    if (category === 'system') {
      document.getElementById('chat-tab-system-dot')?.classList.remove('hidden');
    } else {
      document.getElementById('chat-tab-messages-dot')?.classList.remove('hidden');
    }
  }

  // Hiển thị chấm đỏ thông báo nếu khung chat đang thu gọn
  const chatCollapsible = document.getElementById('chat-container-collapsible');
  const unreadBadge = document.getElementById('chat-unread-badge');
  if (!isSelf && chatCollapsible && chatCollapsible.classList.contains('hidden') && unreadBadge) {
    unreadBadge.classList.remove('hidden');
  }
}

// --- PHÁT HIỆN THIẾT BỊ DI ĐỘNG HAY PC / LAPTOP (YÊU CẦU 1.8 & 2.7) ---
function isMobileOrTouchDevice() {
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = window.innerWidth <= 1024;
  return isMobileUA || hasTouch || (isCoarsePointer && isSmallScreen);
}

function applyDeviceControlsVisibility() {
  const isMobile = isMobileOrTouchDevice();
  const joystickContainer = document.getElementById('virtual-joystick-container');
  const touchInteractBtn = document.getElementById('btn-touch-interact');
  const pcHintEl = document.getElementById('pc-controls-hint');
  const startModal = document.getElementById('start-screen-modal');
  const inStartScreen = startModal && !startModal.classList.contains('hidden');
  const isLobby = currentRoom !== null && !inStartScreen && currentRoom.state === 'LOBBY';

  if (isMobile) {
    // ĐIỆN THOẠI / CẢM ỨNG (Yêu cầu 1.8 & 2.9):
    // 1. Chỉ hiện joystick ảo di chuyển khi ĐÃ VÀO PHÒNG và đang ở sảnh chờ (LOBBY), ẩn khi ở menu chính hoặc khi đang thi
    if (joystickContainer) {
      if (isLobby) {
        joystickContainer.classList.remove('hidden');
        joystickContainer.classList.add('flex');
      } else {
        joystickContainer.classList.add('hidden');
        joystickContainer.classList.remove('flex');
      }
    }
    // 2. Ẩn tip phím W A S D di chuyển PC
    if (pcHintEl) {
      pcHintEl.classList.add('hidden');
      pcHintEl.classList.remove('flex');
    }
  } else {
    // MÁY TÍNH PC / LAPTOP (Yêu cầu 1.8):
    // 1. Ẩn nút joystick ảo
    if (joystickContainer) {
      joystickContainer.classList.add('hidden');
      joystickContainer.classList.remove('flex');
    }
    // 2. Ẩn nút ngồi xuống / đứng dậy cảm ứng
    if (touchInteractBtn) {
      touchInteractBtn.classList.add('hidden');
    }
    // 3. Hiện tip phím W A S D và phím E trên PC khi ở sảnh
    if (pcHintEl) {
      if (isLobby) {
        pcHintEl.classList.remove('hidden');
        pcHintEl.classList.add('flex');
      } else {
        pcHintEl.classList.add('hidden');
        pcHintEl.classList.remove('flex');
      }
    }
  }
}

// --- ĐIỀU KHIỂN DI CHUYỂN & TƯƠNG TÁC SẢNH CHỜ (YÊU CẦU 1.7 & 1.8) ---
function setupMovementControls() {
  if (!scene3d) return;

  // 1. Áp dụng ẩn/hiện điều khiển theo thiết bị
  applyDeviceControlsVisibility();
  window.addEventListener('resize', applyDeviceControlsVisibility);
  window.addEventListener('orientationchange', applyDeviceControlsVisibility);

  // 2. Cài đặt các callbacks cho scene3d
  scene3d.onMyMoveCallback = (data) => {
    if (socket) socket.emit('player_move', data);
  };
  scene3d.onSeatInteracted = (isSitting, seatIndex) => {
    if (socket) socket.emit('player_seat_interact', { isSitting, seatIndex });
  };
  scene3d.onInteractionPromptChange = (prompt) => {
    updateInteractionPromptUI(prompt);
  };

  // 3. Bàn phím PC / Laptop: W, A, S, D và E
  const keys = { w: false, a: false, s: false, d: false };

  function updateMoveFromKeys() {
    let mx = 0;
    let mz = 0;
    if (keys.w) mz -= 1;
    if (keys.s) mz += 1;
    if (keys.a) mx -= 1;
    if (keys.d) mx += 1;

    // Chuẩn hóa vector di chuyển
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) {
      scene3d.setMoveInput(mx / len, mz / len);
    } else {
      scene3d.setMoveInput(0, 0);
    }
  }

  window.addEventListener('keydown', (e) => {
    // Nếu đang gõ tin nhắn hoặc ô input thì bỏ qua
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'KeyW' || e.key === 'ArrowUp') { keys.w = true; updateMoveFromKeys(); }
    if (e.code === 'KeyS' || e.key === 'ArrowDown') { keys.s = true; updateMoveFromKeys(); }
    if (e.code === 'KeyA' || e.key === 'ArrowLeft') { keys.a = true; updateMoveFromKeys(); }
    if (e.code === 'KeyD' || e.key === 'ArrowRight') { keys.d = true; updateMoveFromKeys(); }

    if (e.code === 'KeyE') {
      scene3d.interactMyPlayer();
      if (window.audioMgr) window.audioMgr.playDeskTap();
    }
  });

  window.addEventListener('keyup', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'KeyW' || e.key === 'ArrowUp') { keys.w = false; updateMoveFromKeys(); }
    if (e.code === 'KeyS' || e.key === 'ArrowDown') { keys.s = false; updateMoveFromKeys(); }
    if (e.code === 'KeyA' || e.key === 'ArrowLeft') { keys.a = false; updateMoveFromKeys(); }
    if (e.code === 'KeyD' || e.key === 'ArrowRight') { keys.d = false; updateMoveFromKeys(); }
  });

  // 4. Virtual Joystick (Cho điện thoại)
  const joystickContainer = document.getElementById('virtual-joystick-container');
  const joystickKnob = document.getElementById('virtual-joystick-knob');

  if (joystickContainer && joystickKnob) {
    let joystickTouchId = null;
    let baseCenter = { x: 0, y: 0 };
    const maxRadius = 38; // Bán kính di chuyển núm (px)

    function handleJoystickStart(e) {
      e.preventDefault();
      const touch = e.changedTouches ? e.changedTouches[0] : e;
      joystickTouchId = touch.identifier !== undefined ? touch.identifier : 'mouse';

      const rect = joystickContainer.getBoundingClientRect();
      baseCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      handleJoystickMove(e);
    }

    function handleJoystickMove(e) {
      if (joystickTouchId === null) return;
      e.preventDefault();

      let clientX = 0, clientY = 0;
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joystickTouchId) {
            clientX = e.changedTouches[i].clientX;
            clientY = e.changedTouches[i].clientY;
            break;
          }
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      let dx = clientX - baseCenter.x;
      let dy = clientY - baseCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      // Chuẩn hóa input (-1 đến 1)
      const normX = dx / maxRadius;
      const normZ = dy / maxRadius;
      scene3d.setMoveInput(normX, normZ);
    }

    function handleJoystickEnd(e) {
      if (joystickTouchId === null) return;
      joystickTouchId = null;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      scene3d.setMoveInput(0, 0);
    }

    joystickContainer.addEventListener('touchstart', handleJoystickStart, { passive: false });
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('touchend', handleJoystickEnd);
    window.addEventListener('touchcancel', handleJoystickEnd);
  }

  // 5. Bấm vào thông báo hoặc nút tương tác cảm ứng di động
  document.getElementById('interaction-prompt')?.addEventListener('click', () => {
    scene3d.interactMyPlayer();
    if (window.audioMgr) window.audioMgr.playDeskTap();
  });

  document.getElementById('btn-touch-interact')?.addEventListener('click', () => {
    scene3d.interactMyPlayer();
    if (window.audioMgr) window.audioMgr.playDeskTap();
  });
}

function updateInteractionPromptUI(prompt) {
  const isMobile = isMobileOrTouchDevice();
  const promptEl = document.getElementById('interaction-prompt');
  const touchBtn = document.getElementById('btn-touch-interact');
  const touchIcon = document.getElementById('touch-interact-icon');
  const touchLabel = document.getElementById('touch-interact-label');

  // YÊU CẦU 2.6: Loại bỏ hoàn toàn 2 cửa sổ nổi "chạm để ngồi vào bàn / đứng dậy" và "Ngồi vào ghế (E) / Đứng dậy (E)"
  if (promptEl) promptEl.classList.add('hidden');

  // YÊU CẦU 2.6: Ở giao diện sảnh của người chơi điện thoại, chỉ hiện nút ngồi xuống khi đang ở sảnh (LOBBY).
  // Khi bắt đầu chọn bài thi và thi, luôn ẩn nút này.
  const isLobby = currentRoom && currentRoom.state === 'LOBBY';

  if (prompt && isLobby) {
    if (touchBtn) {
      if (isMobile) {
        touchBtn.classList.remove('hidden');
        if (prompt.type === 'stand') {
          if (touchIcon) touchIcon.innerText = '🚶';
          if (touchLabel) touchLabel.innerText = 'ĐỨNG DẬY';
        } else {
          if (touchIcon) touchIcon.innerText = '🪑';
          if (touchLabel) touchLabel.innerText = 'NGỒI XUỐNG';
        }
      } else {
        touchBtn.classList.add('hidden');
      }
    }
  } else {
    if (touchBtn) touchBtn.classList.add('hidden');
  }
}
