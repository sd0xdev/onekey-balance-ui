# ONEKEY BALANCE UI - 蒸汽波風格資產管理界面

這個專案是一個基於 Svelte 和 Tailwind CSS v4 的加密貨幣資產管理界面，以蒸汽波 (Vaporwave) 復古未來主義風格呈現。結合霓虹色彩、復古視覺元素和現代UI設計，創造出獨特的用戶體驗。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<p align="center">
  <img src="https://raw.githubusercontent.com/sd0xdev/onekey-balance-kit/main/docs/assets/logo.png" alt="OneKeyBalanceKit Logo" width="200">
</p>




## 📺 預覽影片

<video src="https://github.com/user-attachments/assets/41f74444-7794-404f-ae75-15382db9c5f4" width="640" height="360" controls muted></video>

<p align="center">
  <a href="https://raw.githubusercontent.com/sd0xdev/onekey-balance-ui/main/docs/demo.mp4" target="_blank">點擊此處查看演示視頻</a>
</p>

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

## 👥 如何貢獻

我們非常歡迎並感謝所有形式的社區貢獻！無論是提交錯誤報告、功能建議、改進文檔還是提交程式碼，您的參與對我們都非常重要。

請查看我們的 [貢獻指南](CONTRIBUTING.md) 以了解有關參與本專案的詳細信息。

### 貢獻流程

1. Fork 本專案
2. 創建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m '添加一些驚人的特性'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟一個 Pull Request

## 🔒 安全

如果您發現安全漏洞，請不要在公開的 GitHub 問題中報告它們。請查看我們的 [安全政策](SECURITY.md) 了解如何報告安全問題。

## 📄 授權

本專案採用 MIT 許可證 - 詳情請參見 [LICENSE](LICENSE) 文件。

## 📞 聯繫方式

如果您有任何問題或建議，請通過以下方式聯繫我們：

- 提交 [GitHub 問題](https://github.com/your-username/onekey-balance-ui/issues)
- 在社交媒體上關注我們

---

<p align="center">⭐ 如果您喜歡這個專案，請給它一個星標！⭐</p>

## 📚 參考地址

以下是可用於測試或參考的以太坊地址：

- Ethereum 主網大額持幣地址: [0x28c6c06298d514db089934071355e5743bf21d60](https://etherscan.io/address/0x28c6c06298d514db089934071355e5743bf21d60)
