/**
 * RUNE Validator — Spinoza-inspired output validation
 * Scores generated code on 4 axes: Conatus, Ratio, Laetitia, Natura
 */

/**
 * Validate generated HTML/code against Spinoza criteria.
 * @param {string} code - Generated HTML string
 * @returns {{ conatus: number, ratio: number, laetitia: number, natura: number, grade: string, issues: string[] }}
 */
export function validate(code) {
  const issues = [];
  let conatus = 0, ratio = 0, laetitia = 0, natura = 0;

  // --- CONATUS (Power of Existing / Actionability) ---
  // Does it DO something? Interactive elements, event listeners, data persistence
  const hasForm = /<(input|textarea|select|button)/i.test(code);
  const hasEventListeners = /addEventListener|onclick|onsubmit|onChange/i.test(code);
  const hasLocalStorage = /localStorage/i.test(code);
  const hasCanvas = /<canvas/i.test(code) || /getContext|Chart/i.test(code);

  if (hasForm) conatus += 0.3;
  else issues.push('No input elements — low interactivity');
  if (hasEventListeners) conatus += 0.3;
  else issues.push('No event listeners — static page');
  if (hasLocalStorage) conatus += 0.2;
  if (hasCanvas) conatus += 0.2;

  // --- RATIO (Logical Adequacy) ---
  // Is the code well-structured? No obvious errors?
  const hasDoctype = /<!DOCTYPE html>/i.test(code);
  const hasClosingTags = /<\/html>/i.test(code) && /<\/body>/i.test(code);
  const hasScript = /<script/i.test(code);
  const hasTryCatch = /try\s*\{/i.test(code);
  const noConsoleLogs = !/console\.log\(/i.test(code);
  const codeLength = code.length;

  if (hasDoctype) ratio += 0.2;
  else issues.push('Missing DOCTYPE');
  if (hasClosingTags) ratio += 0.2;
  else issues.push('Missing closing HTML/body tags');
  if (hasScript) ratio += 0.2;
  if (hasTryCatch) ratio += 0.2;
  if (codeLength > 2000) ratio += 0.2; // substantial code
  else issues.push('Code seems too short — might be incomplete');

  // --- LAETITIA (Joy / Beauty) ---
  // CSS quality, animations, visual polish
  const hasStyle = /<style/i.test(code);
  const hasCustomProps = /--[a-z]/i.test(code);
  const hasTransitions = /transition|animation|@keyframes/i.test(code);
  const hasGradient = /gradient/i.test(code);
  const hasMediaQuery = /@media/i.test(code);

  if (hasStyle) laetitia += 0.25;
  else issues.push('No embedded styles');
  if (hasCustomProps) laetitia += 0.2;
  if (hasTransitions) laetitia += 0.25;
  if (hasGradient) laetitia += 0.15;
  if (hasMediaQuery) laetitia += 0.15;

  // --- NATURA (Naturalness / Intuition) ---
  // Semantic HTML, accessibility, UX patterns
  const hasSemantic = /<(header|main|footer|nav|section|article)/i.test(code);
  const hasAria = /aria-|role=/i.test(code);
  const hasPlaceholder = /placeholder=/i.test(code);
  const hasTitle = /<title>/i.test(code);
  const hasEmoji = /[\u{1F300}-\u{1FAD6}]/u.test(code);

  if (hasSemantic) natura += 0.25;
  else issues.push('No semantic HTML elements');
  if (hasAria) natura += 0.2;
  if (hasPlaceholder) natura += 0.2;
  if (hasTitle) natura += 0.2;
  if (hasEmoji) natura += 0.15;

  // Clamp all scores
  conatus = Math.min(1, Math.round(conatus * 10) / 10);
  ratio = Math.min(1, Math.round(ratio * 10) / 10);
  laetitia = Math.min(1, Math.round(laetitia * 10) / 10);
  natura = Math.min(1, Math.round(natura * 10) / 10);

  const avg = (conatus + ratio + laetitia + natura) / 4;
  const grade = avg >= 0.85 ? 'S' : avg >= 0.7 ? 'A' : avg >= 0.55 ? 'B' : avg >= 0.4 ? 'C' : 'D';

  return { conatus, ratio, laetitia, natura, grade, issues };
}
