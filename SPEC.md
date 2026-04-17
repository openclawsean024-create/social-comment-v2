# 社群留言自動回覆系統 v2 — 產品規格書

> **版本**：v2.0  
> **更新日期**：2026-04-12  
> **狀態**：✅ IMPLEMENTED  
> **Git Commit**：4b3da7d

---

## 一、願景與產品定位

**一句話價值主張**：手動粘貼論壇/粉絲頁留言，系統自動匹配關鍵字回覆，一鍵複製貼回。

**目標受眾**：台灣粉絲團管理員、客服人員、小編

**核心定位**：輕量级、半自動化的社群留言回覆工具。粘貼留言 → 關鍵字匹配 → 複製回覆 → 貼回 Facebook。

---

## 二、功能架構

### 2.1 頁面清單

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 登入頁 | `/` | 密碼驗證（admin123）|
| 留言回覆（儀表板）| `/dashboard` | 粘貼留言、查看統計 |
| 關鍵字設定 | `/keywords` | 管理關鍵字規則 |
| 待審核列 | `/review` | 審核、複製、批量操作 |
| 回覆歷史 | `/history` | 查看歷史紀錄、匯出 |

### 2.2 登入流程

- 密碼驗證（固定密碼： `admin123`）
- 透過 `sessionStorage` 儲存登入狀態
- 未登入時自動導回登入頁

### 2.3 留言解析（Dashboard）

**支援格式**：

| 格式 | 範例 |
|------|------|
| 冒號分隔 | `王小明：我想報名這個活動` |
| 豎線分隔 | `李小美｜想要了解更多詳情` |
| Tab/多空白分隔 | `張阿強    留個言支持一下` |

**解析流程**：
1. 用戶粘貼多行留言文字
2. 系統自動偵測格式並解析
3. 套用關鍵字規則，自動帶入回覆內容
4. 有符合關鍵字的留言自動加入待審核列

### 2.4 關鍵字規則（Keywords）

- 關鍵字 + 回覆內容 + 匹配模式
- **精準模式**：完全等於關鍵字
- **模糊模式**：包含關鍵字（預設）
- 支援測試功能
- 規則儲存於 `localStorage`

### 2.5 待審核列（Review）

- 顯示所有待審核回覆
- 支援複製（單筆 / 批量）
- 支援刪除
- 審核後自動移至歷史記錄

### 2.6 回覆歷史（History）

- 最近 100 筆已審核回覆
- 支援 TXT / CSV 匯出
- 支援複製全部

### 2.7 AI 回覆生成（API）

**端點**：`POST /api/generate-reply`

**請求 body**：
```json
{
  "comment": "留言內容",
  "template": "default" | "friendly" | "promo"
}
```

**回應**：
```json
{
  "reply": "生成的王覆內容"
}
```

**模板**：

| 模板 | 用途 |
|------|------|
| default | 一般品牌小編（50字以內）|
| friendly | 輕鬆口語化（40字以內）|
| promo | 帶品牌資訊（60字以內）|

**技術規格**：
- Edge Runtime 部署
- GPT-3.5-turbo 模型
- `OPENAI_API_KEY` 環境變數

---

## 三、技術架構

### 3.1 前端

| 技術 | 版本 |
|------|------|
| Next.js | 16.2.3 |
| React | 19.2.4 |
| TypeScript | ✅ |
| Tailwind CSS | v4 |

### 3.2 後端

| 技術 | 說明 |
|------|------|
| Next.js API Routes | Edge Runtime |
| OpenAI API | GPT-3.5-turbo |
| localStorage | 用戶端持久化 |

### 3.3 環境變數

| 變數 | 說明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key（用於生成回覆）|

---

## 四、數據模型

### 4.1 ParsedComment（解析後留言）

```typescript
interface ParsedComment {
  id: string;
  name: string;
  comment: string;
  status: 'pending' | 'replied';
  matchedKeyword?: string;
  replyContent?: string;
}
```

### 4.2 KeywordRule（關鍵字規則）

```typescript
interface KeywordRule {
  id: string;
  keyword: string;
  reply: string;
  matchMode: 'exact' | 'fuzzy';
}
```

### 4.3 PendingReply（待審核回覆）

```typescript
interface PendingReply {
  id: string;
  name: string;
  comment: string;
  reply: string;
  timestamp: number;
}
```

### 4.4 HistoryEntry（歷史記錄）

```typescript
interface HistoryEntry {
  id: string;
  name: string;
  comment: string;
  reply: string;
  timestamp: number;
}
```

---

## 五、localStorage Key 一覽

| Key | 資料 |
|-----|------|
| `social_reply_logged_in` | 登入狀態（session）|
| `social_reply_comments` | 留言列表 |
| `social_reply_keywords` | 關鍵字規則 |
| `social_reply_pending` | 待審核回覆 |
| `social_reply_history` | 回覆歷史（最多100筆）|

---

## 六、部署

| 平台 | URL |
|------|-----|
| Vercel | https://social-comment-v2.vercel.app |
| GitHub | https://github.com/openclawsean024-create/social-comment-v2 |

---

## 七、已實作功能清單

- [x] 登入頁（密碼驗證）
- [x] 留言粘貼解析（3種格式）
- [x] 關鍵字規則管理（精準/模糊匹配）
- [x] 關鍵字測試功能
- [x] 待審核列（支援批量操作）
- [x] 回覆歷史（支援TXT/CSV匯出）
- [x] OpenAI 回覆生成 API
- [x] localStorage 持久化
- [x] Vercel 部署

---

*規格書版本：v2.0*
*更新時間：2026-04-12*
*負責人：Alan（技術長）*
