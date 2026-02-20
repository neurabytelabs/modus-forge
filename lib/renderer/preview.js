/**
 * Preview — Opens generated HTML in the default browser
 */

import { execSync } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Open a file in the default browser.
 * @param {string} filePath - Path to HTML file
 */
export async function preview(filePath) {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
  try {
    execSync(`${cmd} "${filePath}"`, { stdio: 'ignore' });
  } catch {
    console.log(`📂 Open manually: ${filePath}`);
  }
}
