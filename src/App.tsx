import React from 'react';
import { SaveFile } from './lib/save';
import { decodeName } from './lib/pokemon';
import { validateSave, blockingErrors, Check } from './lib/validation';
import { Overview } from './components/Overview';
import { TrainerPanel } from './components/TrainerPanel';
import { PartyPanel } from './components/PartyPanel';
import { BoxPanel } from './components/BoxPanel';
import { BagPanel } from './components/BagPanel';
import { EventsPanel } from './components/EventsPanel';
import { Button, Card, Modal, SectionTitle } from './components/ui';

type Tab = 'overview' | 'trainer' | 'party' | 'boxes' | 'bag' | 'events' | 'export';
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'overview', label: '概览', hint: '存档摘要与校验' },
  { key: 'trainer', label: '训练家', hint: '名字 / 金钱 / 徽章' },
  { key: 'party', label: '队伍', hint: '同行 6 只' },
  { key: 'boxes', label: '盒子', hint: '21 × 30' },
  { key: 'bag', label: '道具', hint: '背包 / PC' },
  { key: 'events', label: '事件', hint: '徽章 / 图鉴 / Flags' },
  { key: 'export', label: '导出', hint: '校验并下载' },
];

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'soulgold-theme';
const THEME_META: Record<ThemeMode, { label: string; icon: string }> = {
  system: { label: '跟随系统', icon: '◐' },
  light: { label: '浅色', icon: '☀' },
  dark: { label: '深色', icon: '☾' },
};

function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'system';
}

function useTheme() {
  const [mode, setMode] = React.useState<ThemeMode>(readThemeMode);
  const [systemDark, setSystemDark] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  React.useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
  }, [mode, resolved]);
  const cycle = () => setMode((m) => m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system');
  return { mode, resolved, cycle };
}

export default function App() {
  const [save, setSave] = React.useState<SaveFile | null>(null);
  const [original, setOriginal] = React.useState<Uint8Array | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [tab, setTab] = React.useState<Tab>('overview');
  const [tick, setTick] = React.useState(0);
  const [error, setError] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const theme = useTheme();

  const checks: Check[] = React.useMemo(() => (save ? validateSave(save) : []), [save, tick]);

  const mutate = (fn: (s: SaveFile) => void) => {
    if (!save) return;
    fn(save);
    setDirty(true);
    setTick((t) => t + 1);
  };

  const load = async (file: File) => {
    try {
      setError('');
      if (file.size === 0) throw new Error('这个文件是空的，请重新导出存档');
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.length !== 0x20000) {
        throw new Error(`文件大小是 ${buf.length} 字节，不是 128 KiB（131072 字节）。请确认选中的是模拟器导出的 .sav，而不是压缩包。`);
      }
      const parsed = new SaveFile(buf);
      setSave(parsed);
      setOriginal(buf);
      setFileName(file.name);
      setDirty(false);
      setTab('overview');
      validateSave(parsed);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) load(f);
  };

  const download = (bytes: Uint8Array, name: string) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const exportSave = () => {
    if (!save) return;
    const errors = blockingErrors(checks);
    if (errors.length) { setExportOpen(true); return; }
    const bytes = save.serialize();
    const base = fileName.replace(/\.(sav|sa1|dsv|bin)$/i, '');
    download(bytes, `${base}_edited.sav`);
    setDirty(false);
  };

  const downloadOriginal = () => {
    if (!original) return;
    download(original, fileName.replace(/\.(sav|sa1|dsv|bin)$/i, '') + '_backup.sav');
  };

  return (
    <div className="app" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
      <header className="topbar">
        <div className="brand">
          <div className="logo"><span /><i /><b /></div>
          <div>
            <h1>魂金存档修改器</h1>
            <p>SOULGOLD SAVE EDITOR · v1.2.1</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="theme-btn" onClick={theme.cycle}
            title={`当前主题：${THEME_META[theme.mode].label}；点击切换（跟随系统 → 浅色 → 深色）`}
            aria-label={`主题：${THEME_META[theme.mode].label}，点击切换`}>
            <span className="theme-icon">{THEME_META[theme.mode].icon}</span>
            <span className="theme-label">{THEME_META[theme.mode].label}</span>
          </button>
          <input id="save-file" ref={inputRef} className="file-input" type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.currentTarget.value = ''; }} />
          <label className="btn top-import" htmlFor="save-file">导入存档</label>
          <Button variant="primary" disabled={!save} onClick={exportSave}>导出修改版</Button>
        </div>
      </header>

      {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="关闭">✕</button></div>}
      {drag && <div className="drop-overlay"><div><b>松开以导入存档</b><span>支持 128 KiB 的 .sav / .sa1 / .dsv</span></div></div>}

      {!save ? (
        <main className="landing">
          <div className="landing-card">
            <div className="landing-mark"><span /><i /><b /></div>
            <h2>把存档拖进来</h2>
            <p>在浏览器本地解析《宝可梦 魂金》v1.2.1 汉化版存档。文件不会上传，也不依赖服务器。</p>
            <label className="btn btn-primary" htmlFor="save-file">选择存档文件</label>
            <p className="muted small">当前支持：128 KiB 标准 GBA 存档 · BX21 盒子格式 · 双存档槽</p>
            <details className="ipad-tip">
              <summary>iPad 上选不到 .sav？</summary>
              <p>文件选择器现在允许任意文件。如果 .sav 显示为灰色，点右上角「浏览」→「我的 iPad / iCloud 云盘 / 下载」，再选择存档；也可以用「文件」App 长按 .sav →「共享」→ 存到「我的 iPad」后再导入。如果文件仍然被置灰，可以把文件临时改名为 .bin（内容不变），再选择。</p>
            </details>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="landing-notes">
              <div><b>结构校验</b><span>扇区校验和 / BX21 头 / 辅助扇区</span></div>
              <div><b>游戏数据</b><span>队伍 / 盒子 / 道具 / 事件 Flags</span></div>
              <div><b>安全写回</b><span>保留另一个存档槽作为备份</span></div>
            </div>
          </div>
        </main>
      ) : (
        <div className="shell">
          <aside className="sidebar">
            <div className="file-card">
              <span className="muted small">当前存档</span>
              <b title={fileName}>{fileName || '未命名.sav'}</b>
              <span>槽 {save.slot + 1} · 计数器 {save.sectors[save.slot * 14].counter}</span>
              <span>{decodeName(save.trainer.name) || '未命名'} · ID {String(save.trainer.trainerId & 0xffff).padStart(5, '0')}</span>
              {dirty && <em>有未导出的修改</em>}
            </div>
            <nav>
              {TABS.map((t) => (
                <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                  <span>{t.label}</span><i>{t.hint}</i>
                </button>
              ))}
            </nav>
            <div className="sidebar-foot">
              <label className="link" htmlFor="save-file">更换存档</label>
              <button className="link" onClick={downloadOriginal}>下载原始备份</button>
            </div>
          </aside>
          <main className="content">
            {tab === 'overview' && <Overview save={save} checks={checks} onGo={(t) => setTab(t as Tab)} />}
            {tab === 'trainer' && <TrainerPanel save={save} mutate={mutate} />}
            {tab === 'party' && <PartyPanel save={save} mutate={mutate} />}
            {tab === 'boxes' && <BoxPanel save={save} mutate={mutate} />}
            {tab === 'bag' && <BagPanel save={save} mutate={mutate} />}
            {tab === 'events' && <EventsPanel save={save} mutate={mutate} />}
            {tab === 'export' && <ExportPanel save={save} checks={checks} dirty={dirty} onExport={exportSave} onBackup={downloadOriginal} />}
          </main>
        </div>
      )}

      {exportOpen && (
        <Modal title="导出被阻止" onClose={() => setExportOpen(false)}
          footer={<><Button onClick={() => setExportOpen(false)}>返回修改</Button><Button variant="danger" onClick={() => { const bytes = save!.serialize(); download(bytes, fileName.replace(/\.(sav|sa1|dsv|bin)$/i, '') + '_edited.sav'); setExportOpen(false); }}>仍然导出</Button></>}>
          <p>校验发现以下错误。建议先修正，否则游戏可能拒绝读取或出现数据异常。</p>
          <div className="check-list">
            {checks.filter((c) => c.level === 'error').map((c, i) => <div key={i} className="check check-error"><span className="check-dot" /><div><b>{c.title}</b>{c.detail && <div className="muted small">{c.detail}</div>}</div></div>)}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExportPanel({ save, checks, dirty, onExport, onBackup }: { save: SaveFile; checks: Check[]; dirty: boolean; onExport: () => void; onBackup: () => void }) {
  const errors = checks.filter((c) => c.level === 'error');
  const warns = checks.filter((c) => c.level === 'warn');
  return (
    <div className="stack">
      <SectionTitle title="导出存档" sub="重新计算所有校验和并下载新的 .sav 文件。原文件不会被覆盖。" />
      <div className="grid-2">
        <Card className="pad">
          <h3>将要写入</h3>
          <div className="kv"><span>存档槽</span><b>{save.slot + 1}</b></div>
          <div className="kv"><span>扇区计数器</span><b>{Math.max(save.sectors[0].counter, save.sectors[14].counter) + 1}</b></div>
          <div className="kv"><span>训练家</span><b>{decodeName(save.trainer.name) || '未命名'}</b></div>
          <div className="kv"><span>队伍</span><b>{save.partyCount} / 6</b></div>
          <div className="kv"><span>金钱</span><b>{save.money.toLocaleString()}</b></div>
          <div className="row gap" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={onExport}>下载修改版 .sav</Button>
            <Button onClick={onBackup}>下载原始备份</Button>
          </div>
          {dirty && <div className="alert alert-warn" style={{ marginTop: 12 }}>还有未导出的修改。</div>}
          {errors.length > 0 && <div className="alert alert-error" style={{ marginTop: 12 }}>存在 {errors.length} 个错误，导出会先弹出确认。</div>}
          {!errors.length && warns.length > 0 && <div className="alert alert-warn" style={{ marginTop: 12 }}>存在 {warns.length} 个提示，不阻止导出。</div>}
        </Card>
        <Card className="pad">
          <h3>写回说明</h3>
          <ul className="note-list">
            <li>修改的是当前有效的存档槽；另一个槽位保持原样，作为回滚备份。</li>
            <li>新计数器 = 两个槽的最大值 + 1，确保游戏优先读取修改后的槽。</li>
            <li>重算 14 个主扇区、盒子溢出扇区、BX21 辅助扇区的校验和。</li>
            <li>BX21 存储头的 payloadChecksum 与辅助扇区 checksum 会同步更新。</li>
            <li>金钱、游戏币、背包数量会用存档内 encryptionKey 重新 XOR。</li>
            <li>导出后建议先在模拟器里另存一份，再替换原文件。</li>
          </ul>
        </Card>
      </div>
      <Card className="pad">
        <h3>校验结果</h3>
        <div className="check-list">
          {checks.map((c, i) => <div key={i} className={`check check-${c.level}`}><span className="check-dot" /><div><b>{c.title}</b>{c.detail && <div className="muted small">{c.detail}</div>}</div></div>)}
        </div>
      </Card>
    </div>
  );
}
