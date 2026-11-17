import React from 'react';
import { BoxMon, calcStats, decodeName, encodeName, expForLevel, levelForExp, NATURES, applyStats, isShinyMon, setMonShiny } from '../lib/pokemon';
import { ABILITIES_BY_CONST, ITEMS, MOVES, MOVES_BY_CONST, MOVES_BY_ID, NATURES_BY_ID, SPECIES, SPECIES_BY_ID, TYPE_FILTER, TYPE_LIST, TYPE_ZH, abilityName, itemName, itemSub, moveName, moveSub, natureEffect, speciesDex, speciesDexFull, speciesName, speciesSub } from '../lib/data';
import { Button, Card, Field, Modal, NumberInput, Picker, TextInput, TypeChip } from './ui';

interface Props {
  mon: BoxMon;
  isParty: boolean;
  shinyOdds?: number;
  onClose: () => void;
  onApply: (mon: BoxMon) => void;
}

const statLabels: { key: keyof BoxMon['ivs']; label: string }[] = [
  { key: 'hp', label: 'HP' }, { key: 'atk', label: '攻击' }, { key: 'def', label: '防御' },
  { key: 'spa', label: '特攻' }, { key: 'spd', label: '特防' }, { key: 'spe', label: '速度' },
];

export function MonEditor({ mon: original, isParty, shinyOdds = 512, onClose, onApply }: Props) {
  const [mon, setMon] = React.useState(() => new BoxMon(original.data.slice()));
  const [sub, setSub] = React.useState<'base' | 'stats' | 'moves' | 'origin'>('base');
  const [nick, setNick] = React.useState(() => decodeName(mon.nicknameBytes));
  const [nickEdited, setNickEdited] = React.useState(false);
  const [picker, setPicker] = React.useState<null | 'species' | 'item' | 'move' | number>(null);
  const [error, setError] = React.useState('');

  const sp = SPECIES_BY_ID.get(mon.species);
  const displayLevel = isParty ? mon.level : (sp ? levelForExp(sp.growth, mon.exp) : 1);
  const stats = sp ? calcStats(mon, sp, displayLevel) : null;

  const update = (fn: (m: BoxMon) => void) => {
    const next = new BoxMon(mon.data.slice());
    fn(next);
    setMon(next);
    setError('');
  };

  const setSpecies = (id: number) => {
    update((m) => {
      m.species = id;
      m.abilityNum = 0;
      const s = SPECIES_BY_ID.get(id);
      if (s) {
        if (!isParty) m.exp = expForLevel(s.growth, displayLevel);
        // Keep moves but refresh PP to the new base values.
        m.pp = m.moves.map((mv) => MOVES.find((x) => x.id === mv)?.pp ?? 0);
      }
    });
  };

  const setLevel = (lvl: number) => {
    if (!sp) return;
    const safe = Math.max(1, Math.min(100, lvl));
    update((m) => {
      m.exp = expForLevel(sp.growth, safe);
      if (isParty) m.level = safe;
    });
  };

  const learnMoves = () => {
    if (!sp) return;
    update((m) => {
      const learn = [...sp.levelUp].filter((x) => x.level <= displayLevel).sort((a, b) => a.level - b.level);
      const ids = learn.slice(-4).map((x) => MOVES.find((mv) => mv.const === x.move)?.id ?? 0);
      while (ids.length < 4) ids.unshift(0);
      m.moves = ids;
      m.pp = ids.map((id) => MOVES.find((mv) => mv.id === id)?.pp ?? 0);
    });
  };

  const setMove = (slot: number, id: number) => {
    update((m) => {
      const moves = [...m.moves];
      const pp = [...m.pp];
      moves[slot] = id;
      pp[slot] = MOVES.find((x) => x.id === id)?.pp ?? 0;
      m.moves = moves;
      m.pp = pp;
    });
  };

  const apply = () => {
    try {
      if (nickEdited && nick !== decodeName(original.nicknameBytes)) {
        const bytes = encodeName(nick, 12);
        mon.nicknameBytes = bytes;
      } else {
        mon.nicknameBytes = original.nicknameBytes;
      }
      const result = new BoxMon(mon.data.slice());
      if (isParty) {
        if (!sp) throw new Error('请选择宝可梦物种');
        result.level = Math.max(1, Math.min(100, displayLevel));
        applyStats(result, sp);
        if (result.hp <= 0) result.hp = 1;
      }
      onApply(result);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  if (!sp) {
    return (
      <Modal title="宝可梦数据异常" onClose={onClose}>
        <p>未知物种 #{mon.species}，请先切换到一个有效物种。</p>
        <Button variant="primary" onClick={() => setPicker('species')}>选择物种</Button>
        {picker === 'species' && <SpeciesPicker onClose={() => setPicker(null)} onPick={(s) => setSpecies(s.id)} />}
      </Modal>
    );
  }

  return (
    <Modal
      wide
      title={`${speciesName(mon.species)}${speciesSub(mon.species) ? ` · ${speciesSub(mon.species)}` : ''}`}
      subtitle={`${isParty ? '队伍' : '盒子'} · ${speciesDex(mon.species)} · ${displayLevel} 级 · ${NATURES_BY_ID.get(mon.nature)?.zh ?? ''}`}
      onClose={onClose}
      footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={apply}>应用修改</Button></>}
    >
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row gap wrap">
        <div className="portrait" style={{ background: typeGradient(sp.types) }}>
          <span>{speciesName(mon.species).slice(0, 1)}</span>
        </div>
        <div className="grow">
          <div className="row gap wrap">
            {TYPE_FILTER(sp.types).map((t) => <TypeChip key={t} type={t} />)}
            {mon.isEgg && <span className="pill pill-gold">蛋</span>}
            {isShiny(mon) && <span className="pill pill-gold">★ 闪光</span>}
            {mon.pokerus > 0 && <span className="pill pill-blue">病毒</span>}
          </div>
          <div className="row gap" style={{ marginTop: 8 }}>
            <Button size="sm" onClick={() => setPicker('species')}>更换物种</Button>
            <Button size="sm" onClick={() => setPicker('item')}>持有物：{itemName(mon.heldItem)}</Button>
          </div>
        </div>
      </div>

      <div className="subtabs">
        {([['base', '基础'], ['stats', '能力'], ['moves', '招式'], ['origin', '来源 / 高级']] as const).map(([k, label]) => (
          <button key={k} className={sub === k ? 'active' : ''} onClick={() => setSub(k)}>{label}</button>
        ))}
      </div>

      {sub === 'base' && (
        <div className="grid-2">
          <Card className="pad">
            <Field label="昵称" hint={`${nick.length} 字`}>
              <TextInput value={nick} onChange={(e) => { setNick(e.target.value); setNickEdited(true); }} maxLength={6} />
            </Field>
            <div className="muted small">原字节：{Array.from(mon.nicknameBytes).map((b) => b.toString(16).padStart(2, '0')).join(' ')}</div>
            <div className="row gap wrap" style={{ marginTop: 10 }}>
              <button className={`toggle-btn ${isShinyMon(mon, shinyOdds) ? 'on' : ''}`} onClick={() => update((m) => setMonShiny(m, !isShinyMon(m, shinyOdds), shinyOdds))}>
                {isShinyMon(mon, shinyOdds) ? '★ 闪光' : '☆ 普通'}
              </button>
              <span className="muted small">闪光由 PID / OTID 与 shinyModifier 位共同决定，切换只改 modifier，不改 PID。</span>
            </div>
            <div className="row gap wrap" style={{ marginTop: 10 }}>
              <Field label="Pokérus">
                <select className="input" value={mon.pokerusDays > 0 ? 1 : mon.pokerusStrain > 0 ? 2 : 0}
                  onChange={(e) => update((m) => { const v = Number(e.target.value); m.pokerus = v === 0 ? 0 : v === 1 ? 0x11 : 0x10; })}>
                  <option value={0}>无 / 未感染</option>
                  <option value={1}>感染中（获得双倍努力值）</option>
                  <option value={2}>已治愈（有抗体）</option>
                </select>
              </Field>
              {mon.pokerusStrain > 0 && <>
                <Field label="毒株"><NumberInput value={mon.pokerusStrain} min={1} max={15} onChange={(v) => update((m) => { m.pokerusStrain = v; })} /></Field>
                <Field label="剩余天数"><NumberInput value={mon.pokerusDays} min={0} max={15} onChange={(v) => update((m) => { m.pokerusDays = v; })} /></Field>
              </>}
            </div>
            <div className="row gap" style={{ marginTop: 12 }}>
              <Field label="等级">
                <NumberInput value={displayLevel} min={1} max={100} onChange={setLevel} />
              </Field>
              <Field label="经验值">
                <NumberInput value={mon.exp} min={0} max={0xffffff} onChange={(v) => update((m) => { m.exp = v; })} />
              </Field>
            </div>
            <Field label="持有物">
              <button className="select-like" onClick={() => setPicker('item')}>{itemName(mon.heldItem)}<span>{itemSub(mon.heldItem)}</span></button>
            </Field>
            <div className="row gap">
              <Field label="性格" hint="通过隐藏性格修正，不改 PID">
                <select className="input" value={mon.nature} onChange={(e) => update((m) => { m.nature = Number(e.target.value); })}>
                  {NATURES.map((n, i) => <option key={n} value={i}>{NATURES_BY_ID.get(i)?.zh ?? n} / {n}（{natureEffect(i)}）</option>)}
                </select>
                <div className="muted small">{natureEffect(mon.nature)}</div>
              </Field>
              <Field label="特性槽位">
                <select className="input" value={mon.abilityNum} onChange={(e) => update((m) => { m.abilityNum = Number(e.target.value); })}>
                  {sp.abilities.map((a, i) => <option key={i} value={i}>{abilityName(a)}</option>)}
                </select>
              </Field>
            </div>
            <div className="row gap">
              <Field label="亲密度"><NumberInput value={mon.friendship} min={0} max={255} onChange={(v) => update((m) => { m.friendship = v; })} /></Field>
              {isParty && <Field label="当前 HP"><NumberInput value={mon.hp} min={0} max={9999} onChange={(v) => update((m) => { m.hp = v; })} /></Field>}
            </div>
          </Card>
          <Card className="pad">
            <h3>能力预览</h3>
            {stats && <StatTable stats={stats} />}
            <div className="muted small">实际数值由物种种族值、等级、个体值、努力值和性格计算。队伍宝可梦应用时会写回能力值；盒子宝可梦在取出时由游戏计算。</div>
            <div className="row gap" style={{ marginTop: 12 }}>
              <Button size="sm" onClick={() => update((m) => { m.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }; })}>全 31 个体</Button>
              <Button size="sm" onClick={() => update((m) => { m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; })}>清空努力值</Button>
            </div>
          </Card>
        </div>
      )}

      {sub === 'stats' && (
        <div className="grid-2">
          <Card className="pad">
            <h3>个体值 IV <span className="muted small">0 – 31</span></h3>
            <div className="stat-grid">
              {statLabels.map((s) => (
                <div key={s.key} className="stat-row">
                  <span>{s.label}</span>
                  <input type="range" min={0} max={31} value={mon.ivs[s.key]}
                    onChange={(e) => update((m) => { m.ivs = { ...m.ivs, [s.key]: Number(e.target.value) }; })} />
                  <NumberInput value={mon.ivs[s.key]} min={0} max={31} onChange={(v) => update((m) => { m.ivs = { ...m.ivs, [s.key]: v }; })} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="pad">
            <h3>努力值 EV <span className="muted small">总和 {Object.values(mon.evs).reduce((a, b) => a + b, 0)} / 510</span></h3>
            <div className="stat-grid">
              {statLabels.map((s) => (
                <div key={s.key} className="stat-row">
                  <span>{s.label}</span>
                  <input type="range" min={0} max={255} value={mon.evs[s.key]}
                    onChange={(e) => update((m) => { m.evs = { ...m.evs, [s.key]: Number(e.target.value) }; })} />
                  <NumberInput value={mon.evs[s.key]} min={0} max={255} onChange={(v) => update((m) => { m.evs = { ...m.evs, [s.key]: v }; })} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {sub === 'moves' && (
        <Card className="pad">
          <div className="row between">
            <h3>招式</h3>
            <Button size="sm" onClick={learnMoves}>按等级补全招式</Button>
          </div>
          <div className="move-list">
            {mon.moves.map((id, i) => {
              const m = MOVES.find((x) => x.id === id);
              return (
                <div key={i} className="move-row">
                  <span className="move-slot">{i + 1}</span>
                  <button className="select-like grow" onClick={() => setPicker(i)}>
                    <span>{moveName(id)}</span><span>{m ? `${TYPE_ZH[m.type] ?? m.type} · 威力 ${m.power || '—'} · PP ${m.pp}` : ''}</span>
                  </button>
                  <NumberInput value={mon.pp[i] ?? 0} min={0} max={99} onChange={(v) => update((m2) => { const pp = [...m2.pp]; pp[i] = v; m2.pp = pp; })} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {sub === 'origin' && (
        <div className="grid-2">
          <Card className="pad">
            <h3>身份数据</h3>
            <div className="kv"><span>图鉴编号</span><span>{speciesDexFull(mon.species)}</span></div>
            <div className="kv"><span>PID</span><code>{hex(mon.pid, 8)}</code><Button size="sm" variant="ghost" onClick={() => update((m) => { m.pid = (Math.random() * 0xffffffff) >>> 0; })}>随机</Button></div>
            <div className="kv"><span>OT ID</span><code>{hex(mon.otId, 8)}</code></div>
            <div className="kv"><span>OT 名</span><span>{decodeName(mon.otNameBytes)}</span></div>
            <div className="kv"><span>性别值</span><span>{mon.otGender ? '女' : '男'}</span></div>
            <div className="kv"><span>蛋</span><span>{mon.isEgg || mon.secureIsEgg ? '是' : '否'}</span></div>
            <div className="kv"><span>球种</span><span>#{mon.pokeball}</span></div>
            <div className="kv"><span>太晶属性</span>
              <select className="input" value={mon.teraType} onChange={(e) => update((m) => { m.teraType = Number(e.target.value); })}>
                {TYPE_LIST.map((t, i) => <option key={t} value={i}>{TYPE_ZH[t]}</option>)}
              </select>
            </div>
          </Card>
          <Card className="pad">
            <h3>相遇数据</h3>
            <Field label="相遇等级"><NumberInput value={mon.metLevel} min={0} max={100} onChange={(v) => update((m) => { m.metLevel = v; })} /></Field>
            <Field label="相遇地点 ID"><NumberInput value={mon.metLocation} min={0} max={0x3fff} onChange={(v) => update((m) => { m.metLocation = v; })} /></Field>
            <Field label="游戏版本"><NumberInt value={mon.metGame} max={15} onChange={(v) => update((m) => { m.metGame = v; })} /></Field>
            <Field label="语言"><NumberInt value={mon.language} max={7} onChange={(v) => update((m) => { m.language = v; })} /></Field>
            <div className="muted small">修改 PID 会改变闪光、性别和未知图腾形态；性格可以直接在上方切换，不需要改 PID。</div>
          </Card>
        </div>
      )}

      {picker === 'species' && <SpeciesPicker onClose={() => setPicker(null)} onPick={(s) => setSpecies(s.id)} />}
      {picker === 'item' && <ItemPicker onClose={() => setPicker(null)} onPick={(i) => update((m) => { m.heldItem = i.id; })} />}
      {typeof picker === 'number' && <MovePicker speciesId={mon.species} onClose={() => setPicker(null)} onPick={(m) => setMove(picker, m.id)} />}
    </Modal>
  );
}

function NumberInt({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return <NumberInput value={value} min={0} max={max} onChange={onChange} />;
}
function hex(n: number, w: number) { return '0x' + n.toString(16).toUpperCase().padStart(w, '0'); }
function isShiny(mon: BoxMon) {
  return ((mon.data[31] >> 6) & 1) === 1 || ((mon.pid ^ mon.otId) >>> 0) < 8;
}
function typeGradient(types: string[]) {
  const t = TYPE_FILTER(types);
  const c1 = t[0] ? `var(--type-${t[0].toLowerCase()})` : '#b0842c';
  const c2 = t[1] ? `var(--type-${t[1].toLowerCase()})` : c1;
  return `linear-gradient(140deg, ${c1}, ${c2})`;
}
function StatTable({ stats }: { stats: { maxHP: number; attack: number; defense: number; speed: number; spAttack: number; spDefense: number } }) {
  return (
    <div className="stat-table">
      {[['HP', stats.maxHP], ['攻击', stats.attack], ['防御', stats.defense], ['特攻', stats.spAttack], ['特防', stats.spDefense], ['速度', stats.speed]].map(([k, v]) => (
        <div key={k as string}><span>{k}</span><b>{v}</b></div>
      ))}
    </div>
  );
}

export function SpeciesPicker({ onClose, onPick }: { onClose: () => void; onPick: (s: (typeof SPECIES)[number]) => void }) {
  return <Picker title="选择宝可梦" items={SPECIES.filter((s) => s.id > 0)} placeholder="中文名 / 英文名 / 编号"
    search={(s, q) => `${s.zh} ${s.name} ${s.id} ${s.nat}`.toLowerCase().includes(q)}
    render={(s) => <><span className="pick-name">{s.zh || s.name}</span><span className="pick-sub">{s.name} · {speciesDexFull(s.id)} · {TYPE_FILTER(s.types).map((t) => TYPE_ZH[t]).join(' / ')}</span></>}
    onPick={onPick} onClose={onClose} />;
}
export function ItemPicker({ pocket, onClose, onPick }: { pocket?: number; onClose: () => void; onPick: (i: (typeof ITEMS)[number]) => void }) {
  return <Picker title="选择道具" items={ITEMS.filter((i) => i.id > 0 && (pocket === undefined || i.pocket === pocket))} placeholder="中文名 / 英文名 / 编号"
    search={(i, q) => `${i.zh} ${i.name} ${i.id} ${i.const}`.toLowerCase().includes(q)}
    render={(i) => <><span className="pick-name">{i.zh || i.name}</span><span className="pick-sub">{i.name} · #{i.id} · {i.desc.slice(0, 60)}</span></>}
    onPick={onPick} onClose={onClose} />;
}
export function MovePicker({ speciesId, onClose, onPick }: { speciesId: number; onClose: () => void; onPick: (m: (typeof MOVES)[number]) => void }) {
  const sp = SPECIES_BY_ID.get(speciesId);
  const levels = new Map<number, number>();
  if (sp) {
    for (const e of sp.levelUp) {
      const m = MOVES_BY_CONST.get(e.move);
      if (m) levels.set(m.id, Math.min(levels.get(m.id) ?? 999, e.level));
    }
  }
  const legal = (sp?.learnable ?? []).map((id) => MOVES_BY_ID.get(id)).filter((m): m is (typeof MOVES)[number] => !!m);
  return <Picker title={`${sp ? speciesName(sp.id) : ''} 可学招式`} items={legal} placeholder="搜索合法招式"
    search={(m, q) => `${m.zh} ${m.name} ${m.id} ${m.const}`.toLowerCase().includes(q)}
    render={(m) => <><span className="pick-name">{m.zh || m.name}{levels.has(m.id) ? <em className="pick-tag">Lv.{levels.get(m.id)}</em> : <em className="pick-tag">招式机/教学</em>}</span><span className="pick-sub">{m.name} · {TYPE_ZH[m.type] ?? m.type} · 威力 {m.power || '—'} · PP {m.pp}</span></>}
    onPick={onPick} onClose={onClose} />;
}
