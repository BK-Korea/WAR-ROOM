/**
 * Financial Data Validators - Goldman Sachs-grade data quality checks
 *
 * Validates financial numbers to prevent hallucination and ensure accuracy
 */

// ============================================
// Types
// ============================================

export interface ValidationResult {
  valid: boolean;
  value?: number;
  formattedValue?: string;
  reason?: string;
  warnings?: string[];
}

export interface FinancialContext {
  metric: 'revenue' | 'net_income' | 'assets' | 'liabilities' | 'cash_flow' | 'other';
  ticker: string;
  year: number;
  quarter?: number;
  industry?: string;
}

// ============================================
// Industry Benchmarks (Simplified)
// ============================================

const INDUSTRY_REVENUE_RANGES: Record<string, { min: number; max: number }> = {
  'aerospace': { min: 1_000_000, max: 100_000_000_000 }, // $1M - $100B
  'technology': { min: 1_000_000, max: 500_000_000_000 }, // $1M - $500B
  'automotive': { min: 10_000_000, max: 300_000_000_000 }, // $10M - $300B
  'biotech': { min: 100_000, max: 50_000_000_000 }, // $100K - $50B
  'finance': { min: 1_000_000, max: 200_000_000_000 }, // $1M - $200B
  'default': { min: 10_000, max: 1_000_000_000_000 }, // $10K - $1T
};

// ============================================
// Validators
// ============================================

/**
 * Validate financial number against expected ranges and patterns
 */
export function validateFinancialNumber(
  value: number,
  context: FinancialContext,
  previousYearValue?: number
): ValidationResult {
  const warnings: string[] = [];

  // 1. Basic sanity check - value too small
  if (context.metric === 'revenue' && value < 1000) {
    return {
      valid: false,
      reason: `Revenue value ${value} is suspiciously low - likely missing unit scale (thousands/millions/billions)`,
    };
  }

  // 2. Industry range check
  if (context.metric === 'revenue' && context.industry) {
    const range = INDUSTRY_REVENUE_RANGES[context.industry] || INDUSTRY_REVENUE_RANGES['default'];

    if (value < range.min) {
      warnings.push(`Revenue ${formatCurrency(value)} is below typical ${context.industry} range`);
    }

    if (value > range.max) {
      warnings.push(`Revenue ${formatCurrency(value)} exceeds typical ${context.industry} range`);
    }
  }

  // 3. YoY change validation
  if (previousYearValue !== undefined && previousYearValue > 0) {
    const yoyChange = Math.abs((value - previousYearValue) / previousYearValue);

    // More than 100% change is suspicious
    if (yoyChange > 1.0) {
      warnings.push(
        `YoY change of ${(yoyChange * 100).toFixed(1)}% is unusually high - verify data accuracy`
      );
    }

    // More than 500% change is likely an error
    if (yoyChange > 5.0) {
      return {
        valid: false,
        reason: `YoY change of ${(yoyChange * 100).toFixed(1)}% is likely a data error`,
      };
    }
  }

  // 4. Negative revenue check
  if (context.metric === 'revenue' && value < 0) {
    return {
      valid: false,
      reason: 'Revenue cannot be negative',
    };
  }

  // All checks passed
  return {
    valid: true,
    value,
    formattedValue: formatCurrency(value),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Format currency with appropriate unit (K/M/B)
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000_000) {
    return `${sign}$${(value / 1_000_000_000_000).toFixed(decimals)}T`;
  }

  if (absValue >= 1_000_000_000) {
    return `${sign}$${(value / 1_000_000_000).toFixed(decimals)}B`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}$${(value / 1_000_000).toFixed(decimals)}M`;
  }

  if (absValue >= 1_000) {
    return `${sign}$${(value / 1_000).toFixed(decimals)}K`;
  }

  return `${sign}$${value.toFixed(decimals)}`;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(valueStr: string): number | null {
  const cleaned = valueStr.replace(/[$,\s]/g, '').trim();

  // Handle K/M/B/T suffixes
  const match = cleaned.match(/^(-?[\d.]+)([KMBT])?$/i);
  if (!match) return null;

  const baseValue = parseFloat(match[1]);
  if (isNaN(baseValue)) return null;

  const unit = match[2]?.toUpperCase();

  switch (unit) {
    case 'T':
      return baseValue * 1_000_000_000_000;
    case 'B':
      return baseValue * 1_000_000_000;
    case 'M':
      return baseValue * 1_000_000;
    case 'K':
      return baseValue * 1_000;
    default:
      return baseValue;
  }
}

/**
 * Validate XBRL value matches expected scale
 */
export function validateXBRLScale(
  value: number,
  declaredScale: 'actual' | 'thousands' | 'millions' | 'billions',
  context: FinancialContext
): ValidationResult {
  // Check if declared scale makes sense for the value
  const absValue = Math.abs(value);

  if (context.metric === 'revenue') {
    // Revenue declared as "actual" but value is in millions range
    if (declaredScale === 'actual' && absValue >= 1_000_000) {
      return {
        valid: false,
        reason: `Value ${value} is too large for scale "${declaredScale}" - likely in millions or billions`,
      };
    }

    // Revenue declared as "billions" but value is too small
    if (declaredScale === 'billions' && absValue < 1) {
      return {
        valid: false,
        reason: `Value ${value} is too small for scale "${declaredScale}"`,
      };
    }
  }

  return {
    valid: true,
    value,
    formattedValue: formatCurrency(value),
  };
}

/**
 * Convert XBRL value to actual dollars based on scale
 */
export function convertXBRLValue(
  value: number,
  scale: 'actual' | 'thousands' | 'millions' | 'billions'
): number {
  switch (scale) {
    case 'billions':
      return value * 1_000_000_000;
    case 'millions':
      return value * 1_000_000;
    case 'thousands':
      return value * 1_000;
    case 'actual':
    default:
      return value;
  }
}

/**
 * Detect likely industry from ticker/company name
 */
export function detectIndustry(ticker: string, companyName: string): string {
  const text = `${ticker} ${companyName}`.toLowerCase();

  if (text.includes('aero') || text.includes('aviation') || text.includes('aircraft')) {
    return 'aerospace';
  }

  if (text.includes('tech') || text.includes('software') || text.includes('cloud')) {
    return 'technology';
  }

  if (text.includes('auto') || text.includes('motor') || text.includes('vehicle')) {
    return 'automotive';
  }

  if (text.includes('bio') || text.includes('pharma') || text.includes('therapeutics')) {
    return 'biotech';
  }

  if (text.includes('bank') || text.includes('financial') || text.includes('capital')) {
    return 'finance';
  }

  return 'default';
}

/**
 * Validate percentage value
 */
export function validatePercentage(value: number): ValidationResult {
  if (value < -100 || value > 1000) {
    return {
      valid: false,
      reason: `Percentage value ${value}% is out of reasonable range`,
    };
  }

  return {
    valid: true,
    value,
    formattedValue: `${value.toFixed(2)}%`,
  };
}

/**
 * Validate share count
 */
export function validateShareCount(value: number, context: FinancialContext): ValidationResult {
  // Share count should be positive
  if (value <= 0) {
    return {
      valid: false,
      reason: 'Share count must be positive',
    };
  }

  // Share count typically in millions or billions
  if (value < 1_000) {
    return {
      valid: false,
      reason: `Share count ${value} is suspiciously low - likely missing scale factor`,
    };
  }

  return {
    valid: true,
    value,
    formattedValue: formatCurrency(value, 0).replace('$', ''),
  };
}
