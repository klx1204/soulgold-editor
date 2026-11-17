import React from 'react';

export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Button({ variant = 'default', size = 'md', className = '', ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}{hint && <span className="field-hint">{hint}</span>}</span>
      {children}
    </label>
  );
}

export function NumberInput({ value, onChange, min = 0, max = 65535, step = 1, disabled, className = '' }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; className?: string }) {
  return (
    <input
      className={`input num ${className}`}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
      }}
    />
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Modal({ title, subtitle, onClose, children, footer, wide }:
  { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function TypeChip({ type }: { type: string }) {
  if (!type || type === 'NONE') return null;
  return <span className={`type type-${type.toLowerCase()}`}>{TYPE_ZH[type] ?? type}</span>;
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="section-actions">{right}</div>}
    </div>
  );
}

export function Picker<T>({ title, items, search, render, onPick, onClose, placeholder }:
  { title: string; items: T[]; search: (item: T, q: string) => boolean; render: (item: T) => React.ReactNode; onPick: (item: T) => void; onClose: () => void; placeholder?: string }) {
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(80);
  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query ? items.filter((it) => search(it, query)) : items;
    return list;
  }, [items, q, search]);
  return (
    <Modal title={title} onClose={onClose} wide>
      <input autoFocus className="input search" placeholder={placeholder ?? '搜索名称 / 编号'} value={q}
        onChange={(e) => { setQ(e.target.value); setLimit(80); }} />
      <div className="pick-list">
        {filtered.slice(0, limit).map((it, i) => (
          <button key={i} className="pick-row" onClick={() => { onPick(it); onClose(); }}>
            {render(it)}
          </button>
        ))}
        {filtered.length === 0 && <Empty>没有匹配结果</Empty>}
        {filtered.length > limit && (
          <Button variant="ghost" onClick={() => setLimit((v) => v + 120)}>继续显示（{filtered.length - limit} 项）</Button>
        )}
      </div>
    </Modal>
  );
}

import { TYPE_ZH } from '../lib/data';
