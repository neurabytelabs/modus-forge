/**
 * Iterate Refiner — LLM-powered refinement of generated apps.
 * 
 * Takes a generated HTML app + its Spinoza validation report,
 * and asks the LLM to fix specific issues in a targeted way.
 * 
 * This is cheaper than regenerating from scratch because we send
 * the existing code + specific fix instructions.
 */

import { validate } from '../rune/validator.js';
import { route } from '../generators/router.js';

/**
 * Build a refinement prompt from validation issues.
 * @param {string} code - Current HTML
 * @param {{ issues: string[], conatus: number, ratio: number, laetitia: number, natura: number }} report
 * @returns {string} Refinement prompt
 */
function buildRefinementPrompt(code, report) {
  const weakest = Object.entries({
    conatus: report.conatus,
    ratio: report.ratio,
    laetitia: report.laetitia,
    natura: report.natura,
  }).sort((a, b) => a[1] - b[1]);

  const focusAreas = weakest.slice(0, 2).map(([axis, score]) => {
    const hints = {
      conatus: 'Add more interactive elements, event listeners, localStorage persistence, or canvas visualizations.',
      ratio: 'Ensure DOCTYPE, proper closing tags, try/catch error handling, and substantial code structure.',
      laetitia: 'Add CSS custom properties, transitions/animations, gradients, and responsive media queries.',
      natura: 'Use semantic HTML (header/main/footer/nav), ARIA attributes, placeholder text, and emoji.',
    };
    return `- **${axis}** (${(score * 100).toFixed(0)}%): ${hints[axis]}`;
  });

  return `You are refining an existing web app. The app works but has quality gaps.

## CURRENT CODE
\`\`\`html
${code}
\`\`\`

## ISSUES FOUND
${report.issues.map(i => `- ${i}`).join('\n')}

## FOCUS AREAS (lowest scores)
${focusAreas.join('\n')}

## INSTRUCTIONS
1. Keep all existing functionality intact
2. Fix the listed issues
3. Improve the focus areas specifically
4. Do NOT remove any working features
5. Return the COMPLETE updated HTML file

Return ONLY the complete HTML. No markdown fences. No explanation.
Start with <!DOCTYPE html> and end with </html>.`;
}

/**
 * Refine a generated app iteratively until quality threshold is met.
 * @param {string} code - Initial HTML
 * @param {object} opts - { model, maxRounds, threshold }
 * @returns {Promise<{ code: string, report: object, rounds: number, improved: boolean }>}
 */
export async function refine(code, opts = {}) {
  const maxRounds = opts.maxRounds || 2;
  const threshold = opts.threshold || 0.75; // average score threshold
  const model = opts.model || 'gemini';

  let current = code;
  let report = validate(current);
  let avg = (report.conatus + report.ratio + report.laetitia + report.natura) / 4;
  let rounds = 0;

  while (avg < threshold && rounds < maxRounds) {
    rounds++;
    console.log(`   🔧 Refining (round ${rounds}/${maxRounds}) — current avg: ${(avg * 100).toFixed(0)}%`);

    const prompt = buildRefinementPrompt(current, report);
    const refined = await route(prompt, { model });

    // Validate refinement didn't make things worse
    const newReport = validate(refined);
    const newAvg = (newReport.conatus + newReport.ratio + newReport.laetitia + newReport.natura) / 4;

    if (newAvg >= avg) {
      current = refined;
      report = newReport;
      avg = newAvg;
      console.log(`   ✅ Improved to ${(avg * 100).toFixed(0)}%`);
    } else {
      console.log(`   ⚠️  Refinement regressed (${(newAvg * 100).toFixed(0)}% < ${(avg * 100).toFixed(0)}%) — keeping previous`);
      break;
    }

    if (avg >= threshold) {
      console.log(`   🎯 Threshold ${(threshold * 100).toFixed(0)}% reached!`);
    }
  }

  return {
    code: current,
    report,
    rounds,
    improved: rounds > 0,
  };
}
