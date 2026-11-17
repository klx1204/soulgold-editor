import React from 'react';
import { SaveFile, POCKETS, PC_ITEM_COUNT } from '../lib/save';
import { ITEMS, itemName, itemSub } from '../lib/data';
import { Button, Card, Empty, NumberInput, SectionTitle } from './ui';
import { ItemPicker } from './MonEditor';

export function BagPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [pocket, setPocket] = React.useState(0);
  const [pc, setPc] = React.useState(false);
  const [picking, setPicking] = React.useState<{ pc: boolean; index: number } | null>(null);
  const [q, setQ] = React.useState('');

  const slots = pc
    ? Array.from({ length: PC_ITEM_COUNT }, (_, i) => ({ item: save.pcItem(i).item, qty: save.pcItem(i).qty }))
    : Array.from({ length: POCKETS[pocket].count }, (_, i) => save.bagItem(pocket, i));

  const filtered = slots.map((slot, i) => ({ ...slot, i })).filter((s) => {
    if (!q.trim()) return true;
    return s.item === 0 || itemName(s.item).toLowerCase().includes(q.toLowerCase()) || String(s.item) === q.trim();
  });

  const setSlot = (i: number, item: number, qty: number) => {
    mutate((s) => pc ? s.setPcItem(i, item, qty) : s.setBagItem(pocket, i, item, qty));
  };

  const addItem = () => {
    const empty = slots.findIndex((s) => !s.item);
    if (empty < 0) { alert('这个口袋已满'); return; }
    setPicking({ pc, index: empty });
  };

  return (
    <div className="stack">
      <SectionTitle title="道具" sub="背包共 8 个口袋；PC 道具独立存储。道具数量会用存档密钥加密。" />
      <div className="pocket-tabs">
        {POCKETS.map((p, i) => {
          const used = Array.from({ length: p.count }, (_, j) => save.bagItem(i, j)).filter((s) => s.item).length;
          return <button key={p.key} className={!pc && pocket === i ? 'active' : ''} onClick={() => { setPocket(i); setPc(false); }}>
            {p.label}<i>{used}</i>
          </button>;
        })}
        <button className={pc ? 'active' : ''} onClick={() => setPc(true)}>PC 道具<i>{Array.from({ length: PC_ITEM_COUNT }, (_, j) => save.pcItem(j)).filter((s) => s.item).length}</i></button>
      </div>
      <Card className="pad">
        <div className="row between">
          <div className="row gap">
            <h3>{pc ? 'PC 道具' : POCKETS[pocket].label}</h3>
            <span className="muted small">{slots.filter((s) => s.item).length} / {slots.length}</span>
          </div>
          <div className="row gap">
            <input className="input search" placeholder="筛选道具" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
            <Button size="sm" variant="primary" onClick={addItem}>添加道具</Button>
          </div>
        </div>
        <div className="bag-list">
          {filtered.length === 0 && <Empty>这个口袋是空的</Empty>}
          {filtered.map((slot) => (
            <div key={slot.i} className={`bag-row ${slot.item ? '' : 'empty'}`}>
              <span className="bag-index">{slot.i + 1}</span>
              <button className="select-like grow" onClick={() => setPicking({ pc, index: slot.i })}>
                <span>{itemName(slot.item)}</span><span>{itemSub(slot.item)}</span>
              </button>
              <NumberInput value={slot.qty} min={0} max={9999} onChange={(v) => setSlot(slot.i, slot.item, v)} />
              {slot.item > 0 && <Button size="sm" variant="ghost" onClick={() => setSlot(slot.i, 0, 0)}>清空</Button>}
            </div>
          ))}
        </div>
      </Card>
      {picking && <ItemPicker onClose={() => setPicking(null)} onPick={(item) => {
        const cur = picking.pc ? save.pcItem(picking.index) : save.bagItem(pocket, picking.index);
        setSlot(picking.index, item.id, cur.qty || 1);
      }} />}
    </div>
  );
}
