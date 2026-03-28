const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const { name, version } = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')
);

const content = `// Auto-generated - do not edit manually
export const PACKAGE_NAME = '${name}';
export const PACKAGE_VERSION = '${version}';
`;

writeFileSync(resolve(__dirname, '..', 'src', 'version.ts'), content);
