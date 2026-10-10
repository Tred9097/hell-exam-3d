// server.js - Backend Real-time Multiplayer cho "Kì Thi Địa Ngục" (Hell Exam) v1.4
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { 
  validateWord, 
  getRandomStartingWord, 
  findBotReply, 
  VIETNAMESE_WORDS 
} = require('./lib/dictionary');

const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6 // 5MB cho ảnh vẽ canvas
});

const PORT = process.env.PORT || 3000;

// Tối ưu hóa băng thông mạng: Gzip nén tất cả JSON, Model 3D GLTF và JS (Giảm 80% tải mạng)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const type = res.getHeader('Content-Type') || '';
    if (/json|gltf|text|javascript|css/i.test(type)) return true;
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Phục vụ static files trong thư mục public kèm Cache-Control để máy khác/điện thoại không phải tải lại model
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Không cache code client (.html, .js, .css) để fix bug và cập nhật logic ngay tức thì
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      // Cache mạnh cho Model 3D gltf, textures, images, audio (1 ngày)
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
}));
app.use(express.json({ limit: '10mb' }));

// Health check cho hosting platforms (Render, Railway, etc.).
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API lưu ảnh thumbnail 3D nhân vật
app.post('/api/save-thumbnail', (req, res) => {
  const { id, dataUrl } = req.body;
  if (!id || !dataUrl) return res.status(400).json({ error: 'Missing id or dataUrl' });
  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const dir = path.join(__dirname, 'public', 'images', 'characters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.png`), base64Data, 'base64');
    res.json({ success: true, id });
  } catch (err) {
    console.error('Lỗi khi lưu thumbnail:', err);
    res.status(500).json({ error: err.message });
  }
});

// Lấy địa chỉ IP Hotspot (nếu máy tính đang phát Mobile Hotspot)
function getHotspotIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        if (/local area connection|hotspot/i.test(devName) || alias.address.startsWith('192.168.137.')) {
          return alias.address;
        }
      }
    }
  }
  return null;
}

// Lấy địa chỉ IP mạng LAN nội bộ và thông tin PC máy chủ (Yêu cầu 1.8)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let wifiIp = null;
  let lanIp = null;
  let privateIp = null;
  let fallbackIp = null;

  for (const devName in interfaces) {
    const isVpn = /radmin|vpn|warp|virtual|vmware|vbox|docker|pseudo|tailscale|zerotier/i.test(devName);
    const isWifi = /wi-fi|wifi|wireless/i.test(devName);
    const isLan = /ethernet|local area|lan/i.test(devName);
    const iface = interfaces[devName];

    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal && !alias.address.startsWith('169.254.')) {
        const isPrivate = alias.address.startsWith('192.168.') || 
                          alias.address.startsWith('10.') || 
                          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(alias.address);

        if (!isVpn && isPrivate) {
          if (isWifi) return alias.address; // Ưu tiên số 1: Card Wi-Fi nội bộ thật của PC máy chủ
          if (isLan && !lanIp) lanIp = alias.address; // Ưu tiên số 2: Cáp Ethernet mạng nội bộ thật
          if (!privateIp) privateIp = alias.address;
        }
        if (!isVpn && !fallbackIp) fallbackIp = alias.address;
      }
    }
  }
  return wifiIp || lanIp || privateIp || fallbackIp || 'localhost';
}

function getAllNetworkIps() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const devName in interfaces) {
    const isVpn = /radmin|vpn|warp|virtual|vmware|vbox|docker|pseudo/i.test(devName);
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal && !alias.address.startsWith('169.254.')) {
        list.push({
          dev: devName,
          ip: alias.address,
          isVpn: isVpn,
          isPrivate: alias.address.startsWith('192.168.') || alias.address.startsWith('10.')
        });
      }
    }
  }
  return list;
}

// Biến lưu Link Online toàn cầu từ Cloudflare Tunnel
let publicOnlineUrl = null;
let cloudflaredProcess = null;

function startCloudflareTunnel() {
  if (process.env.ENABLE_CLOUDFLARE_TUNNEL !== 'true') {
    return;
  }

  const exePath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(exePath)) {
    console.log('ℹ️ Không tìm thấy file cloudflared.exe - Bỏ qua chế độ Tunnel Online.');
    return;
  }

  try {
    console.log('🌐 Đang khởi tạo Cloudflare Tunnel (Cho phép các máy khác mạng / 4G / ở xa vào chơi)...');
    cloudflaredProcess = spawn(exePath, ['tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${PORT}`], {
      windowsHide: true
    });

    const urlRegex = /https:\/\/(?!api\b|pkg\b)[a-z0-9-]+\.trycloudflare\.com/i;

    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(urlRegex);
      if (match && !publicOnlineUrl && !match[0].includes('api.trycloudflare.com')) {
        publicOnlineUrl = match[0];
        console.log(`=======================================================`);
        console.log(`🌍 LINK ONLINE TOÀN CẦU (Khác mạng, 4G, 5G, Wi-Fi khác):`);
        console.log(`👉 ${publicOnlineUrl}`);
        console.log(`=======================================================`);
        io.emit('online_url_ready', { onlineUrl: publicOnlineUrl });
      }
    };

    cloudflaredProcess.stdout.on('data', handleOutput);
    cloudflaredProcess.stderr.on('data', handleOutput);

    cloudflaredProcess.on('close', (code) => {
      publicOnlineUrl = null;
    });

    const cleanup = () => {
      if (cloudflaredProcess) {
        try { cloudflaredProcess.kill(); } catch (e) {}
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(); });
    process.on('SIGTERM', () => { cleanup(); process.exit(); });
  } catch (err) {
    console.warn('Lỗi khi mở Cloudflare Tunnel:', err.message);
  }
}

function getServerNetworkInfo() {
  const currentLanIp = getLocalIpAddress();
  const hotspotIp = getHotspotIpAddress();
  const pcHost = os.hostname();
  return {
    lanIp: currentLanIp,
    hotspotIp: hotspotIp,
    onlineUrl: publicOnlineUrl,
    pcHost: pcHost,
    port: PORT,
    url: publicOnlineUrl || (hotspotIp ? `http://${hotspotIp}:${PORT}` : `http://${currentLanIp}:${PORT}`),
    allIps: getAllNetworkIps()
  };
}

// Endpoint lấy thông tin kết nối mạng và địa chỉ PC máy chủ thực sự (Yêu cầu 1.8)
app.get('/api/info', (req, res) => {
  res.json(getServerNetworkInfo());
});

// Danh sách đề bài vẽ tranh học đường hài hước
const DRAWING_PROMPTS = [
  "Thầy giám thị bắt được phao thi",
  "Con vịt 0 điểm chói lòa",
  "Học sinh ngủ gật chảy ke",
  "Bị cô gọi lên bảng trả bài cũ",
  "Bát mì tôm úp vội giờ ra chơi",
  "Xe đạp thủng lốp giữa trời mưa ngập",
  "Lớp trưởng gương mẫu hóng drama",
  "Tờ phao thi gấp quạt dài 2 mét",
  "Mặt thầy khi cả lớp được 1 điểm",
  "Cơm đĩa căn-tin trường học",
  "Thủ khoa thức thâu đêm ôn thi",
  "Chép bài bạn mà chép nhầm cả tên"
];

// Thân phận và dữ liệu mẫu cho bài thi "Hỏi Xoáy Đáp Xoay" (1.6)
const SPINQA_PERSONAS = [
  { id: 'satan', name: 'Quỷ Satan', icon: '😈', desc: 'Chuyên bới móc tội lỗi và cám dỗ học đường' },
  { id: 'neighbor', name: 'Bà Hàng Xóm', icon: '👵', desc: 'Thánh săm soi điểm số, hóng hớt chuyện yêu đương' },
  { id: 'ancestor', name: 'Tổ Tiên', icon: '👴', desc: 'Hiển linh kiểm tra con cháu học hành báo đáp công ơn' },
  { id: 'lawyer', name: 'Luật Sư', icon: '⚖️', desc: 'Truy vấn bằng chứng, bắt bẻ từng sơ hở lí do trốn học' }
];

const SPINQA_DEFAULT_QUESTIONS = {
  satan: [
    "Hôm qua bạn trốn tiết đi net chơi game, tính giấu ai hả sĩ tử?",
    "Tại sao bài kiểm tra 1 điểm mà dám photo sửa thành 10 điểm đưa ba mẹ?",
    "Bạn có dám thú nhận đã ăn vụng mì tôm của bạn cùng bàn không?"
  ],
  neighbor: [
    "Bao giờ thì cháu mới chịu lấy chồng/lấy vợ để bác ăn cỗ đây?",
    "Nghe nói kỳ này lại thi lại mấy môn đúng không cháu, sao bằng con nhà người ta?",
    "Hôm nọ bác thấy cháu chở bạn nào đi trà sữa đấy, người yêu hả?"
  ],
  ancestor: [
    "Tổ tiên dòng họ mấy đời học giỏi, cớ sao con lại đội sổ thế hả con?",
    "Con thi đại học tính đỗ trường nào để nở mày nở mặt dòng họ đây?",
    "Ăn học tốn bao nhiêu lúa gạo, rồi con định báo đáp ông bà tổ tiên kiểu gì?"
  ],
  lawyer: [
    "Bị cáo có bằng chứng nào chứng minh con chó đã ăn mất bài tập về nhà?",
    "Tại sao chữ ký phụ huynh trong sổ liên lạc lại giống hệt nét chữ của bạn?",
    "Vào thời điểm xảy ra vụ việc mất bút bi, bị cáo đang ở đâu và làm gì?"
  ]
};

const SPINQA_DEFAULT_KEYWORDS = [
  "thủng lốp xe", "tiền ăn sáng", "tỏ tình thất bại", "phao thi",
  "con ruột mẹ nuôi", "mất dép", "sổ đầu bài", "thầy giám thị",
  "trà sữa trân châu", "ngủ quên", "bị mẹ phạt", "chép phạt 100 lần"
];

// Quản lý phòng chơi
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    round: room.round,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      characterModel: p.characterModel || p.characterType || 'Casual_Male',
      characterType: p.characterModel || p.characterType || 'Casual_Male',
      skinColor: p.skinColor || '#f0c294',
      color: p.color,
      accessory: p.accessory,
      hatColor: p.hatColor || '#dc2626',
      seatIndex: p.seatIndex,
      score: p.score,
      isReady: p.isReady,
      eliminated: p.eliminated,
      hasSubmitted: !!p.hasSubmittedCurrentTurn
    })),
    timer: room.timerSeconds,
    currentPrompt: room.currentPrompt,
    wordChain: room.wordChain ? {
      currentWord: room.wordChain.currentWord,
      currentTurnPlayerId: room.wordChain.currentTurnPlayerId,
      turnTimeLeft: room.wordChain.turnTimeLeft,
      history: room.wordChain.history.slice(-8)
    } : null,
    reviewDrawing: room.reviewDrawing ? {
      promptAuthorName: room.reviewDrawing.promptAuthorName,
      promptText: room.reviewDrawing.promptText,
      drawerId: room.reviewDrawing.drawerId,
      drawerName: room.reviewDrawing.drawerName,
      drawingData: room.reviewDrawing.drawingData,
      currentIndex: room.reviewDrawing.currentIndex,
      total: room.reviewDrawing.total
    } : null,
    spinQA: room.spinQA ? {
      askerId: room.spinQA.askerId,
      askerName: room.spinQA.askerName,
      persona: room.spinQA.persona,
      question: room.spinQA.question,
      keywords: room.spinQA.keywords,
      currentReview: room.spinQA.currentReview || null
    } : null
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('room_update', getRoomState(room));
}

// Chuyển sang giai đoạn Bình Chọn (3 Môn Thi: DRAWING, WORD_CHAIN, SPIN_QA)
function startVotingPhase(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'VOTING';
  room.timerSeconds = 10;
  room.votes = { DRAWING: 0, WORD_CHAIN: 0, SPIN_QA: 0 };
  room.votedPlayers = new Set();

  broadcastRoom(room);

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      clearInterval(room.timerInterval);
      // Quyết định trò chơi có số phiếu cao nhất
      const drawVotes = room.votes.DRAWING || 0;
      const wordVotes = room.votes.WORD_CHAIN || 0;
      const spinVotes = room.votes.SPIN_QA || 0;
      const maxVotes = Math.max(drawVotes, wordVotes, spinVotes);

      const candidateGames = [];
      if (drawVotes === maxVotes) candidateGames.push('DRAWING');
      if (wordVotes === maxVotes) candidateGames.push('WORD_CHAIN');
      if (spinVotes === maxVotes) candidateGames.push('SPIN_QA');

      const nextGame = candidateGames[Math.floor(Math.random() * candidateGames.length)];

      io.to(room.code).emit('game_selected', { game: nextGame });
      setTimeout(() => {
        if (nextGame === 'DRAWING') {
          startDrawingGame(room);
        } else if (nextGame === 'WORD_CHAIN') {
          startWordChainGame(room);
        } else {
          startSpinQAGame(room);
        }
      }, 2500);
    }
  }, 1000);
}

// ==========================================
// --- MINIGAME 1: VẼ TRANH XOAY VÒNG 2.0 ---
// ==========================================

// Giai đoạn 1: Tất cả thí sinh tự nhập đề vẽ (30s)
function startDrawingGame(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'DRAWING_PROMPT_INPUT';
  room.timerSeconds = 30;
  room.drawingPrompts = new Map();

  room.players.forEach(p => {
    p.customPrompt = null;
    p.hasSubmittedCurrentTurn = false;
    p.roundScore = 1;
  });

  broadcastRoom(room);
  io.to(room.code).emit('drawing_prompt_phase_start', { timer: 30 });
  io.to(room.code).emit('announcement', {
    title: '🎨 BÀI THI: VẼ TRANH XOAY VÒNG',
    msg: 'Hãy tự nghĩ và gửi 1 đề bài vẽ thật độc đáo (30s) để thách thức cả lớp!'
  });

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      clearInterval(room.timerInterval);
      // Gán đề mặc định cho ai chưa kịp gửi
      room.players.forEach(p => {
        if (!p.customPrompt) {
          const randPrompt = DRAWING_PROMPTS[Math.floor(Math.random() * DRAWING_PROMPTS.length)];
          p.customPrompt = randPrompt;
          room.drawingPrompts.set(p.id, randPrompt);
        }
      });
      startDrawingRotation(room);
    }
  }, 1000);
}

// Giai đoạn 2: Vẽ xoay vòng từng yêu cầu của người khác (60s mỗi lượt)
function startDrawingRotation(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.drawingPlayers = Array.from(room.players.values());
  const N = room.drawingPlayers.length;

  if (N < 2) {
    // Không đủ 2 người để xoay vòng
    io.to(room.code).emit('announcement', {
      title: 'THIẾU SĨ TỬ',
      msg: 'Cần tối thiểu 2 sĩ tử để tiến hành vẽ xoay vòng!'
    });
    setTimeout(() => startRoundSummary(room), 2000);
    return;
  }

  room.drawingRoundIndex = 0;
  room.drawingTotalRounds = N - 1; // Mỗi người vẽ tất cả các đề trừ của mình
  room.allDrawings = [];

  runDrawingTurn(room);
}

function runDrawingTurn(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  const N = room.drawingPlayers.length;
  const k = room.drawingRoundIndex;

  if (k >= room.drawingTotalRounds) {
    // Đã hoàn thành tất cả các lượt vẽ -> Chuyển sang triển lãm chấm điểm!
    startDrawingReview(room);
    return;
  }

  room.state = 'DRAWING_TIME';
  room.timerSeconds = 60; // 60 giây mỗi lượt theo yêu cầu 1.6
  room.currentTurnSubmissions = new Set();

  // Phân phối đề cho từng người: P_i vẽ đề của P_j với j = (i + 1 + k) % N
  room.drawingPlayers.forEach((p, i) => {
    const j = (i + 1 + k) % N;
    const author = room.drawingPlayers[j];
    const promptText = room.drawingPrompts.get(author.id) || author.customPrompt || "Chân dung bạn cùng bàn";

    p.assignedTurnPrompt = {
      promptAuthorId: author.id,
      promptAuthorName: author.name,
      promptText: promptText,
      roundIndex: k + 1,
      totalRounds: room.drawingTotalRounds
    };
    p.drawingData = null;
    p.hasSubmittedCurrentTurn = false;

    // Gửi đề bài riêng của lượt này cho từng người chơi
    io.to(p.id).emit('drawing_assigned_turn', {
      roundIndex: k + 1,
      totalRounds: room.drawingTotalRounds,
      promptAuthorId: author.id,
      promptAuthorName: author.name,
      promptText: promptText,
      timer: 60
    });
  });

  broadcastRoom(room);
  io.to(room.code).emit('announcement', {
    title: `🎨 LƯỢT VẼ ${k + 1} / ${room.drawingTotalRounds}`,
    msg: `Bắt đầu lượt vẽ thứ ${k + 1}! Bạn có 60 giây để vẽ đề của bạn học!`
  });

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      clearInterval(room.timerInterval);
      finishDrawingTurn(room);
    }
  }, 1000);
}

function finishDrawingTurn(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  // Thu bài tự động cho ai chưa kịp nộp
  room.drawingPlayers.forEach(p => {
    if (!p.hasSubmittedCurrentTurn) {
      const promptInfo = p.assignedTurnPrompt || { promptAuthorName: "Bạn học", promptText: "Đề bài bí mật" };
      room.allDrawings.push({
        id: 'draw_' + Math.random().toString(36).substr(2, 9),
        drawerId: p.id,
        drawerName: p.name,
        promptAuthorId: promptInfo.promptAuthorId,
        promptAuthorName: promptInfo.promptAuthorName,
        promptText: promptInfo.promptText,
        drawingData: p.drawingData || null,
        votesMap: new Map()
      });
      p.hasSubmittedCurrentTurn = true;
    }
  });

  room.drawingRoundIndex++;
  if (room.drawingRoundIndex < room.drawingTotalRounds) {
    io.to(room.code).emit('announcement', {
      title: 'CHUYỂN LƯỢT VẼ KẾ TIẾP!',
      msg: `Lượt vừa rồi đã kết thúc! Chuyển ngay sang đề vẽ tiếp theo!`
    });
    setTimeout(() => {
      runDrawingTurn(room);
    }, 1500);
  } else {
    // Đã xong tất cả các lượt
    io.to(room.code).emit('announcement', {
      title: 'ĐÃ XONG TẤT CẢ LƯỢT VẼ!',
      msg: 'Tất cả sĩ tử đã hoàn thành các lượt vẽ! Bắt đầu công bố và chấm điểm từng đề!'
    });
    setTimeout(() => {
      startDrawingReview(room);
    }, 1500);
  }
}

// Giai đoạn 3: Triển lãm và chấm điểm từng tác phẩm
function startDrawingReview(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'DRAWING_REVIEW';

  const drawingList = room.allDrawings || [];
  if (drawingList.length === 0) {
    io.to(room.code).emit('announcement', {
      title: 'HẾT GIỜ!',
      msg: 'Không có tác phẩm nào được nộp! Toàn lớp nhận 1 điểm!'
    });
    room.players.forEach(p => p.score += 1);
    setTimeout(() => startRoundSummary(room), 2500);
    return;
  }

  let reviewIndex = 0;

  function showNextDrawing() {
    if (reviewIndex >= drawingList.length) {
      startRoundSummary(room);
      return;
    }

    const currentDrawing = drawingList[reviewIndex];
    currentDrawing.votesMap = new Map();

    room.reviewDrawing = {
      promptAuthorName: currentDrawing.promptAuthorName,
      promptText: currentDrawing.promptText,
      drawerId: currentDrawing.drawerId,
      drawerName: currentDrawing.drawerName,
      drawingData: currentDrawing.drawingData,
      currentIndex: reviewIndex + 1,
      total: drawingList.length
    };
    room.timerSeconds = 12;

    broadcastRoom(room);
    io.to(room.code).emit('announcement', {
      title: `TRIỂN LÃM BÀI VẼ (${reviewIndex + 1}/${drawingList.length})`,
      msg: `Đề: "${currentDrawing.promptText}" (Ra đề: ${currentDrawing.promptAuthorName}) • Họa sĩ: ${currentDrawing.drawerName}`
    });

    room.timerInterval = setInterval(() => {
      room.timerSeconds--;
      io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

      if (room.timerSeconds <= 0) {
        clearInterval(room.timerInterval);

        // Chuẩn hóa điểm bài thi vẽ (1.4: Trung bình vote, làm tròn >= 0.5 lên 1, min 1đ, max 10đ)
        const votes = Array.from(currentDrawing.votesMap.values());
        const rawAvg = votes.length > 0 ? (votes.reduce((sum, v) => sum + v, 0) / votes.length) : 7.5;
        const finalScore = Math.max(1, Math.min(10, Math.round(rawAvg)));

        const drawer = room.players.get(currentDrawing.drawerId);
        if (drawer) {
          drawer.roundScore = finalScore;
          drawer.score += finalScore;
        }

        io.to(room.code).emit('announcement', {
          title: 'ĐIỂM BÀI VẼ',
          msg: `Họa sĩ "${currentDrawing.drawerName}": Điểm trung bình ${rawAvg.toFixed(1)}/10 ➔ Nhận ${finalScore} điểm!`
        });

        io.to(room.code).emit('drawing_graded', {
          authorId: currentDrawing.drawerId,
          authorName: currentDrawing.drawerName,
          avg: rawAvg.toFixed(1),
          finalScore: finalScore,
          totalScore: drawer ? drawer.score : 0
        });

        setTimeout(() => {
          reviewIndex++;
          showNextDrawing();
        }, 2000);
      }
    }, 1000);
  }

  showNextDrawing();
}

// ==========================================
// --- MINIGAME 3: HỎI XOÁY ĐÁP XOAY (MỚI 1.6) ---
// ==========================================

function startSpinQAGame(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  const playerList = Array.from(room.players.values());

  if (playerList.length < 2) {
    io.to(room.code).emit('announcement', {
      title: 'THIẾU SĨ TỬ',
      msg: 'Cần ít nhất 2 sĩ tử để chơi Hỏi Xoáy Đáp Xoay!'
    });
    setTimeout(() => startRoundSummary(room), 2000);
    return;
  }

  // Chọn ngẫu nhiên 1 người làm Người hỏi, thân phận ngẫu nhiên
  const asker = playerList[Math.floor(Math.random() * playerList.length)];
  const persona = SPINQA_PERSONAS[Math.floor(Math.random() * SPINQA_PERSONAS.length)];

  room.spinQA = {
    askerId: asker.id,
    askerName: asker.name,
    persona: persona,
    question: null,
    keywords: [],
    responderKeywords: new Map(),
    responderAnswers: new Map(),
    askerBonusTotal: 0
  };

  room.state = 'SPIN_QA_SETUP';
  room.timerSeconds = 120; // Yêu cầu 1.8: Tăng thời gian hỏi của người hỏi lên 120 giây

  room.players.forEach(p => {
    p.hasSubmittedCurrentTurn = false;
    p.roundScore = 1;
  });

  broadcastRoom(room);
  io.to(room.code).emit('spinqa_setup_start', {
    askerId: asker.id,
    askerName: asker.name,
    persona: persona,
    timer: 120
  });

  io.to(room.code).emit('announcement', {
    title: '🌀 HỎI XOÁY ĐÁP XOAY (120 GIÂY)',
    msg: `Sĩ tử "${asker.name}" hóa thân thành ${persona.icon} ${persona.name}! Có 120 giây để người hỏi đặt câu hỏi oái oăm & người đáp gài từ khóa!`
  });

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      clearInterval(room.timerInterval);
      finishSpinQASetup(room);
    }
  }, 1000);
}

function finishSpinQASetup(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  // Nếu người hỏi chưa nhập câu hỏi -> Lấy câu hỏi mẫu hợp thân phận
  if (!room.spinQA.question) {
    const personaQuestions = SPINQA_DEFAULT_QUESTIONS[room.spinQA.persona.id] || SPINQA_DEFAULT_QUESTIONS.satan;
    room.spinQA.question = personaQuestions[Math.floor(Math.random() * personaQuestions.length)];
  }

  // YÊU CẦU 1.7: Chỉ hiện đúng số lượng từ khóa của các người chơi nhập vào
  // Chỉ gán từ khóa ngẫu nhiên cho những người đáp chưa kịp nộp trước khi hết 30s
  room.players.forEach(p => {
    if (p.id !== room.spinQA.askerId && !room.spinQA.responderKeywords.has(p.id)) {
      const randKw = SPINQA_DEFAULT_KEYWORDS[Math.floor(Math.random() * SPINQA_DEFAULT_KEYWORDS.length)];
      room.spinQA.responderKeywords.set(p.id, randKw);
    }
  });

  // Gom chính xác từ khóa từ người đáp (đúng bằng số lượng người đáp)
  room.spinQA.keywords = Array.from(room.spinQA.responderKeywords.values());

  startSpinQAAnswering(room);
}

// Menu người đáp phần 2: Viết câu trả lời trong 120 giây
function startSpinQAAnswering(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'SPIN_QA_ANSWERING';
  room.timerSeconds = 120; // 120 giây theo yêu cầu 1.6

  room.players.forEach(p => {
    p.hasSubmittedCurrentTurn = false;
  });

  broadcastRoom(room);
  io.to(room.code).emit('spinqa_answering_start', {
    asker: {
      id: room.spinQA.askerId,
      name: room.spinQA.askerName,
      persona: room.spinQA.persona
    },
    question: room.spinQA.question,
    keywords: room.spinQA.keywords,
    timer: 120
  });

  io.to(room.code).emit('announcement', {
    title: '🎤 120 GIÂY ĐÁP XOAY BẮT ĐẦU!',
    msg: `Hãy ghép các từ khóa vào lời đáp trả sắc bén nhất gửi tới ${room.spinQA.persona.name}!`
  });

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      clearInterval(room.timerInterval);
      finishSpinQAAnswering(room);
    }
  }, 1000);
}

function finishSpinQAAnswering(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  // Ai chưa nộp câu đáp thì tự động gán câu đáp hài hước
  room.players.forEach(p => {
    if (p.id !== room.spinQA.askerId && !room.spinQA.responderAnswers.has(p.id)) {
      room.spinQA.responderAnswers.set(p.id, {
        responderId: p.id,
        responderName: p.name,
        answerText: `(Thí sinh câm nín, không nói nên lời trước câu hỏi quá xoáy của ${room.spinQA.persona.name}!)`,
        votesMap: new Map()
      });
    }
  });

  startSpinQAReview(room);
}

// Menu chấm điểm: Lần lượt hiện các câu đáp kèm đối chứng câu hỏi & từ khóa
function startSpinQAReview(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'SPIN_QA_REVIEW';

  const answersList = Array.from(room.spinQA.responderAnswers.values());
  if (answersList.length === 0) {
    io.to(room.code).emit('announcement', {
      title: 'HẾT GIỜ!',
      msg: 'Không có câu đáp nào được nộp!'
    });
    setTimeout(() => startRoundSummary(room), 2500);
    return;
  }

  let answerIndex = 0;

  function showNextAnswer() {
    if (answerIndex >= answersList.length) {
      // Tính điểm tổng kết vòng cho Người Hỏi (Chuẩn hóa 1 - 10đ)
      const asker = room.players.get(room.spinQA.askerId);
      if (asker) {
        const bonus = room.spinQA.askerBonusTotal || 0;
        const askerRoundScore = Math.max(1, Math.min(10, bonus > 0 ? bonus : 5));
        asker.roundScore = askerRoundScore;
        asker.score += askerRoundScore;
      }
      startRoundSummary(room);
      return;
    }

    const currentAnswer = answersList[answerIndex];
    currentAnswer.votesMap = new Map();

    room.spinQA.currentReview = {
      askerName: room.spinQA.askerName,
      persona: room.spinQA.persona,
      question: room.spinQA.question,
      keywords: room.spinQA.keywords,
      responderId: currentAnswer.responderId,
      responderName: currentAnswer.responderName,
      answerText: currentAnswer.answerText,
      currentIndex: answerIndex + 1,
      total: answersList.length
    };
    room.timerSeconds = 15;

    broadcastRoom(room);
    io.to(room.code).emit('announcement', {
      title: `CHẤM ĐIỂM ĐÁP XOAY (${answerIndex + 1}/${answersList.length})`,
      msg: `Thí sinh "${currentAnswer.responderName}" đối đầu ${room.spinQA.persona.name}!`
    });

    room.timerInterval = setInterval(() => {
      room.timerSeconds--;
      io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

      if (room.timerSeconds <= 0) {
        clearInterval(room.timerInterval);

        // Chuẩn hóa điểm bài đáp: Trung bình vote, làm tròn >= 0.5 lên 1 (1 - 10đ)
        const votes = Array.from(currentAnswer.votesMap.values());
        const rawAvg = votes.length > 0 ? (votes.reduce((sum, v) => sum + v, 0) / votes.length) : 7.5;
        const finalScore = Math.max(1, Math.min(10, Math.round(rawAvg)));

        // 1. Cộng điểm cho Người Đáp (Điểm bài thi 1 - 10đ)
        const responder = room.players.get(currentAnswer.responderId);
        if (responder) {
          responder.roundScore = finalScore;
          responder.score += finalScore;
        }

        // 2. YÊU CẦU 1.6 & 1.7: Đối với Người Hỏi, các bài đáp nào dưới 8 điểm thì Người Hỏi được CỘNG 2 ĐIỂM!
        let askerBonus = 0;
        if (rawAvg < 8.0) {
          askerBonus = 2;
          room.spinQA.askerBonusTotal = (room.spinQA.askerBonusTotal || 0) + 2;
        }
        const asker = room.players.get(room.spinQA.askerId);

        const bonusMsg = askerBonus > 0 
          ? ` • Câu hỏi quá hiểm hóc (< 8đ) ➔ Người hỏi (${room.spinQA.askerName}) được +2 điểm!` 
          : '';

        io.to(room.code).emit('announcement', {
          title: 'KẾT QUẢ ĐỐI CHẤT',
          msg: `"${currentAnswer.responderName}": ${rawAvg.toFixed(1)}/10đ ➔ +${finalScore} điểm!${bonusMsg}`
        });

        io.to(room.code).emit('spinqa_answer_graded', {
          responderId: currentAnswer.responderId,
          responderName: currentAnswer.responderName,
          avg: rawAvg.toFixed(1),
          finalScore: finalScore,
          askerId: room.spinQA.askerId,
          askerBonus: askerBonus,
          responderTotalScore: responder ? responder.score : 0,
          askerTotalScore: asker ? (asker.score + (room.spinQA.askerBonusTotal || 0)) : 0
        });

        setTimeout(() => {
          answerIndex++;
          showNextAnswer();
        }, 2200);
      }
    }, 1000);
  }

  showNextAnswer();
}

// --- MINIGAME 2: ĐẠI CHIẾN NỐI TỪ (ĐỐI KHÁNG) ---
function startWordChainGame(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'WORD_CHAIN';

  // Khởi tạo trạng thái nối từ
  const activePlayers = Array.from(room.players.values());
  activePlayers.forEach(p => {
    p.eliminated = false;
    p.roundScore = 1;
  });

  const startingWord = getRandomStartingWord();
  room.wordChain = {
    currentWord: startingWord,
    usedWords: new Set([startingWord]),
    history: [{ word: startingWord, player: "Giám Thị", time: Date.now() }],
    turnIndex: 0,
    alivePlayerIds: activePlayers.map(p => p.id),
    eliminationOrder: [],
    currentTurnPlayerId: activePlayers[0].id,
    turnTimeLeft: 15 // 15 giây mỗi lượt (Yêu cầu 1.4)
  };

  broadcastRoom(room);
  io.to(room.code).emit('announcement', {
    title: '⚔️ ĐẠI CHIẾN NỐI TỪ',
    msg: `Giám thị mở đầu bằng từ: "${startingWord.toUpperCase()}". Mỗi lượt 15 giây, ai sai hoặc bí từ sẽ bị loại!`
  });

  startWordChainTurn(room);
}

function startWordChainTurn(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  const wc = room.wordChain;
  if (!wc) return;

  // Lọc người chơi còn sống
  wc.alivePlayerIds = wc.alivePlayerIds.filter(id => {
    const p = room.players.get(id);
    return p && !p.eliminated;
  });

  if (wc.alivePlayerIds.length <= 1) {
    // Chỉ còn 1 người sống sót hoặc hòa
    const winnerId = wc.alivePlayerIds[0];
    const winner = room.players.get(winnerId);

    // Chuẩn hóa tính điểm đối kháng (Yêu cầu 1.4):
    // Top 1: 10đ | Top 2: 9đ | Top 3: 8đ | Còn lại: 1đ
    const allParticipants = Array.from(room.players.values());
    const elim = wc.eliminationOrder || [];
    
    // Top 2: người bị loại cuối cùng
    const top2Id = elim.length >= 1 ? elim[elim.length - 1] : null;
    // Top 3: người bị loại áp chót
    const top3Id = elim.length >= 2 ? elim[elim.length - 2] : null;

    if (winner) {
      winner.roundScore = 10;
      winner.score += 10;
    }
    const top2 = top2Id ? room.players.get(top2Id) : null;
    if (top2 && top2.id !== winnerId) {
      top2.roundScore = 9;
      top2.score += 9;
    }
    const top3 = top3Id ? room.players.get(top3Id) : null;
    if (top3 && top3.id !== winnerId && top3.id !== top2Id) {
      top3.roundScore = 8;
      top3.score += 8;
    }

    const assignedIds = new Set([winnerId, top2Id, top3Id]);
    allParticipants.forEach(p => {
      if (!assignedIds.has(p.id)) {
        p.roundScore = 1;
        p.score += 1;
      }
    });

    const wName = winner ? winner.name : 'Vô địch';
    const t2Name = top2 ? top2.name : '';
    const t3Name = top3 ? top3.name : '';

    io.to(room.code).emit('announcement', {
      title: '🏆 KẾT THÚC ĐẠI CHIẾN NỐI TỪ!',
      msg: `Top 1 "${wName}": +10đ${t2Name ? ` | Top 2 "${t2Name}": +9đ` : ''}${t3Name ? ` | Top 3 "${t3Name}": +8đ` : ''} | Còn lại: +1đ!`
    });
    if (winner) {
      io.to(room.code).emit('trigger_animation', { playerId: winner.id, anim: 'cheer' });
    }
    setTimeout(() => startRoundSummary(room), 3500);
    return;
  }

  // Chọn người tới lượt
  if (wc.turnIndex >= wc.alivePlayerIds.length) {
    wc.turnIndex = 0;
  }
  wc.currentTurnPlayerId = wc.alivePlayerIds[wc.turnIndex];
  wc.turnTimeLeft = 15;

  const currentTurnPlayer = room.players.get(wc.currentTurnPlayerId);

  broadcastRoom(room);
  io.to(room.code).emit('word_turn_start', {
    playerId: wc.currentTurnPlayerId,
    playerName: currentTurnPlayer ? currentTurnPlayer.name : 'Unknown',
    currentWord: wc.currentWord,
    turnTimeLeft: 15
  });

  // Đếm ngược 15 giây
  room.timerInterval = setInterval(() => {
    wc.turnTimeLeft--;
    io.to(room.code).emit('turn_timer_tick', { turnTimeLeft: wc.turnTimeLeft });

    if (wc.turnTimeLeft <= 0) {
      clearInterval(room.timerInterval);
      eliminatePlayer(room, wc.currentTurnPlayerId, "Hết 15 giây suy nghĩ!");
    }
  }, 1000);
}

function processWordSubmission(room, playerId, word) {
  const wc = room.wordChain;
  if (!wc || wc.currentTurnPlayerId !== playerId) return;

  const player = room.players.get(playerId);
  if (!player || player.eliminated) return;

  const validation = validateWord(word, wc.currentWord, wc.usedWords);
  if (!validation.valid) {
    // Báo lỗi từ không hợp lệ
    io.to(room.code).emit('word_invalid', {
      playerId: playerId,
      word: word,
      reason: validation.reason
    });
    return;
  }

  // Hợp lệ!
  if (room.timerInterval) clearInterval(room.timerInterval);

  const matchedWord = validation.normalizedWord;
  wc.usedWords.add(matchedWord);
  wc.currentWord = matchedWord;

  wc.history.push({
    word: matchedWord,
    player: player.name,
    playerId: player.id,
    time: Date.now()
  });

  io.to(room.code).emit('word_valid', {
    playerId: player.id,
    playerName: player.name,
    word: matchedWord,
    scoreAdded: 0,
    newScore: player.score
  });

  // Chuyển lượt kế tiếp
  wc.turnIndex++;
  setTimeout(() => {
    if (room.state === 'WORD_CHAIN') {
      startWordChainTurn(room);
    }
  }, 1200);
}

function eliminatePlayer(room, playerId, reason) {
  const player = room.players.get(playerId);
  if (player) {
    player.eliminated = true;
    if (room.wordChain) {
      if (!room.wordChain.eliminationOrder) room.wordChain.eliminationOrder = [];
      if (!room.wordChain.eliminationOrder.includes(playerId)) {
        room.wordChain.eliminationOrder.push(playerId);
      }
    }
    io.to(room.code).emit('player_eliminated', {
      playerId: player.id,
      playerName: player.name,
      reason: reason
    });
    io.to(room.code).emit('trigger_animation', { playerId: player.id, anim: 'cry' });
  }

  setTimeout(() => {
    if (room.state === 'WORD_CHAIN') {
      startWordChainTurn(room);
    }
  }, 1800);
}

// --- TỔNG KẾT VÒNG (ROUND SUMMARY) ---
function startRoundSummary(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'ROUND_SUMMARY';
  room.round++;
  room.timerSeconds = 3; // Yêu cầu 1.4: Tự động đóng trong 3 giây

  // YÊU CẦU 1.7: Chỉ hiện điểm của bài thi đó (1-10đ)
  const sortedPlayers = Array.from(room.players.values())
    .sort((a, b) => (b.roundScore || 1) - (a.roundScore || 1));

  broadcastRoom(room);
  io.to(room.code).emit('round_summary_start', {
    round: room.round - 1,
    leaderboard: sortedPlayers.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      roundScore: p.roundScore || 1,
      score: p.roundScore || 1,
      totalScore: p.score
    }))
  });

  // Kích hoạt pháo hoa giấy 3D và hoạt ảnh ăn mừng cho Top 1
  if (sortedPlayers.length > 0) {
    io.to(room.code).emit('trigger_confetti', { topPlayerId: sortedPlayers[0].id });
    io.to(room.code).emit('trigger_animation', { playerId: sortedPlayers[0].id, anim: 'cheer' });
  }

  room.timerInterval = setInterval(() => {
    room.timerSeconds--;
    io.to(room.code).emit('timer_tick', { timer: room.timerSeconds });

    if (room.timerSeconds <= 0) {
      finishRoundSummary(room);
    }
  }, 1000);
}

function finishRoundSummary(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  // Yêu cầu 1.4: Tất cả dữ liệu bài thi và vote chọn bài thi phải bị reset (NGOẠI TRỪ ĐIỂM ĐÃ LƯU)
  room.votes = { DRAWING: 0, WORD_CHAIN: 0, SPIN_QA: 0 };
  room.votedPlayers = new Set();
  room.currentPrompt = null;
  room.drawingPrompts = null;
  room.drawingPlayers = null;
  room.allDrawings = null;
  room.reviewDrawing = null;
  room.wordChain = null;
  room.spinQA = null;
  room.state = 'LOBBY';

  room.players.forEach(p => {
    p.drawingData = null;
    p.customPrompt = null;
    p.assignedTurnPrompt = null;
    p.hasSubmittedCurrentTurn = false;
    p.eliminated = false;
    // p.score ĐƯỢC GIỮ NGUYÊN!
  });

  broadcastRoom(room);
  io.to(room.code).emit('round_summary_end');
}

// --- SOCKET.IO EVENT HANDLERS ---
io.on('connection', (socket) => {
  let currentRoom = null;
  let playerObj = null;

  // Gửi thông tin mạng và địa chỉ PC máy chủ ngay khi client kết nối (Yêu cầu 1.8)
  socket.emit('server_network_info', getServerNetworkInfo());

  // 1. Tạo phòng
  socket.on('create_room', ({ playerName, characterModel, skinColor, characterType, color, accessory, hatColor }, callback) => {
    const code = generateRoomCode();
    const room = {
      code: code,
      hostId: socket.id,
      state: 'LOBBY',
      round: 1,
      timerSeconds: 0,
      players: new Map(),
      reviewDrawing: null,
      wordChain: null,
      spinQA: null,
      timerInterval: null
    };

    const skin = characterModel || characterType || 'Casual_Male';
    playerObj = {
      id: socket.id,
      name: playerName || 'Học Sinh ' + (room.players.size + 1),
      characterModel: skin,
      characterType: skin,
      skinColor: skinColor || '#f0c294',
      color: color || '#2563eb',
      accessory: accessory || 'headband',
      hatColor: hatColor || '#dc2626',
      seatIndex: 0,
      score: 0,
      isReady: true,
      eliminated: false,
      drawingData: null,
      customPrompt: null,
      hasSubmittedCurrentTurn: false
    };

    room.players.set(socket.id, playerObj);
    rooms.set(code, room);
    currentRoom = room;

    socket.join(code);
    callback({ success: true, roomCode: code, state: getRoomState(room) });
    broadcastRoom(room);
  });

  // 2. Vào phòng
  socket.on('join_room', ({ roomCode, playerName, characterModel, skinColor, characterType, color, accessory, hatColor }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      return callback({ success: false, message: 'Phòng không tồn tại!' });
    }
    if (room.players.size >= 12) {
      return callback({ success: false, message: 'Phòng đã đủ 12 học sinh!' });
    }

    // Chọn ghế trống (0 - 11)
    const usedSeats = new Set(Array.from(room.players.values()).map(p => p.seatIndex));
    let seat = 0;
    for (let i = 0; i < 12; i++) {
      if (!usedSeats.has(i)) {
        seat = i;
        break;
      }
    }

    const joinSkin = characterModel || characterType || 'Casual_Male';
    playerObj = {
      id: socket.id,
      name: playerName || 'Học Sinh ' + (room.players.size + 1),
      characterModel: joinSkin,
      characterType: joinSkin,
      skinColor: skinColor || '#f0c294',
      color: color || '#16a34a',
      accessory: accessory || 'none',
      hatColor: hatColor || '#dc2626',
      seatIndex: seat,
      score: 0,
      isReady: true,
      eliminated: false,
      drawingData: null,
      customPrompt: null,
      hasSubmittedCurrentTurn: false
    };

    room.players.set(socket.id, playerObj);
    currentRoom = room;

    socket.join(code);
    callback({ success: true, roomCode: code, state: getRoomState(room) });
    broadcastRoom(room);

    io.to(code).emit('announcement', {
      title: 'HỌC SINH MỚI VÀO LỚP',
      msg: `"${playerObj.name}" vừa ngồi vào bàn ${Math.floor(playerObj.seatIndex / 2) + 1}!`
    });
  });

  // 3. Bắt đầu bình chọn / vào game (Yêu cầu 1.6: Bỏ bot, tối thiểu 2 người chơi thật)
  socket.on('start_game', (callback) => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      return callback && callback({ success: false, message: 'Chỉ Chủ phòng mới có quyền bắt đầu!' });
    }
    if (currentRoom.players.size < 2) {
      return callback && callback({ success: false, message: 'Cần ít nhất 2 sĩ tử để bắt đầu kì thi!' });
    }

    startVotingPhase(currentRoom);
    if (callback) callback({ success: true });
  });

  // 4. Bình chọn môn thi (3 môn)
  socket.on('cast_vote', ({ choice }) => {
    if (!currentRoom || currentRoom.state !== 'VOTING') return;
    if (currentRoom.votedPlayers.has(socket.id)) return;

    if (choice === 'DRAWING' || choice === 'WORD_CHAIN' || choice === 'SPIN_QA') {
      currentRoom.votes[choice] = (currentRoom.votes[choice] || 0) + 1;
      currentRoom.votedPlayers.add(socket.id);
      io.to(currentRoom.code).emit('vote_update', { votes: currentRoom.votes });

      // YÊU CẦU 1.8: Khi tất cả người chơi đã chọn bài thi thì ngay lập tức đếm ngược xuống còn 2 giây
      if (currentRoom.votedPlayers.size >= currentRoom.players.size) {
        if (currentRoom.timerSeconds > 2) {
          currentRoom.timerSeconds = 2;
          io.to(currentRoom.code).emit('timer_tick', { timer: currentRoom.timerSeconds });
          io.to(currentRoom.code).emit('announcement', {
            title: '⚡ TẤT CẢ ĐÃ CHỌN XONG!',
            msg: 'Cả lớp đã chọn xong môn thi! Đếm ngược 2 giây chuẩn bị phát đề!'
          });
        }
      }
    }
  });

  // 5. Gửi đề bài vẽ của mình (30s)
  socket.on('submit_drawing_prompt', ({ promptText }) => {
    if (!currentRoom || currentRoom.state !== 'DRAWING_PROMPT_INPUT') return;
    const cleanPrompt = (promptText || '').trim().slice(0, 60);
    if (!cleanPrompt || !playerObj) return;

    playerObj.customPrompt = cleanPrompt;
    playerObj.hasSubmittedCurrentTurn = true;
    if (!currentRoom.drawingPrompts) currentRoom.drawingPrompts = new Map();
    currentRoom.drawingPrompts.set(socket.id, cleanPrompt);

    io.to(currentRoom.code).emit('prompt_submitted', { playerId: socket.id });

    // Kiểm tra nếu tất cả đã nộp đề
    const allSubmitted = Array.from(currentRoom.players.values()).every(p => !!p.customPrompt);
    if (allSubmitted) {
      if (currentRoom.timerInterval) clearInterval(currentRoom.timerInterval);
      startDrawingRotation(currentRoom);
    }
  });

  // 6. Nộp bài vẽ tranh lượt hiện tại (60s)
  socket.on('submit_drawing', ({ drawingData }) => {
    if (!currentRoom || currentRoom.state !== 'DRAWING_TIME') return;
    if (!playerObj || playerObj.hasSubmittedCurrentTurn) return;

    playerObj.drawingData = drawingData;
    playerObj.hasSubmittedCurrentTurn = true;

    if (!currentRoom.allDrawings) currentRoom.allDrawings = [];
    const promptInfo = playerObj.assignedTurnPrompt || { promptAuthorName: "Bạn học", promptText: "Đề bài bí mật" };

    currentRoom.allDrawings.push({
      id: 'draw_' + Math.random().toString(36).substr(2, 9),
      drawerId: socket.id,
      drawerName: playerObj.name,
      promptAuthorId: promptInfo.promptAuthorId,
      promptAuthorName: promptInfo.promptAuthorName,
      promptText: promptInfo.promptText,
      drawingData: drawingData,
      votesMap: new Map()
    });

    io.to(currentRoom.code).emit('player_submitted_drawing', { playerId: socket.id });

    // Kiểm tra nếu tất cả người chơi đã nộp bài của lượt này
    const allSubmitted = currentRoom.drawingPlayers.every(p => !!p.hasSubmittedCurrentTurn);
    if (allSubmitted) {
      finishDrawingTurn(currentRoom);
    }
  });

  // 7. Chấm điểm bài vẽ (sao, cà chua, tim)
  socket.on('rate_drawing', ({ type, stars }) => {
    if (!currentRoom || currentRoom.state !== 'DRAWING_REVIEW') return;
    if (!currentRoom.reviewDrawing) return;
    if (currentRoom.reviewDrawing.drawerId === socket.id) return; // Không tự chấm mình

    const drawingList = currentRoom.allDrawings || [];
    const currentItem = drawingList[currentRoom.reviewDrawing.currentIndex - 1];
    if (!currentItem || !currentItem.votesMap) return;

    let voteScore = 6;
    if (type === 'tomato') {
      voteScore = 1;
    } else if (type === 'heart') {
      voteScore = 10;
    } else if (type === 'star') {
      const s = Math.min(5, Math.max(1, parseInt(stars) || 3));
      voteScore = s * 2;
    }
    currentItem.votesMap.set(socket.id, voteScore);

    io.to(currentRoom.code).emit('drawing_reaction', {
      authorId: currentRoom.reviewDrawing.drawerId,
      fromPlayerId: socket.id,
      type: type,
      stars: stars,
      voteScore: voteScore
    });
  });

  // 8. HỎI XOÁY ĐÁP XOAY: Người hỏi gửi câu hỏi (30s)
  socket.on('submit_spinqa_question', (data) => {
    if (!currentRoom || currentRoom.state !== 'SPIN_QA_SETUP') return;
    if (!currentRoom.spinQA || currentRoom.spinQA.askerId !== socket.id) return;

    const rawQ = (data && (data.question || data.questionText)) || '';
    const cleanQ = rawQ.trim().slice(0, 120);
    if (cleanQ) {
      currentRoom.spinQA.question = cleanQ;
      io.to(currentRoom.code).emit('spinqa_question_submitted');

      // Nếu tất cả người đáp cũng đã nộp từ khóa thì chuyển ngay
      const responders = Array.from(currentRoom.players.values()).filter(p => p.id !== socket.id);
      const allKw = responders.every(p => currentRoom.spinQA.responderKeywords.has(p.id));
      if (allKw) {
        finishSpinQASetup(currentRoom);
      }
    }
  });

  // 9. HỎI XOÁY ĐÁP XOAY: Người đáp gửi từ khóa (30s)
  socket.on('submit_spinqa_keyword', ({ keyword }) => {
    if (!currentRoom || currentRoom.state !== 'SPIN_QA_SETUP') return;
    if (!currentRoom.spinQA || currentRoom.spinQA.askerId === socket.id) return;

    const cleanKw = (keyword || '').trim().slice(0, 25);
    if (cleanKw) {
      currentRoom.spinQA.responderKeywords.set(socket.id, cleanKw);
      io.to(currentRoom.code).emit('spinqa_keyword_submitted', { playerId: socket.id });

      const responders = Array.from(currentRoom.players.values()).filter(p => p.id !== currentRoom.spinQA.askerId);
      const allKw = responders.every(p => currentRoom.spinQA.responderKeywords.has(p.id));
      if (allKw && currentRoom.spinQA.question) {
        finishSpinQASetup(currentRoom);
      }
    }
  });

  // 10. HỎI XOÁY ĐÁP XOAY: Người đáp gửi câu trả lời (120s)
  socket.on('submit_spinqa_answer', ({ answerText }) => {
    if (!currentRoom || currentRoom.state !== 'SPIN_QA_ANSWERING') return;
    if (!currentRoom.spinQA || currentRoom.spinQA.askerId === socket.id) return;
    if (!playerObj || playerObj.hasSubmittedCurrentTurn) return;

    const cleanAns = (answerText || '').trim().slice(0, 200);
    if (cleanAns) {
      currentRoom.spinQA.responderAnswers.set(socket.id, {
        responderId: socket.id,
        responderName: playerObj.name,
        answerText: cleanAns,
        votesMap: new Map()
      });
      playerObj.hasSubmittedCurrentTurn = true;

      io.to(currentRoom.code).emit('spinqa_player_submitted', {
        responderId: socket.id,
        responderName: playerObj.name
      });

      // Kiểm tra nếu tất cả người đáp đã nộp
      const responders = Array.from(currentRoom.players.values()).filter(p => p.id !== currentRoom.spinQA.askerId);
      const allAns = responders.every(p => currentRoom.spinQA.responderAnswers.has(p.id));
      if (allAns) {
        finishSpinQAAnswering(currentRoom);
      }
    }
  });

  // 11. HỎI XOÁY ĐÁP XOAY: Chấm điểm câu đáp
  socket.on('rate_spinqa_answer', ({ type, stars }) => {
    if (!currentRoom || currentRoom.state !== 'SPIN_QA_REVIEW') return;
    if (!currentRoom.spinQA || !currentRoom.spinQA.currentReview) return;
    if (currentRoom.spinQA.currentReview.responderId === socket.id) return; // Không tự chấm mình

    const answersList = Array.from(currentRoom.spinQA.responderAnswers.values());
    const currentItem = answersList[currentRoom.spinQA.currentReview.currentIndex - 1];
    if (!currentItem || !currentItem.votesMap) return;

    let voteScore = 6;
    if (type === 'tomato') {
      voteScore = 1;
    } else if (type === 'heart') {
      voteScore = 10;
    } else if (type === 'star') {
      const s = Math.min(5, Math.max(1, parseInt(stars) || 3));
      voteScore = s * 2;
    }
    currentItem.votesMap.set(socket.id, voteScore);

    io.to(currentRoom.code).emit('spinqa_reaction', {
      responderId: currentRoom.spinQA.currentReview.responderId,
      fromPlayerId: socket.id,
      type: type,
      stars: stars,
      voteScore: voteScore
    });
  });

  // 8. Nộp từ Nối từ
  socket.on('submit_word', ({ word }) => {
    if (!currentRoom || currentRoom.state !== 'WORD_CHAIN') return;
    processWordSubmission(currentRoom, socket.id, word);
  });

  // 9. Đóng bảng tổng kết ngay lập tức (Nhấn bất kỳ đâu)
  socket.on('dismiss_summary', () => {
    if (currentRoom && currentRoom.state === 'ROUND_SUMMARY') {
      finishRoundSummary(currentRoom);
    }
  });

  // 10. Ném Bút / Phao 3D
  socket.on('throw_projectile', ({ toPlayerId, type }) => {
    if (!currentRoom) return;
    const target = currentRoom.players.get(toPlayerId);
    if (!target) return;

    io.to(currentRoom.code).emit('projectile_thrown', {
      fromPlayerId: socket.id,
      toPlayerId: toPlayerId,
      type: type || 'pen' // 'pen', 'paper', 'chalk'
    });
  });

  // 11. Gửi Biểu cảm & Hoạt ảnh
  socket.on('send_reaction', ({ emoji }) => {
    if (!currentRoom || !playerObj) return;
    let anim = 'idle';
    if (emoji === '🎉') anim = 'cheer';
    if (emoji === '😭') anim = 'cry';
    if (emoji === '🙏') anim = 'pray';

    io.to(currentRoom.code).emit('player_reaction', {
      playerId: socket.id,
      emoji: emoji,
      anim: anim
    });
  });

  // 12. Gửi tin nhắn Chat
  socket.on('send_chat', ({ message }) => {
    if (!currentRoom || !playerObj) return;
    const cleanMsg = (message || '').trim().slice(0, 100);
    if (!cleanMsg) return;

    io.to(currentRoom.code).emit('chat_message', {
      id: 'msg_' + Date.now(),
      playerId: socket.id,
      playerName: playerObj.name,
      text: cleanMsg,
      time: Date.now()
    });
  });

  // 13. Cập nhật diện mạo (tên, skin nhân vật 3D, màu da - Yêu cầu 2.0)
  socket.on('update_customization', ({ name, characterModel, skinColor, characterType, color, accessory, hatColor }) => {
    if (!currentRoom || !playerObj) return;
    if (name) playerObj.name = name.slice(0, 20);
    const skin = characterModel || characterType;
    if (skin) {
      playerObj.characterModel = skin;
      playerObj.characterType = skin;
    }
    if (skinColor) playerObj.skinColor = skinColor;
    if (color) playerObj.color = color;
    if (accessory) playerObj.accessory = accessory;
    if (hatColor) playerObj.hatColor = hatColor;

    broadcastRoom(currentRoom);
  });

  // 14. Di chuyển nhân vật ở sảnh chờ (Yêu cầu 1.7)
  socket.on('player_move', (data) => {
    if (!currentRoom || !playerObj) return;
    if (currentRoom.state !== 'LOBBY') return;

    playerObj.x = data.x;
    playerObj.z = data.z;
    playerObj.rot = data.rot;
    playerObj.isMoving = !!data.isMoving;
    playerObj.isSitting = !!data.isSitting;
    if (data.seatIndex !== undefined) playerObj.seatIndex = data.seatIndex;

    // Broadcast tới tất cả người chơi khác trong phòng
    socket.to(currentRoom.code).emit('player_moved', {
      playerId: socket.id,
      x: data.x,
      z: data.z,
      rot: data.rot,
      isMoving: playerObj.isMoving,
      isSitting: playerObj.isSitting,
      seatIndex: playerObj.seatIndex
    });
  });

  // Tương tác ngồi / đứng dậy với bàn ghế
  socket.on('player_seat_interact', ({ isSitting, seatIndex }) => {
    if (!currentRoom || !playerObj) return;
    playerObj.isSitting = isSitting;
    if (seatIndex !== undefined) playerObj.seatIndex = seatIndex;

    io.to(currentRoom.code).emit('player_seated', {
      playerId: socket.id,
      isSitting: isSitting,
      seatIndex: playerObj.seatIndex
    });
  });

  // 15. Ngắt kết nối
  socket.on('disconnect', () => {
    if (currentRoom && playerObj) {
      currentRoom.players.delete(socket.id);
      if (currentRoom.players.size === 0) {
        if (currentRoom.timerInterval) clearInterval(currentRoom.timerInterval);
        rooms.delete(currentRoom.code);
      } else {
        // Nếu host rời, chuyển quyền cho người tiếp theo
        if (currentRoom.hostId === socket.id) {
          const nextPlayer = Array.from(currentRoom.players.values()).find(p => !p.isBot);
          if (nextPlayer) {
            currentRoom.hostId = nextPlayer.id;
          }
        }
        broadcastRoom(currentRoom);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const currentLanIp = getLocalIpAddress();
  const hotspotIp = getHotspotIpAddress();
  const pcHost = os.hostname();
  console.log(`=======================================================`);
  console.log(`🎓 KÌ THI ĐỊA NGỤC (HELL EXAM) - 3D MULTIPLAYER GAME`);
  console.log(`💻 Tên máy chủ PC: ${pcHost}`);
  console.log(`🚀 Server đang chạy tại:`);
  console.log(`   - Local (Máy này):        http://localhost:${PORT}`);
  if (hotspotIp) {
    console.log(`   - Mobile Hotspot (Phát):  http://${hotspotIp}:${PORT}`);
  }
  console.log(`   - Mạng LAN / Wi-Fi:       http://${currentLanIp}:${PORT}`);
  console.log(`👉 Mở trên cùng Wi-Fi / Hotspot để chơi trên điện thoại / laptop!`);
  console.log(`=======================================================`);
  startCloudflareTunnel();
});
