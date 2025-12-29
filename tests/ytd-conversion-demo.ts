#!/usr/bin/env tsx
/**
 * YTD to Quarterly Conversion Logic Demonstration
 * Shows how SEC's cumulative YTD values are converted to standalone quarters
 */

// Example: Apple's FY2024 Revenue (in billions, example data)
const exampleData = {
  Q1_YTD: 119.6,  // Q1 standalone
  Q2_YTD: 210.5,  // Q1 + Q2 cumulative
  Q3_YTD: 300.8,  // Q1 + Q2 + Q3 cumulative
  FY: 394.3       // Full year (Q1 + Q2 + Q3 + Q4)
};

console.log('═══════════════════════════════════════════════════');
console.log('📊 YTD to Quarterly Conversion Demo');
console.log('═══════════════════════════════════════════════════\n');

console.log('INPUT: SEC API Data (Cumulative YTD)');
console.log('─────────────────────────────────────');
console.log(`Q1 YTD:  $${exampleData.Q1_YTD}B`);
console.log(`Q2 YTD:  $${exampleData.Q2_YTD}B  (Q1 + Q2 total)`);
console.log(`Q3 YTD:  $${exampleData.Q3_YTD}B  (Q1 + Q2 + Q3 total)`);
console.log(`FY:      $${exampleData.FY}B      (Full year)\n`);

// Conversion logic (same as in Helena.ts:1090-1144)
const Q1_standalone = exampleData.Q1_YTD;
const Q2_standalone = exampleData.Q2_YTD - exampleData.Q1_YTD;
const Q3_standalone = exampleData.Q3_YTD - exampleData.Q2_YTD;
const Q4_standalone = exampleData.FY - exampleData.Q3_YTD;  // GENERATED!

console.log('OUTPUT: Standalone Quarterly Values');
console.log('─────────────────────────────────────');
console.log(`Q1:  $${Q1_standalone.toFixed(1)}B  (no change, already standalone)`);
console.log(`Q2:  $${Q2_standalone.toFixed(1)}B  (Q2_YTD - Q1)`);
console.log(`Q3:  $${Q3_standalone.toFixed(1)}B  (Q3_YTD - Q2_YTD)`);
console.log(`Q4:  $${Q4_standalone.toFixed(1)}B  (FY - Q3_YTD) ⭐ GENERATED!\n`);

console.log('VERIFICATION: Sum = Full Year?');
console.log('─────────────────────────────────────');
const sum = Q1_standalone + Q2_standalone + Q3_standalone + Q4_standalone;
console.log(`Sum:  $${sum.toFixed(1)}B`);
console.log(`FY:   $${exampleData.FY}B`);
console.log(`✅ ${sum === exampleData.FY ? 'MATCH!' : 'ERROR!'}\n`);

console.log('SEASONAL ANALYSIS (what Dorothy will see)');
console.log('─────────────────────────────────────');
const quarters = [
  { quarter: 'Q1 (Oct-Dec)', value: Q1_standalone },
  { quarter: 'Q2 (Jan-Mar)', value: Q2_standalone },
  { quarter: 'Q3 (Apr-Jun)', value: Q3_standalone },
  { quarter: 'Q4 (Jul-Sep)', value: Q4_standalone }
];

quarters.sort((a, b) => b.value - a.value);

console.log('Ranking (highest to lowest):');
quarters.forEach((q, i) => {
  const emoji = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
  console.log(`${emoji} ${i + 1}. ${q.quarter}: $${q.value.toFixed(1)}B`);
});

console.log('\n✅ Dorothy can now correctly identify Q1 (holiday season) as peak!\n');
console.log('═══════════════════════════════════════════════════');
