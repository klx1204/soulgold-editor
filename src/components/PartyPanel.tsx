import React from 'react';
import { SaveFile } from '../lib/save';
import { BoxMon, calcStats, decodeName, isShinyMon } from '../lib/pokemon';
import { NATURES_BY_ID, SPECIES_BY_ID, TYPE_FILTER, itemName, speciesDex, speciesName, speciesSub } from '../lib/data';
import { createMon } from '../lib/create';
import { Button, Card, Empty, SectionTitle, TypeChip } from './ui';
import { MonEditor, SpeciesPicker } from './MonEditor';

export function PartyPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [edit, setEdit] = React.useState<number | null>(null);
  const [adding, setAdding] = React.useState(false);
  const mons = Array.from({ length: 6 }, (_, i) => i < save.partyCount ? new BoxMon(save.partyMon(i)) : null);

  const add = (speciesId: number) => {
    const mon = createMon(save, speciesId, 5, true);
    mutate((s) => {
      const idx = s.partyCount;
      if (idx >= 6) return;
      s.setPartyMon(idx, mon.data);
      s.partyCount = idx + 1;
    });
    setAdding(false);
    setEdit(save.partyCount - 1);
  };

  const remove = (i: number) => {
    mutate((s) => {
      for (let j = i; j < s.partyCount - 1; j++) s.setPartyMon(j, new BoxMon(s.partyMon(j + 1)).data);
      s.setPartyMon(s.partyCount - 1, new Uint8Array(96));
      s.partyCount = Math.max(0, s.partyCount - 1);
    });
  };

  const healAll = () => mutate((s) => {
    for (let i = 0; i < s.partyCount; i++) {
      const mon = new BoxMon(s.partyMon(i));
      const sp = SPECIES_BY_ID.get(mon.species);
      if (!sp) continue;
      const st = calcStats(mon, sp);
      mon.status = 0;
      mon.maxHP = st.maxHP;
      mon.hp = st.maxHP;
      s.setPartyMon(i, mon.data);
    }
  });

  return (
    <div className="stack">
      <SectionTitle title="同行队伍" sub={`${save.partyCount} / 6 · 点击卡片编辑；队伍宝可梦的等级与能力值会写回存档`}
        right={<><Button onClick={healAll} disabled={!save.partyCount}>全部治疗</Button><Button variant="primary" onClick={() => setAdding(true)} disabled={save.partyCount >= 6}>添加宝可梦</Button></>} />

      {save.partyCount === 0 && <Empty>队伍是空的。点击「添加宝可梦」创建一只，或从盒子里移动。</Empty>}
      <div className="party-grid">
        {mons.map((mon, i) => mon ? <PartyCard key={i} save={save} mon={mon} index={i} onEdit={() => setEdit(i)} onRemove={() => remove(i)} /> : (
          <Card key={i} className="party-card empty-slot">
            <span>空位 {i + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>添加</Button>
          </Card>
        ))}
      </div>

      {edit !== null && save.partyCount > edit && (
        <MonEditor mon={new BoxMon(save.partyMon(edit))} isParty shinyOdds={save.flag(0x95e) ? 256 : 512}
          onClose={() => setEdit(null)} onApply={(mon) => mutate((s) => s.setPartyMon(edit, mon.data))} />
      )}
      {adding && <SpeciesPicker onClose={() => setAdding(false)} onPick={(sp) => add(sp.id)} />}
    </div>
  );
}

function PartyCard({ save, mon, index, onEdit, onRemove }: { save: SaveFile; mon: BoxMon; index: number; onEdit: () => void; onRemove: () => void }) {
  const sp = SPECIES_BY_ID.get(mon.species);
  const name = decodeName(mon.nicknameBytes).trim() || speciesName(mon.species);
  const pct = mon.maxHP ? Math.max(0, Math.min(100, (mon.hp / mon.maxHP) * 100)) : 0;
  const shiny = isShinyMon(mon, save.flag(0x95e) ? 256 : 512);
  const infected = mon.pokerusDays > 0;
  const cured = !infected && mon.pokerusStrain > 0;
  return (
    <Card className="party-card">
      <div className="party-top">
        <div className="portrait sm" style={{ background: sp ? gradient(sp.types) : '#999' }}>
          <span>{name.slice(0, 1)}</span>
        </div>
        <div className="grow">
          <div className="row between">
            <div>
              <div className="party-name">{name}{shiny && <span className="shiny">★</span>}</div>
              <div className="muted small">{speciesName(mon.species)}{speciesSub(mon.species) && ` · ${speciesSub(mon.species)}`} · {speciesDex(mon.species)}</div>
            </div>
            <div className="level">Lv.{mon.level}</div>
          </div>
          <div className="row gap wrap" style={{ marginTop: 4 }}>
            {sp && TYPE_FILTER(sp.types).map((t) => <TypeChip key={t} type={t} />)}
            <span className="muted small">{NATURES_BY_ID.get(mon.nature)?.zh}</span>
            {infected && <span className="pill pill-blue">病毒</span>}
            {cured && <span className="pill">已有抗体</span>}
          </div>
        </div>
      </div>
      <div className="hp-row">
        <span>HP</span>
        <div className="hp-bar"><i style={{ width: `${pct}%` }} className={pct < 25 ? 'low' : pct < 55 ? 'mid' : ''} /></div>
        <b>{mon.hp} / {mon.maxHP}</b>
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted small">持有：{itemName(mon.heldItem)}</span>
        <span className="row gap">
          <Button size="sm" variant="ghost" onClick={onEdit}>编辑</Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>移出</Button>
        </span>
      </div>
    </Card>
  );
}

function gradient(types: string[]) {
  const t = TYPE_FILTER(types);
  const c1 = t[0] ? `var(--type-${t[0].toLowerCase()})` : '#b0842c';
  const c2 = t[1] ? `var(--type-${t[1].toLowerCase()})` : c1;
  return `linear-gradient(140deg, ${c1}, ${c2})`;
}
