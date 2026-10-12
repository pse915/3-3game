import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
// Separate processes keep old DOM mocks isolated; no worker-spawn requirement.
let failed=0;for(const name of fs.readdirSync('tests').filter(x=>x.endsWith('.test.mjs'))){const r=spawnSync(process.execPath,['--test','--test-isolation=none','tests/'+name],{stdio:'inherit'});if(r.status!==0)failed++;}process.exitCode=failed?1:0;
