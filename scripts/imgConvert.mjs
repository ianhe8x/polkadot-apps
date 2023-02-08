// Copyright 2017-2023 @polkadot/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

import { formatNumber, stringCamelCase } from '@polkadot/util';

const MAX_SIZE = 48 * 1024;
const HEADER = '// Copyright 2017-2023 @polkadot/apps authors & contributors\n// SPDX-License-Identifier: Apache-2.0\n\n// Do not edit. Auto-generated via node scripts/imgConvert.mjs\n\n';

const MIME = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml'
}

function makeContents (k, contents) {
  return `${HEADER}export const ${k} = '${contents}';\n`;
}

const all = {};
const sizes = {};

for (let dir of ['extensions', 'external', 'chains', 'nodes']) {
  const sub = path.join('packages/apps-config/src/ui/logos', dir);
  const result = {};

  fs
    .readdirSync(sub)
    .forEach((file) => {
      const full = path.join(sub, file);

      if (fs.lstatSync(full).isFile() && !(file.endsWith('.ts') || file.startsWith('.'))) {
        const parts = file.split('.');
        const ext = parts[parts.length - 1];
        const nameParts = parts.slice(0, parts.length - 1);
        const mime = MIME[ext];

        if (!mime) {
          throw new Error(`Unable to determine mime for ${file}`);
        } else {
          const data = `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
          const k = `${stringCamelCase(`${dir}_${nameParts.join('_')}`)}${ext.toUpperCase()}`;
          const fileprefix = `generated/${nameParts.join('.')}${ext.toUpperCase()}`;

          fs.writeFileSync(path.join(sub, `${fileprefix}.ts`), makeContents(k, data));

          result[k] = fileprefix;
          all[k] = data;
          sizes[k] = data.length;
        }
      }
    });

    if (Object.keys(result).length) {
      let srcs = '';

      for (let dir of ['endpoints', 'extensions', 'links']) {
      const srcroot = path.join('packages/apps-config/src', dir);

        fs
          .readdirSync(srcroot)
          .forEach((file) => {
            const full = path.join(srcroot, file);

            if (fs.lstatSync(full).isFile() && file.endsWith('.ts')) {
              srcs += fs.readFileSync(full).toString();
            }
          });
      }

      const notfound = Object
        .keys(result)
        .filter((k) => !srcs.includes(k));

      if (notfound.length) {
        console.log('\n', notfound.length.toString().padStart(3), 'not referenced in', dir, '::\n\n\t', notfound.join(', '), '\n');
      }

      fs.writeFileSync(path.join(sub, 'index.ts'), `${HEADER}${Object.keys(result).sort().map((k) => `export { ${k} } from './${result[k]}';`).join('\n')}\n`);
    }
}

const allKeys = Object.keys(all);
const dupes = {};

 allKeys.forEach((a) => {
  const d = allKeys.filter((b) =>
    a !== b &&
    all[a] === all[b]
  );

  if (d.length) {
    dupes[a] = d;
  }
 });

if (Object.keys(dupes).length) {
  const dupeMsg = `${Object.keys(dupes).length.toString().padStart(3)} dupes found`;

  console.log('\n', dupeMsg, '::\n');

  for (let [k, d] of Object.entries(dupes)) {
    console.log('\t', k.padStart(30), ' >> ', d.join(', '));
  }

  throw new Error(`FATAL: ${dupeMsg}`);
}

const large = Object
  .entries(sizes)
  .sort((a, b) => b[1] - a[1])
  .filter(([, v]) => v > MAX_SIZE);

if (Object.keys(large).length) {
  console.log('\n', `${Object.keys(large).length.toString().padStart(3)} large images found ::\n`);

  large.forEach(([k, v]) =>
    console.log('\t', k.padStart(30), formatNumber(v).padStart(15))
  );

  console.log();
}
