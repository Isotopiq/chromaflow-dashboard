/// <reference lib="webworker" />
// Lightweight mzML / mzXML browser parser. Extracts retention times + TIC + BPC
// and runs a simple peak picker. Designed for smallish files (< 300 MB).
//
// Posts back: { ok: true, summary } or { ok: false, error }

import { XMLParser } from "fast-xml-parser";
import { inflate } from "pako";

type RunSummary = {
  trace: { x: number[]; tic: number[]; bpc: number[] };
  peaks: Array<{
    rt: number;
    area: number;
    height: number;
    fwhm: number;
    sn: number;
    mz?: number;
  }>;
  ionMode: "positive" | "negative";
  format: "mzML" | "mzXML";
};

function b64ToFloat(
  b64: string,
  precision: 32 | 64,
  compressed: boolean,
): number[] {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const bytes = compressed ? inflate(buf) : buf;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  if (precision === 64) {
    for (let i = 0; i + 8 <= bytes.byteLength; i += 8) {
      out.push(dv.getFloat64(i, true));
    }
  } else {
    for (let i = 0; i + 4 <= bytes.byteLength; i += 4) {
      out.push(dv.getFloat32(i, true));
    }
  }
  return out;
}

function pickArrays(arr: any[]): {
  mz: { precision: 32 | 64; compressed: boolean; raw: string } | null;
  intensity: { precision: 32 | 64; compressed: boolean; raw: string } | null;
} {
  let mz: any = null,
    intensity: any = null;
  for (const a of arr) {
    const cv = Array.isArray(a.cvParam) ? a.cvParam : [a.cvParam].filter(Boolean);
    const accs = cv.map((c: any) => c?.["@_accession"] ?? "");
    const isMz = accs.includes("MS:1000514");
    const isInt = accs.includes("MS:1000515");
    const precision: 32 | 64 = accs.includes("MS:1000523") ? 64 : 32;
    const compressed = accs.includes("MS:1000574");
    const bin = a?.binary;
    if (typeof bin !== "string") continue;
    const slot = { precision, compressed, raw: bin };
    if (isMz) mz = slot;
    if (isInt) intensity = slot;
  }
  return { mz, intensity };
}

function getRetentionTime(scan: any): number {
  const sl = scan?.scanList?.scan;
  const sList = Array.isArray(sl) ? sl : [sl].filter(Boolean);
  for (const s of sList) {
    const cv = Array.isArray(s?.cvParam) ? s.cvParam : [s?.cvParam].filter(Boolean);
    for (const c of cv) {
      if (c?.["@_accession"] === "MS:1000016") {
        const v = parseFloat(c["@_value"]);
        const unit = c["@_unitName"] ?? c["@_unitAccession"] ?? "";
        // unit "second" → minutes
        return /second|MS:1000038/i.test(unit) ? v / 60 : v;
      }
    }
  }
  return 0;
}

function detectIonMode(spec: any): "positive" | "negative" | null {
  const cv = Array.isArray(spec?.cvParam) ? spec.cvParam : [spec?.cvParam].filter(Boolean);
  for (const c of cv) {
    if (c?.["@_accession"] === "MS:1000130") return "positive";
    if (c?.["@_accession"] === "MS:1000129") return "negative";
  }
  return null;
}

function pickPeaks(
  x: number[],
  y: number[],
  topN = 30,
): Array<{ rt: number; area: number; height: number; fwhm: number; sn: number }> {
  if (x.length < 5) return [];
  const baseline = (() => {
    const sorted = [...y].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.2)] || 0;
  })();
  const noise = (() => {
    const lows = y.filter((v) => v <= baseline * 1.5);
    if (lows.length === 0) return Math.max(1, baseline * 0.05);
    const mean = lows.reduce((s, v) => s + v, 0) / lows.length;
    const sd = Math.sqrt(lows.reduce((s, v) => s + (v - mean) ** 2, 0) / lows.length);
    return Math.max(1, sd);
  })();

  const candidates: Array<{ i: number; h: number }> = [];
  for (let i = 2; i < y.length - 2; i++) {
    if (
      y[i] > y[i - 1] &&
      y[i] > y[i + 1] &&
      y[i] > y[i - 2] &&
      y[i] > y[i + 2] &&
      y[i] > baseline + 5 * noise
    ) {
      candidates.push({ i, h: y[i] });
    }
  }

  const top = candidates.sort((a, b) => b.h - a.h).slice(0, topN);
  return top
    .map(({ i, h }) => {
      const half = h / 2;
      let l = i;
      while (l > 0 && y[l] > half) l--;
      let r = i;
      while (r < y.length - 1 && y[r] > half) r++;
      const fwhm = Math.max(0.001, x[r] - x[l]);
      // trapezoid area in the FWHM window (ionised intensity * min)
      let area = 0;
      for (let k = l; k < r; k++) area += ((y[k] + y[k + 1]) / 2) * (x[k + 1] - x[k]);
      return {
        rt: +x[i].toFixed(4),
        area: +area.toFixed(0),
        height: +h.toFixed(0),
        fwhm: +fwhm.toFixed(4),
        sn: +(h / noise).toFixed(1),
      };
    })
    .sort((a, b) => a.rt - b.rt);
}

async function parseMzML(text: string): Promise<RunSummary> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(text);
  const root = doc?.indexedmzML?.mzML ?? doc?.mzML;
  const specList = root?.run?.spectrumList;
  const rawSpecs = specList?.spectrum;
  const specs = Array.isArray(rawSpecs) ? rawSpecs : rawSpecs ? [rawSpecs] : [];

  const x: number[] = [];
  const tic: number[] = [];
  const bpc: number[] = [];
  let ionMode: "positive" | "negative" = "positive";
  let ionDetected = false;

  for (const s of specs) {
    // MS1 only
    const cv = Array.isArray(s?.cvParam) ? s.cvParam : [s?.cvParam].filter(Boolean);
    const msLevel = cv.find((c: any) => c?.["@_accession"] === "MS:1000511");
    if (msLevel && parseInt(msLevel["@_value"], 10) !== 1) continue;
    if (!ionDetected) {
      const m = detectIonMode(s);
      if (m) {
        ionMode = m;
        ionDetected = true;
      }
    }
    const rt = getRetentionTime(s);
    let ticVal = 0;
    let bpcVal = 0;
    const ticCv = cv.find((c: any) => c?.["@_accession"] === "MS:1000285");
    const bpcCv = cv.find((c: any) => c?.["@_accession"] === "MS:1000505");
    if (ticCv) ticVal = parseFloat(ticCv["@_value"]);
    if (bpcCv) bpcVal = parseFloat(bpcCv["@_value"]);

    if (!ticVal || !bpcVal) {
      // compute from binary arrays
      const bdl = s?.binaryDataArrayList?.binaryDataArray;
      const arrs = Array.isArray(bdl) ? bdl : bdl ? [bdl] : [];
      const { intensity } = pickArrays(arrs);
      if (intensity) {
        const ints = b64ToFloat(intensity.raw, intensity.precision, intensity.compressed);
        if (!ticVal) ticVal = ints.reduce((a, b) => a + b, 0);
        if (!bpcVal) bpcVal = Math.max(0, ...ints);
      }
    }

    x.push(+rt.toFixed(4));
    tic.push(ticVal);
    bpc.push(bpcVal);
  }

  const peaks = pickPeaks(x, tic);
  return { trace: { x, tic, bpc }, peaks, ionMode, format: "mzML" };
}

self.onmessage = async (e: MessageEvent) => {
  const { id, text } = e.data as { id: string; text: string };
  try {
    const summary = await parseMzML(text);
    (self as unknown as Worker).postMessage({ id, ok: true, summary });
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err?.message ?? String(err) });
  }
};
