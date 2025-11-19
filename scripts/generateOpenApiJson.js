const fs = require('fs');
const path = require('path');
try {
  const yaml = require('js-yaml');
  const inPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  const outPath = path.join(__dirname, '..', 'docs', 'openapi.json');
  const data = fs.readFileSync(inPath, 'utf8');
  const doc = yaml.load(data);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
  console.log('Wrote', outPath);
} catch (err) {
  console.error('Failed to generate JSON from YAML. Ensure `js-yaml` is installed. Error:', err.message);
  process.exit(1);
}
