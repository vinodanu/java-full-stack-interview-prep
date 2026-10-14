const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
let checked = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { visit(filename); continue; }
    if (!/\.(md|html)$/.test(entry.name)) continue;
    const text = fs.readFileSync(filename, 'utf8');
    const targets = entry.name.endsWith('.md')
      ? [...text.matchAll(/\]\(([^\s)]+)\)/g)].map(match => match[1])
      : [...text.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    for (const target of targets) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const resolved = path.resolve(path.dirname(filename), decodeURIComponent(target.split('#')[0]));
      assert(resolved === root || resolved.startsWith(root + path.sep), `Link escapes repository: ${target}`);
      assert(fs.existsSync(resolved), `Broken link in ${path.relative(root, filename)}: ${target}`);
      checked++;
    }
  }
}
visit(root);
console.log(`Passed ${checked} local Markdown/HTML links.`);
