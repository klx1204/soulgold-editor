import React from 'react';
import { SaveFile, u32 } from '../lib/save';
import { Check } from '../lib/validation';
import { BADGE_JOHTO, BADGE_KANTO, BADGE_NAMES_JOHTO, BADGE_NAMES_KANTO, itemName, speciesName } from '../lib/data';
import { BoxMon, decodeName } from '../lib/pokemon';
import { Card, SectionTitle } from './ui';

export function Overview({ save, checks, onGo }: { save: SaveFile; checks: Check[]; onGo: (tab: string) => void }) {
  const badges = [...BADGE_JOHTO, ...BADGE_KANTO].filter((id) => save.flag(id)).length;
  const party = Array.from({ length: save.partyCount }, (_, i) => new BoxMon(save.partyMon(i)));
  const time = `${save.trainer.playTimeHours}:${String(save.trainer.playTimeMinutes).padStart(2, '0')}:${String(save.trainer.playTimeSeconds).padStart(2, '0')}`;
  const errors = checks.filter((c) => c.level === 'error').length;
  const warns = checks.filter((c) => c.level === 'warn').length;

  return (
    <div className="stack">
      <SectionTitle title="存档概览" sub={`当前编辑：存档槽 ${save.slot + 1} · 扇区计数器 ${save.sectors[save.slot * 14].counter}`} />
      <div className="summary-grid">
        <Card className="summary-card gold">
          <div className="summary-label">训练家</div>
          <div className="summary-value">{decodeName(save.trainer.name) || '（未命名）'}</div>
          <div className="summary-meta">ID {String(save.trainer.trainerId & 0xffff).padStart(5, '0')} · {save.trainer.gender ? '女' : '男'} · {time}</div>
        </Card>
        <Card className="summary-card">
          <div className="summary-label">金钱 / 游戏币</div>
          <div className="summary-value">{save.money.toLocaleString()}</div>
          <div className="summary-meta">游戏币 {save.coins.toLocaleString()} · 加密密钥 {u32(save.sb2, 0xb4).toString(16).toUpperCase()}</div>
        </Card>
        <Card className="summary-card">
          <div className="summary-label">徽章</div>
          <div className="summary-value">{badges} / 16</div>
          <div className="summary-meta">城都 {BADGE_JOHTO.filter((id) => save.flag(id)).length} · 关都 {BADGE_KANTO.filter((id) => save.flag(id)).length}</div>
        </Card>
        <Card className="summary-card">
          <div className="summary-label">队伍 / 盒子</div>
          <div className="summary-value">{save.partyCount} / 6</div>
          <div className="summary-meta">盒子 {Array.from({ length: 21 }, (_, b) => Array.from({ length: 30 }, (_, s) => save.boxMon(b, s)).filter((m) => m.some((x) => x)).length).reduce((a, b) => a + b, 0)} 只</div>
        </Card>
      </div>

      <div className="grid-2">
        <Card className="pad">
          <div className="row between"><h3>游戏内校验</h3><span className={`pill ${errors ? 'pill-red' : warns ? 'pill-gold' : 'pill-green'}`}>{errors ? `${errors} 个错误` : warns ? `${warns} 个提示` : '全部通过'}</span></div>
          <div className="check-list">
            {checks.map((c, i) => (
              <div key={i} className={`check check-${c.level}`}>
                <span className="check-dot" />
                <div><b>{c.title}</b>{c.detail && <div className="muted small">{c.detail}</div>}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="pad">
          <h3>快捷入口</h3>
          <div className="quick-grid">
            <button onClick={() => onGo('trainer')}>训练家信息<span>名字、金钱、徽章、时间</span></button>
            <button onClick={() => onGo('party')}>同行队伍<span>{party.map((m) => speciesName(m.species)).join('、') || '空'}</span></button>
            <button onClick={() => onGo('boxes')}>宝可梦盒子<span>21 个盒子 · 630 个位置</span></button>
            <button onClick={() => onGo('bag')}>道具<span>8 个口袋 + PC 道具</span></button>
            <button onClick={() => onGo('events')}>事件<span>徽章、图鉴、Flags / Vars</span></button>
            <button onClick={() => onGo('export')}>导出存档<span>重新计算校验并下载</span></button>
          </div>
        </Card>
      </div>

      <Card className="pad">
        <h3>数据安全说明</h3>
        <ul className="note-list">
          <li>所有解析都在浏览器本地完成，存档不会上传到任何服务器。</li>
          <li>导出时只写入当前存档槽，并将扇区计数器 +1；另一个槽保留为原始备份。</li>
          <li>重新计算每个扇区的校验和、BX21 存储头校验和与辅助扇区校验和。</li>
          <li>金钱、游戏币和背包数量会使用存档内的加密密钥重新加密。</li>
          <li>建议导出前先在模拟器里备份原存档；不要在游戏运行中替换存档文件。</li>
        </ul>
      </Card>
    </div>
  );
}
