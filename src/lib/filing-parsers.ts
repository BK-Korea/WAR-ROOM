/**
 * Goldman Sachs-Grade Filing Parsers
 *
 * Specialized parsers for non-financial SEC filings
 * Each parser extracts structured data from specific filing types
 * using LLM-based natural language understanding
 */

import { glmClient } from '../llm/GLMClient';

// =====================================================
// Type Definitions
// =====================================================

export interface OwnershipChange {
  ticker: string;
  cik: string;
  companyName: string;
  filingType: string;
  filingDate: string;
  accessionNumber: string;
  reporterName: string;
  reporterCik?: string;
  reporterType?: string;
  sharesOwned?: number;
  ownershipPercent?: number;
  purpose?: string;
  hasControlIntent?: boolean;
  votingRights?: string;
  acquisitionDate?: string;
  pricePerShare?: number;
  sourceUrl: string;
  rawText: string;
}

export interface InsiderTransaction {
  ticker: string;
  cik: string;
  companyName: string;
  filingType: string;
  filingDate: string;
  accessionNumber: string;
  reporterName: string;
  reporterCik?: string;
  position?: string;
  isDirector?: boolean;
  isOfficer?: boolean;
  isTenPercentOwner?: boolean;
  transactionDate: string;
  transactionType?: string;
  transactionCode?: string;
  sharesTraded?: number;
  pricePerShare?: number;
  totalValue?: number;
  sharesOwnedAfter?: number;
  ownershipPercentAfter?: number;
  isDerivative?: boolean;
  derivativeType?: string;
  sourceUrl: string;
  rawText: string;
}

export interface CapitalRaise {
  ticker: string;
  cik: string;
  companyName: string;
  filingType: string;
  filingDate: string;
  accessionNumber: string;
  offeringType?: string;
  offeringStatus?: string;
  sharesOffered?: number;
  sharesOutstandingBefore?: number;
  sharesOutstandingAfter?: number;
  pricePerShare?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  grossProceeds?: number;
  underwritingDiscount?: number;
  netProceeds?: number;
  dilutionPercent?: number;
  useOfProceeds?: string;
  leadUnderwriter?: string;
  allUnderwriters?: string[];
  hasGreenshoe?: boolean;
  greenshoeShares?: number;
  sourceUrl: string;
  rawText: string;
}

export interface MaterialEvent {
  ticker: string;
  cik: string;
  companyName: string;
  filingDate: string;
  reportDate?: string;
  accessionNumber: string;
  eventItems?: string[];
  eventTypes?: string[];
  severity?: string;
  eventSummary?: string;
  keyDetails?: any;
  financialImpact?: number;
  impactCurrency?: string;
  counterparties?: string[];
  sourceUrl: string;
  rawText: string;
}

// =====================================================
// 13D/13G Parser: Beneficial Ownership
// =====================================================

export async function parse13D(
  markdown: string,
  metadata: {
    ticker: string;
    cik: string;
    companyName: string;
    filingType: string;
    filingDate: string;
    accessionNumber: string;
    sourceUrl: string;
  }
): Promise<OwnershipChange | null> {
  try {
    const prompt = `You are a financial analyst parsing SEC Form ${metadata.filingType} (beneficial ownership disclosure).

Extract the following information from this filing:

1. **Reporting Person** (who is acquiring the shares):
   - Name
   - CIK (if available)
   - Type: Individual, Institution, Corporate, or Group

2. **Ownership Details**:
   - Total shares owned
   - Ownership percentage
   - Purpose of acquisition: Investment, Acquisition, Strategic, or Passive
   - Has control intent (true if SC 13D or mentions control/influence)
   - Voting rights: Sole, Shared, or None

3. **Transaction Details**:
   - Acquisition date (when shares were acquired)
   - Price per share (if disclosed)

**Filing Text:**
${markdown.substring(0, 8000)}

**Respond ONLY with valid JSON:**
{
  "reporterName": "string",
  "reporterCik": "string or null",
  "reporterType": "Individual|Institution|Corporate|Group",
  "sharesOwned": number,
  "ownershipPercent": number,
  "purpose": "Investment|Acquisition|Strategic|Passive",
  "hasControlIntent": boolean,
  "votingRights": "Sole|Shared|None",
  "acquisitionDate": "YYYY-MM-DD or null",
  "pricePerShare": number or null
}

If information is not found, use null. DO NOT include explanations.`;

    const response = await glmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[13D Parser] Failed to extract JSON from LLM response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ...metadata,
      reporterName: parsed.reporterName,
      reporterCik: parsed.reporterCik,
      reporterType: parsed.reporterType,
      sharesOwned: parsed.sharesOwned,
      ownershipPercent: parsed.ownershipPercent,
      purpose: parsed.purpose,
      hasControlIntent: parsed.hasControlIntent,
      votingRights: parsed.votingRights,
      acquisitionDate: parsed.acquisitionDate,
      pricePerShare: parsed.pricePerShare,
      rawText: markdown,
    };
  } catch (error: any) {
    console.error('[13D Parser] Parsing failed:', error.message);
    return null;
  }
}

// =====================================================
// Form 4 Parser: Insider Transactions
// =====================================================

export async function parseForm4(
  markdown: string,
  metadata: {
    ticker: string;
    cik: string;
    companyName: string;
    filingType: string;
    filingDate: string;
    accessionNumber: string;
    sourceUrl: string;
  }
): Promise<InsiderTransaction | null> {
  try {
    const prompt = `You are a financial analyst parsing SEC Form 4 (insider transaction report).

Extract the following information:

1. **Reporting Person** (insider):
   - Name
   - CIK (if available)
   - Position/Title (CEO, CFO, Director, etc.)
   - Is Director (true/false)
   - Is Officer (true/false)
   - Is 10% Owner (true/false)

2. **Transaction Details**:
   - Transaction date (when the trade occurred)
   - Transaction type: Purchase, Sale, Award, Option Exercise, Gift
   - Transaction code (SEC code: P, S, A, M, G, etc.)
   - Shares traded (number of shares)
   - Price per share
   - Total value (shares * price)

3. **Post-Transaction Holdings**:
   - Shares owned after transaction
   - Ownership percent after transaction (if disclosed)

4. **Derivative Info** (if applicable):
   - Is derivative (true if stock options, RSUs, etc.)
   - Derivative type (Stock Option, RSU, Warrant, etc.)

**Filing Text:**
${markdown.substring(0, 8000)}

**Respond ONLY with valid JSON:**
{
  "reporterName": "string",
  "reporterCik": "string or null",
  "position": "string or null",
  "isDirector": boolean,
  "isOfficer": boolean,
  "isTenPercentOwner": boolean,
  "transactionDate": "YYYY-MM-DD",
  "transactionType": "Purchase|Sale|Award|Option Exercise|Gift",
  "transactionCode": "string",
  "sharesTraded": number,
  "pricePerShare": number or null,
  "totalValue": number or null,
  "sharesOwnedAfter": number,
  "ownershipPercentAfter": number or null,
  "isDerivative": boolean,
  "derivativeType": "string or null"
}`;

    const response = await glmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Form 4 Parser] Failed to extract JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ...metadata,
      reporterName: parsed.reporterName,
      reporterCik: parsed.reporterCik,
      position: parsed.position,
      isDirector: parsed.isDirector,
      isOfficer: parsed.isOfficer,
      isTenPercentOwner: parsed.isTenPercentOwner,
      transactionDate: parsed.transactionDate,
      transactionType: parsed.transactionType,
      transactionCode: parsed.transactionCode,
      sharesTraded: parsed.sharesTraded,
      pricePerShare: parsed.pricePerShare,
      totalValue: parsed.totalValue,
      sharesOwnedAfter: parsed.sharesOwnedAfter,
      ownershipPercentAfter: parsed.ownershipPercentAfter,
      isDerivative: parsed.isDerivative,
      derivativeType: parsed.derivativeType,
      rawText: markdown,
    };
  } catch (error: any) {
    console.error('[Form 4 Parser] Parsing failed:', error.message);
    return null;
  }
}

// =====================================================
// 424B Parser: Public Offering Prospectus
// =====================================================

export async function parse424B(
  markdown: string,
  metadata: {
    ticker: string;
    cik: string;
    companyName: string;
    filingType: string;
    filingDate: string;
    accessionNumber: string;
    sourceUrl: string;
  }
): Promise<CapitalRaise | null> {
  try {
    const prompt = `You are a financial analyst parsing SEC Form ${metadata.filingType} (public offering prospectus).

Extract the following information:

1. **Offering Type**: IPO, Follow-on, PIPE, At-the-market, Rights Offering
2. **Offering Status**: Registered, Effective, Completed, Withdrawn
3. **Share Structure**:
   - Shares offered (number of new shares)
   - Shares outstanding before offering (if disclosed)
   - Shares outstanding after offering (if disclosed)
4. **Pricing**:
   - Price per share (final offering price)
   - Price range low (if applicable)
   - Price range high (if applicable)
5. **Proceeds**:
   - Gross proceeds (total raised before expenses)
   - Underwriting discount (fees paid to underwriters)
   - Net proceeds (gross - discount)
6. **Dilution**:
   - Dilution percent (new shares / old shares * 100)
7. **Use of Proceeds**: Short description (R&D, working capital, debt repayment, etc.)
8. **Underwriters**:
   - Lead underwriter (bookrunner)
   - All underwriters (array of names)
9. **Greenshoe**:
   - Has greenshoe (over-allotment option)
   - Greenshoe shares (if applicable)

**Filing Text:**
${markdown.substring(0, 10000)}

**Respond ONLY with valid JSON:**
{
  "offeringType": "string or null",
  "offeringStatus": "string or null",
  "sharesOffered": number or null,
  "sharesOutstandingBefore": number or null,
  "sharesOutstandingAfter": number or null,
  "pricePerShare": number or null,
  "priceRangeLow": number or null,
  "priceRangeHigh": number or null,
  "grossProceeds": number or null,
  "underwritingDiscount": number or null,
  "netProceeds": number or null,
  "dilutionPercent": number or null,
  "useOfProceeds": "string or null",
  "leadUnderwriter": "string or null",
  "allUnderwriters": ["string"] or null,
  "hasGreenshoe": boolean,
  "greenshoeShares": number or null
}`;

    const response = await glmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[424B Parser] Failed to extract JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ...metadata,
      offeringType: parsed.offeringType,
      offeringStatus: parsed.offeringStatus,
      sharesOffered: parsed.sharesOffered,
      sharesOutstandingBefore: parsed.sharesOutstandingBefore,
      sharesOutstandingAfter: parsed.sharesOutstandingAfter,
      pricePerShare: parsed.pricePerShare,
      priceRangeLow: parsed.priceRangeLow,
      priceRangeHigh: parsed.priceRangeHigh,
      grossProceeds: parsed.grossProceeds,
      underwritingDiscount: parsed.underwritingDiscount,
      netProceeds: parsed.netProceeds,
      dilutionPercent: parsed.dilutionPercent,
      useOfProceeds: parsed.useOfProceeds,
      leadUnderwriter: parsed.leadUnderwriter,
      allUnderwriters: parsed.allUnderwriters,
      hasGreenshoe: parsed.hasGreenshoe,
      greenshoeShares: parsed.greenshoeShares,
      rawText: markdown,
    };
  } catch (error: any) {
    console.error('[424B Parser] Parsing failed:', error.message);
    return null;
  }
}

// =====================================================
// 8-K Parser: Material Events
// =====================================================

export async function parse8K(
  markdown: string,
  metadata: {
    ticker: string;
    cik: string;
    companyName: string;
    filingDate: string;
    accessionNumber: string;
    sourceUrl: string;
  }
): Promise<MaterialEvent | null> {
  try {
    const prompt = `You are a financial analyst parsing SEC Form 8-K (current report - material events).

Extract the following information:

1. **Event Classification**:
   - Event items (SEC item codes, e.g., ['1.01', '5.02', '8.01'])
   - Event types (human-readable, e.g., ['Material Agreement', 'CEO Departure', 'Press Release'])

2. **Severity**: Critical, High, Medium, or Low (your assessment)

3. **Event Summary**: One paragraph describing what happened

4. **Key Details**: Structured JSON with event-specific details (varies by type)

5. **Financial Impact**: Dollar amount if disclosed (e.g., $500000000 for $500M investment)

6. **Report Date**: Actual event date (can differ from filing date)

7. **Counterparties**: Other companies/entities involved (array)

**Common 8-K Items:**
- 1.01: Material Agreement
- 1.02: Termination of Material Agreement
- 2.01: Completion of Acquisition/Disposition
- 5.02: Departure/Appointment of Directors/Officers
- 8.01: Other Events (press releases, etc.)

**Filing Text:**
${markdown.substring(0, 8000)}

**Respond ONLY with valid JSON:**
{
  "eventItems": ["string"],
  "eventTypes": ["string"],
  "severity": "Critical|High|Medium|Low",
  "eventSummary": "string",
  "keyDetails": {},
  "financialImpact": number or null,
  "reportDate": "YYYY-MM-DD or null",
  "counterparties": ["string"] or null
}`;

    const response = await glmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[8-K Parser] Failed to extract JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ...metadata,
      eventItems: parsed.eventItems,
      eventTypes: parsed.eventTypes,
      severity: parsed.severity,
      eventSummary: parsed.eventSummary,
      keyDetails: parsed.keyDetails,
      financialImpact: parsed.financialImpact,
      impactCurrency: 'USD',
      reportDate: parsed.reportDate,
      counterparties: parsed.counterparties,
      rawText: markdown,
    };
  } catch (error: any) {
    console.error('[8-K Parser] Parsing failed:', error.message);
    return null;
  }
}

// =====================================================
// Helper: Route filing to appropriate parser
// =====================================================

export async function parseFilingByType(
  filingType: string,
  markdown: string,
  metadata: any
): Promise<any | null> {
  const normalizedType = filingType.toUpperCase().trim();

  // Ownership filings
  if (['13D', '13G', 'SC 13D', 'SC 13G'].includes(normalizedType)) {
    return await parse13D(markdown, metadata);
  }

  // Insider trading
  if (['3', '4', '5'].includes(normalizedType)) {
    return await parseForm4(markdown, metadata);
  }

  // Capital raising
  if (['424B1', '424B3', '424B5', 'S-1', 'S-3'].includes(normalizedType)) {
    return await parse424B(markdown, metadata);
  }

  // Material events
  if (normalizedType === '8-K') {
    return await parse8K(markdown, metadata);
  }

  // Unsupported type
  console.log(`[Filing Parser] No parser available for ${filingType}`);
  return null;
}
