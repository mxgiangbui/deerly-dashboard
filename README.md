# TheDeerly Dashboard

P&L Dashboard cho TheDeerly — Next.js + Tailwind + Recharts

## Deploy lên Vercel

### Bước 1 — Push lên GitHub
```bash
cd /Users/leo/.openclaw/workspace-wally/dashboard-deerly
git init (đã có)
git remote add origin https://github.com/<your-username>/deerly-dashboard.git
git add .
git commit -m "Initial dashboard build"
git push -u origin main
```

### Bước 2 — Deploy trên Vercel
1. Vào vercel.com → New Project
2. Import GitHub repo vừa push
3. Framework: Next.js (auto-detect)
4. Click Deploy → xong!

## Cập nhật data hàng ngày

Sau khi cron job chạy (2:15PM), copy file mới vào public/data/:
```bash
cp /Users/leo/.openclaw/workspace-wally/data/deerly/computed/daily_pnl.json \
   /Users/leo/.openclaw/workspace-wally/dashboard-deerly/public/data/daily_pnl.json
```

Để Vercel tự cập nhật, cần push lên GitHub sau mỗi lần sync.
(Wally sẽ handle bước này trong cron job sau)

## Dev local
```bash
npm run dev
# → http://localhost:3000
```
