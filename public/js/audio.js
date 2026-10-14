// public/js/audio.js - Web Audio API Synthesized Sound Effects cho "Kì Thi Địa Ngục"
// Tự tổng hợp âm thanh học đường: Tiếng trống trường, chuông reo, ném cà chua, tiếng ném phao, v.v.

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // 1. Tiếng trống trường Việt Nam: "TÙNG... TÙNG... TÙNG..."
  playSchoolDrum(hits = 3) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    let delay = 0;
    for (let i = 0; i < hits; i++) {
      setTimeout(() => {
        this._synthesizeDrumHit();
      }, delay);
      delay += (i < hits - 1) ? 550 : 300;
    }
  }

  // Tiếng đánh trống dồn: Tùng tùng tùng tùng!
  playDrumRoll() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const timings = [0, 400, 800, 1100, 1300, 1450, 1600, 1750];
    timings.forEach(t => {
      setTimeout(() => this._synthesizeDrumHit(0.8), t);
    });
  }

  _synthesizeDrumHit(volume = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Oscillator trầm mô phỏng mặt da trống gỗ
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Lọc dải thấp tạo độ ấm và vang của thùng gỗ
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    osc.type = 'sine';
    // Cao độ tụt nhanh từ 140Hz xuống 55Hz
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

    // Tiếng bập bùng âm sắc
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.85 * volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    // Tiếng dùi gỗ gõ mặt da trống (Noise burst)
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 350;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4 * volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(now);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  // 2. Tiếng chuông trường điện tử: "Renggggggggg"
  playSchoolBell() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [880, 1175, 1760];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.15, now);
      // Rung tần số 12Hz tạo tiếng chuông cơ học
      for (let i = 0; i < 20; i++) {
        const t = now + i * 0.05;
        gain.gain.setValueAtTime(i % 2 === 0 ? 0.2 : 0.05, t);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  // 3. Tiếng ném cà chua: bẹp/bẹt
  playTomatoSplat() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // 4. Tiếng thả tim cute
  playHeartChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2); // C6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 5. Tiếng chấm sao: Ding!
  playStarDing(count = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const baseFreq = 659.25 + (count * 80); // E5 +
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 6. Tiếng còi buzzer khi sai hoặc hết giờ
  playBuzzer() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.setValueAtTime(110, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // 7. Tiếng vút ném phao / ném bút
  playWhoosh() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // 8. Tiếng gõ bàn / thước kẻ cạch cạch
  playDeskTap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 9. Tiếng ăn mừng chiến thắng (Fanfare)
  playFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [
      { f: 523.25, d: 150 }, // C5
      { f: 659.25, d: 150 }, // E5
      { f: 783.99, d: 150 }, // G5
      { f: 1046.50, d: 450 } // C6
    ];

    let delay = 0;
    notes.forEach(n => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + (n.d / 1000));

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + (n.d / 1000) + 0.05);
      }, delay);
      delay += n.d;
    });
  }

  // Tiếng click nút
  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Tiếng nổ tung khi người chơi bị loại (Yêu cầu 2.5)
  playExplosion() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Tiếng bùm trầm (Bass boom)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    oscGain.gain.setValueAtTime(0.85, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);

    // 2. Tiếng nổ mảnh vỡ (Noise blast)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.8);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.16));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.7);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 9. Âm thanh biểu cảm Ăn Mừng 🎉 (Yêu cầu 3.0: Chuỗi chuông vui nhộn)
  playCheer() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const delay = idx * 0.08;
      const noteTime = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.28, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }

  // 10. Âm thanh biểu cảm Khóc Gục 😭 (Yêu cầu 3.0: Kèn trombone hài hước ảo não)
  playCry() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [311.13, 293.66, 277.18, 261.63]; // Eb4 -> D4 -> C#4 -> C4
    notes.forEach((freq, idx) => {
      const delay = idx * 0.16;
      const noteTime = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);
      if (idx === notes.length - 1) {
        osc.frequency.exponentialRampToValueAtTime(175, noteTime + 0.45);
      }

      const dur = idx === notes.length - 1 ? 0.5 : 0.14;
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + dur);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, noteTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + dur + 0.05);
    });
  }

  // 11. Âm thanh biểu cảm Cầu May 🙏 (Yêu cầu 3.0: Chuông thiền Zen thanh tịnh)
  playPray() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [432, 864].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const vol = idx === 0 ? 0.25 : 0.12;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
    });
  }

  // 12. Âm thanh biểu cảm Đo Ván 😵 (Yêu cầu 3.0: Tiếng choáng váng lò xo ngộ nghĩnh)
  playDizzy() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.12;
      osc.frequency.linearRampToValueAtTime(460, t + 0.06);
      osc.frequency.linearRampToValueAtTime(240, t + 0.12);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}

// Khởi tạo đối tượng toàn cục
window.audioMgr = new AudioManager();
