# ONEKEY BALANCE UI - 蒸汽波風格資產管理界面

![主題預覽](https://via.placeholder.com/800x400)

這個專案是一個基於 Svelte 和 Tailwind CSS v4 的加密貨幣資產管理界面，以蒸汽波 (Vaporwave) 復古未來主義風格呈現。結合霓虹色彩、復古視覺元素和現代UI設計，創造出獨特的用戶體驗。

## ✨ 特色

- 🔮 蒸汽波 × 高級雜誌混合視覺風格
- 🌈 基於 Tailwind CSS v4 新功能構建
- 💾 VHS 掃描線、格子地面等復古美學元素
- 🎛️ 響應式設計與流暢動畫效果
- 📊 加密貨幣資產可視化界面
- 🧩 模組化組件設計

## 🎨 設計系統

### 色彩主題

```
--vwave-pink: #FF71CE - 主色彩/漸層起點
--vwave-cyan: #01CDFE - 主色彩/漸層終點
--vwave-mint: #05FFA1 - 強調色/交互元素
--vwave-lav:  #B967FF - 次要文字/補充元素
--vwave-sun:  #FFFB96 - 點綴高光/特殊標籤
```

### 字體系統

```
標題: "Bodoni Moda", serif — 奢華雜誌風格
代碼: "MS Gothic", monospace — 復古終端機風格
正文: 系統無襯線字體 — 清晰可讀
```

## 🚀 快速開始

### 安裝依賴

```bash
npm install
# 或
pnpm install
```

### 開發模式

```bash
npm run dev
# 或
pnpm dev
```

### 構建項目

```bash
npm run build
# 或
pnpm build
```

## 🧠 架構概述

```
src/
├── lib/
│   ├── components/    - UI 組件
│   ├── stores/        - Svelte 狀態管理
│   └── types/         - TypeScript 型別定義
├── routes/            - SvelteKit 路由
└── app.css            - 全局樣式
```

## 🧩 主要組件

- **Dashboard** - 主儀表板和資產總覽
- **ChainSelector** - 區塊鏈網絡選擇器
- **AddressInput** - 錢包地址輸入和驗證
- **SavedAddresses** - 已保存錢包地址管理

## 📐 設計特效

### 特殊視覺效果

- **掃描線效果** - `vhs-scanlines` 增強復古感
- **透視網格** - `grid-floor` 創建 3D 空間感
- **光暈效果** - `pulse-glow-*` 系列實現霓虹發光

### 動畫系統

- **卡片動畫** - 使用 `delay-card-*` 實現階梯式入場
- **懸停效果** - `hover-glow` 實現互動發光反饋
- **載入動畫** - 使用骨架屏和脈動效果

## 🔧 環境兼容性

- 支持現代瀏覽器
- 使用 Tailwind CSS v4 進行樣式管理
- 基於 SvelteKit 構建

## 📜 開發指南

開發新組件時，請遵循以下原則：

1. 保持蒸汽波風格的一致性
2. 使用現有的色彩和字體系統
3. 遵循 Tailwind CSS v4 最佳實踐
4. 避免過度使用視覺元素，保持「三件套」原則
5. 保持適當的空白和呼吸空間

## 📄 授權

MIT
