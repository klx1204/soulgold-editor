import React from 'react';
import { SaveFile, POCKETS, PC_ITEM_COUNT } from '../lib/save';
import { itemName, itemSub, type Item } from '../lib/data';
import { Button, Card, Empty, NumberInput, SectionTitle } from './ui';
import { ItemPicker } from './MonEditor';

interface Row { pocket: number; i: number; item: number; qty: number }
interface Picking { pocket: number; index: number; pc: boolean }

export function BagPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [pocket, setPocket] = React.useState(0);
  const [pc, setPc] = React.useState(false);
  const [picking, setPicking] = React.useState<Picking | null>(null);
  const [q, setQ] = React.useState('');

  const allRows: Row[] = [];
  for (let p = 0; p < POCKETS.length; p++) {
    for (let i = 0; i < POCKETS[p].count; i++) {
      const s = save.bagItem(p, i);
      allRows.push({ pocket: p, i, item: s.item, qty: s.qty });
    }
  }
  const pcRows: Row[] = Array.from({ length: PC_ITEM_COUNT }, (_, i) => {
    const s = save.pcItem(i);
    return { pocket: -1, i, item: s.item, qty: s.qty };
  });
  const rows: Row[] = pc ? pcRows : pocket === -1 ? allRows : allRows.filter((r) => r.pocket === pocket);
  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    return r.item === 0 || itemName(r.item).toLowerCase().includes(q.toLowerCase()) || String(r.item) === q.trim();
  });
  const visible = pocket === -1 && !pc ? filtered.filter((r) => r.item) : filtered;

  const maxQty = (p: number) => (p === 2 || p === 4 || p === 5) ? 1 : 9999;
  const setSlot = (row: Row, item: number, qty: number) => {
    const n = Math.max(0, Math.min(maxQty(row.pocket), qty));
    mutate((s) => row.pocket < 0 ? s.setPcItem(row.i, item, n) : s.setBagItem(row.pocket, row.i, item, n));
  };

  const addItem = () => {
    if (pc) {
      const empty = pcRows.findIndex((r) => !r.item);
      if (empty < 0) { alert('PC 道具栏已满'); return; }
      setPicking({ pocket: -1, index: empty, pc: true });
      return;
    }
    if (pocket === -1) {
      setPicking({ pocket: -2, index: -1, pc: false }); // auto-place into the item's own pocket
      return;
    }
    const empty = rows.findIndex((r) => !r.item);
    if (empty < 0) { alert('这个口袋已满'); return; }
    setPicking({ pocket, index: rows[empty].i, pc: false });
  };

  const pickItem = (item: Item) => {
    if (!picking) return;
    if (picking.pc) {
      const cur = save.pcItem(picking.index);
      setSlot({ pocket: -1, i: picking.index, item: cur.item, qty: cur.qty }, item.id, cur.qty || 1);
      return;
    }
    if (picking.pocket === -2) {
      if (item.pocket < 0) { alert('这个道具没有可放入的口袋'); return; }
      const target = allRows.find((r) => r.pocket === item.pocket && !r.item);
      if (!target) { alert(`${POCKETS[item.pocket].label}口袋已满`); return; }
      setSlot(target, item.id, 1);
      return;
    }
    const row = rows.find((r) => r.pocket === picking.pocket && r.i === picking.index)
      ?? { pocket: picking.pocket, i: picking.index, item: 0, qty: 0 };
    setSlot(row, item.id, row.qty || 1);
  };

  const totalUsed = allRows.filter((r) => r.item).length;

  return (
    <div className="stack">
      <SectionTitle title="道具" sub="背包共 8 个口袋；「全部」可总览并自动按道具分类放入对应口袋。PC 道具独立存储。" />
      <div className="pocket-tabs">
        <button className={!pc && pocket === -1 ? 'active' : ''} onClick={() => { setPocket(-1); setPc(false); }}>全部<i>{totalUsed}</i></button>
        {POCKETS.map((p, i) => {
          const used = allRows.filter((r) => r.pocket === i && r.item).length;
          return <button key={p.key} className={!pc && pocket === i ? 'active' : ''} onClick={() => { setPocket(i); setPc(false); }}>
            {p.label}<i>{used}</i>
          </button>;
        })}
        <button className={pc ? 'active' : ''} onClick={() => setPc(true)}>PC 道具<i>{pcRows.filter((r) => r.item).length}</i></button>
      </div>
      <Card className="pad">
        <div className="row between">
          <div className="row gap">
            <h3>{pc ? 'PC 道具' : pocket === -1 ? '全部道具' : POCKETS[pocket].label}</h3>
            <span className="muted small">{rows.filter((s) => s.item).length} / {rows.length}</span>
          </div>
          <div className="row gap">
            <input className="input search" placeholder="筛选道具" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
            <Button size="sm" variant="primary" onClick={addItem}>添加道具</Button>
          </div>
        </div>
        {pocket === -1 && !pc && <div className="muted small" style={{ marginTop: 6 }}>「全部」只显示已有道具；添加时会自动放入道具对应的口袋（例如大师球进精灵球口袋）。</div>}
        <div className="bag-list">
          {visible.length === 0 && <Empty>{pocket === -1 && !pc ? '背包中没有道具' : '这个口袋是空的'}</Empty>}
          {visible.map((row) => (
            <div key={`${row.pocket}-${row.i}`} className={`bag-row ${row.item ? '' : 'empty'}`}>
              <span className="bag-index">{pocket === -1 && !pc ? POCKETS[row.pocket].label : row.i + 1}</span>
              <button className="select-like grow" onClick={() => setPicking({ pocket: row.pocket, index: row.i, pc: pc })}>
                <span>{itemName(row.item)}</span><span>{itemSub(row.item)}</span>
              </button>
              <NumberInput value={row.qty} min={0} max={maxQty(row.pocket)} onChange={(v) => setSlot(row, row.item, v)} />
              {row.item > 0 && <Button size="sm" variant="ghost" onClick={() => setSlot(row, 0, 0)}>清空</Button>}
            </div>
          ))}
        </div>
      </Card>
      {picking && <ItemPicker pocket={picking.pc || picking.pocket === -2 ? undefined : picking.pocket} onClose={() => setPicking(null)} onPick={pickItem} />}
    </div>
  );
}
