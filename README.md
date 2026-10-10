# 🎓 Kì Thi Địa Ngục (Hell Exam) - Web 3D School Party Game

Web 3D Party Game nhiều người chơi phong cách học đường hài hước Việt Nam, hỗ trợ chơi qua mạng LAN Wi-Fi nội bộ hoặc Online, đồng bộ thời gian thực (real-time multiplayer).

---

## 🌟 Tính Năng Nổi Bật

### 1. Đồ Họa 3D Low-Poly Học Đường (Three.js)
- **Không gian sân trường ngoài trời:** Nền cỏ xanh mướt, hoa dại rực rỡ, bầu trời xanh với mây trắng bồng bềnh trôi nhẹ, cột cờ Tổ quốc và hàng cây phượng vĩ đỏ thắm đặc trưng của mái trường Việt Nam.
- **Lớp học ngoài trời:** 6 bàn học sinh đôi bằng gỗ tự nhiên (có ngăn bàn, tấm chắn trước, giấy thi kẻ ô ly, bút bi) và ghế sắt chân kim loại.
- **Nhân vật 3D Low-poly:** Học sinh mặc áo đồng phục tùy biến màu sắc, thắt khăn quàng đỏ, tùy chọn phụ kiện (Mũ cử nhân 🎓, Băng rôn "QUYẾT THẮNG" 🎗️).
- **Hoạt ảnh diễn cảm sống động:**
  - `idle`: Ngồi đung đưa người, tay hí hoáy viết bài thi.
  - `cheer`: Nhảy cẫng lên ăn mừng, hai tay giơ cao reo hò chữ V.
  - `cry`: Gục đầu xuống mặt bàn khóc nức nở khi bị loại hoặc điểm kém.
  - `pray`: Hai tay chắp trước ngực cầu xin giám thị / lạy trời cho qua môn.
  - `hit`: Giật nảy mình khi bị ném bút / ném phao thi trúng người.
- **Bảng đen 3D & Băng rôn:**
  - Băng rôn khẩu hiệu: **"TIÊN HỌC LỄ • HẬU HỌC VĂN • TRƯỜNG THPT BÁ KHÍ"**.
  - Bảng đen trung tâm render trực tiếp bảng xếp hạng điểm số (Top 1, Top 2, Top 3...) bằng phấn trắng trên nền bảng xanh rêu theo thời gian thực.
  - **Pháo hoa giấy 3D (Confetti):** Bắn tung tóe khi tổng kết vòng thi và vinh danh thủ khoa.

### 2. Âm Thanh Tổng Hợp Học Đường (Web Audio API)
- 🥁 **Tiếng trống trường Việt Nam:** Tổng hợp sóng âm trầm bổng chân thực: *"TÙNG... TÙNG... TÙNG..."*.
- 🔔 **Chuông trường reo:** Báo hiệu vào tiết thi đấu.
- 🍅 **Tiếng ném cà chua:** Âm thanh bẹp/bẹt hài hước.
- ❤️ **Tiếng thả tim & tiếng sao leng keng:** Hiệu ứng tích điểm vui nhộn.
- 💨 **Tiếng vút ném phao & cạch thước kẻ:** Mô phỏng phòng thi sống động.

### 3. Cơ Chế Gameplay & Phòng Chờ
- **Sảnh chờ (Lobby & LAN Discovery):**
  - Tự động phát hiện địa chỉ IP mạng Wi-Fi (ví dụ: `http://192.168.1.X:3000`).
  - Bạn bè cùng bắt Wi-Fi chỉ cần mở trình duyệt điện thoại/laptop gõ địa chỉ IP là có thể kết nối ngay lập tức!
  - Chủ phòng (Host) có nút **"🚀 BẮT ĐẦU"** to ở góc trên, mở Modal điều hành để thêm Bot AI (nếu chơi một mình hoặc ít người) và khởi động bình chọn.
- **Giai đoạn bình chọn (Voting Phase):** Đếm ngược 10 giây để cả phòng bỏ phiếu giữa 2 bài thi:
  1. 🎨 **"Vẽ Tranh Hội Thảo" (Scored):** Giám thị ra đề bài bất ngờ (vd: *"Thầy giám thị bắt phao"*, *"Con vịt 0 điểm"*, *"Học sinh ngủ gật"*...). Mọi người dùng Canvas vẽ trong 30s. Sau đó từng tranh được đưa lên cho cả lớp chấm điểm: 1-5 sao, ném cà chua (-2đ), thả tim (+8đ).
  2. ⚔️ **"Đại Chiến Nối Từ" (Battle):** Đấu vòng tròn theo lượt (7 giây/lượt). Kiểm tra từ điển tiếng Việt tự động. Ai hết giờ hoặc bí từ sẽ bị loại. Người sống sót cuối cùng ôm trọn +50 điểm thưởng!
- **Tương tác trong lớp học:**
  - Khung chat học đường với các câu nói cửa miệng: *"Cứu tao!"*, *"Đề khó vãi 😭"*, *"Cho chép bài với!"*, *"Mách cô nè!"*.
  - Nút biểu cảm nhanh: 🎉 (Ăn mừng), 😭 (Khóc gục), 🙏 (Cầu may).
  - 🚀 **"Ném Bút / Phao":** Chọn bàn bạn học để phóng máy bay giấy phao thi hoặc bút bi bay hình vòng cung 3D sang bàn đối phương kèm âm thanh và phản ứng giật mình!

---

## 🛠️ Cấu Trúc Dự Án

```
hell-exam-3d/
├── package.json           # Khai báo dependencies (express, socket.io)
├── server.js              # Server Node.js + Express + Socket.io realtime, quản lý phòng & Bot
├── lib/
│   └── dictionary.js      # Từ điển tiếng Việt phong phú & bộ kiểm tra nối từ
├── public/                # Thư mục web client tĩnh
│   ├── index.html         # Giao diện chính, Tailwind CSS, HUD & Canvas vẽ
│   ├── css/
│   │   └── style.css      # Style học đường, glassmorphism, keyframes
│   └── js/
│       ├── audio.js       # Bộ tổng hợp âm thanh Web Audio API (trống trường, chuông...)
│       ├── characters.js  # Mô hình học sinh 3D, đồng phục, phụ kiện & hoạt ảnh
│       ├── scene3d.js     # Three.js sân trường, 6 bàn đôi, bảng đen Canvas & pháo hoa 3D
│       └── game.js        # Controller xử lý Socket.io, Canvas vẽ, Nối từ & Chat
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt các thư viện cần thiết:
```bash
npm install
```

### 2. Khởi chạy Server:
```bash
npm start
```
hoặc:
```bash
node server.js
```

### 3. Truy cập và chơi:
- **Trên máy chủ (Host):** Mở trình duyệt vào [http://localhost:3000](http://localhost:3000).
- **Trên các thiết bị khác (Điện thoại, Tablet, Laptop) cùng mạng Wi-Fi:** 
  - Xem địa chỉ IP hiển thị trên màn hình dòng lệnh của server (hoặc trên thanh tiêu đề của game, ví dụ: `http://192.168.1.13:3000`).
  - Gõ địa chỉ đó vào trình duyệt trên điện thoại là có thể vào chơi chung ngay lập tức!
- **Chơi một mình:** Tạo phòng mới, bấm **"🚀 BẮT ĐẦU"** -> Chọn **"Thêm Học Sinh Bot AI"** (có thể thêm 2-5 Bot như *Học Bá Nam, Thánh Cúp Học, Bé Bắp Lớp Phó...*), sau đó bấm **"TIẾN HÀNH BÌNH CHỌN MÔN THI"** để thi đấu cùng AI!
