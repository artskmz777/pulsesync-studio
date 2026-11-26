# PulseSync Studio

**เครื่องมือซิงก์เสียงดนตรีและคลื่นสเปกตรัมบนเบราว์เซอร์ (ประมวลผลบนเครื่องผู้ใช้ 100%)**

- **Live Web App:** https://artskmz777.github.io/pulsesync-studio/
- **Repository:** https://github.com/artskmz777/pulsesync-studio

## จุดเด่นและสถาปัตยกรรม

1. **Client-Side 100% — ไม่ต้องส่งไฟล์ขึ้นเซิร์ฟเวอร์**
   - รองรับ **ภาพนิ่ง + เสียง** (`.png`, `.jpg`, `.webp` + `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) พร้อม `Cover/Contain` และ `Bleed Margin` 10–18%
   - รองรับ **วิดีโอ + เสียงเดิม** และ **วิดีโอ + เสียงใหม่** (`.mp4`, `.webm`, `.mov`) พร้อมตัวเลือก **Loop Video** อัตโนมัติเมื่อวิดีโอสั้นกว่าไฟล์เสียง
2. **Dual-Band DSP Engine ใน Web Worker (Radix-2 FFT)**
   - **ระบบเบส (20–140 Hz / ปรับจุดตัด 60–160 Hz):** ใช้ Onset Detection + Rolling Energy Average + Asymmetric Attack (`10–25 ms`) / Release (`140–280 ms`) Envelope Follower ให้ภาพกระตุกตรงจังหวะกลองอย่างนุ่มนวล พร้อม Micro Shake (Sine-damped) และ Bass Glow
   - **ระบบคลื่นดนตรี (160–16,000 Hz เท่านั้น):** ตัดย่านเบสออกทั้งหมดด้วย Hard High-Pass Bin Masking + Butterworth High-Pass Filter (160 Hz) พร้อม Logarithmic Frequency Mapping 64 แบนด์
3. **คลื่นดนตรี 15 แบบ (โครงสร้างเชิงเส้น/มิติ ไม่มีวงกลม)**
   - Classic Spectrum Bars, Mirrored Symmetric Bars, Smooth Bezier Wave, Layered Silk Ribbons, Audio Mountain Fill, High-Pass Oscilloscope, Retro LED Block Matrix, Floating Pill Bars, Dual Neon Horizon, Dot Matrix Wave, Slanted Kinetic Bars, Horizontal Stereo Strips, Melodic Particle Stream, 3D Perspective Terrain, Fine-Line Hairline Spectrum
4. **ชุดสีไล่เฉด 3 สี 20 แบบ**
   - รองรับการเลือกทิศทางไล่เฉด (แนวนอน / แนวตั้ง / เฉียง)
5. **ส่งออกไฟล์ MP4 แบบออฟไลน์ทีละเฟรม (Deterministic Export)**
   - รองรับ 6 สัดส่วนภาพ: `16:9`, `3:2`, `1:1`, `4:5`, `2:3`, `9:16` (ที่ความละเอียด `1080p` / `720p`, `60 FPS` / `30 FPS`)
   - ใช้ `Mediabunny` + `WebCodecs API` (`VideoEncoder`, `AudioEncoder`, `VideoDecoder`, `VideoFrame`, `AudioData`) บน `OffscreenCanvas` พร้อมจัดการ Backpressure (`encodeQueueSize > 10`) และ `frame.close()` โดยไม่ใช้วิธีอัดหน้าจอ (`MediaRecorder` / `captureStream`)

## การรันและทดสอบบนเครื่อง

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```
