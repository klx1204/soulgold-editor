import { SaveFile, POKEMON_SIZE, BOX_MON_SIZE } from './save';
import { BoxMon, applyStats, encodeName, expForLevel } from './pokemon';
import { MOVES, SPECIES_BY_ID } from './data';

export function createMon(save: SaveFile, speciesId: number, level: number, party: boolean): BoxMon {
  const sp = SPECIES_BY_ID.get(speciesId);
  if (!sp) throw new Error(`未知物种 #${speciesId}`);
  const mon = new BoxMon(new Uint8Array(party ? POKEMON_SIZE : BOX_MON_SIZE));
  const pid = (Math.random() * 0x100000000) >>> 0;
  mon.pid = pid;
  mon.otId = save.trainer.trainerId;
  mon.species = speciesId;
  mon.exp = expForLevel(sp.growth, level);
  mon.level = party ? level : 0;
  mon.friendship = 70;
  mon.pokeball = 4;
  mon.language = 2;
  mon.metLevel = Math.max(1, Math.min(100, level));
  mon.metLocation = 0;
  mon.metGame = 3;
  mon.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  mon.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  mon.abilityNum = 0;
  mon.otGender = save.sb2[8] & 1;
  mon.otNameBytes = save.sb2.slice(0, 7);
  mon.data[21] = (mon.data[21] & ~0b110) | 0b010; // hasSpecies, not egg
  mon.secureIsEgg = 0;
  try {
    mon.nicknameBytes = encodeName(sp.zh || sp.name, 12);
  } catch {
    try { mon.nicknameBytes = encodeName(sp.name, 12); }
    catch { mon.nicknameBytes = new Uint8Array([0xff]); }
  }
  const learn = [...sp.levelUp].filter((x) => x.level <= level).sort((a, b) => a.level - b.level);
  const ids = learn.slice(-4).map((x) => MOVES.find((m) => m.const === x.move)?.id ?? 0);
  while (ids.length < 4) ids.unshift(0);
  mon.moves = ids;
  mon.pp = ids.map((id) => MOVES.find((m) => m.id === id)?.pp ?? 0);
  if (party) {
    applyStats(mon, sp);
    mon.hp = mon.maxHP;
  }
  return mon;
}
