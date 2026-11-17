/**
 * Smoke test: bun run scripts/smoke.ts /path/to/save.sav
 * Parses a save, edits a few fields, serializes, reparses and verifies.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SaveFile } from '../src/lib/save';
import { BoxMon, decodeName, encodeName, expForLevel } from '../src/lib/pokemon';
import { SPECIES_BY_ID } from '../src/lib/data';
import { createMon } from '../src/lib/create';

const path = process.argv[2];
if (!path) {
  console.error('usage: bun run scripts/smoke.ts <save.sav>');
  process.exit(1);
}
const raw = new Uint8Array(readFileSync(path));
const save = new SaveFile(raw);
console.log('slot', save.slot, 'trainer', decodeName(save.trainer.name), 'money', save.money, 'coins', save.coins);
console.log('party', save.partyCount, 'checks', save.validateStorage());

save.money = 123456;
save.coins = 777;
save.setFlag(2451, true);

const mon = new BoxMon(save.partyMon(0));
const sp = SPECIES_BY_ID.get(mon.species);
if (sp) {
  mon.level = 50;
  mon.exp = expForLevel(sp.growth, 50);
  mon.nature = 3;
  mon.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  save.setPartyMon(0, mon.data);
}

const newBox = createMon(save, 1, 25, false);
save.setBoxMon(0, 0, newBox.data);
save.setBagItem(0, 0, 1, 50);
save.setPcItem(0, 1, 99);

const out = save.serialize();
writeFileSync('/tmp/soulgold-smoke.sav', out);
const check = new SaveFile(out);
if (check.money !== 123456 || check.coins !== 777 || !check.flag(2451)) throw new Error('trainer roundtrip failed');
if (new BoxMon(check.partyMon(0)).level !== 50) throw new Error('party roundtrip failed');
if (new BoxMon(check.boxMon(0, 0)).species !== 1) throw new Error('box roundtrip failed');
if (!check.validateStorage().ok) throw new Error('storage checksum failed');
console.log('ok -> /tmp/soulgold-smoke.sav');
