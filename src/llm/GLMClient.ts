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
    this.defaultModel = 'glm-4-plus'; // GLM-4.7 latest model
    this.mockMode = process.env.GLM_MOCK_MODE === 'true';

    if (!this.apiKey && !this.mockMode) {
      console.warn('⚠️  GLM_API_KEY not found in environment variables');
    }

    if (this.mockMode) {
      console.log('🧪 GLM Client running in MOCK MODE (no API calls)');
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

    try {
      const response = await this.client.post<GLMResponse>('/chat/completions', {
        model: params.model || this.defaultModel,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        top_p: params.top_p ?? 0.9,
        max_tokens: params.max_tokens ?? 2000,
        stream: false
      });

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('GLM API Error:', error.response?.data || error.message);
      throw new Error(`GLM API call failed: ${error.message}`);
    }
  }

  private generateMockResponse(messages: GLMMessage[]): string {
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const isDorothy = systemMessage.includes('Dorothy') || systemMessage.includes('CFA') || systemMessage.includes('SEC');

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

    // Financial metrics extraction
    if (lastMessage.includes('financial metrics') || lastMessage.includes('extract')) {
      return `## KEY FINANCIAL METRICS EXTRACTION

SOURCE: Form 10-Q filed November 12, 2024

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
