/**
 * SoulGold (pokeemerald-expansion) BX21 savefile reader/writer.
 *
 * Verified against the v1.2.1 Chinese save:
 *  - 32 sectors x 4 KiB, footer = id/checksum/signature/counter
 *  - save slot 0 = sectors 0..13, slot 1 = 14..27 (physical order rotates)
 *  - storage 43,456 bytes split across sectors 5..13, 30/31, SaveBlock1 tail
 *    and the BX21 auxiliary sector 28/29
 *  - checksum = folded sum of little-endian u32 words
 *  - money/coins/bag quantities are XOR-encrypted with SaveBlock2.encryptionKey
 */

export const SECTOR_SIZE = 4096;
export const SECTOR_DATA = 3968;
export const SIGNATURE_BX21 = 0x21325842;
export const SIGNATURE_LEGACY = 0x08012025;

export const SB2_SIZE = 0x0b30;
export const SB1_SIZE = 0x3c54;
export const STORAGE_SIZE = 43456;
export const STORAGE_REGULAR = 35712;        // sectors 5..13
export const STORAGE_OVERFLOW = STORAGE_REGULAR + SECTOR_DATA; // 39680
export const SB1_TAIL_OFF = 0x349a;
export const SB1_TAIL_LEN = 1944;
export const AUX_TAIL_OFF = 12;
export const AUX_TAIL_LEN = 1832;
export const AUX_PAYLOAD_LEN = 3420;
export const BX21_MAGIC = 0x31325842;

export const O_PARTY_COUNT = 0x234;
export const O_PARTY = 0x238;
export const O_MONEY = 0x478;
export const O_COINS = 0x47c;
export const O_PC_ITEMS = 0x480;
export const O_BAG = 0x548;
export const O_FLAGS = 0x1898;       // 681 bytes (NUM_FLAG_BYTES)
export const NUM_FLAG_BYTES = 681;
export const O_VARS = 0x1b42;
export const NUM_VARS = 768;
export const O_GAME_STATS = 0x2144;
export const O_DEX_SEEN = 0x31f8;
export const O_DEX_CAUGHT = 0x3279;
export const DEX_FLAG_BYTES = 129;

export const PARTY_SIZE = 6;
export const POKEMON_SIZE = 96;
export const BOX_MON_SIZE = 68;
export const BOX_COUNT = 21;
export const BOX_SLOTS = 30;
export const BOXES_OFF = 404;
export const BOX_NAMES_OFF = 43244;
export const BOX_WALLPAPERS_OFF = 43433;
export const PC_ITEM_COUNT = 50;

export const POCKETS = [
  { key: 'items', label: '道具', count: 150 },
  { key: 'medicine', label: '药品', count: 65 },
  { key: 'keyItems', label: '重要物品', count: 50 },
  { key: 'pokeBalls', label: '精灵球', count: 27 },
  { key: 'tms', label: '招式学习器', count: 128 },
  { key: 'megaStones', label: 'Mega 石', count: 35 },
  { key: 'battleItems', label: '对战道具', count: 100 },
  { key: 'berries', label: '树果', count: 70 },
] as const;

export const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
export const u32 = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
export const w16 = (b: Uint8Array, o: number, v: number) => {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
};
export const w32 = (b: Uint8Array, o: number, v: number) => {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
};

export function checksum(buf: Uint8Array, size = buf.length, start = 0): number {
  let sum = 0;
  const end = start + Math.floor(size / 4) * 4;
  for (let o = start; o < end; o += 4) {
    sum = (sum + ((buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0)) >>> 0;
  }
  return ((sum >>> 16) + sum) & 0xffff;
}

export interface SectorInfo {
  index: number;
  id: number;
  checksum: number;
  signature: number;
  counter: number;
  valid: boolean;
}

export interface TrainerInfo {
  name: Uint8Array;          // 8 bytes, 2-byte text + 0xFFFF
  gender: number;
  trainerId: number;
  playTimeHours: number;
  playTimeMinutes: number;
  playTimeSeconds: number;
  money: number;
  coins: number;
  encryptionKey: number;
}

export class SaveFile {
  raw: Uint8Array;
  sectors: SectorInfo[];
  slot: number;
  phys: number[];            // logical sector id -> physical sector index
  sb2: Uint8Array;
  sb1: Uint8Array;
  storage: Uint8Array;

  constructor(data: Uint8Array) {
    if (data.length !== 0x20000) {
      throw new Error(`存档大小必须是 128 KiB，当前为 ${data.length} 字节`);
    }
    this.raw = data.slice();
    this.sectors = Array.from({ length: 32 }, (_, i) => this.readSectorInfo(i));
    this.slot = this.pickSlot();
    this.phys = new Array(14).fill(-1);
    for (const s of this.sectors.slice(this.slot * 14, this.slot * 14 + 14)) {
      this.phys[s.id] = s.index;
    }
    this.sb2 = this.readBlock(0, SB2_SIZE);
    this.sb1 = this.readBlock(1, SB1_SIZE);
    this.storage = this.readStorage();
    if (u32(this.storage, 0) !== BX21_MAGIC) {
      throw new Error('存档不是 BX21 盒子格式（需要 SoulGold v1.2.1 或更新版本的存档）');
    }
  }

  private readSectorInfo(i: number): SectorInfo {
    const o = i * SECTOR_SIZE;
    const id = u16(this.raw, o + 4084);
    const ck = u16(this.raw, o + 4086);
    const signature = u32(this.raw, o + 4088);
    const counter = u32(this.raw, o + 4092);
    const size = id === 0 ? SB2_SIZE : id === 4 ? SB1_SIZE - 3 * SECTOR_DATA : SECTOR_DATA;
    const valid =
      (signature === SIGNATURE_BX21 || signature === SIGNATURE_LEGACY) &&
      ck === checksum(this.raw, size, o);
    return { index: i, id, checksum: ck, signature, counter, valid };
  }

  private slotValid(slot: number): boolean {
    const secs = this.sectors.slice(slot * 14, slot * 14 + 14);
    if (!secs.every((s) => s.valid)) return false;
    const ids = new Set(secs.map((s) => s.id));
    return ids.size === 14 && [...ids].every((id) => id >= 0 && id < 14);
  }

  private pickSlot(): number {
    const ok0 = this.slotValid(0);
    const ok1 = this.slotValid(1);
    if (!ok0 && !ok1) throw new Error('两个存档槽都未通过校验，无法读取');
    if (!ok0) return 1;
    if (!ok1) return 0;
    return this.sectors[14].counter > this.sectors[0].counter ? 1 : 0;
  }

  private readBlock(firstId: number, size: number): Uint8Array {
    const out = new Uint8Array(size);
    let pos = 0;
    for (let id = firstId; id < 14 && pos < size; id++) {
      const p = this.phys[id];
      if (p < 0) break;
      const n = Math.min(SECTOR_DATA, size - pos);
      out.set(this.raw.subarray(p * SECTOR_SIZE, p * SECTOR_SIZE + n), pos);
      pos += n;
    }
    return out;
  }

  private readStorage(): Uint8Array {
    const out = new Uint8Array(STORAGE_SIZE);
    let pos = 0;
    for (let id = 5; id < 14; id++) {
      const p = this.phys[id];
      out.set(this.raw.subarray(p * SECTOR_SIZE, p * SECTOR_SIZE + SECTOR_DATA), pos);
      pos += SECTOR_DATA;
    }
    const overflow = 30 + this.slot;
    out.set(this.raw.subarray(overflow * SECTOR_SIZE, overflow * SECTOR_SIZE + SECTOR_DATA), pos);
    pos += SECTOR_DATA;
    const s1End = this.phys[4];
    out.set(this.raw.subarray(s1End * SECTOR_SIZE + SB1_TAIL_OFF,
      s1End * SECTOR_SIZE + SB1_TAIL_OFF + SB1_TAIL_LEN), pos);
    pos += SB1_TAIL_LEN;
    const aux = 28 + this.slot;
    out.set(this.raw.subarray(aux * SECTOR_SIZE + AUX_TAIL_OFF,
      aux * SECTOR_SIZE + AUX_TAIL_OFF + AUX_TAIL_LEN), pos);
    return out;
  }

  get encryptionKey() { return u32(this.sb2, 0xb4); }
  get money() { return (u32(this.sb1, O_MONEY) ^ this.encryptionKey) >>> 0; }
  set money(v: number) { w32(this.sb1, O_MONEY, (v ^ this.encryptionKey) >>> 0); }
  get coins() { return (u16(this.sb1, O_COINS) ^ (this.encryptionKey & 0xffff)) & 0xffff; }
  set coins(v: number) { w16(this.sb1, O_COINS, v ^ (this.encryptionKey & 0xffff)); }

  get partyCount() { return this.sb1[O_PARTY_COUNT]; }
  set partyCount(v: number) { this.sb1[O_PARTY_COUNT] = v & 0xff; }

  get trainer(): TrainerInfo {
    return {
      name: this.sb2.slice(0, 8),
      gender: this.sb2[8],
      trainerId: u32(this.sb2, 0x0a),
      playTimeHours: u16(this.sb2, 0x0e),
      playTimeMinutes: this.sb2[0x10],
      playTimeSeconds: this.sb2[0x11],
      money: this.money,
      coins: this.coins,
      encryptionKey: this.encryptionKey,
    };
  }

  partyMon(i: number): Uint8Array {
    const o = O_PARTY + i * POKEMON_SIZE;
    return this.sb1.slice(o, o + POKEMON_SIZE);
  }
  setPartyMon(i: number, mon: Uint8Array) {
    this.sb1.set(mon.subarray(0, POKEMON_SIZE), O_PARTY + i * POKEMON_SIZE);
  }
  boxMon(box: number, slot: number): Uint8Array {
    const o = BOXES_OFF + (box * BOX_SLOTS + slot) * BOX_MON_SIZE;
    return this.storage.slice(o, o + BOX_MON_SIZE);
  }
  setBoxMon(box: number, slot: number, mon: Uint8Array) {
    const o = BOXES_OFF + (box * BOX_SLOTS + slot) * BOX_MON_SIZE;
    if (mon.length === 0) this.storage.fill(0, o, o + BOX_MON_SIZE);
    else this.storage.set(mon.subarray(0, BOX_MON_SIZE), o);
  }

  boxName(box: number): Uint8Array {
    const o = BOX_NAMES_OFF + box * 9;
    return this.storage.slice(o, o + 9);
  }
  setBoxName(box: number, name: Uint8Array) {
    const o = BOX_NAMES_OFF + box * 9;
    this.storage.fill(0, o, o + 9);
    this.storage.set(name.subarray(0, 9), o);
  }

  pcItem(i: number): { item: number; qty: number } {
    const o = O_PC_ITEMS + i * 4;
    return { item: u16(this.sb1, o), qty: u16(this.sb1, o + 2) };
  }
  setPcItem(i: number, item: number, qty: number) {
    const o = O_PC_ITEMS + i * 4;
    w16(this.sb1, o, item);
    w16(this.sb1, o + 2, qty);
  }

  pocketOffset(pocket: number): number {
    let o = O_BAG;
    for (let i = 0; i < pocket; i++) o += POCKETS[i].count * 4;
    return o;
  }
  bagItem(pocket: number, i: number): { item: number; qty: number } {
    const o = this.pocketOffset(pocket) + i * 4;
    return { item: u16(this.sb1, o), qty: (u16(this.sb1, o + 2) ^ (this.encryptionKey & 0xffff)) & 0xffff };
  }
  setBagItem(pocket: number, i: number, item: number, qty: number) {
    const o = this.pocketOffset(pocket) + i * 4;
    w16(this.sb1, o, item);
    w16(this.sb1, o + 2, qty ^ (this.encryptionKey & 0xffff));
  }

  flag(id: number): boolean {
    return (this.sb1[O_FLAGS + (id >> 3)] & (1 << (id & 7))) !== 0;
  }
  setFlag(id: number, on: boolean) {
    const o = O_FLAGS + (id >> 3);
    if (on) this.sb1[o] |= 1 << (id & 7);
    else this.sb1[o] &= ~(1 << (id & 7));
  }
  getVar(id: number): number {
    const i = id - 0x4000;
    return i >= 0 && i < NUM_VARS ? u16(this.sb1, O_VARS + i * 2) : 0;
  }
  setVar(id: number, value: number) {
    const i = id - 0x4000;
    if (i >= 0 && i < NUM_VARS) w16(this.sb1, O_VARS + i * 2, value);
  }
  dexSeen(id: number): boolean {
    const i = id - 1;
    return i >= 0 && i < DEX_FLAG_BYTES * 8 && (this.sb1[O_DEX_SEEN + (i >> 3)] & (1 << (i & 7))) !== 0;
  }
  dexCaught(id: number): boolean {
    const i = id - 1;
    return i >= 0 && i < DEX_FLAG_BYTES * 8 && (this.sb1[O_DEX_CAUGHT + (i >> 3)] & (1 << (i & 7))) !== 0;
  }
  setDexSeen(id: number, on: boolean) {
    const i = id - 1; if (i < 0) return;
    const o = O_DEX_SEEN + (i >> 3);
    if (on) this.sb1[o] |= 1 << (i & 7); else this.sb1[o] &= ~(1 << (i & 7));
  }
  setDexCaught(id: number, on: boolean) {
    const i = id - 1; if (i < 0) return;
    const o = O_DEX_CAUGHT + (i >> 3);
    if (on) this.sb1[o] |= 1 << (i & 7); else this.sb1[o] &= ~(1 << (i & 7));
  }

  validateStorage(): { ok: boolean; detail: string } {
    try {
      const auxIndex = 28 + this.slot;
      const aux = this.raw.slice(auxIndex * SECTOR_SIZE, (auxIndex + 1) * SECTOR_SIZE);
      const auxCk = u16(aux, 4086);
      const auxSectorOk = auxCk === checksum(aux, SECTOR_DATA, 0);
      const magic = u32(aux, 0);
      const version = u16(aux, 4);
      const payloadLength = u16(aux, 6);
      const payloadCk = u16(aux, 8);
      const payloadInv = u16(aux, 10);
      const payloadOk = payloadCk === checksum(aux, AUX_PAYLOAD_LEN, AUX_TAIL_OFF) && payloadInv === ((~payloadCk) & 0xffff);
      const overflow = 30 + this.slot;
      const ov = this.raw.slice(overflow * SECTOR_SIZE, (overflow + 1) * SECTOR_SIZE);
      const ovOk = u16(ov, 4086) === checksum(ov, SECTOR_DATA, 0);
      const headerCk = u16(this.storage, 8);
      const headerOk = u32(this.storage, 0) === BX21_MAGIC &&
        u16(this.storage, 4) === 1 &&
        u16(this.storage, 6) === STORAGE_SIZE - 16 &&
        headerCk === checksum(this.storage, STORAGE_SIZE - 16, 16) &&
        u16(this.storage, 10) === ((~headerCk) & 0xffff);
      const ok = auxSectorOk && magic === BX21_MAGIC && version === 1 &&
        payloadLength === AUX_PAYLOAD_LEN && payloadOk && ovOk && headerOk;
      return { ok, detail: ok ? 'BX21 存储头、盒子溢出扇区、辅助扇区校验通过' : '存储头 / 盒子扩展校验失败' };
    } catch {
      return { ok: false, detail: '无法读取盒子扩展数据' };
    }
  }

  serialize(): Uint8Array {
    // BX21 header checksum covers currentBox..end (43,440 bytes).
    w32(this.storage, 0, BX21_MAGIC);
    w32(this.storage, 12, (~BX21_MAGIC) >>> 0);
    w16(this.storage, 4, 1);
    w16(this.storage, 6, STORAGE_SIZE - 16);
    const headerCk = checksum(this.storage, STORAGE_SIZE - 16, 16);
    w16(this.storage, 8, headerCk);
    w16(this.storage, 10, (~headerCk) & 0xffff);

    const newCounter = Math.max(this.sectors[0].counter, this.sectors[14].counter) + 1;
    const out = this.raw.slice();

    // Storage tail lives inside SaveBlock1's last sector; keep both in sync.
    this.sb1.set(this.storage.subarray(STORAGE_OVERFLOW, STORAGE_OVERFLOW + SB1_TAIL_LEN), SB1_TAIL_OFF);

    const put = (id: number, chunk: Uint8Array, size: number) => {
      const p = this.phys[id];
      const sec = out.slice(p * SECTOR_SIZE, (p + 1) * SECTOR_SIZE);
      sec.set(chunk.subarray(0, size), 0);
      const ck = checksum(sec, size, 0);
      w16(sec, 4084, id);
      w16(sec, 4086, ck);
      w32(sec, 4088, SIGNATURE_BX21);
      w32(sec, 4092, newCounter);
      out.set(sec, p * SECTOR_SIZE);
    };

    put(0, this.sb2, SB2_SIZE);
    for (let id = 1; id <= 4; id++) {
      const off = (id - 1) * SECTOR_DATA;
      put(id, this.sb1.subarray(off), Math.min(SECTOR_DATA, SB1_SIZE - off));
    }
    for (let id = 5; id <= 13; id++) {
      const off = (id - 5) * SECTOR_DATA;
      put(id, this.storage.subarray(off), SECTOR_DATA);
    }

    // Overflow sector (30/31)
    {
      const p = 30 + this.slot;
      const sec = out.slice(p * SECTOR_SIZE, (p + 1) * SECTOR_SIZE);
      sec.set(this.storage.subarray(STORAGE_REGULAR, STORAGE_REGULAR + SECTOR_DATA), 0);
      const ck = checksum(sec, SECTOR_DATA, 0);
      w16(sec, 4084, 30 + this.slot);
      w16(sec, 4086, ck);
      w32(sec, 4088, SIGNATURE_BX21);
      w32(sec, 4092, newCounter);
      out.set(sec, p * SECTOR_SIZE);
    }

    // BX21 auxiliary sector (28/29): storage tail + Hall of Fame.
    {
      const p = 28 + this.slot;
      const sec = out.slice(p * SECTOR_SIZE, (p + 1) * SECTOR_SIZE);
      sec.set(this.storage.subarray(STORAGE_SIZE - AUX_TAIL_LEN), AUX_TAIL_OFF);
      const auxCk = checksum(sec, AUX_PAYLOAD_LEN, AUX_TAIL_OFF);
      w16(sec, 8, auxCk);
      w16(sec, 10, (~auxCk) & 0xffff);
      const ck = checksum(sec, SECTOR_DATA, 0);
      w16(sec, 4084, 28 + this.slot);
      w16(sec, 4086, ck);
      w32(sec, 4088, SIGNATURE_BX21);
      w32(sec, 4092, newCounter);
      out.set(sec, p * SECTOR_SIZE);
    }

    return out;
  }
}
