import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMCompletionParams {
  model?: string;
  messages: GLMMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GLMResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GLMClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private mockMode: boolean;

  constructor() {
    this.apiKey = process.env.GLM_API_KEY || '';
    this.baseURL = process.env.GLM_API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    this.defaultModel = process.env.GLM_MODEL || 'glm-4-plus'; // Default: glm-4-plus (Max Plan)
    this.mockMode = process.env.GLM_MOCK_MODE === 'true';

    if (!this.apiKey && !this.mockMode) {
      console.warn('⚠️  GLM_API_KEY not found in environment variables');
    }

    if (this.mockMode) {
      console.log('🧪 GLM Client running in MOCK MODE (no API calls)');
    } else {
      console.log(`🤖 GLM Client using model: ${this.defaultModel}`);
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
  }

  async chat(params: GLMCompletionParams): Promise<string> {
    // Mock mode for testing without API access
    if (this.mockMode) {
      return this.generateMockResponse(params.messages);
    }

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[GLM API] Attempt ${attempt}/${maxRetries} - Model: ${params.model || this.defaultModel}`);

        const response = await this.client.post<GLMResponse>('/chat/completions', {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          top_p: params.top_p ?? 0.9,
          max_tokens: params.max_tokens ?? 2000,
          stream: false
        });

        // 성공 - Rate limit 헤더 로깅
        const headers = response.headers;
        console.log(`[GLM API] ✅ Success - Tokens: ${response.data.usage.total_tokens}`);
        if (headers['x-ratelimit-limit']) {
          console.log(`[GLM API] Rate Limit: ${headers['x-ratelimit-remaining']}/${headers['x-ratelimit-limit']}, Reset: ${headers['x-ratelimit-reset']}`);
        }

        return response.data.choices[0].message.content;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        const headers = error.response?.headers || {};

        // Rate limit 정보 로깅
        console.error(`[GLM API] ❌ Error ${status} (attempt ${attempt}/${maxRetries})`);
        if (headers['x-ratelimit-limit']) {
          console.error(`[GLM API] Rate Limit Info: ${headers['x-ratelimit-remaining']}/${headers['x-ratelimit-limit']}, Reset: ${headers['x-ratelimit-reset']}`);
        }
        console.error(`[GLM API] Error details:`, error.response?.data);

        // 429: Rate Limit - 재시도
        if (status === 429) {
          const retryAfter = headers['retry-after'] || headers['x-ratelimit-reset'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

          console.warn(`⚠️  Rate limit hit. Waiting ${waitTime/1000}s before retry...`);

          if (attempt < maxRetries) {
            await this.sleep(waitTime);
            continue;
          }
        }

        // 다른 에러는 즉시 throw
        break;
      }
    }

    // 모든 재시도 실패
    const status = lastError?.response?.status;
    if (status === 429) {
      throw new Error('API 요청 한도를 초과했어. 잠시 후 다시 시도해줘 (Rate Limit)');
    } else if (status === 401) {
      throw new Error('API 키가 유효하지 않아. 환경 변수를 확인해줘');
    } else if (status === 403) {
      throw new Error('API 접근 권한이 없어. API 키 설정을 확인해줘');
    } else {
      throw new Error(`GLM API 호출 실패: ${lastError.message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockResponse(messages: GLMMessage[]): string {
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const isDorothy = systemMessage.includes('Dorothy') || systemMessage.includes('CFA') || systemMessage.includes('SEC');
    const isAlice = systemMessage.includes('Alice') || systemMessage.includes('McKinsey') || systemMessage.includes('전략');

    // Dorothy Beta Technologies analysis (Korean)
    if (isDorothy && (lastMessage.includes('beta') || lastMessage.includes('베타'))) {
      return `## Beta Technologies 2024년 재무 주요사항 분석

**회사**: Beta Technologies, Inc. (eVTOL 항공기 제조사)
**보고서**: Form 10-K filed 2024년 12월 31일
**분석일**: 2024 회계연도

---

## 1. 매출 성장 분석 (전년 대비)

### 총 매출 실적

- **FY 2024**: $54,800K (출처: Form 10-K, Page 4, Consolidated Statements of Operations)
- **FY 2023**: $43,500K (출처: Form 10-K, Page 4, Consolidated Statements of Operations)
- **증감**: +$11,300K (+26.0%)

### 매출원별 분석

#### 1순위: 정부 계약 (Government Contracts)
- **FY 2024**: $32,100K (총 매출의 58.6%) (출처: Page 4)
- **FY 2023**: $28,500K (총 매출의 65.5%) (출처: Page 4)
- **증감**: +$3,600K (+12.6%)
- **주요 계약** (출처: Page 29):
  - U.S. Air Force AFWERX: $18,500K (Page 29, Line 12)
  - U.S. Army 화물 배송: $8,200K (Page 29, Line 18)
  - NASA AAM 연구: $5,400K (Page 29, Line 24)

#### 2순위: 제품 판매 (Product Sales)
- **FY 2024**: $18,500K (총 매출의 33.8%) (출처: Page 4)
- **FY 2023**: $12,200K (총 매출의 28.0%) (출처: Page 4)
- **증감**: +$6,300K (+51.6%)
- **세부 내역** (출처: Page 30, Table 1):
  - 런칭 고객 선납금: $12,800K
  - 파트너 부품 판매: $5,700K

#### 3순위: 서비스 매출 (Service Revenue)
- **FY 2024**: $4,200K (총 매출의 7.7%) (출처: Page 4)
- **FY 2023**: $2,800K (총 매출의 6.4%) (출처: Page 4)
- **증감**: +$1,400K (+50.0%)
- **구성** (출처: Page 30):
  - 유지보수 및 교육: $2,800K (Line 8)
  - 엔지니어링 컨설팅: $1,400K (Line 12)

---

## 2. R&D 지출 현황과 우선순위

### 총 R&D 비용
- **FY 2024**: $142,300K (출처: Page 4, Consolidated Statements of Operations)
- **FY 2023**: $135,800K (출처: Page 4)
- **증감**: +$6,500K (+4.8%)

### R&D 우선순위별 세부 분석 (출처: Page 33, Table 2)

#### **Priority 1: FAA 인증 활동** (최우선)
- **금액**: $58,200K (R&D의 40.9%)
- **목적**: Type certification 테스트 및 문서화
- **진행상황**: 최종 인증 추진 집중
- **예상 인증일**: 2025년 하반기

#### **Priority 2: ALIA 항공기 개발**
- **금액**: $42,500K (R&D의 29.9%)
- **현황**: 6대 시험비행 항공기 운영 중
- **성과**: 2024년 1,000회 이상 시험비행 완료

#### **Priority 3: 생산 시스템 개발**
- **금액**: $24,800K (R&D의 17.4%)
- **목표**: Vermont 제조 시설 확장
- **계획**: 2026년까지 연 30대 생산 능력

#### **Priority 4: 엔지니어링 인력**
- **금액**: $16,800K (R&D의 11.8%)
- **인원**: 180명 (2023년 155명에서 증가)
- **채용 분야**: 시스템 통합 및 인증 전문가

---

## 3. SG&A 비용

- **FY 2024**: $38,200K (출처: Page 4)
- **FY 2023**: $35,600K (출처: Page 4)
- **증감**: +$2,600K (+7.3%)

**세부 내역** (출처: Page 34):
- 영업 및 마케팅: $14,200K (Line 6)
- 일반 관리비: $18,500K (Line 10)
- 시설 및 인프라: $5,500K (Line 14)

**평가**: 사업 확장에도 불구하고 통제된 성장률 유지

---

## 4. 현금 포지션과 자금 조달 현황

### 현금 및 유동성 (출처: Page 38)

- **현금 및 현금성자산**: $285,400K (Page 38, Line 4)
- **단기 투자**: $52,000K (Page 38, Line 8)
- **총 유동성**: $337,400K (Page 38, Line 12)

### 2024년 자금 조달 (출처: Consolidated Statements of Cash Flows)

- **지분 조달**: $265,000K
  - 주요 투자자: Fidelity, Amazon Climate Pledge Fund
  - 조달 시기: Q2 2024
- **부채 조달**: $5,000K

### 현금 소진율 및 런웨이

- **월 소진율**: $8-9M (출처: Page 38)
- **영업활동 현금 사용**: -$98,500K (2024년, 출처: Cash Flows)
- **예상 런웨이**: 36개월 이상 (인증 및 초기 생산까지 충분)

---

## 5. FAA 인증 진행 상황

### 인증 타임라인 (출처: Page 45)

- **Type Certification 신청**: Q4 2023 제출 완료
- **예상 Type Certificate**: 2025년 하반기
- **Production Certificate 예상**: 2026년
- **첫 고객 인도**: 2025년 말 / 2026년 초

### 핵심 마일스톤 (출처: Page 45)

- Q3 2024: 첫 화물 배송 시연 성공
- 2024년: 850시간 시험비행 완료 (2023년 520시간 대비 증가)

---

## 6. 전략적 파트너십 (출처: Page 42)

1. **UPS**: 150대 조건부 주문 (2021년 발표)
2. **United Therapeutics**: 의료 배송 파트너십
3. **Air New Zealand**: 23대 주문 (2024년 발표)
4. **U.S. Air Force**: Agility Prime 프로그램 참여

### 고객 예약금 현황 (출처: Page 58)

- **총 예약금**: $48,200K
- **대표 항공기 수**: 약 350대
- **정부 계약 백로그**: $67,500K

---

## 7. 전체 재무 건전성 평가

### ✅ 강점

1. **강력한 매출 성장**: 26.0% YoY 증가 (출처: Page 4)
2. **탄탄한 유동성**: $337.4M, 36개월 이상 런웨이 (출처: Page 38)
3. **성공적인 자금 조달**: $265M 지분 투자 유치 (출처: Cash Flows)
4. **다각화된 매출원**: 정부/민간/서비스 균형
5. **FAA 인증 진전**: 2025년 하반기 인증 예상 (출처: Page 45)
6. **강력한 고객 파이프라인**: 350대 예약, $48.2M 예약금 (출처: Page 58)

### ⚠️ 주의 사항

1. **지속적인 영업 손실**: -$125,700K (출처: Page 4)
   - Pre-revenue 단계 eVTOL 회사의 전형적 특성
2. **인증 리스크**: FAA 프로세스 지연 가능성 (출처: Page 52, Risk Factors)
3. **기술 리스크**: 미검증 대규모 기술 (출처: Page 52)
4. **경쟁 심화**: 다수 eVTOL 기업 인증 추진 중 (출처: Page 52)
5. **생산 확대 위험**: 첫 대량 생산의 어려움 (출처: Page 52)

### 종합 평가

Beta Technologies는 **eVTOL 업계에서 가장 탄탄한 재무 기반을 갖춘 기업** 중 하나입니다:

- 3년 이상의 현금 런웨이로 인증까지 자금 안정성 확보
- 정부 및 상업 고객 모두에서 검증된 수요
- 2025년 FAA 인증 획득 시 선도 기업으로 부상 가능
- 현재까지 계획대로 진행 중 (850시간 비행 테스트, 고객 예약 증가)

**리스크**: 인증 지연 또는 기술적 문제 발생 시 추가 자금 조달 필요 가능성

---

**본 분석은 전적으로 Form 10-K (Filed: 2024년 12월 31일)에 공시된 데이터만을 사용했습니다.**
**모든 수치는 명시된 페이지와 섹션에서 직접 인용했습니다.**`;
    }

    // Alice strategic analysis (Korean)
    if (isAlice && (lastMessage.includes('dorothy') || lastMessage.includes('beta') || lastMessage.includes('전략'))) {
      return `# Beta Technologies 전략 분석

**분석 프레임워크**: McKinsey 3-Horizon Model + Porter's Five Forces
**분석 대상**: Beta Technologies, Inc. (eVTOL 선도 기업)

---

## I. 현재 전략적 포지션 평가

### A. 핵심 강점 (Strengths)

#### 1. **재무 안정성** (Critical Success Factor)

- **현금 런웨이**: 36개월+ ($337.4M 유동성)
- **의미**: 경쟁사 대비 가장 긴 런웨이 → 인증 완료까지 자금 조달 압박 없음
- **전략적 가치**: "Wait & See" 옵션 보유, 협상력 강화

#### 2. **정부 계약 기반** (De-risking Strategy)

- **현황**: 총 매출의 58.6%가 정부 계약
- **장점**:
  - 안정적 현금 흐름 (선도 eVTOL 기업 중 유일)
  - 기술 검증 신뢰도 상승
  - 민간 고객 신뢰 확보 효과

#### 3. **실행 역량** (Execution Excellence)

- 2024년 850시간 비행 테스트 (업계 최상위)
- 6대 테스트 항공기 동시 운영
- Q3 2024 화물 배송 시연 성공

#### 4. **고객 파이프라인** (Demand Validation)

- 350대 예약 ($48.2M 예약금)
- UPS, Air New Zealand 등 Tier-1 고객 확보
- 정부 + 민간 + 의료 다각화

### B. 구조적 약점 (Weaknesses)

#### 1. **인증 의존성** (Single Point of Failure)

- 2025 H2 FAA 인증이 모든 것을 결정
- 지연 시 경쟁사에 선점 기회 상실

#### 2. **생산 미경험** (Operational Risk)

- eVTOL 대량 생산 경험 전무
- 목표 30대/년 달성 불확실성

#### 3. **제한된 매출 다각화**

- 정부 계약 의존도 높음 (58.6%)
- 민간 상업 매출 확대 필요

---

## II. 주요 전략적 리스크와 기회

### 리스크 매트릭스 (Impact × Probability)

| 리스크 | Impact | Probability | 대응 전략 |
|--------|--------|-------------|----------|
| FAA 인증 지연 | 극상 | 중 | 병렬 국제 인증 추진 |
| 경쟁사 선점 | 상 | 중상 | First-mover 포기, Fast-follower 전환 |
| 생산 차질 | 중상 | 중 | 제조 파트너십 검토 |
| 자금 부족 | 하 | 하 | 36개월 런웨이로 완화됨 |

### 전략적 기회

#### **기회 1: Government-to-Commercial Pivot**

- **현재**: 정부 58.6% → **목표**: 민간 60% (2027)
- **실행**: UPS, Air NZ 계약 이행으로 레퍼런스 구축

#### **기회 2: 인증 선도 기업 포지셔닝**

- Joby, Archer 등과 인증 경쟁
- **1-2위 인증 기업**이 시장 70% 점유 예상
- Beta의 우위: 정부 검증 + 실제 비행 데이터

#### **기회 3: Vertical Integration**

- 현재: 배터리, 모터 외주
- **전략**: 핵심 부품 내재화로 마진 개선 (2026+)

---

## III. 경쟁 우위 분석 (Porter's Five Forces)

### 1. **산업 내 경쟁** (HIGH)

- Joby, Archer, Lilium, Volocopter 등 20+ 업체
- **Beta 차별화**:
  - ✅ 가장 긴 현금 런웨이
  - ✅ 정부 검증 (U.S. Air Force, Army)
  - ✅ 실전 배송 데이터 (의료, 화물)

### 2. **신규 진입 위협** (MEDIUM)

- 높은 자본 요구 ($200M+)
- 인증 장벽 (5-7년)
- **Beta 우위**: 이미 진입 완료, 인증 진행 중

### 3. **공급자 교섭력** (MEDIUM-HIGH)

- 배터리: 제한된 공급자 (삼성SDI, LG 등)
- **대응**: 장기 계약 + 차세대 배터리 R&D

### 4. **구매자 교섭력** (MEDIUM)

- 대형 고객 (UPS, Air NZ): 높은 교섭력
- **완화**: 다수 고객 확보로 의존도 분산

### 5. **대체재 위협** (LOW-MEDIUM)

- 헬리콥터: 소음, 비용 문제
- 드론: 탑재량 제한
- **Beta 우위**: eVTOL의 경제성 + 친환경

### 지속가능한 경쟁우위 (Sustainable Competitive Advantage)

**Beta의 Moat**:
1. **데이터 우위**: 850시간 비행 데이터 → 인증 가속
2. **정부 신뢰**: 국방부/NASA 파트너십 → 민간 신뢰도
3. **자본 효율**: 낮은 burn rate ($98.5M/년 vs 경쟁사 $150M+)

---

## IV. FAA 인증까지의 전략적 우선순위

### Phase 1: 인증 완료 (2024 Q4 - 2025 H2) - **최우선**

#### 우선순위 1: 인증 리소스 집중
- R&D 40.9%를 인증에 투입 유지
- **권고**: 추가 10% 증액 고려 (가속화)

#### 우선순위 2: 리스크 완화
- 병렬 전략: EASA (유럽) 인증 동시 추진
- Backup plan: 2026 Q1 인증 시나리오 준비

### Phase 2: 초기 생산 준비 (2025 H1 - 2025 H2)

#### 우선순위 3: 제조 파트너십
- **권고**: Tier-1 항공 제조사와 JV 검토
  - 후보: Spirit AeroSystems, Triumph Group
  - 목적: 생산 리스크 분산, 노하우 습득

#### 우선순위 4: 공급망 확보
- 배터리: 3-5년 장기 계약 체결
- 모터, 전자장비: 이중화 공급망

### Phase 3: 상업화 (2025 H2 - 2026)

#### 우선순위 5: 고객 인도 실행
- UPS, Air NZ 첫 인도 성공 → 레퍼런스 확보
- **KPI**: 2026년 15대 인도 (목표 30대의 50%)

---

## V. 자금 조달 전략 평가

### 현재 전략: ✅ **매우 양호**

- $265M (Q2 2024) 조달로 3년 런웨이 확보
- Fidelity, Amazon 등 전략적 투자자 유치

### 향후 자금 조달 권고

#### 시나리오 1: 인증 성공 시 (2025 H2)
- **전략**: Series D ($300-400M)
  - Valuation 목표: $3-4B (인증 프리미엄)
  - 용도: 생산 확대, 국제 확장

#### 시나리오 2: 인증 지연 시 (2026+)
- **전략**: 브릿지 파이낸싱 ($100M)
  - 기존 투자자 우선 접촉
  - Dilution 최소화

#### 시나리오 3: IPO 검토 (2026-2027)
- **조건**: 인증 + 첫 상업 인도 완료
- **목표**: NASDAQ 상장, $5B+ 시가총액

---

## VI. 향후 12-24개월 전략 로드맵

### **2025년 Q1-Q2: 인증 마무리 단계**

**전략 목표**: FAA 인증 완료

| 월 | 핵심 과제 | 담당 | KPI |
|----|----------|------|-----|
| Q1 | FAA 최종 테스트 완료 | CTO | 100시간 추가 비행 |
| Q1 | 생산 라인 파일럿 | COO | 프로토타입 2대 |
| Q2 | EASA 인증 신청 | Legal | 신청서 제출 |
| Q2 | UPS 첫 인도 준비 | Sales | 인도 계획 확정 |

**주요 의사결정 포인트**:
- 3월: 인증 진행 평가 → 추가 리소스 투입 여부
- 6월: 생산 파트너십 최종 결정

### **2025년 Q3-Q4: 상업화 개시**

**전략 목표**: 첫 상업 인도 + 생산 확대

| 월 | 핵심 과제 | 담당 | KPI |
|----|----------|------|-----|
| Q3 | FAA 인증 획득 | CEO | Type Certificate |
| Q3 | 첫 고객 인도 | Ops | UPS 1호기 |
| Q4 | 생산 확대 시작 | COO | 월 2대 생산 |
| Q4 | Series D 조달 | CFO | $300M 목표 |

**주요 의사결정 포인트**:
- 9월: IPO vs 추가 Private 라운드 결정
- 12월: 2026년 생산 목표 재설정 (15 vs 30대)

### **2026년 Q1-Q4: 시장 지배력 확보**

**전략 목표**: 시장 점유율 20%+ 달성

| 분기 | 핵심 과제 | 목표 |
|------|----------|------|
| Q1 | 생산 속도 향상 | 월 3대 |
| Q2 | 국제 시장 진출 | EU 첫 인도 |
| Q3 | 신규 고객 확보 | 100대 추가 수주 |
| Q4 | IPO 추진 | NASDAQ 상장 |

---

## VII. 경영진 제안사항 (McKinsey 스타일 권고안)

### 즉시 실행 (Next 30 Days)

1. **인증 가속 태스크포스 구성**
   - 전담 팀 20명 → 30명 증원
   - 예산 10% 추가 배정

2. **생산 파트너십 Due Diligence 착수**
   - Spirit AeroSystems, Triumph Group 접촉
   - 90일 내 LOI 체결 목표

3. **공급망 리스크 평가**
   - 배터리 공급사 2nd source 확보
   - 장기 계약 협상 시작

### 3개월 내 실행 (Next 90 Days)

4. **EASA 인증 신청**
   - 유럽 시장 선점 준비
   - Air NZ 인도 조건 충족

5. **IPO 준비 착수**
   - Investment bank 선정 (Goldman, Morgan Stanley)
   - S-1 문서 초안 작성

### 6-12개월 내 실행

6. **국제 확장 전략 수립**
   - 중동, 아시아 시장 진출 계획
   - 현지 파트너 물색

7. **차세대 제품 로드맵**
   - ALIA-Passenger 버전 개발 착수
   - 2027년 출시 목표

---

## VIII. 결론 및 최종 권고

### **전략적 결론**

Beta Technologies는 **eVTOL 업계에서 가장 유리한 전략적 포지션**을 확보했습니다:

✅ **재무 안정성**: 3년 런웨이 (업계 최장)
✅ **실행 역량**: 850시간 비행 테스트 (업계 최다)
✅ **고객 검증**: 정부 + 민간 350대 예약
✅ **인증 진척**: 2025 H2 인증 가시권

### **핵심 리스크**

⚠️ **인증 지연**: 2025 목표 미달 시 경쟁 우위 상실
⚠️ **생산 미숙**: 대량 생산 경험 부족
⚠️ **경쟁 심화**: Joby, Archer 등 동시 인증 추진

### **McKinsey 최종 권고**

#### **전략 방향**: "Fast Follower with Moat"

1. **인증 최우선**: 2025 H2 목표 사수 (추가 투자 승인)
2. **생산 파트너십**: Tier-1 제조사 JV (리스크 분산)
3. **자금 조달**: Series D ($300M, 2025 H2) 준비
4. **시장 진입**: 정부 → 상업 전환 (2026-2027)
5. **Exit 전략**: IPO 2026-2027 (Valuation $5B+)

### **성공 확률 평가**

- **Base Case** (60% 확률): 2025 H2 인증, 2026년 15대 인도 → Valuation $3-4B
- **Bull Case** (25% 확률): 2025 H1 조기 인증 → 시장 선점 → Valuation $6B+
- **Bear Case** (15% 확률): 2026+ 인증 지연 → 추가 자금 필요 → Valuation $1-2B

**최종 평가**: Beta는 현재 **매우 양호한 전략적 위치**에 있으며, 향후 12개월이 승부처입니다.

---

**본 분석은 Dorothy의 재무 분석을 기반으로 McKinsey 전략 프레임워크를 적용하여 작성되었습니다.**`;
    }

    // Dorothy quarterly/periodic financial analysis (Korean)
    if (isDorothy && (lastMessage.includes('분기') || lastMessage.includes('quarterly') || lastMessage.includes('q3') || lastMessage.includes('revenue') && lastMessage.includes('expenses'))) {
      return `## Vertical Aerospace Ltd. (EVTL) 분기별 재무 분석
### Q3 2024 vs Q3 2023 비교

**분석 기간**: 2024년 9월 30일 마감 분기 vs 2023년 9월 30일 마감 분기
**출처**: Form 10-Q filed 2024년 11월 12일

---

## 1. 매출(Revenue) 변화와 원인

### 총 매출 실적

- **Q3 2024**: $1,200K (출처: Form 10-Q, Page 4, Consolidated Statements of Operations)
- **Q3 2023**: $2,100K (출처: Form 10-Q, Page 4, Consolidated Statements of Operations)
- **증감**: -$900K (-42.9%)

### 매출 감소 원인 (출처: Page 24, MD&A)

1. **엔지니어링 서비스 매출 감소**: -$700K
   - 제3자 고객 대상 엔지니어링 용역 중단

2. **사전 납품 계약금 감소**: -$200K
   - 잠재 고객의 pre-delivery payment 감소

### 매출 특성 평가

회사는 현재 **pre-commercialization 단계**로 VX4 인증에 집중하고 있어 매출 발생이 극히 제한적입니다.
(출처: Page 24, MD&A)

---

## 2. 사용비용 (Operating Expenses) 중요도 순 분석

### 총 사용비용 개요

- **Q3 2024**: $51,300K (출처: Page 4)
- **Q3 2023**: $57,000K (출처: Page 4)
- **증감**: -$5,700K (-10.0%)

---

## 2-1. R&D 비용 (Research & Development)

**총 R&D 비용**:
- **Q3 2024**: $38,500K (출처: Page 4, Consolidated Statements of Operations)
- **Q3 2023**: $42,800K (출처: Page 4, Consolidated Statements of Operations)
- **증감**: -$4,300K (-10.0%)

### R&D 세부 항목 (중요도 순)

#### **Priority 1: Flight Testing and Certification** (최우선 과제)
- **Q3 2024**: $22,800K (R&D의 59.2%) (출처: Page 25, Table 1)
- **Q3 2023**: $25,600K (R&D의 59.8%) (출처: Page 25, Table 1)
- **증감**: -$2,800K (-10.9%)
- **원인**: 공급업체 문제로 인한 시험비행 일정 지연 (출처: Page 25, Table 1)

#### **Priority 2: Prototype Manufacturing and Tooling**
- **Q3 2024**: $8,400K (R&D의 21.8%) (출처: Page 25, Table 1)
- **Q3 2023**: $9,200K (R&D의 21.5%) (출처: Page 25, Table 1)
- **증감**: -$800K (-8.7%)
- **원인**: 제조 효율성 개선 (출처: Page 25, Table 1)

#### **Priority 3: Engineering Personnel Costs**
- **Q3 2024**: $5,100K (R&D의 13.2%) (출처: Page 26, Line 8)
- **Q3 2023**: $5,800K (R&D의 13.5%) (출처: Page 26, Line 8)
- **증감**: -$700K (-12.1%)
- **원인**: 2024년 8월 15% 인력 감축 단행 (출처: Page 26, Line 8)

#### **Priority 4: Regulatory and Certification Expenses**
- **Q3 2024**: $2,200K (R&D의 5.7%) (출처: Page 26, Line 12)
- **Q3 2023**: $2,200K (R&D의 5.1%) (출처: Page 26, Line 12)
- **증감**: $0K (0%)
- **원인**: 인증 일정이 일관되게 유지됨 (출처: Page 26, Line 12)

---

## 2-2. G&A 비용 (General & Administrative)

**총 G&A 비용**:
- **Q3 2024**: $12,800K (출처: Page 4, Consolidated Statements of Operations)
- **Q3 2023**: $14,200K (출처: Page 4, Consolidated Statements of Operations)
- **증감**: -$1,400K (-9.9%)

### G&A 세부 항목 (중요도 순)

#### **Priority 1: Professional Fees** (법률, 회계, 컨설팅)
- **Q3 2024**: $4,800K (G&A의 37.5%) (출처: Page 27, Table 2)
- **Q3 2023**: $5,200K (G&A의 36.6%) (출처: Page 27, Table 2)
- **증감**: -$400K (-7.7%)
- **원인**: 구조조정 후 자문료 감소 (출처: Page 27, Table 2)

#### **Priority 2: Administrative Personnel Costs**
- **Q3 2024**: $3,600K (G&A의 28.1%) (출처: Page 27, Table 2)
- **Q3 2023**: $4,100K (G&A의 28.9%) (출처: Page 27, Table 2)
- **증감**: -$500K (-12.2%)
- **원인**: 인력 감축 및 채용 동결 (출처: Page 27, Table 2)

#### **Priority 3: Facilities and Rent**
- **Q3 2024**: $2,400K (G&A의 18.8%) (출처: Page 28, Line 3)
- **Q3 2023**: $2,500K (G&A의 17.6%) (출처: Page 28, Line 3)
- **증감**: -$100K (-4.0%)
- **원인**: 미사용 사무 공간 전대 (출처: Page 28, Line 3)

#### **Priority 4: IT and Software Subscriptions**
- **Q3 2024**: $1,200K (G&A의 9.4%) (출처: Page 28, Line 7)
- **Q3 2023**: $1,400K (G&A의 9.9%) (출처: Page 28, Line 7)
- **증감**: -$200K (-14.3%)
- **원인**: 비필수 소프트웨어 라이선스 해지 (출처: Page 28, Line 7)

#### **Priority 5: Other Administrative Expenses**
- **Q3 2024**: $800K (G&A의 6.3%) (출처: Page 28, Line 11)
- **Q3 2023**: $1,000K (G&A의 7.0%) (출처: Page 28, Line 11)
- **증감**: -$200K (-20.0%)
- **원인**: 출장 제한 및 마케팅 축소 (출처: Page 28, Line 11)

---

## 3. 전체 재무 상태 평가

### 영업 손실 (Loss from Operations)
- **Q3 2024**: -$50,100K (출처: Page 4)
- **Q3 2023**: -$54,900K (출처: Page 4)
- **개선**: $4,800K (8.7% 감소)

### 순손실 (Net Loss)
- **Q3 2024**: -$51,300K (출처: Page 4)
- **Q3 2023**: -$55,800K (출처: Page 4)
- **개선**: $4,500K (8.1% 감소)

### 분기별 현금소진 추이 (9M 2024 데이터 기반)
- **Q1 2024**: ~$51,200K (추정치, 출처: Page 4 9M 데이터에서 역산)
- **Q2 2024**: ~$51,200K (추정치, 출처: Page 4 9M 데이터에서 역산)
- **Q3 2024**: $51,300K (실제, 출처: Page 4)
- **평균 분기 손실**: $51,200K
- **Burn Rate 안정성**: 매우 일관적

---

## 핵심 인사이트 (Key Insights)

### ✅ 긍정적 요소

1. **비용 절감 성공**: 인플레이션 환경에서도 YoY 운영비용 10% 감소 (출처: Page 4)
2. **R&D 우선순위 유지**: flight testing이 예산 감축에도 최우선순위 유지 (출처: Page 25)
3. **G&A 효율화**: 모든 G&A 항목에서 비용 절감 달성 (출처: Page 27-28)
4. **일관된 burn rate**: 분기별 손실이 ~$51M로 안정적이어서 예측 가능 (출처: Page 4)

### ⚠️ 우려 요소

1. **매출 급감**: 42.9% YoY 감소, pre-commercial 단계의 한계 (출처: Page 4, Page 24)
2. **높은 분기 손실**: 분기당 $51M 손실은 여전히 매우 높음 (출처: Page 4)
3. **현금 고갈 리스크**: 3개월 런웨이 (별도 going concern 분석 참조)

---

**본 분석은 전적으로 Form 10-Q (Filed: 2024년 11월 12일)에 공시된 데이터만을 사용했습니다.**
**모든 수치는 명시된 페이지와 섹션에서 직접 인용했습니다.**`;
    }

    // Dorothy going concern analysis (Korean)
    if (lastMessage.includes('going concern') || lastMessage.includes('계속기업') || lastMessage.includes('goingconcern')) {
      return `## 계속기업 이슈 분석 (GOING CONCERN ANALYSIS)

답변: 네, Vertical Aerospace는 심각한 계속기업 이슈에 직면해 있습니다.

출처: Form 10-Q filed 2024년 11월 12일 (2024년 9월 30일 마감 분기)

### 1. 감사인의 계속기업 적격의견 여부
**예 - 명시적인 감사인 적격의견 존재**

데이터 인용:
"회사의 재무제표는 계속기업을 가정하여 작성되었습니다... 이러한 상황은 회사의 계속기업 능력에 대한 실질적 의문을 제기합니다. 이에 대한 경영진의 계획은 Note 1에 기술되어 있습니다."

### 2. 구체적인 유동성 우려사항

현금 포지션:
- 현금및현금성자산: **$45.2 million** (2024년 9월 30일)
- vs. $128.5 million (2023년 12월 31일)
- **9개월간 $83.3 million 감소**

출처: Consolidated Balance Sheets, 1페이지

### 3. 월간 현금소진율
**월 $15-18 million**

데이터 인용:
"회사의 현재 운영 계획과 월 약 $15-18 million의 예상 현금소진율을 기준으로..."

출처: Note 1 - Basis of Presentation and Going Concern

### 4. 예상 런웨이 (자금 고갈 시점)
**약 3개월 (2025년 1분기까지)**

데이터 인용:
"경영진은 기존 현금및현금성자산이 2025년 1분기까지 운영 자금으로 충분할 것으로 추정합니다"

출처: Note 1 - Basis of Presentation and Going Concern

### 5. 영업현금흐름 (9M 2024)
**마이너스 $114.2 million**

데이터 인용:
"2024년 9월 30일 마감 9개월 동안, 회사는... 영업활동에서 $114.2 million의 현금을 사용했습니다"

출처: Consolidated Statements of Cash Flows

### 6. 계속기업 문제 해결을 위한 회사의 계획

경영진이 공시한 5가지 주요 이니셔티브:

1. **지분 조달**: 공모 또는 사모를 통한 추가 자본 조달
2. **전략적 파트너십**: 전략적 파트너십 또는 협력 확보
3. **비희석성 자금조달**: 정부 보조금 등 추구
4. **비용 절감**: 운영비용 절감 (2024년 8월 15% 인력 감축 완료, 연간 $8M 절감)
5. **자산 유동화**: 자산 매각 또는 라이선싱 방안 검토

데이터 인용:
"계속기업 문제 해결을 위한 경영진의 계획은 다음을 포함합니다: 1. 공모 또는 사모를 통한 추가 자본 조달 2. 전략적 파트너십 확보..."

**중요 면책조항**: "그러나 이러한 계획들이 성공적으로 실행될 것이라는 보장은 없습니다."

### 7. 약정(Covenant) 위반 또는 채무불이행

**현재 상태**: 준수 중
**향후 리스크**: 위반 가능성 높음

부채 잔액:
- 총 부채: **$60.0 million**
  - 장기차입금: $45.0 million (만기 2025년 12월)
  - 전환사채: $15.0 million (만기 2025년 6월)

약정 요구사항:
- 최소 유동성: **$20.0 million**

데이터 인용:
"2024년 9월 30일 기준, 회사는 모든 부채 약정을 준수하고 있습니다. 그러나 현재 현금소진 예측에 따르면, 추가 자금조달 없이는 2025년 1분기에 최소 유동성 약정을 위반할 수 있습니다."

출처: Note 8 - Debt

### 후속 사건 (SUBSEQUENT EVENTS)
2024년 10월, 회사는 잠재적 **$40 million 투자**에 대한 **비구속적 term sheet**를 체결했으나, 실사가 필요하며 **완료 보장 없음**.

## 전문가 평가

**심각도**: **매우 위험 (CRITICAL)**

계속기업 리스크는 즉각적이고 중대합니다:
- 3개월 런웨이는 극도로 짧음
- 2025년 1분기 약정 위반 리스크로 $60M 부채 조기상환 가능
- 확정된 자금조달 약속 없음
- eVTOL 섹터의 자금조달 어려움 (역사적 트랙레코드)

**본 분석은 전적으로 SEC filing 데이터에 기반합니다. 외부 시장 데이터나 예측은 사용하지 않았습니다.**`;
    }

    // Financial metrics extraction (Korean)
    if (lastMessage.includes('financial metrics') || lastMessage.includes('extract') || lastMessage.includes('재무지표')) {
      return `## 주요 재무지표 추출

출처: Form 10-Q filed 2024년 11월 12일

### 1. Cash and Cash Equivalents

**Current Period (Sep 30, 2024)**: $45.2 million
**Prior Period (Dec 31, 2023)**: $128.5 million
**Change**: -$83.3 million (-64.8%)

SOURCE: Consolidated Balance Sheets

### 2. Current Assets and Liabilities

**Total Current Assets**: $65.6 million (Sep 30, 2024)
- vs. $149.5 million (Dec 31, 2023)

**Total Current Liabilities**: $74.5 million (Sep 30, 2024)
- vs. $61.2 million (Dec 31, 2023)

SOURCE: Consolidated Balance Sheets

### 3. Working Capital

**CALCULATION**:
Working Capital = Current Assets - Current Liabilities
= $65.6M - $74.5M = **-$8.9 million (NEGATIVE)**

**Prior Period**: $149.5M - $61.2M = $88.3 million

**DETERIORATION**: -$97.2 million in 9 months

**ANALYSIS**: Company has shifted from positive to negative working capital, indicating severe liquidity stress.

### 4. Net Loss

**Q3 2024**: -$51.3 million
**9M 2024**: -$153.7 million

SOURCE: Consolidated Statements of Operations

**Quarterly Trend** (implied):
- Q1-Q2 2024 average: ~$51.2M per quarter
- Q3 2024: $51.3M
- **Burn rate stable but unsustainable**

### 5. Operating Cash Flow (9M 2024)

**Net cash used in operating activities**: -$114.2 million

SOURCE: Consolidated Statements of Cash Flows

**Monthly average**: -$12.7 million (actual operating cash burn)

### 6. Monthly Cash Burn Rate (Management Guidance)

**$15-18 million per month**

SOURCE: Management's Discussion and Analysis (MD&A)

**NOTE**: Management's projection ($15-18M) is higher than historical operating cash flow average ($12.7M), suggesting:
- Anticipated increase in expenses, OR
- Conservative planning

### 7. Total Debt Outstanding

**$60.0 million** as of September 30, 2024

Breakdown:
- Current portion: $15.0 million
- Long-term portion: $45.0 million

Components:
- Term loan facility: $45.0M (due Dec 2025)
- Convertible notes: $15.0M (due Jun 2025)

SOURCE: Note 8 - Debt

### 8. Stockholders' Equity

**Sep 30, 2024**: $55.0 million
**Dec 31, 2023**: $147.2 million
**Decline**: -$92.2 million (-62.6%)

SOURCE: Consolidated Balance Sheets

**ACCUMULATED DEFICIT**: $487.3 million (disclosed in Note 1)

## KEY FINANCIAL RATIOS

### Current Ratio
= Current Assets / Current Liabilities
= $65.6M / $74.5M = **0.88**

**INTERPRETATION**: Below 1.0 indicates liquidity risk. Company cannot cover current liabilities with current assets.

### Cash Ratio
= Cash / Current Liabilities
= $45.2M / $74.5M = **0.61**

**INTERPRETATION**: Only 61% of current liabilities can be covered by cash.

### Debt-to-Equity Ratio
= Total Debt / Stockholders' Equity
= $60.0M / $55.0M = **1.09**

**INTERPRETATION**: Debt exceeds equity. Highly leveraged position for a pre-revenue development stage company.

**All data extracted directly from SEC 10-Q filing. No estimates or assumptions made.**`;
    }

    // Risk analysis
    if (lastMessage.includes('risk')) {
      return `## TOP 5 CRITICAL FINANCIAL RISKS

Ranked by severity and immediacy of impact:

### RISK #1: LIQUIDITY CRISIS (SEVERITY: CRITICAL - IMMEDIATE)

**TIMELINE**: 3 months to potential insolvency

**EVIDENCE**:
- Cash: $45.2M with burn rate of $15-18M/month = **2.5-3 month runway**
- Management disclosure: "existing cash... will be sufficient to fund operations into Q1 2025"
- Auditor statement: "substantial doubt about the Company's ability to continue as a going concern"

**IMPACT**: Without immediate financing, operations must cease in Q1 2025.

SOURCE: Note 1, MD&A

---

### RISK #2: DEBT COVENANT VIOLATION (SEVERITY: CRITICAL - Q1 2025)

**EXPOSURE**: $60 million debt potentially accelerated

**EVIDENCE**:
- Minimum liquidity covenant: $20.0M required
- Current cash: $45.2M
- At $15-18M/month burn: Will breach covenant in ~2 months
- "Company may violate the minimum liquidity covenant in Q1 2025 without additional financing"

**IMPACT**: Covenant breach could trigger:
- Immediate debt acceleration ($60M due)
- Forced bankruptcy or restructuring
- Loss of all equity value

SOURCE: Note 8 - Debt

---

### RISK #3: FINANCING UNCERTAINTY (SEVERITY: HIGH - ONGOING)

**CAPITAL NEEDS**: $200-300 million to achieve certification (disclosed in Risk Factors)

**EVIDENCE**:
- Only non-binding term sheet for $40M (no assurance of completion)
- Already raised $60M in debt + equity in 2024, yet still facing liquidity crisis
- eVTOL sector facing challenging capital markets
- "There is no assurance that such financing will be available on acceptable terms, or at all"

**IMPACT**:
- Severe dilution for existing shareholders
- Potential down-round financing
- May be forced to accept unfavorable strategic terms

SOURCE: MD&A, Subsequent Events

---

### RISK #4: NEGATIVE WORKING CAPITAL (SEVERITY: HIGH - CURRENT)

**DEFICIT**: -$8.9 million

**EVIDENCE**:
- Current Assets: $65.6M
- Current Liabilities: $74.5M
- Deterioration of $97.2M from Dec 2023 (+$88.3M) to Sep 2024 (-$8.9M)

**CONTRIBUTING FACTORS**:
- Operating losses: $153.7M (9M 2024)
- Operating cash burn: $114.2M (9M 2024)
- Increasing current liabilities despite declining operations

**IMPACT**:
- Difficulty meeting short-term obligations
- Supplier payment delays
- Potential supply chain disruptions

SOURCE: Consolidated Balance Sheets

---

### RISK #5: OPERATIONAL BURN RATE SUSTAINABILITY (SEVERITY: HIGH - ONGOING)

**QUARTERLY LOSSES**: ~$51M per quarter (stable)

**EVIDENCE**:
- Q3 2024 net loss: $51.3M
- 9M 2024 net loss: $153.7M
- Operating expenses: $154.1M (9M 2024)
  - R&D: $115.2M (75% of OpEx)
  - G&A: $38.9M (25% of OpEx)
- Revenue: Only $3.8M (9M 2024) = **negligible**

**COST REDUCTION EFFORTS**:
- 15% workforce reduction (Aug 2024)
- Annual savings: Only $8M (~16% of quarterly burn)
- Insufficient to extend runway meaningfully

**IMPACT**:
- Cannot achieve certification without external funding
- Must continue high R&D spend to maintain progress
- Any reduction in R&D jeopardizes entire business model

SOURCE: Consolidated Statements of Operations, MD&A

---

## RISK INTERCONNECTION

These risks are **highly correlated and cascading**:

1. **Liquidity crisis** (Risk #1) forces urgent capital raise
2. Desperate capital raise leads to **dilutive terms** (Risk #3)
3. If financing fails, **covenant breach** occurs (Risk #2)
4. Covenant breach with **negative working capital** (Risk #4) triggers bankruptcy
5. Throughout, **operational burn** continues (Risk #5), accelerating timeline

**CRITICAL OBSERVATION**: The company has approximately **60-90 days** to secure financing before multiple risks converge into an existential crisis.

**This analysis uses only data explicitly disclosed in the SEC 10-Q filing dated November 12, 2024.**`;
    }

    // Data not available test
    if (lastMessage.includes('salary') || lastMessage.includes('ceo') || lastMessage.includes('breakdown')) {
      return `## DATA NOT AVAILABLE

**QUESTION**: Executive salaries and R&D expense breakdown by project category

### Executive Compensation (CEO/CFO Salaries)

**DATA NOT AVAILABLE**

This information is not disclosed in the Form 10-Q filed on November 12, 2024.

**WHERE IT WOULD BE FOUND**: Executive compensation is typically disclosed in:
- Proxy Statement (DEF 14A) filed annually
- Form 10-K (annual report) in limited detail

**NOTE**: The 10-Q is a quarterly report and does not require detailed executive compensation disclosure.

### R&D Expense Breakdown by Project Category

**DATA NOT AVAILABLE**

The SEC filing only provides aggregate R&D expenses:
- **9M 2024**: $115.2 million (total)
- **Q3 2024**: $38.5 million (total)

**NO BREAKDOWN PROVIDED** by:
- Project category
- VX4 vs. other programs
- Personnel vs. materials
- Certification vs. development activities

**WHAT THE FILING STATES**:
"Research and development expenses for the nine months ended September 30, 2024 were $115.2 million"

**WHY NOT DISCLOSED**: Companies are not required to break down R&D by specific project unless they have multiple reportable segments.

---

## PROFESSIONAL GUIDANCE

As Dorothy, I maintain strict data integrity. I can only answer based on what is **explicitly stated in SEC filings**.

For the information you requested:
1. **Executive salaries**: Please refer to the company's Proxy Statement (DEF 14A)
2. **R&D breakdown**: This level of detail is not publicly disclosed

If you need this information for investment analysis, you may need to:
- Contact the company's Investor Relations directly
- Wait for more detailed disclosure in the annual 10-K
- Review earnings call transcripts (if available)

**I will not estimate, assume, or extrapolate data not present in the official filings.**`;
    }

    // Default strategic analysis (for Alice)
    if (lastMessage.includes('strategic') || lastMessage.includes('analysis')) {
      return `Based on the information provided, here is my strategic analysis using McKinsey frameworks:

## SITUATION ASSESSMENT

**Current State**: The organization faces a critical strategic inflection point requiring immediate action.

## STRATEGIC OPTIONS (Decision Tree Analysis)

**Option 1**: Aggressive Growth
- Pros: Market leadership potential
- Cons: Resource intensive, higher risk
- Recommendation: Conditional - requires strong market position

**Option 2**: Operational Efficiency
- Pros: Immediate cash flow improvement
- Cons: May sacrifice growth
- Recommendation: Priority focus given constraints

**Option 3**: Strategic Partnerships
- Pros: Risk sharing, resource access
- Cons: Loss of control
- Recommendation: Strongly recommended

## RECOMMENDATION

**Primary Strategy**: Pursue Option 3 (Strategic Partnerships) combined with Option 2 (Operational Efficiency)

**Rationale**:
1. Mitigates immediate risks
2. Preserves strategic optionality
3. Addresses resource constraints

**Next Steps**:
1. Identify partnership candidates (30 days)
2. Implement quick-win efficiency initiatives (60 days)
3. Develop detailed integration plan (90 days)

This analysis follows McKinsey's structured problem-solving approach.`;
    }

    // Generic response
    return `Thank you for your question. Based on the information provided, I can offer the following analysis:

[This is a mock response for testing purposes]

The data suggests several key considerations that should be evaluated carefully. However, for a complete analysis, I would need access to the actual data sources.

In a real scenario, I would:
1. Review all relevant documentation
2. Extract specific data points
3. Perform quantitative analysis
4. Provide evidence-based recommendations

Please note: This is a simulated response for testing the system architecture.`;
  }

  async chatWithSystem(systemPrompt: string, userMessage: string, temperature: number = 0.7): Promise<string> {
    return this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature
    });
  }

  async chatWithHistory(messages: GLMMessage[], temperature: number = 0.7): Promise<string> {
    return this.chat({
      messages,
      temperature
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const glmClient = new GLMClient();
