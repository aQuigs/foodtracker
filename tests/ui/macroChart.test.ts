import { expect } from '@esm-bundle/chai';
import { renderMacroChart } from '../../src/ui/macroChart.js';
import type { Totals } from '../../src/domain/types.js';

function totals(kcal: number, protein: number, carbs: number, fat: number): Totals {
  return { kcal, protein, carbs, fat };
}

describe('renderMacroChart', () => {
  it('returns null when totals.kcal is 0', () => {
    const result = renderMacroChart(totals(0, 0, 0, 0));
    expect(result).to.equal(null);
  });

  it('returns an HTMLElement when totals.kcal is non-zero', () => {
    const result = renderMacroChart(totals(500, 30, 50, 10));
    expect(result).to.be.instanceOf(HTMLElement);
  });

  it('renders exactly three segments ordered protein → carbs → fat', () => {
    const result = renderMacroChart(totals(500, 30, 50, 10))!;
    const segments = result.querySelectorAll('[data-macro]');
    expect(segments.length).to.equal(3);
    expect(segments[0]!.getAttribute('data-macro')).to.equal('protein');
    expect(segments[1]!.getAttribute('data-macro')).to.equal('carbs');
    expect(segments[2]!.getAttribute('data-macro')).to.equal('fat');
  });

  it('each segment label contains the percent and calorie count', () => {
    // 30g protein (120 cal), 50g carbs (200 cal), 10g fat (90 cal) → 410 cal total
    const result = renderMacroChart(totals(500, 30, 50, 10))!;
    const segments = result.querySelectorAll('[data-macro]');

    const proteinText = segments[0]!.textContent ?? '';
    const carbsText   = segments[1]!.textContent ?? '';
    const fatText     = segments[2]!.textContent ?? '';

    // Labels should contain the macro name, a percentage, and the calorie count
    expect(proteinText).to.match(/protein/i);
    expect(proteinText).to.match(/%/);
    expect(proteinText).to.match(/120\s*cal/i);

    expect(carbsText).to.match(/carbs/i);
    expect(carbsText).to.match(/%/);
    expect(carbsText).to.match(/200\s*cal/i);

    expect(fatText).to.match(/fat/i);
    expect(fatText).to.match(/%/);
    expect(fatText).to.match(/90\s*cal/i);
  });

  it('segment widths roughly match the macro percentages', () => {
    // 25g protein (100 cal), 25g carbs (100 cal), 11.111g fat (100 cal) → 300 cal total = 33.3% each
    const result = renderMacroChart(totals(400, 25, 25, 100 / 9))!;
    const segments = Array.from(result.querySelectorAll('[data-macro]')) as HTMLElement[];

    for (const seg of segments) {
      const basis = seg.style.flexBasis || seg.style.width;
      const pct = parseFloat(basis);
      // Each segment should be close to 33.3% (within 2%)
      expect(pct).to.be.within(30, 37);
    }
  });

  it('hidden chart element is not rendered when kcal is 0 (guard from view)', () => {
    // This verifies the null return is the intended API for the view to conditionally include
    expect(renderMacroChart(totals(0, 0, 0, 0))).to.equal(null);
    expect(renderMacroChart(totals(0, 100, 100, 100))).to.equal(null);
  });
});
