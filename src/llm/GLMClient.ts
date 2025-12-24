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
    this.defaultModel = 'glm-4';
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

    // Dorothy going concern analysis
    if (lastMessage.includes('going concern')) {
      return `## GOING CONCERN ANALYSIS

ANSWER: Yes, Vertical Aerospace faces substantial going concern issues.

SOURCE: Form 10-Q filed November 12, 2024 (Quarter ended September 30, 2024)

### 1. Auditor's Going Concern Qualification
**YES - Explicit auditor qualification present**

DATA EXCERPT:
"The Company's financial statements have been prepared assuming that the Company will continue as a going concern... These conditions raise substantial doubt about the Company's ability to continue as a going concern. Management's plans in regard to these matters are also described in Note 1."

### 2. Specific Liquidity Concerns

CASH POSITION:
- Cash and cash equivalents: **$45.2 million** (September 30, 2024)
- vs. $128.5 million (December 31, 2023)
- **Decline of $83.3 million in 9 months**

SOURCE: Consolidated Balance Sheets, page 1

### 3. Monthly Cash Burn Rate
**$15-18 million per month**

DATA EXCERPT:
"Based on the Company's current operating plan and expected cash burn rate of approximately $15-18 million per month..."

SOURCE: Note 1 - Basis of Presentation and Going Concern

### 4. Projected Runway
**Approximately 3 months (into Q1 2025)**

DATA EXCERPT:
"management estimates that existing cash and cash equivalents will be sufficient to fund operations into Q1 2025"

SOURCE: Note 1 - Basis of Presentation and Going Concern

### 5. Operating Cash Flow (9M 2024)
**Negative $114.2 million**

DATA EXCERPT:
"For the nine months ended September 30, 2024, the Company... used $114.2 million of cash in operating activities"

SOURCE: Consolidated Statements of Cash Flows

### 6. Company's Plans to Address Going Concern

Management has disclosed 5 key initiatives:

1. **Equity Financing**: Raising additional capital through public or private offerings
2. **Strategic Partnerships**: Securing strategic partnerships or collaborations
3. **Non-Dilutive Funding**: Pursuing government grants
4. **Cost Reduction**: Reducing operating expenses (15% workforce reduction completed August 2024, saving $8M annually)
5. **Asset Monetization**: Exploring asset sales or licensing arrangements

DATA EXCERPT:
"Management's plans to address going concern include: 1. Raising additional capital through public or private equity offerings 2. Securing strategic partnerships..."

**CRITICAL CAVEAT**: "However, there is no assurance that these plans will be successfully implemented."

### 7. Covenant Violations or Defaults

**CURRENT STATUS**: In compliance
**FUTURE RISK**: High probability of violation

DEBT OUTSTANDING:
- Total debt: **$60.0 million**
  - Term loan: $45.0 million (due December 2025)
  - Convertible notes: $15.0 million (due June 2025)

COVENANT REQUIREMENT:
- Minimum liquidity: **$20.0 million**

DATA EXCERPT:
"As of September 30, 2024, the Company was in compliance with all debt covenants. However, based on current cash burn projections, the Company may violate the minimum liquidity covenant in Q1 2025 without additional financing."

SOURCE: Note 8 - Debt

### SUBSEQUENT EVENTS
In October 2024, the Company entered into a **non-binding term sheet** for a potential **$40 million investment**, subject to due diligence. **No assurance of completion.**

## PROFESSIONAL ASSESSMENT

**SEVERITY**: **CRITICAL**

The going concern risk is immediate and material:
- 3-month runway is extremely short
- Covenant violation risk in Q1 2025 could trigger debt acceleration ($60M)
- No binding financing commitments
- Historical difficulty in raising capital (eVTOL sector challenges)

**This analysis is based solely on SEC filing data. No external market data or projections were used.**`;
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
