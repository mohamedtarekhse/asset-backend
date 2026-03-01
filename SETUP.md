# SAP Asset Management Backend — Setup Guide

## ─────────────────────────────────────────
## STEP 1 — Create Your .env File
## ─────────────────────────────────────────

1. Copy `.env.example` → rename it to `.env`
2. Open `.env` in Notepad
3. Replace the DATABASE_URL with your Supabase connection string:

   How to get it:
   - Go to https://supabase.com → your project
   - Project Settings → Database → Connection pooling
   - Mode: Transaction → click COPY
   - Paste it as: DATABASE_URL=paste_here

4. Generate JWT_SECRET by opening CMD and running:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   Copy the output and paste as JWT_SECRET=

Your final .env should look like:
DATABASE_URL=postgres://postgres.XXXX:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
JWT_SECRET=a3f8c2d1e4b5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
NODE_ENV=production
PORT=5000
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

## ─────────────────────────────────────────
## STEP 2 — Install Packages
## ─────────────────────────────────────────

Open CMD in this folder and run:
   npm install

## ─────────────────────────────────────────
## STEP 3 — Create Database Tables
## ─────────────────────────────────────────

Run migrations (creates all tables):
   node src/config/migrate.js

## ─────────────────────────────────────────
## STEP 4 — Load Sample Data
## ─────────────────────────────────────────

   node src/config/seed.js

You should see:
   ✅  PostgreSQL connected successfully
   🌱  Seeding database...
   🎉  Seed complete!

## ─────────────────────────────────────────
## STEP 5 — Run The Server
## ─────────────────────────────────────────

Development (auto-reload):
   npm run dev

Production:
   npm start

Test it works — open browser:
   http://localhost:5000/health

## ─────────────────────────────────────────
## STEP 6 — Deploy to Railway
## ─────────────────────────────────────────

1. Push to GitHub:
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/asset-backend.git
   git push -u origin main

2. Go to https://railway.app → New Project → Deploy from GitHub

3. Add these Railway Variables:
   DATABASE_URL  = (same as your .env)
   JWT_SECRET    = (same as your .env)
   NODE_ENV      = production
   FRONTEND_URL  = https://your-netlify-site.netlify.app
   OPENAI_API_KEY = sk-...
   OPENAI_MODEL   = gpt-4o-mini

## ─────────────────────────────────────────
## LOGIN CREDENTIALS (after seeding)
## ─────────────────────────────────────────

Email                   Password        Role
─────────────────────────────────────────────
admin@assetmgmt.com     Password123!    Admin
sara@assetmgmt.com      Password123!    Manager
layla@assetmgmt.com     Password123!    Editor
james@assetmgmt.com     Password123!    Viewer

## ─────────────────────────────────────────
## API ENDPOINTS
## ─────────────────────────────────────────

POST   /api/auth/login           Login
GET    /api/auth/me              Get current user
GET    /api/assets               List assets
POST   /api/assets               Create asset
PUT    /api/assets/:id           Update asset
DELETE /api/assets/:id           Delete asset
GET    /api/assets/export/excel  Download Excel
POST   /api/assets/import/excel  Upload Excel
GET    /api/bom                  List BOM items
POST   /api/bom                  Create BOM item
GET    /api/contracts            List contracts
GET    /api/rigs                 List rigs
GET    /api/companies            List companies
GET    /api/users                List users
GET    /api/notifications        Get notifications
POST   /api/email/send           Send email alert
POST   /api/ai/chat              Ask AI assistant
