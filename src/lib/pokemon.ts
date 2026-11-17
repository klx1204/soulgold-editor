import { u16, u32, w16, w32, BOX_MON_SIZE, POKEMON_SIZE } from './save';
import { CHAR_TO_CODE, CODE_TO_CHAR, SINGLE_TO_CHAR } from './data';

export const SECURE_OFF = 32;

export interface MonStats {
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number;
}
export interface SpeciesData {
  id: number; name: string; zh?: string;
  types: string[];
  base: MonStats;
  growth: number;
  genderRatio?: number; // 0..254, 255 = genderless
  abilities?: string[];
}

const n = (v: number) => (v > 0x7fffffff ? v - 0x100000000 : v);

export class BoxMon {
  data: Uint8Array;
  party: boolean;
  constructor(data: Uint8Array) {
    if (data.length !== BOX_MON_SIZE && data.length !== POKEMON_SIZE) {
      throw new Error(`bad mon size ${data.length}`);
    }
    this.data = data;
    this.party = data.length === POKEMON_SIZE;
  }
  static empty() { return new BoxMon(new Uint8Array(BOX_MON_SIZE)); }
  get isEmpty() { return this.data.every((b) => b === 0); }
  get pid() { return u32(this.data, 0); }
  set pid(v) { w32(this.data, 0, v); }
  get otId() { return u32(this.data, 4); }
  set otId(v) { w32(this.data, 4, v); }
  get nicknameBytes() { return this.data.slice(8, 20); }
  set nicknameBytes(v: Uint8Array) {
    this.data.fill(0xff, 8, 20);
    this.data.set(v.subarray(0, 12), 8);
  }
  get language() { return this.data[20] & 7; }
  set language(v) { this.data[20] = (this.data[20] & 0xf8) | (v & 7); }
  get hiddenNature() { return this.data[20] >> 3; }
  set hiddenNature(v) { this.data[20] = (this.data[20] & 7) | ((v & 0x1f) << 3); }
  get flagsByte() { return this.data[21]; }
  set flagsByte(v) { this.data[21] = v; }
  get isEgg() { return (this.data[21] & 4) !== 0; }
  get hasSpecies() { return (this.data[21] & 2) !== 0; }
  get otNameBytes() { return this.data.slice(22, 29); }
  set otNameBytes(v: Uint8Array) {
    this.data.fill(0xff, 22, 29);
    this.data.set(v.subarray(0, 7), 22);
  }

  private get sec() { return this.data.subarray(SECURE_OFF, SECURE_OFF + 36); }
  private sw(i: number) { return u32(this.sec, i * 4); }
  private sww(i: number, v: number) { w32(this.data, SECURE_OFF + i * 4, v); }

  get species() { return this.sw(0) & 0x7ff; }
  set species(v) { this.sww(0, (this.sw(0) & ~0x7ff) | (v & 0x7ff)); }
  get teraType() { return (this.sw(0) >>> 11) & 0x1f; }
  set teraType(v) { this.sww(0, (this.sw(0) & ~(0x1f << 11)) | ((v & 0x1f) << 11)); }
  get heldItem() { return (this.sw(0) >>> 16) & 0x3ff; }
  set heldItem(v) { this.sww(0, (this.sw(0) & ~(0x3ff << 16)) | ((v & 0x3ff) << 16)); }
  get pokeball() { return (this.sw(0) >>> 26) & 0x3f; }
  set pokeball(v) { this.sww(0, (this.sw(0) & ~(0x3f << 26)) | ((v & 0x3f) << 26)); }

  get exp() { return this.sw(1) & 0xffffff; }
  set exp(v) { this.sww(1, (this.sw(1) & 0xff000000) | (v & 0xffffff)); }
  get ppBonuses() { return this.sw(1) >>> 24; }
  set ppBonuses(v) { this.sww(1, (this.sw(1) & 0xffffff) | ((v & 0xff) << 24)); }

  get nature() { return (natureFromPid(this.pid) ^ this.hiddenNature) % 25; }
  set nature(v) { this.hiddenNature = (natureFromPid(this.pid) ^ (v & 0x1f)) & 0x1f; }
  get friendship() { return this.sw(2) & 0xff; }
  set friendship(v) { this.sww(2, (this.sw(2) & ~0xff) | (v & 0xff)); }
  get pokerus() { return (this.sw(2) >>> 8) & 0xff; }
  set pokerus(v) { this.sww(2, (this.sw(2) & ~(0xff << 8)) | ((v & 0xff) << 8)); }
  get metLocation() {
    const w = this.sw(2);
    const low = (w >>> 16) & 0xff;
    const w4 = this.sw(4);
    const hi = (w4 >>> 22) & 1 | (((w4 >>> 23) & 0x1f) << 1) | (((w4 >>> 28) & 1) << 6);
    return low | (hi << 8);
  }
  set metLocation(v) {
    this.sww(2, (this.sw(2) & ~(0xff << 16)) | ((v & 0xff) << 16));
    const hi = (v >>> 8) & 0x7f;
    let w4 = this.sw(4);
    w4 = (w4 & ~(1 << 22)) | ((hi & 1) << 22);
    w4 = (w4 & ~(0x1f << 23)) | (((hi >>> 1) & 0x1f) << 23);
    w4 = (w4 & ~(1 << 28)) | (((hi >>> 6) & 1) << 28);
    this.sww(4, w4);
  }
  get metLevel() { return (this.sw(2) >>> 24) & 0x7f; }
  set metLevel(v) { this.sww(2, (this.sw(2) & ~(0x7f << 24)) | ((v & 0x7f) << 24)); }
  get otGender() { return (this.sw(2) >>> 31) & 1; }
  set otGender(v) { this.sww(2, (this.sw(2) & 0x7fffffff) | ((v & 1) << 31)); }

  get move1() { return this.sw(3) & 0x7ff; }
  set move1(v) { this.sww(3, (this.sw(3) & ~0x7ff) | (v & 0x7ff)); }
  get move2() { return (this.sw(3) >>> 16) & 0x7ff; }
  set move2(v) { this.sww(3, (this.sw(3) & ~(0x7ff << 16)) | ((v & 0x7ff) << 16)); }
  get move3() { return this.sw(4) & 0x7ff; }
  set move3(v) { this.sww(4, (this.sw(4) & ~0x7ff) | (v & 0x7ff)); }
  get move4() { return (this.sw(4) >>> 11) & 0x7ff; }
  set move4(v) { this.sww(4, (this.sw(4) & ~(0x7ff << 11)) | ((v & 0x7ff) << 11)); }
  get moves() { return [this.move1, this.move2, this.move3, this.move4]; }
  set moves(v: number[]) {
    this.move1 = v[0] ?? 0; this.move2 = v[1] ?? 0; this.move3 = v[2] ?? 0; this.move4 = v[3] ?? 0;
  }

  get abilityNum() { return (this.sw(4) >>> 29) & 3; }
  set abilityNum(v) { this.sww(4, (this.sw(4) & ~(3 << 29)) | ((v & 3) << 29)); }
  get secureIsEgg() { return (this.sw(4) >>> 30) & 1; }
  set secureIsEgg(v) { this.sww(4, (this.sw(4) & 0x3fffffff) | ((v & 1) << 30)); }

  get pp() { return [0, 1, 2, 3].map((i) => (this.sw(5) >>> (7 * i)) & 0x7f); }
  set pp(v: number[]) {
    let w = this.sw(5) & 0xf0000000;
    for (let i = 0; i < 4; i++) w |= (v[i] ?? 0) << (7 * i);
    this.sww(5, w);
  }
  get metGame() { return (this.sw(5) >>> 28) & 0xf; }
  set metGame(v) { this.sww(5, (this.sw(5) & 0x0fffffff) | ((v & 0xf) << 28)); }

  get evs(): MonStats {
    const a = this.sw(6), b = this.sw(7);
    return {
      hp: a & 0xff, atk: (a >>> 8) & 0xff, def: (a >>> 16) & 0xff, spe: (a >>> 24) & 0xff,
      spa: b & 0xff, spd: (b >>> 8) & 0xff,
    };
  }
  set evs(v: MonStats) {
    this.sww(6, (v.hp & 0xff) | ((v.atk & 0xff) << 8) | ((v.def & 0xff) << 16) | ((v.spe & 0xff) << 24));
    this.sww(7, (this.sw(7) & 0xffff0000) | (v.spa & 0xff) | ((v.spd & 0xff) << 8));
  }
  get hyperTrained() {
    const w = this.sw(7) >>> 16;
    return [0, 1, 2, 3, 4, 5].map((i) => (w >>> i) & 1);
  }
  get ivs(): MonStats {
    const w = this.sw(8);
    return {
      hp: w & 0x1f, atk: (w >>> 5) & 0x1f, def: (w >>> 10) & 0x1f,
      spe: (w >>> 15) & 0x1f, spa: (w >>> 20) & 0x1f, spd: (w >>> 25) & 0x1f,
    };
  }
  set ivs(v: MonStats) {
    const w = (v.hp & 0x1f) | ((v.atk & 0x1f) << 5) | ((v.def & 0x1f) << 10) |
      ((v.spe & 0x1f) << 15) | ((v.spa & 0x1f) << 20) | ((v.spd & 0x1f) << 25);
    this.sww(8, w);
  }

  // Party-only live stats
  get status() { return this.party ? u32(this.data, 76) : 0; }
  set status(v) { if (this.party) w32(this.data, 76, v); }
  get level() { return this.party ? this.data[80] : 0; }
  set level(v) { if (this.party) this.data[80] = v & 0xff; }
  get mail() { return this.party ? this.data[81] : 0; }
  set mail(v) { if (this.party) this.data[81] = v & 0xff; }
  get hp() { return this.party ? u16(this.data, 82) : 0; }
  set hp(v) { if (this.party) w16(this.data, 82, v); }
  get maxHP() { return this.party ? u16(this.data, 84) : 0; }
  set maxHP(v) { if (this.party) w16(this.data, 84, v); }
  get attack() { return this.party ? u16(this.data, 86) : 0; }
  get defense() { return this.party ? u16(this.data, 88) : 0; }
  get speed() { return this.party ? u16(this.data, 90) : 0; }
  get spAttack() { return this.party ? u16(this.data, 92) : 0; }
  get spDefense() { return this.party ? u16(this.data, 94) : 0; }

  toBox(): BoxMon {
    if (!this.party) return this;
    return new BoxMon(this.data.slice(0, BOX_MON_SIZE));
  }
  toParty(): BoxMon {
    if (this.party) return this;
    const out = new Uint8Array(POKEMON_SIZE);
    out.set(this.data, 0);
    return new BoxMon(out);
  }
}

export const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
] as const;

export function natureFromPid(pid: number) { return pid % 25; }

export const GROWTH_RATES: Record<number, { name: string; max: number; fn: (n: number) => number }> = {
  0: { name: 'Medium Fast', max: 100, fn: (n) => n ** 3 },
  1: { name: 'Erratic', max: 100, fn: (n) => n < 50 ? Math.floor((n ** 3 * (100 - n)) / 50) : n < 68 ? Math.floor((n ** 3 * (150 - n)) / 100) : n < 98 ? Math.floor((n ** 3 * ((1911 - 10 * n) / 3)) / 500) : Math.floor((n ** 3 * (160 - n)) / 100) },
  2: { name: 'Fluctuating', max: 100, fn: (n) => n < 15 ? Math.floor((n ** 3 * ((n + 1) / 3 + 24)) / 50) : n < 36 ? Math.floor((n ** 3 * (n + 14)) / 50) : Math.floor((n ** 3 * ((n / 2) + 32)) / 50) },
  3: { name: 'Medium Slow', max: 100, fn: (n) => Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140)) },
  4: { name: 'Fast', max: 100, fn: (n) => Math.floor((4 * n ** 3) / 5) },
  5: { name: 'Slow', max: 100, fn: (n) => Math.floor((5 * n ** 3) / 4) },
};

const NATURE_MOD = [
  [1, 1, 1, 1, 1], [1.1, 0.9, 1, 1, 1], [1.1, 1, 0.9, 1, 1], [1.1, 1, 1, 0.9, 1], [1.1, 1, 1, 1, 0.9],
  [0.9, 1.1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1.1, 0.9, 1, 1], [1, 1.1, 1, 0.9, 1], [1, 1.1, 1, 1, 0.9],
  [0.9, 1, 1.1, 1, 1], [1, 0.9, 1.1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1.1, 0.9, 1], [1, 1, 1.1, 1, 0.9],
  [0.9, 1, 1, 1.1, 1], [1, 0.9, 1, 1.1, 1], [1, 1, 0.9, 1.1, 1], [1, 1, 1, 1, 1], [1, 1, 1.1, 1, 0.9],
  [0.9, 1, 1, 1, 1.1], [1, 0.9, 1, 1, 1.1], [1, 1, 0.9, 1, 1.1], [1, 1, 1, 0.9, 1.1], [1, 1, 1, 1, 1],
];

export function calcStats(mon: BoxMon, sp: SpeciesData, levelOverride?: number) {
  const ivs = mon.ivs, evs = mon.evs;
  const lvl = levelOverride ?? (mon.level || 1);
  const nature = mon.nature;
  const m = NATURE_MOD[nature];
  const hp = Math.floor(((2 * sp.base.hp + ivs.hp + Math.floor(evs.hp / 4)) * lvl) / 100) + lvl + 10;
  const stat = (base: number, iv: number, ev: number, mul: number) =>
    Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * lvl) / 100) + 5) * mul);
  return {
    maxHP: hp,
    attack: stat(sp.base.atk, ivs.atk, evs.atk, m[0]),
    defense: stat(sp.base.def, ivs.def, evs.def, m[1]),
    speed: stat(sp.base.spe, ivs.spe, evs.spe, m[2]),
    spAttack: stat(sp.base.spa, ivs.spa, evs.spa, m[3]),
    spDefense: stat(sp.base.spd, ivs.spd, evs.spd, m[4]),
  };
}

export function expForLevel(growth: number, level: number) {
  return GROWTH_RATES[growth]?.fn(Math.max(1, Math.min(100, level))) ?? 0;
}

export function levelForExp(growth: number, exp: number) {
  let lvl = 1;
  for (let i = 2; i <= 100; i++) {
    if (exp >= expForLevel(growth, i)) lvl = i; else break;
  }
  return lvl;
}

export function applyStats(mon: BoxMon, sp: SpeciesData) {
  if (!mon.party) return;
  const st = calcStats(mon, sp);
  const ratio = mon.maxHP > 0 ? mon.hp / mon.maxHP : 1;
  w16(mon.data, 84, st.maxHP);
  mon.hp = Math.max(1, Math.min(st.maxHP, Math.round(st.maxHP * ratio)));
  w16(mon.data, 86, st.attack);
  w16(mon.data, 88, st.defense);
  w16(mon.data, 90, st.speed);
  w16(mon.data, 92, st.spAttack);
  w16(mon.data, 94, st.spDefense);
}

/** SoulGold Chinese text: 1-byte ASCII/symbols + 2-byte glyphs (lead 0x01-0x14), 0xFF terminator. */
export function decodeName(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    if (b === 0xff) break;
    if (b === 0x00) { out += ' '; i += 1; continue; }
    if (b >= 0x01 && b <= 0x14 && i + 1 < bytes.length) {
      const code = (b << 8) | bytes[i + 1];
      out += CODE_TO_CHAR[String(code)] ?? `⟨${code.toString(16).toUpperCase().padStart(4, '0')}⟩`;
      i += 2;
      continue;
    }
    if (b >= 0xfc) { i += b === 0xfc ? 3 : 2; continue; } // font/string control codes
    out += SINGLE_TO_CHAR[b] ?? `⟨${b.toString(16).toUpperCase().padStart(2, '0')}⟩`;
    i += 1;
  }
  return out;
}

export function encodeName(text: string, maxBytes = 12): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const code = CHAR_TO_CODE[ch];
    if (code === undefined) throw new Error(`字库中没有字符「${ch}」`);
    const len = code > 0xff ? 2 : 1;
    if (out.length + len + 1 > maxBytes) break; // always leave room for 0xFF
    if (len === 2) out.push((code >>> 8) & 0xff, code & 0xff);
    else out.push(code);
  }
  out.push(0xff);
  return new Uint8Array(out);
}

export function emptyBoxMon() { return new BoxMon(new Uint8Array(BOX_MON_SIZE)); }
