import React from 'react';
import { SaveFile, w32 } from '../lib/save';
import { decodeName, encodeName } from '../lib/pokemon';
import { BADGE_JOHTO, BADGE_KANTO, BADGE_NAMES_JOHTO, BADGE_NAMES_KANTO, FLAGS_BY_ID } from '../lib/data';
import { Button, Card, Field, NumberInput, SectionTitle, TextInput } from './ui';

export function TrainerPanel({ save, mutate }: { save: SaveFile; mutate: (fn: (s: SaveFile) => void) => void }) {
  const [name, setName] = React.useState(() => decodeName(save.trainer.name));
  const [nameEdited, setNameEdited] = React.useState(false);
  const [err, setErr] = React.useState('');
  const t = save.trainer;
  const badges = [...BADGE_JOHTO.map((id, i) => ({ id, name: BADGE_NAMES_JOHTO[i], region: '城都' })),
    ...BADGE_KANTO.map((id, i) => ({ id, name: BADGE_NAMES_KANTO[i], region: '关都' }))];

  const applyName = () => {
    try {
      const bytes = encodeName(name, 8);
      mutate((s) => {
        s.sb2.fill(0xff, 0, 8);
        s.sb2.set(bytes.subarray(0, 8), 0);
      });
      setNameEdited(false);
      setErr('');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const setTime = (h: number, m: number, sec: number) => {
    mutate((s) => {
      s.sb2[0x0e] = h & 0xff;
      s.sb2[0x0f] = (h >> 8) & 0xff;
      s.sb2[0x10] = m & 0xff;
      s.sb2[0x11] = sec & 0xff;
    });
  };

  return (
    <div className="stack">
      <SectionTitle title="训练家信息" sub="名字、ID、游戏时间、金钱、游戏币与徽章（徽章是事件 Flags 的快捷开关）" />
      {err && <div className="alert alert-error">{err}</div>}
      <div className="grid-2">
        <Card className="pad">
          <h3>档案</h3>
          <div className="row gap">
            <Field label="训练家名字" hint="最多 8 字节">
              <TextInput value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true); }} maxLength={4} />
            </Field>
            <Field label="操作"><Button size="sm" variant={nameEdited ? 'primary' : 'default'} onClick={applyName} disabled={!nameEdited}>写入名字</Button></Field>
          </div>
          <div className="muted small">当前原始字节：{Array.from(t.name).map((b) => b.toString(16).padStart(2, '0')).join(' ')}</div>
          <div className="row gap" style={{ marginTop: 16 }}>
            <Field label="性别">
              <select className="input" value={t.gender} onChange={(e) => mutate((s) => { s.sb2[8] = Number(e.target.value); })}>
                <option value={0}>男</option><option value={1}>女</option>
              </select>
            </Field>
            <Field label="公开 ID (TID)">
              <NumberInput value={t.trainerId & 0xffff} min={0} max={0xffff}
                onChange={(v) => mutate((s) => w32(s.sb2, 0x0a, ((t.trainerId >>> 16) << 16 | v) >>> 0))} />
            </Field>
            <Field label="里 ID (SID)">
              <NumberInput value={(t.trainerId >>> 16) & 0xffff} min={0} max={0xffff}
                onChange={(v) => mutate((s) => w32(s.sb2, 0x0a, ((v << 16) | (t.trainerId & 0xffff)) >>> 0))} />
            </Field>
          </div>
          <Field label="游戏时间">
            <div className="row gap">
              <NumberInput value={t.playTimeHours} min={0} max={999} onChange={(v) => setTime(v, t.playTimeMinutes, t.playTimeSeconds)} />
              <span className="muted">时</span>
              <NumberInput value={t.playTimeMinutes} min={0} max={59} onChange={(v) => setTime(t.playTimeHours, v, t.playTimeSeconds)} />
              <span className="muted">分</span>
              <NumberInput value={t.playTimeSeconds} min={0} max={59} onChange={(v) => setTime(t.playTimeHours, t.playTimeMinutes, v)} />
              <span className="muted">秒</span>
            </div>
          </Field>
        </Card>

        <Card className="pad">
          <h3>金钱与游戏币</h3>
          <div className="row gap">
            <Field label="金钱" hint="上限 999,999">
              <NumberInput value={save.money} min={0} max={999999} onChange={(v) => mutate((s) => { s.money = v; })} />
            </Field>
            <Field label="游戏币" hint="上限 9,999">
              <NumberInput value={save.coins} min={0} max={9999} onChange={(v) => mutate((s) => { s.coins = v; })} />
            </Field>
          </div>
          <div className="row gap">
            <Button size="sm" onClick={() => mutate((s) => { s.money = 999999; })}>金钱拉满</Button>
            <Button size="sm" onClick={() => mutate((s) => { s.coins = 9999; })}>游戏币拉满</Button>
            <Button size="sm" onClick={() => mutate((s) => { s.money = 3000; s.coins = 0; })}>重置为初始值</Button>
          </div>
          <div className="muted small" style={{ marginTop: 12 }}>存档中以 XOR 加密保存，导出时会自动用当前密钥重新加密。</div>

          <h3 style={{ marginTop: 24 }}>图鉴</h3>
          <DexSummary save={save} />
        </Card>
      </div>

      <Card className="pad">
        <div className="row between">
          <h3>徽章</h3>
          <div className="row gap">
            <Button size="sm" onClick={() => mutate((s) => badges.forEach((b) => s.setFlag(b.id, true)))}>全部点亮</Button>
            <Button size="sm" variant="ghost" onClick={() => mutate((s) => badges.forEach((b) => s.setFlag(b.id, false)))}>全部清除</Button>
          </div>
        </div>
        <div className="badge-grid">
          {badges.map((b) => {
            const on = save.flag(b.id);
            return (
              <button key={b.id} className={`badge ${on ? 'on' : ''}`} onClick={() => mutate((s) => s.setFlag(b.id, !on))}>
                <span className="badge-dot" />
                <span className="badge-name">{b.name}</span>
                <span className="badge-meta">{b.region} · {FLAGS_BY_ID.get(b.id)?.name ?? b.id}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function DexSummary({ save }: { save: SaveFile }) {
  let seen = 0;
  let caught = 0;
  for (let i = 1; i <= 1025; i++) {
    if (save.dexSeen(i)) seen++;
    if (save.dexCaught(i)) caught++;
  }
  return (
    <div className="row gap">
      <div className="mini-stat"><span>已发现</span><b>{seen}</b></div>
      <div className="mini-stat"><span>已捕获</span><b>{caught}</b></div>
    </div>
  );
}
