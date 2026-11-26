#!/usr/bin/env node
// Ground View regression runner.
//
//   node tests/regression/run.mjs                 units + live site + security + data
//   node tests/regression/run.mjs units           one suite (units | site | security | data | local)
//   BASE_URL=https://staging.example node tests/regression/run.mjs site
//
// Everything against the live site is read-only. The data suite uses the
// service-role key from .env.local and only reads, apart from disposable
// "zz-" test rows it creates and removes itself. The local suite needs a dev
// server and is opt-in (see suites/local.mjs).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summary } from './framework.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = ['units', 'site', 'security', 'data'];
const toRun = wanted.length ? wanted : all;

for (const name of toRun) {
  const mod = await import(`./suites/${name}.mjs`);
  await mod.default();
}

const totals = summary(path.join(here, 'results', 'last-run.json'));
process.exit(totals.fail > 0 ? 1 : 0);
