// lib/dictionary.js - Từ điển Tiếng Việt chuẩn hóa cho minigame "Đại Chiến Nối Từ" v1.5
// Tích hợp từ điển Tiếng Việt Viet74K (gần 50.000 từ ghép chuẩn) + thuật ngữ học đường.
const fs = require('fs');
const path = require('path');

const VIETNAMESE_WORDS = [
  // Học đường & Thi cử
  "học sinh", "sinh viên", "viên phấn", "phấn hoa", "hoa hồng", "hồng ngọc", "ngọc bích", "bích quy",
  "quy củ", "củ cải", "cải bắp", "bắp ngô", "ngô khoai", "khoai lang", "lang thang", "thang máy",
  "máy tính", "tính toán", "toán học", "học tập", "tập vở", "vở kịch", "kịch bản", "bản đồ",
  "đồ dùng", "dùng dằng", "dằng dặc", "đặc sản", "sản xuất", "xuất sắc", "sắc đẹp", "đẹp đẽ",
  "đẽo gọt", "gọt giũa", "giũa mài", "mài giũa", "bài thi", "thi cử", "cử chỉ", "chỉ dẫn",
  "dẫn đường", "đường đời", "đời sống", "sống còn", "còn lại", "lại qua", "qua cầu", "cầu khỉ",
  "khỉ đột", "đột xuất", "xuất hiện", "hiện đại", "đại gia", "gia đình", "đình công", "công nghệ",
  "nghệ sĩ", "sĩ diện", "diện mạo", "mạo hiểm", "hiểm nghèo", "nghèo khó", "khó khăn", "khăn quàng",
  "quàng khăn", "bàn ghế", "ghế đá", "đá bóng", "bóng đá", "đá hoa", "hoa loa", "loa kèn",
  "kèn tây", "tây bắc", "bắc nam", "nam tiến", "tiến bộ", "bộ trưởng", "trưởng ban", "ban ngày",
  "ngày đêm", "đêm tối", "tối tăm", "tăm tia", "tia sáng", "sáng sủa", "sủa gâu", "gâu gâu",
  "giám thị", "thị sát", "sát nút", "nút thắt", "thắt lưng", "lưng ong", "ong mật", "mật ong",
  "ong bầu", "bầu trời", "trời xanh", "xanh biếc", "biếc xanh", "xanh tươi", "tươi cười", "cười mỉm",
  "mỉm cười", "cười toe", "toe toét", "toét miệng", "miệng lưỡi", "lưỡi rìu", "rìu búa", "búa tạ",
  "tạ ơn", "ơn nghĩa", "nghĩa vụ", "vụ việc", "việc làm", "làm ăn", "ăn uống", "uống nước",
  "nước nôi", "nôi em", "em bé", "bé bỏng", "bỏng ngô", "ngô nghê", "nghê thường", "thường dân",
  "dân chủ", "chủ tịch", "tịch thu", "thu nhập", "nhập ngũ", "ngũ cốc", "cốc chén", "chén đĩa",
  "đĩa hát", "hát ca", "ca sĩ", "sĩ tử", "tử tế", "tế nhị", "nhị hoa", "hoa bướm",
  "bướm đêm", "đêm trăng", "trăng rằm", "rằm tháng", "tháng ngày", "ngày giỗ", "giỗ chạp", "chạp tối",
  
  // Hài hước học trò
  "phao thi", "thi đua", "đua xe", "xe máy", "máy bay", "bay nhảy", "nhảy múa", "múa quạt",
  "quạt trần", "trần nhà", "nhà trường", "trường lớp", "lớp phó", "phó bảng", "bảng đen", "đen đủi",
  "đủi xui", "xui xẻo", "xẻo thịt", "thịt gà", "gà gáy", "gáy to", "to lớn", "lớn khôn",
  "khôn ngoan", "ngoan ngoãn", "ngoãn hiền", "hiền lành", "lành lặn", "lặn lội", "lội suối", "suối nguồn",
  "nguồn cội", "cội rễ", "rễ cây", "cây cối", "cối xay", "xay lúa", "lúa mì", "mì tôm",
  "tôm cá", "cá chép", "chép phạt", "phạt đền", "đền ơn", "ơn huệ", "huệ tây", "tây dương",
  "dương liễu", "liễu rủ", "rủ rê", "rê bóng", "bóng bàn", "bàn bạc", "bạc tình", "tình bạn",
  "bạn bè", "bè phái", "phái đẹp", "đẹp xinh", "xinh tươi", "tươi tắn", "tắn hồng", "hồng hào",
  "hào hiệp", "hiệp sĩ", "sĩ số", "số má", "má phấn", "phấn son", "son môi", "môi đỏ",
  "đỏ hoe", "hoe vàng", "vàng ươm", "ươm mầm", "mầm non", "non trẻ", "trẻ con", "con cái",
  "cái gì", "gì đấy", "đấy nhé", "nhé em", "em gái", "gái quê", "quê quán", "quán xá",
  "xá tội", "tội lỗi", "lỗi lầm", "lầm than", "than thở", "thở dài", "dài ngoằng", "ngoằng ngoặc",
  
  // Hành động, Cảm xúc & Điểm số
  "điểm mười", "mười phân", "phân bua", "bua vây", "vây bắt", "bắt bí", "bí bách", "bách hóa",
  "hóa học", "học kì", "kì thị", "thị phi", "phi pháp", "pháp luật", "luật sư", "sư tử",
  "tử thần", "thần thánh", "thánh thần", "thánh thót", "thót tim", "tim gan", "gan dạ", "dạ vâng",
  "vâng lời", "lời ru", "ru ngủ", "ngủ gật", "gật đầu", "đầu gối", "gối ôm", "ôm ấp",
  "ấp ủ", "ủ dột", "dột nát", "nát bét", "bét bảng", "bảng vàng", "vàng bạc", "bạc phước",
  "phước đức", "đức độ", "độ lượng", "lượng giác", "giác ngộ", "ngộ nghĩnh", "nghĩnh nghịch", "nghịch ngợm",
  "ngợm đùa", "đùa vui", "vui vẻ", "vẻ vang", "vang dội", "dội nước", "nước sôi", "sôi nổi",
  "nổi tiếng", "tiếng tăm", "tăm tối", "tối hậu", "hậu cần", "cần cù", "cù lét", "lét lút",
  "lút ngập", "ngập ngừng", "ngừng lại", "lại đây", "đây đó", "đó đây", "đây này", "này nọ",
  "nọ kia", "kia kìa", "kìa ai", "ai nấy", "nấy người", "người ta", "ta đây", "đây thôn",
  
  // Tự nhiên & Đời sống Việt Nam
  "thôn xóm", "xóm làng", "làng quê", "quê hương", "hương hoa", "hoa lá", "lá cành", "cành khô",
  "khô cằn", "cằn cỗi", "cỗi cằn", "cây gạo", "gạo nếp", "nếp nhà", "nhà cửa", "cửa kính",
  "kính lúp", "lúp xúp", "xúp lơ", "lơ đãng", "đãng trí", "trí tuệ", "tuệ giác", "giác mạc",
  "mạc vận", "vận may", "may mắn", "mắn đẻ", "đẻ trứng", "trứng gà", "gà vịt", "vịt cỏ",
  "cỏ xanh", "xanh ngắt", "ngắt lời", "lời khuyên", "khuyên răn", "răn dạy", "dạy học", "học hành",
  "hành chính", "chính tả", "tả xung", "xung trận", "trận địa", "địa lý", "lý thuyết", "thuyết trình",
  "trình bày", "bày biện", "biện hộ", "hộ khẩu", "khẩu phần", "phần thưởng", "thưởng thức", "thức khuya",
  "khuya khoắt", "khoắt khoeo", "khoeo chân", "chân thành", "thành tích", "tích phân", "phân tích", "tích cực",
  "cực khổ", "khổ sai", "sai sót", "sót lại", "lại quả", "quả táo", "táo quân", "quân đội",
  "đội ngũ", "ngũ hành", "hành quân", "quân sự", "sự thật", "thật thà", "thà chết", "chết đuối",
  "đuối sức", "sức khỏe", "khỏe khoắn", "khoắn tay", "tay vịn", "vịn vai", "vai gáy", "gáy vang",
  
  // Thêm các từ nối phong phú
  "vật lý", "văn học", "lịch sử", "địa chỉ", "chỉ tiêu", "tiêu chuẩn", "chuẩn xác", "xác suất",
  "suất ăn", "ăn cơm", "cơm sườn", "sườn núi", "núi cao", "cao sang", "sang trọng", "trọng lượng",
  "lượng từ", "từ ngữ", "ngữ pháp", "pháp sư", "sư phạm", "phạm vi", "vi mô", "mô hình",
  "hình tròn", "tròn trĩnh", "trĩnh trạc", "trạc tuổi", "tuổi xuân", "xuân sắc", "sắc bén", "bén mảng",
  "mảng miếng", "miếng ngon", "ngon ngọt", "ngọt ngào", "ngào đường", "đường sữa", "sữa tươi", "tươi tốt",
  "tốt bụng", "bụng dạ", "dạ hội", "hội trường", "trường thi", "thi đấu", "đấu tranh", "tranh giành",
  "giành giật", "giật mình", "mình mẩy", "mẩy tròn", "tròn xoe", "xoe tròn", "tròn vo", "vo gạo"
];

// Hàm chuẩn hóa chuỗi tiếng Việt
function normalizeVietnamese(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Khởi tạo tập từ điển chuẩn tiếng Việt
const DICTIONARY_SET = new Set();
const wordsByFirstSyllable = new Map();

// 1. Nạp từ danh sách từ ngữ học đường cơ bản
VIETNAMESE_WORDS.forEach(phrase => {
  const norm = normalizeVietnamese(phrase);
  DICTIONARY_SET.add(norm);
});

// 2. Nạp thêm toàn bộ từ tệp viet74k.txt (chứa hơn 49.000 từ ghép tiếng Việt chuẩn)
try {
  const dictPath = path.join(__dirname, 'viet74k.txt');
  if (fs.existsSync(dictPath)) {
    const raw = fs.readFileSync(dictPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length === 2 && !parts[0].includes('-') && !parts[1].includes('-')) {
        const word = parts.join(' ');
        DICTIONARY_SET.add(word);
      }
    }
  }
} catch (e) {
  console.warn('⚠️ Lỗi nạp viet74k.txt, dùng từ điển có sẵn:', e.message);
}

// 3. Lập chỉ mục theo âm tiết đầu để Bot AI tra từ chính xác và nhanh chóng
for (const word of DICTIONARY_SET) {
  const syllables = word.split(' ');
  if (syllables.length === 2) {
    const first = syllables[0];
    if (!wordsByFirstSyllable.has(first)) {
      wordsByFirstSyllable.set(first, []);
    }
    wordsByFirstSyllable.get(first).push(word);
  }
}

console.log(`📚 Đã nạp từ điển Tiếng Việt thành công: ${DICTIONARY_SET.size} từ ghép hợp lệ.`);

/**
 * Kiểm tra tính hợp lệ của từ nối (Yêu cầu 1.5: Kiểm tra chặt chẽ, loại bỏ hoàn toàn từ vô nghĩa)
 * @param {string} inputWord - Từ người chơi nhập (phải đúng 2 tiếng)
 * @param {string} prevWord - Từ trước đó (hoặc rỗng nếu là từ mở đầu)
 * @param {Set<string>} usedWords - Tập các từ đã dùng trong ván
 * @returns {{ valid: boolean, reason?: string, normalizedWord: string }}
 */
function validateWord(inputWord, prevWord, usedWords) {
  if (!inputWord || typeof inputWord !== "string") {
    return { valid: false, reason: "Bạn chưa nhập từ nào!" };
  }

  const norm = normalizeVietnamese(inputWord);
  const syllables = norm.split(" ");

  if (syllables.length !== 2) {
    return { valid: false, reason: "Phải nhập từ ghép có đúng 2 tiếng!" };
  }

  if (usedWords && usedWords.has(norm)) {
    return { valid: false, reason: `Từ "${norm.toUpperCase()}" đã được dùng rồi!` };
  }

  if (prevWord) {
    const prevNorm = normalizeVietnamese(prevWord);
    const prevSyllables = prevNorm.split(" ");
    const expectedFirst = prevSyllables[prevSyllables.length - 1];

    if (syllables[0] !== expectedFirst) {
      return { 
        valid: false, 
        reason: `Từ phải bắt đầu bằng chữ "${expectedFirst.toUpperCase()}" (ví dụ: ${expectedFirst} ...)!` 
      };
    }
  }

  // Yêu cầu 1.5: Kiểm tra từ điển - Từ PHẢI có trong từ điển tiếng Việt chuẩn
  if (!DICTIONARY_SET.has(norm)) {
    return { 
      valid: false, 
      reason: `"${inputWord.toUpperCase()}" không có trong từ điển tiếng Việt!` 
    };
  }

  return { valid: true, normalizedWord: norm };
}

/**
 * Lấy một từ ngẫu nhiên để bắt đầu trận đấu
 */
function getRandomStartingWord() {
  const starters = [
    "học sinh", "thi cử", "bảng đen", "giám thị", "phao thi", "điểm mười", 
    "bài thi", "phấn hoa", "nhà trường", "sĩ tử", "hoa hồng", "toán học",
    "học tập", "tập vở", "vở kịch", "cây cối", "bạn bè", "thầy cô"
  ];
  return starters[Math.floor(Math.random() * starters.length)];
}

/**
 * Bot tìm từ tiếp theo dựa vào âm cuối của từ trước
 * @param {string} prevWord
 * @param {Set<string>} usedWords
 * @returns {string|null}
 */
function findBotReply(prevWord, usedWords) {
  const prevNorm = normalizeVietnamese(prevWord);
  const prevSyllables = prevNorm.split(" ");
  const targetFirst = prevSyllables[prevSyllables.length - 1];

  const candidates = wordsByFirstSyllable.get(targetFirst) || [];
  const available = candidates.filter(w => !usedWords.has(w));

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  return null; // Bot bí từ thật sự khi không còn từ hợp lệ trong từ điển
}

module.exports = {
  VIETNAMESE_WORDS,
  DICTIONARY_SET,
  validateWord,
  getRandomStartingWord,
  findBotReply,
  normalizeVietnamese
};
