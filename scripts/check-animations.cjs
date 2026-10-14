const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const animationDirectory = path.resolve(__dirname, '../animations');
for (const file of fs.readdirSync(animationDirectory).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(animationDirectory, file), 'utf8');
  const elements = new Map();
  function element() { return {children: [], textContent: '', disabled: false, append(n) { this.children.push(n); }, replaceChildren() { this.children = []; }}; }
  for (const id of ['stage','caption','play','pause','step','reset']) elements.set(id, element());
  let tick = null;
  const context = vm.createContext({document: {getElementById: id => {assert(elements.has(id)); return elements.get(id);}, createElement: element}, setInterval(fn) {tick = fn; return 1;}, clearInterval() {tick = null;}});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  assert(elements.get('stage').children.length > 0);
  const initial = elements.get('caption').textContent;
  elements.get('step').onclick();
  assert.notStrictEqual(elements.get('caption').textContent, initial);
  for(let n=0;n<40;n++) elements.get('step').onclick();
  assert(elements.get('step').disabled);
  elements.get('play').onclick();
  assert(tick);
  tick();
  elements.get('pause').onclick();
  assert.strictEqual(tick,null);
  elements.get('reset').onclick();
  assert.strictEqual(elements.get('caption').textContent,initial);
  console.log(file + ': controls and all frames passed');
}
