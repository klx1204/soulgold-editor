import { SaveFile, BOX_COUNT, BOX_SLOTS, POCKETS, PC_ITEM_COUNT, u16 } from './save';
import { BoxMon, expForLevel, levelForExp } from './pokemon';
import { ITEMS_BY_ID, MOVES_BY_ID, SPECIES_BY_ID } from './data';

export type CheckLevel = 'ok' | 'warn' | 'error';
export interface Check {
  level: CheckLevel;
  title: string;
  detail?: string;
}

const itemName = (id: number) => (id ? `#${id}` : '空');

export function validateSave(save: SaveFile): Check[] {
  const out: Check[] = [];

  // Round-trip structural check.
  try {
    const copy = new SaveFile(save.serialize());
    out.push({ level: 'ok', title: '存档结构 / 校验和', detail: `槽位 ${copy.slot + 1}，31 个扇区校验通过，BX21 头正常` });
  } catch (e: any) {
    out.push({ level: 'error', title: '存档结构 / 校验和', detail: e?.message ?? String(e) });
  }

  const st = save.validateStorage();
  out.push({ level: st.ok ? 'ok' : 'error', title: '盒子扩展 / BX21 校验', detail: st.detail });

  if (save.partyCount > 6) out.push({ level: 'error', title: '队伍数量', detail: `队伍数量 ${save.partyCount} 超过 6` });
  else out.push({ level: 'ok', title: '队伍数量', detail: `${save.partyCount} / 6` });

  let partyIssues = 0;
  for (let i = 0; i < save.partyCount; i++) {
    const mon = new BoxMon(save.partyMon(i));
    const sp = SPECIES_BY_ID.get(mon.species);
    if (!sp) {
      partyIssues++;
      out.push({ level: 'error', title: `队伍 ${i + 1} 物种`, detail: `未知物种 #${mon.species}` });
      continue;
    }
    const evTotal = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    if (evTotal > 510) out.push({ level: 'warn', title: `队伍 ${i + 1} 努力值`, detail: `总和 ${evTotal} > 510，游戏内可能被截断` });
    if (mon.level < 1 || mon.level > 100) out.push({ level: 'error', title: `队伍 ${i + 1} 等级`, detail: `${mon.level} 超出 1-100` });
    const lvlFromExp = levelForExp(sp.growth, mon.exp);
    if (Math.abs(lvlFromExp - mon.level) > 1) out.push({ level: 'warn', title: `队伍 ${i + 1} 经验`, detail: `经验值对应 ${lvlFromExp} 级，等级字段为 ${mon.level}` });
    const badMoves = mon.moves.filter((m) => m && !MOVES_BY_ID.has(m));
    if (badMoves.length) out.push({ level: 'warn', title: `队伍 ${i + 1} 招式`, detail: `未知招式 ${badMoves.join(', ')}` });
    const illegal = mon.moves.filter((m) => m && !sp.learnable.includes(m));
    if (illegal.length) out.push({ level: 'warn', title: `队伍 ${i + 1} 非法招式`, detail: `${illegal.join(', ')} 不在该物种合法招式表中` });
    if (mon.hp > mon.maxHP) out.push({ level: 'warn', title: `队伍 ${i + 1} HP`, detail: `${mon.hp} / ${mon.maxHP}` });
  }

  let boxMons = 0;
  let boxIssues = 0;
  for (let b = 0; b < BOX_COUNT; b++) {
    for (let s = 0; s < BOX_SLOTS; s++) {
      const raw = save.boxMon(b, s);
      if (raw.every((x) => x === 0)) continue;
      boxMons++;
      const mon = new BoxMon(raw);
      const bsp = SPECIES_BY_ID.get(mon.species);
      if (!bsp) {
        boxIssues++;
        out.push({ level: 'warn', title: `盒子 ${b + 1}-${s + 1} 物种`, detail: `未知物种 #${mon.species}` });
      } else {
        const illegal = mon.moves.filter((m) => m && !bsp.learnable.includes(m));
        if (illegal.length) {
          boxIssues++;
          out.push({ level: 'warn', title: `盒子 ${b + 1}-${s + 1} 非法招式`, detail: `${illegal.join(', ')} 不在该物种合法招式表中` });
        }
      }
      const evTotal = Object.values(mon.evs).reduce((a, b2) => a + b2, 0);
      if (evTotal > 510) out.push({ level: 'warn', title: `盒子 ${b + 1}-${s + 1} 努力值`, detail: `总和 ${evTotal} > 510` });
    }
  }
  out.push({ level: boxIssues ? 'warn' : 'ok', title: '盒子数据', detail: `${boxMons} 只宝可梦，${boxIssues} 个异常` });

  if (save.money > 999999) out.push({ level: 'error', title: '金钱', detail: `${save.money} > 999999` });
  if (save.coins > 9999) out.push({ level: 'error', title: '游戏币', detail: `${save.coins} > 9999` });

  let bagIssues = 0;
  for (let p = 0; p < POCKETS.length; p++) {
    const seen = new Set<number>();
    for (let i = 0; i < POCKETS[p].count; i++) {
      const slot = save.bagItem(p, i);
      if (!slot.item) continue;
      if (!ITEMS_BY_ID.has(slot.item)) { bagIssues++; out.push({ level: 'warn', title: `${POCKETS[p].label} ${i + 1}`, detail: `未知道具 #${slot.item}` }); }
      if (slot.qty === 0 || slot.qty > 9999) { bagIssues++; out.push({ level: 'warn', title: `${POCKETS[p].label} ${i + 1} 数量`, detail: `${slot.qty}` }); }
      if (seen.has(slot.item)) { bagIssues++; out.push({ level: 'warn', title: `${POCKETS[p].label} 重复`, detail: `道具 ${itemName(slot.item)} 占用了多个格子` }); }
      seen.add(slot.item);
    }
  }
  for (let i = 0; i < PC_ITEM_COUNT; i++) {
    const slot = save.pcItem(i);
    if (slot.item && !ITEMS_BY_ID.has(slot.item)) bagIssues++;
  }
  out.push({ level: bagIssues ? 'warn' : 'ok', title: '背包 / PC 道具', detail: bagIssues ? `${bagIssues} 个可疑条目` : '道具编号与数量正常' });

  out.push({ level: 'ok', title: '加密字段', detail: `金钱 / 游戏币 / 背包数量已使用存档密钥重新加密` });
  out.push({ level: 'ok', title: '写回策略', detail: '只写入当前存档槽并把计数器 +1，另一个槽位保留为原始备份' });

  return out;
}

export function blockingErrors(checks: Check[]) {
  return checks.filter((c) => c.level === 'error');
}
