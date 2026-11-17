import speciesJson from '../data/species.json';
import itemsJson from '../data/items.json';
import movesJson from '../data/moves.json';
import abilitiesJson from '../data/abilities.json';
import naturesJson from '../data/natures.json';
import flagsJson from '../data/flags.json';
import varsJson from '../data/vars.json';
import charmapJson from '../data/charmap.json';

export interface Species {
  id: number; name: string; zh: string; nat: number; johto: number;
  types: string[]; base: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  growth: number; gender: number; abilities: string[];
  levelUp: { level: number; move: string }[];
  learnable: number[];
}
export interface Item { id: number; const: string; name: string; zh: string; pocket: number; desc: string }
export interface Move { id: number; const: string; name: string; zh: string; pp: number; power: number; acc: number; type: string; desc: string }
export interface Ability { id: number; const: string; name: string; zh: string; desc: string }
export interface Nature { id: number; name: string; zh: string; plus: string; minus: string }
export interface FlagDef { id: number; name: string; desc: string }
export interface VarDef { id: number; name: string; desc: string }

export const CHARMAP = charmapJson as { toCode: Record<string, number>; toChar: Record<string, string>; single: Record<string, number> };
export const CHAR_TO_CODE = CHARMAP.toCode;
export const CODE_TO_CHAR = CHARMAP.toChar;
export const SINGLE_TO_CHAR: Record<number, string> = Object.fromEntries(
  Object.entries(CHARMAP.single).map(([ch, code]) => [code as number, ch]),
);

export const SPECIES = speciesJson as Species[];
export const ITEMS = itemsJson as Item[];
export const MOVES = movesJson as Move[];
export const ABILITIES = abilitiesJson as Ability[];
export const NATURES = naturesJson as Nature[];
export const FLAGS = flagsJson as FlagDef[];
export const VARS = varsJson as VarDef[];

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export const ITEMS_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const MOVES_BY_ID = new Map(MOVES.map((m) => [m.id, m]));
export const MOVES_BY_CONST = new Map(MOVES.map((m) => [m.const, m]));
export const ABILITIES_BY_CONST = new Map(ABILITIES.map((a) => [a.const, a]));
export const NATURES_BY_ID = new Map(NATURES.map((n) => [n.id, n]));
export const FLAGS_BY_ID = new Map(FLAGS.map((f) => [f.id, f]));
export const VARS_BY_ID = new Map(VARS.map((v) => [v.id, v]));

// The data generator already removes TYPE_ prefixes. Strip TYPE_NONE duplicates.
export const TYPE_ZH: Record<string, string> = {
  NONE: '无', NORMAL: '一般', FIGHTING: '格斗', FLYING: '飞行', POISON: '毒', GROUND: '地面',
  ROCK: '岩石', BUG: '虫', GHOST: '幽灵', STEEL: '钢', FIRE: '火', WATER: '水', GRASS: '草',
  ELECTRIC: '电', PSYCHIC: '超能力', ICE: '冰', DRAGON: '龙', DARK: '恶', FAIRY: '妖精',
};

export const TYPE_LIST = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY'];

export const TYPE_COLOR: Record<string, string> = {
  NORMAL: '#9fa39a', FIGHTING: '#c0563b', FLYING: '#8f9fd4', POISON: '#9b5ca5', GROUND: '#c8a96b',
  ROCK: '#b5a35c', BUG: '#94a83c', GHOST: '#6b5f9e', STEEL: '#8e9aa6', FIRE: '#dc6b3b', WATER: '#4b8ed1',
  GRASS: '#5cab4e', ELECTRIC: '#d6b23a', PSYCHIC: '#cf5f8a', ICE: '#66bfc0', DRAGON: '#6d63c9',
  DARK: '#5b514b', FAIRY: '#d47fae',
};

export function speciesName(id: number): string {
  const s = SPECIES_BY_ID.get(id);
  if (!s) return `#${id}`;
  return s.zh || s.name;
}
export function speciesDex(id: number): string {
  const s = SPECIES_BY_ID.get(id);
  if (!s) return `#${id}`;
  if (s.johto) return `城都 #${String(s.johto).padStart(3, '0')}`;
  if (s.nat) return `全国 #${String(s.nat).padStart(4, '0')}`;
  return '未收录';
}
export function speciesDexFull(id: number): string {
  const s = SPECIES_BY_ID.get(id);
  if (!s) return `内部 #${id}`;
  const parts = [];
  if (s.johto) parts.push(`城都 #${s.johto}`);
  if (s.nat) parts.push(`全国 #${s.nat}`);
  parts.push(`内部 #${s.id}`);
  return parts.join(' · ');
}
export function speciesInternal(id: number): string {
  const s = SPECIES_BY_ID.get(id);
  return s ? `内部 #${s.id}` : `内部 #${id}`;
}
export function natureEffect(id: number): string {
  const n = NATURES_BY_ID.get(id);
  if (!n) return '';
  return n.plus ? `+${n.plus} / -${n.minus}` : '无能力修正';
}
export function speciesSub(id: number): string {
  const s = SPECIES_BY_ID.get(id);
  if (!s) return '';
  return s.zh ? s.name : '';
}
export function itemName(id: number): string {
  if (!id) return '（空）';
  const i = ITEMS_BY_ID.get(id);
  return i ? (i.zh || i.name) : `道具 #${id}`;
}
export function itemSub(id: number): string {
  if (!id) return '';
  const i = ITEMS_BY_ID.get(id);
  return i && i.zh ? i.name : '';
}
export function moveName(id: number): string {
  if (!id) return '（空）';
  const m = MOVES_BY_ID.get(id);
  return m ? (m.zh || m.name) : `招式 #${id}`;
}
export function moveSub(id: number): string {
  if (!id) return '';
  const m = MOVES_BY_ID.get(id);
  return m && m.zh ? m.name : '';
}
export function abilityName(constName: string): string {
  const a = ABILITIES_BY_CONST.get(constName) ?? ABILITIES_BY_CONST.get(`ABILITY_${constName}`);
  return a ? (a.zh || a.name) : constName.replace(/^ABILITY_/, '');
}
export function natureName(id: number): string {
  const n = NATURES_BY_ID.get(id);
  return n ? (n.zh || n.name) : `${id}`;
}
export function natureSub(id: number): string {
  const n = NATURES_BY_ID.get(id);
  return n && n.zh ? n.name : '';
}

export const TYPE_FILTER = (types: string[]) => Array.from(new Set(types.filter((t) => t && t !== 'NONE')));

export function growthName(g: number) {
  return ['Medium Fast', 'Erratic', 'Fluctuating', 'Medium Slow', 'Fast', 'Slow'][g] ?? '—';
}

export const BADGE_JOHTO = [2451, 2452, 2453, 2454, 2455, 2456, 2457, 2458];
export const BADGE_KANTO = [2577, 2578, 2579, 2580, 2581, 2582, 2583, 2584];
export const BADGE_NAMES_KANTO = ['灰色徽章', '蓝色徽章', '彩虹徽章', '黄金徽章', '粉红徽章', '朱红徽章', '绿色徽章', '金色徽章'];
export const BADGE_NAMES_JOHTO = ['飞行徽章', '虫系徽章', '普通徽章', '幽灵徽章', '格斗徽章', '钢铁徽章', '冰系徽章', '龙系徽章'];

export function flagLabel(id: number) {
  const f = FLAGS_BY_ID.get(id);
  return f ? f.name : `FLAG_0x${id.toString(16).toUpperCase()}`;
}
export function varLabel(id: number) {
  const v = VARS_BY_ID.get(id);
  return v ? v.name : `VAR_0x${id.toString(16).toUpperCase()}`;
}

// Some flag ids share names/aliases; keep a compact grouped list for the advanced editor.
export const STORY_FLAGS = FLAGS.filter((f) => f.id < 0x500 && f.id >= 0x20);
export const SYSTEM_FLAGS = FLAGS.filter((f) => f.id >= 0x98c && f.id < 0xa80);
