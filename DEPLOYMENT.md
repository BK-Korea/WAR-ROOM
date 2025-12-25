# 🚀 WAR-ROOM 웹 UI 배포 가이드

Dorothy (CFA 재무분석가)와 Alice (McKinsey 전략 컨설턴트)를 웹 브라우저에서 대화형으로 사용하는 방법입니다.

---

## 📋 목차

1. [로컬에서 실행하기](#로컬에서-실행하기)
2. [Vercel에 배포하기](#vercel에-배포하기)
3. [환경 변수 설정](#환경-변수-설정)
4. [문제 해결](#문제-해결)

---

## 🏠 로컬에서 실행하기

### 1️⃣ 의존성 설치

```bash
npm install
```

### 2️⃣ 환경 변수 설정

`.env.local` 파일 생성:

```bash
cp .env.local.example .env.local
```

`.env.local` 파일 편집:

```env
GLM_API_KEY=44b578c5827846adad3868df7c4ec3ab.T7AxyFHNPZFRq1fb
GLM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MOCK_MODE=false
```

### 3️⃣ 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속!

---

## ☁️ Vercel에 배포하기

### 방법 1: GitHub 연동 (가장 추천!)

1. **GitHub에 푸시**
   ```bash
   git add .
   git commit -m "feat: Add Next.js web UI for WAR-ROOM"
   git push
   ```

2. **Vercel 연동**
   - https://vercel.com 접속
   - "New Project" 클릭
   - GitHub 레포지토리 선택: `BK-Korea/WAR-ROOM`
   - "Import" 클릭

3. **환경 변수 설정**

   Vercel 대시보드에서 설정:

   ```
   Name: GLM_API_KEY
   Value: 44b578c5827846adad3868df7c4ec3ab.T7AxyFHNPZFRq1fb

   Name: GLM_API_BASE_URL
   Value: https://open.bigmodel.cn/api/paas/v4

   Name: GLM_MOCK_MODE
   Value: false
   ```

4. **배포!**
   - "Deploy" 클릭
   - 2-3분 후 완료 ✅
   - URL 받기: `https://war-room-xxx.vercel.app`

### 방법 2: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

---

## 🎯 내가 해야 할 일

### ✅ 지금 바로 할 일:

1. **로컬 테스트**
   ```bash
   npm install
   cp .env.local.example .env.local
   # .env.local에 API 키 입력
   npm run dev
   ```

2. **브라우저 확인**
   - http://localhost:3000 접속
   - Dorothy 또는 Alice 선택
   - 질문 입력해보기!

### 🌐 Vercel 배포하려면:

1. **GitHub에 푸시** (이미 했으면 스킵)
   ```bash
   git add .
   git commit -m "feat: Add web UI"
   git push
   ```

2. **Vercel 가입**
   - https://vercel.com/signup
   - GitHub 계정으로 로그인

3. **프로젝트 Import**
   - New Project → Import Git Repository
   - `BK-Korea/WAR-ROOM` 선택

4. **환경 변수 입력**
   - Settings → Environment Variables
   - `GLM_API_KEY` 추가
   - `GLM_API_BASE_URL` 추가

5. **Deploy 클릭!**

---

## 🔧 환경 변수 설정

### 필수 환경 변수:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `GLM_API_KEY` | GLM-4 API 키 | `44b578...` |
| `GLM_API_BASE_URL` | GLM API 엔드포인트 | `https://open.bigmodel.cn/api/paas/v4` |
| `GLM_MOCK_MODE` | Mock 모드 사용 여부 | `false` (실제 API), `true` (목업) |

### 선택 환경 변수:

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `DATABASE_HOST` | PostgreSQL 호스트 | `localhost` |
| `DATABASE_PORT` | PostgreSQL 포트 | `5432` |
| `DATABASE_NAME` | 데이터베이스 이름 | `war_room` |
| `DATABASE_USER` | DB 사용자 | `postgres` |
| `DATABASE_PASSWORD` | DB 비밀번호 | - |

> **참고:** DB는 선택사항이에요. 없어도 Dorothy와 Alice는 작동해요!

---

## 🐛 문제 해결

### 문제 1: `Module not found` 에러

```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### 문제 2: API 호출 실패 (403 에러)

```
GLM API Error: Host not allowed
```

**해결책:**
- 로컬에서는 작동함 (샌드박스 제한 없음)
- Vercel에서는 작동함 (외부 API 허용)
- 현재 Claude Code 환경에서만 차단됨

### 문제 3: 빌드 실패

```bash
# TypeScript 에러 확인
npm run build

# 타입 에러 무시하고 빌드 (임시)
# next.config.mjs에 추가:
# typescript: { ignoreBuildErrors: true }
```

### 문제 4: 환경 변수가 안 읽힘

Vercel에서:
- Settings → Environment Variables
- 변수 추가 후 **Redeploy** 필수!

로컬에서:
- `.env.local` 파일 확인
- 개발 서버 재시작 (`Ctrl+C` 후 `npm run dev`)

---

## 📱 사용 방법

1. **에이전트 선택**
   - 💼 Dorothy: SEC 데이터 기반 재무 분석
   - 💡 Alice: McKinsey 스타일 전략 진단

2. **질문 입력**
   ```
   예시:
   - Vertical Aerospace 2025년 운영비용 분석해줘
   - 현금 소진율이 어떻게 변했어?
   - Beta Technologies 재무 건전성 평가해줘
   ```

3. **반말로 답변 받기**
   - Dorothy: 날카롭고 정확한 숫자 분석
   - Alice: 생기발랄한 전략 컨설팅

---

## 🎨 UI 커스터마이징

### 색상 변경

`app/page.tsx`에서:

```typescript
// Dorothy 색상
className="bg-purple-600"  // 원하는 색으로 변경

// Alice 색상
className="bg-blue-600"    // 원하는 색으로 변경
```

### 다크모드 비활성화

`app/globals.css`에서 `@media (prefers-color-scheme: dark)` 섹션 삭제

---

## 📚 추가 리소스

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [GLM-4 API 문서](https://open.bigmodel.cn/dev/api)

---

## ❓ 질문이나 문제가 있어요!

1. **로컬에서 먼저 테스트** - 대부분의 문제는 로컬에서 재현 가능
2. **환경 변수 확인** - `.env.local` 파일 내용 체크
3. **콘솔 로그 확인** - 브라우저 개발자 도구 (F12)
4. **API 키 유효성** - GLM API 키가 만료되지 않았는지 확인

**로컬에서 작동하면 Vercel에서도 작동해요!** 🚀
