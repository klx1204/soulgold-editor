import React from 'react';
import { SaveFile } from '../lib/save';
import { BoxMon, calcStats, decodeName, encodeName, levelForExp } from '../lib/pokemon';
import { SPECIES_BY_ID, TYPE_FILTER, itemName, speciesName } from '../lib/data';
import { createMon } from '../lib/create';
import { Button, Card, Empty, SectionTitle, TextInput, TypeChip } from './ui';
import { MonEditor, SpeciesPicker } from './MonEditor';

export function BoxPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [box, setBox] = React.useState(save.storage[16] || 0);
  const [edit, setEdit] = React.useState<{ b: number; s: number } | null>(null);
  const [adding, setAdding] = React.useState<{ b: number; s: number } | null>(null);
  const [clip, setClip] = React.useState<Uint8Array | null>(null);
  const [renaming, setRenaming] = React.useState(false);
  const [boxName, setBoxName] = React.useState(() => decodeName(save.boxName(box)));
  const [err, setErr] = React.useState('');

  const counts = Array.from({ length: 21 }, (_, b) => Array.from({ length: 30 }, (_, s) => save.boxMon(b, s)).filter((m) => m.some((x) => x)).length);

  const selectBox = (b: number) => {
    setBox(b);
    setBoxName(decodeName(save.boxName(b)));
    setRenaming(false);
    mutate((s) => { s.storage[16] = b; });
  };

  const applyBoxName = () => {
    try {
      mutate((s) => s.setBoxName(box, encodeName(boxName, 9)));
      setRenaming(false);
      setErr('');
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  };

  const clear = (b: number, s: number) => mutate((save) => save.setBoxMon(b, s, new Uint8Array(0)));
  const copy = (b: number, s: number) => setClip(save.boxMon(b, s));
  const paste = (b: number, s: number) => { if (clip) mutate((save) => save.setBoxMon(b, s, clip)); };

  const toParty = (b: number, s: number) => {
    if (save.partyCount >= 6) { setErr('队伍已满（6 只）'); return; }
    const raw = save.boxMon(b, s);
    const mon = new BoxMon(raw).toParty();
    const sp = SPECIES_BY_ID.get(mon.species);
    if (sp) {
      mon.level = levelForExp(sp.growth, mon.exp);
      const st = calcStats(mon, sp, mon.level);
      mon.maxHP = st.maxHP;
      mon.hp = st.maxHP;
    }
    mutate((save) => {
      save.setPartyMon(save.partyCount, mon.data);
      save.partyCount = save.partyCount + 1;
      save.setBoxMon(b, s, new Uint8Array(0));
    });
    setErr('');
  };

  return (
    <div className="stack">
      <SectionTitle title="宝可梦盒子" sub="21 个盒子 × 30 格。点击格子编辑；支持复制/粘贴、移入队伍和新建。" />
      {err && <div className="alert alert-error">{err}</div>}
      <div className="box-tabs">
        {counts.map((n, b) => (
          <button key={b} className={box === b ? 'active' : ''} onClick={() => selectBox(b)}>
            <span>盒子 {b + 1}</span><i>{n}</i>
          </button>
        ))}
      </div>
      <Card className="pad">
        <div className="row between">
          <div className="row gap">
            <h3>盒子 {box + 1}</h3>
            {renaming ? (
              <>
                <TextInput value={boxName} onChange={(e) => setBoxName(e.target.value)} maxLength={4} style={{ width: 160 }} />
                <Button size="sm" onClick={applyBoxName}>保存</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setBoxName(decodeName(save.boxName(box))); }}>取消</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>改名：{decodeName(save.boxName(box)) || '（空）'}</Button>
            )}
          </div>
          <div className="row gap">
            {clip && <Button size="sm" onClick={() => { const idx = firstEmpty(save, box); if (idx >= 0) paste(box, idx); }}>粘贴到空位</Button>}
            <Button size="sm" variant="primary" onClick={() => { const idx = firstEmpty(save, box); if (idx < 0) setErr('这个盒子满了'); else setAdding({ b: box, s: idx }); }}>新建宝可梦</Button>
          </div>
        </div>
        <div className="box-grid">
          {Array.from({ length: 30 }, (_, s) => {
            const raw = save.boxMon(box, s);
            const empty = !raw.some((x) => x);
            if (empty) {
              return <button key={s} className="box-slot empty" onClick={() => setAdding({ b: box, s })}>
                <span className="slot-no">{s + 1}</span><span className="slot-plus">＋</span>
              </button>;
            }
            const mon = new BoxMon(raw);
            const sp = SPECIES_BY_ID.get(mon.species);
            const lvl = sp ? levelForExp(sp.growth, mon.exp) : 0;
            const name = decodeName(mon.nicknameBytes).trim() || speciesName(mon.species);
            const shiny = ((mon.pid ^ mon.otId) >>> 0) < 8 || ((mon.data[31] >> 6) & 1) === 1;
            return <button key={s} className="box-slot filled" onClick={() => setEdit({ b: box, s })}>
              <span className="slot-no">{s + 1}</span>
              <span className="box-title">{name}{shiny && <span className="shiny">★</span>}</span>
              <span className="box-sub">Lv.{lvl} · {itemName(mon.heldItem)}</span>
              {sp && <span className="box-types">{TYPE_FILTER(sp.types).map((t) => <TypeChip key={t} type={t} />)}</span>}
              <span className="box-actions" onClick={(e) => e.stopPropagation()}>
                <i onClick={() => copy(box, s)} title="复制">复制</i>
                <i onClick={() => paste(box, s)} title="粘贴">粘贴</i>
                <i onClick={() => toParty(box, s)} title="移入队伍">入队</i>
                <i onClick={() => clear(box, s)} title="清空">清空</i>
              </span>
            </button>;
          })}
        </div>
      </Card>
      {edit && <MonEditor mon={new BoxMon(save.boxMon(edit.b, edit.s))} isParty={false} onClose={() => setEdit(null)}
        onApply={(mon) => mutate((s) => s.setBoxMon(edit.b, edit.s, mon.data))} />}
      {adding && <SpeciesPicker onClose={() => setAdding(null)} onPick={(sp) => {
        const mon = createMon(save, sp.id, 5, false);
        mutate((s) => s.setBoxMon(adding.b, adding.s, mon.data));
        setAdding(null);
        setEdit({ b: adding.b, s: adding.s });
      }} />}
    </div>
  );
}

function firstEmpty(save: SaveFile, box: number) {
  for (let s = 0; s < 30; s++) if (!save.boxMon(box, s).some((x) => x)) return s;
  return -1;
}