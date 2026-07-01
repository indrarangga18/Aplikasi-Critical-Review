# Critical Review RIS

Aplikasi web (Next.js 14) untuk menganalisis file **RIS** hasil ekspor Scopus/Mendeley/Zotero.
Merupakan port dari notebook Colab "Critical Review RIS" ke TypeScript sehingga bisa berjalan
sepenuhnya di browser dan di-deploy gratis ke **Vercel**.

## Fitur

- **Halaman depan bertahap**: input nama + email → unggah `.ris` (drag & drop) → judul, topik, 5–10 keyword.
- **Analisis penuh di browser** (tanpa Python): kualitas data, keyword strength, identifikasi masalah/gap,
  co-occurrence, peluang riset, sinyal emerging, **Novelty Score**, dan rekomendasi kombinasi topik.
- **Visualisasi** dengan Recharts (bar, tren, diverging, heatmap co-occurrence).
- **Unduh laporan** HTML mandiri (bisa dibuka/di-print jadi PDF).
- **Kirim laporan ke email** via Resend (lampiran HTML).

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi RESEND_API_KEY bila ingin fitur email
npm run dev                  # http://localhost:3100
```

File contoh untuk uji coba tersedia di `public/contoh.ris`.

## Deploy ke Vercel

1. Push folder `ris-analyzer` ini ke sebuah repo GitHub (atau jalankan `vercel` dari CLI).
2. Di Vercel, **Import Project** → framework terdeteksi otomatis sebagai **Next.js**.
   Root Directory = `ris-analyzer` bila repo berisi proyek lain.
3. Tambahkan Environment Variables (opsional, untuk fitur email):
   - `RESEND_API_KEY` — dari <https://resend.com/api-keys>
   - `REPORT_FROM_EMAIL` — mis. `onboarding@resend.dev` (uji coba) atau alamat di domain terverifikasi.
4. **Deploy**. Selesai — analisis berjalan client-side, pengiriman email lewat route `/api/send-report`.

> Tanpa `RESEND_API_KEY`, semua fitur tetap jalan; hanya tombol "Kirim ke Email" yang menampilkan
> pesan bahwa email belum dikonfigurasi. Tombol "Unduh HTML" selalu berfungsi.

## Catatan metodologis

Analisis memakai **pencocokan kata kunci**, bukan pemahaman makna. Homonim/sinonim tidak ditangani,
dan **Novelty Score bukan metrik bibliometrik standar** (bobotnya dipilih manual). Gunakan hasilnya
sebagai titik awal, lalu validasi dengan membaca paper aktual.
