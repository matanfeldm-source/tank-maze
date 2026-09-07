// build-artifact.js — bundles index.html + css/style.css + js/*.js into a single
// self-contained file (artifact_content.html) suitable for publishing as a Claude Artifact.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const jsFiles = ['config', 'maze', 'audio', 'input', 'entities', 'ai', 'render', 'net', 'game'];
const js = jsFiles.map(f => `// ==== ${f}.js ====\n` + fs.readFileSync(path.join(root, `js/${f}.js`), 'utf8')).join('\n\n');

let out = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
const scriptBlock = jsFiles.map(f => `<script src="js/${f}.js"></script>`).join('\n');
out = out.replace(scriptBlock, `<script>\n${js}\n</script>`);

out = out
  .replace(/^<!DOCTYPE html>\n?/i, '')
  .replace(/<html[^>]*>\n?/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>\n?/i, '')
  .replace(/<\/head>\n?/i, '')
  .replace(/<body>\n?/i, '')
  .replace(/<\/body>\n?/i, '')
  .replace(/<meta charset="utf-8">\n?/i, '')
  .replace(/<meta name="viewport"[^>]*>\n?/i, '');

fs.writeFileSync(path.join(root, 'artifact_content.html'), out);
console.log('wrote artifact_content.html', out.length, 'bytes');
