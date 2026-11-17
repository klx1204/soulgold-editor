import React from 'react';
import { SaveFile } from '../lib/save';
import { BADGE_JOHTO, BADGE_KANTO, BADGE_NAMES_JOHTO, BADGE_NAMES_KANTO, FLAGS, SPECIES, VARS } from '../lib/data';
import { Button, Card, Empty, NumberInput, SectionTitle } from './ui';

type Tab = 'badges' | 'dex' | 'flags' | 'vars';

export function EventsPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [tab, setTab] = React.useState<Tab>('badges');
  return (
    <div className="stack">
      <SectionTitle title="事件" sub="徽章、图鉴、事件 Flags 与 Vars。高级编辑可能影响剧情进度，修改前请备份。" />
      <div className="subtabs">
        {([['badges', '徽章'], ['dex', '图鉴'], ['flags', '事件 Flags'], ['vars', '变量 Vars']] as const).map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'badges' && <Badges save={save} mutate={mutate} />}
      {tab === 'dex' && <Dex save={save} mutate={mutate} />}
      {tab === 'flags' && <Flags save={save} mutate={mutate} />}
      {tab === 'vars' && <Vars save={save} mutate={mutate} />}
    </div>
  );
}

function Badges({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const all = [...BADGE_JOHTO.map((id, i) => ({ id, name: BADGE_NAMES_JOHTO[i], region: '城都' })),
    ...BADGE_KANTO.map((id, i) => ({ id, name: BADGE_NAMES_KANTO[i], region: '关都' }))];
  return (
    <Card className="pad">
      <div className="row between">
        <h3>徽章开关</h3>
        <div className="row gap">
          <Button size="sm" onClick={() => mutate((s) => all.forEach((b) => s.setFlag(b.id, true)))}>全部点亮</Button>
          <Button size="sm" variant="ghost" onClick={() => mutate((s) => all.forEach((b) => s.setFlag(b.id, false)))}>全部清除</Button>
        </div>
      </div>
      <div className="badge-grid">
        {all.map((b) => (
          <button key={b.id} className={`badge ${save.flag(b.id) ? 'on' : ''}`} onClick={() => mutate((s) => s.setFlag(b.id, !save.flag(b.id)))}>
            <span className="badge-dot" /><span className="badge-name">{b.name}</span><span className="badge-meta">{b.region} · {b.id}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Dex({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(120);
  const list = React.useMemo(() => {
    const seen = new Set<number>();
    const out: typeof SPECIES = [];
    for (const s of SPECIES) {
      if (s.id <= 0 || s.nat <= 0 || seen.has(s.nat)) continue;
      seen.add(s.nat);
      out.push(s);
    }
    return out;
  }, []);
  const filtered = list.filter((s: any) => !q.trim() || `${s.zh} ${s.name} ${s.nat}`.toLowerCase().includes(q.toLowerCase()));
  const seenCount = list.filter((s: any) => save.dexSeen(s.nat)).length;
  const caughtCount = list.filter((s: any) => save.dexCaught(s.nat)).length;
  return (
    <Card className="pad">
      <div className="row between">
        <h3>图鉴 <span className="muted small">发现 {seenCount} · 捕获 {caughtCount}</span></h3>
        <div className="row gap">
          <Button size="sm" onClick={() => mutate((s) => filtered.forEach((x: any) => s.setDexCaught(x.nat, true)))}>当前结果全部捕获</Button>
          <Button size="sm" variant="ghost" onClick={() => mutate((s) => filtered.forEach((x: any) => { s.setDexSeen(x.nat, false); s.setDexCaught(x.nat, false); }))}>当前结果清除</Button>
        </div>
      </div>
      <input className="input search" placeholder="搜索宝可梦" value={q} onChange={(e) => { setQ(e.target.value); setLimit(120); }} />
      <div className="dex-list">
        {filtered.slice(0, limit).map((s: any) => (
          <div key={s.nat} className="dex-row">
            <span className="dex-no">#{s.nat}</span>
            <span className="grow">{s.zh || s.name} <span className="muted small">{s.name}</span></span>
            <label className="check-inline"><input type="checkbox" checked={save.dexSeen(s.nat)} onChange={(e) => mutate((sv) => sv.setDexSeen(s.nat, e.target.checked))} />发现</label>
            <label className="check-inline"><input type="checkbox" checked={save.dexCaught(s.nat)} onChange={(e) => mutate((sv) => sv.setDexCaught(s.nat, e.target.checked))} />捕获</label>
          </div>
        ))}
        {filtered.length > limit && <Button variant="ghost" onClick={() => setLimit((v) => v + 200)}>继续显示（{filtered.length - limit}）</Button>}
        {filtered.length === 0 && <Empty>没有匹配结果</Empty>}
      </div>
    </Card>
  );
}

function Flags({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [q, setQ] = React.useState('');
  const [onlySet, setOnlySet] = React.useState(false);
  const [showTemp, setShowTemp] = React.useState(false);
  const [showUnused, setShowUnused] = React.useState(false);
  const [limit, setLimit] = React.useState(150);
  const filtered = FLAGS.filter((f) => {
    if (!showTemp && f.name.includes('TEMP_')) return false;
    if (!showUnused && /unused flag/i.test(f.desc)) return false;
    if (onlySet && !save.flag(f.id)) return false;
    if (!q.trim()) return true;
    return `${f.name} ${f.desc} ${f.id.toString(16)} ${f.id}`.toLowerCase().includes(q.toLowerCase());
  });
  const setCount = FLAGS.filter((f) => save.flag(f.id)).length;
  return (
    <Card className="pad">
      <div className="row between">
        <h3>事件 Flags <span className="muted small">已设置 {setCount} / {FLAGS.length}（有名称的 Flag）</span></h3>
        <div className="row gap">
          <label className="check-inline"><input type="checkbox" checked={onlySet} onChange={(e) => setOnlySet(e.target.checked)} />只看已设置</label>
          <label className="check-inline"><input type="checkbox" checked={showTemp} onChange={(e) => setShowTemp(e.target.checked)} />临时 Flag</label>
          <label className="check-inline"><input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} />未使用</label>
        </div>
      </div>
      <input className="input search" placeholder="搜索 Flag 名称、ID 或说明" value={q} onChange={(e) => { setQ(e.target.value); setLimit(150); }} />
      <div className="flag-list">
        {filtered.slice(0, limit).map((f) => {
          const on = save.flag(f.id);
          return (
            <div key={`${f.id}-${f.name}`} className={`flag-row ${on ? 'on' : ''}`}>
              <button className={`switch ${on ? 'on' : ''}`} onClick={() => mutate((s) => s.setFlag(f.id, !on))} aria-label={f.name}><i /></button>
              <div className="grow">
                <div className="flag-name">{f.name}</div>
                <div className="muted small">0x{f.id.toString(16).toUpperCase()} {f.desc}</div>
              </div>
              <code>{f.id}</code>
            </div>
          );
        })}
        {filtered.length > limit && <Button variant="ghost" onClick={() => setLimit((v) => v + 200)}>继续显示（{filtered.length - limit}）</Button>}
        {filtered.length === 0 && <Empty>没有匹配的 Flag</Empty>}
      </div>
      <div className="alert alert-warn">Flags 直接控制剧情、隐藏对象和系统功能。除非明确知道用途，否则不要随意切换。</div>
    </Card>
  );
}

function Vars({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [q, setQ] = React.useState('');
  const [showTemp, setShowTemp] = React.useState(false);
  const [custom, setCustom] = React.useState(0x4000);
  const filtered = VARS.filter((v) => {
    if (!showTemp && v.name.includes('TEMP_')) return false;
    return !q.trim() || `${v.name} ${v.desc} ${v.id.toString(16)} ${v.id}`.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <Card className="pad">
      <div className="row between">
        <h3>变量 Vars <span className="muted small">共 {VARS.length} 个有名称的变量</span></h3>
        <label className="check-inline"><input type="checkbox" checked={showTemp} onChange={(e) => setShowTemp(e.target.checked)} />显示临时变量</label>
      </div>
      <input className="input search" placeholder="搜索变量名称、ID 或说明" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="var-list">
        {filtered.map((v) => (
          <div key={`${v.id}-${v.name}`} className="var-row">
            <div className="grow"><div className="flag-name">{v.name}</div><div className="muted small">0x{v.id.toString(16).toUpperCase()} {v.desc}</div></div>
            <NumberInput value={save.getVar(v.id)} min={0} max={65535} onChange={(n) => mutate((s) => s.setVar(v.id, n))} />
          </div>
        ))}
      </div>
      <div className="row gap" style={{ marginTop: 16 }}>
        <span className="muted small">手动变量 ID</span>
        <NumberInput value={custom} min={0x4000} max={0x42ff} onChange={setCustom} />
        <span className="muted">当前值 {save.getVar(custom)}</span>
        <NumberInput value={save.getVar(custom)} min={0} max={65535} onChange={(n) => mutate((s) => s.setVar(custom, n))} />
      </div>
      <div className="alert alert-warn">变量用于剧情状态、计数器与临时脚本参数。写错可能导致事件卡死。</div>
    </Card>
  );
}
