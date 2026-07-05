import * as ss from "simple-statistics";

export type Row = Record<string, string | number | null>;

export type ColumnType = "number" | "string" | "date" | "boolean" | "empty";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  count: number;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  variance?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  outliers?: number[];
  topValues?: { value: string; count: number }[];
}

// ============ Detecção de tipo ============
export function detectType(values: (string | number | null)[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== "" && v !== undefined);
  if (nonEmpty.length === 0) return "empty";
  let nums = 0;
  let dates = 0;
  let bools = 0;
  for (const v of nonEmpty) {
    const s = String(v).trim();
    if (s === "true" || s === "false") bools++;
    else if (!isNaN(Number(s.replace(",", ".")))) nums++;
    else if (!isNaN(Date.parse(s))) dates++;
  }
  const total = nonEmpty.length;
  if (nums / total > 0.8) return "number";
  if (dates / total > 0.8) return "date";
  if (bools / total > 0.8) return "boolean";
  return "string";
}

// ============ Limpeza ============
export interface CleanOptions {
  removeDuplicates: boolean;
  trimStrings: boolean;
  fillMissingNumeric: "none" | "mean" | "median" | "zero";
  fillMissingString: "none" | "empty" | "unknown";
  removeOutliers: boolean;
  normalizeCase: "none" | "lower" | "upper";
}

export function cleanData(
  rows: Row[],
  opts: CleanOptions,
): { cleaned: Row[]; report: string[] } {
  const report: string[] = [];
  let data = rows.map((r) => ({ ...r }));
  const initial = data.length;

  if (opts.trimStrings || opts.normalizeCase !== "none") {
    data = data.map((r) => {
      const nr: Row = {};
      for (const k in r) {
        let v = r[k];
        if (typeof v === "string") {
          if (opts.trimStrings) v = v.trim();
          if (opts.normalizeCase === "lower") v = v.toLowerCase();
          if (opts.normalizeCase === "upper") v = v.toUpperCase();
        }
        nr[k] = v;
      }
      return nr;
    });
    report.push("Strings normalizadas (trim/case).");
  }

  if (opts.removeDuplicates) {
    const seen = new Set<string>();
    data = data.filter((r) => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    report.push(`Duplicatas removidas: ${initial - data.length}.`);
  }

  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  for (const col of columns) {
    const values = data.map((r) => r[col]);
    const type = detectType(values);
    if (type === "number") {
      const nums = values
        .map((v) => (v === null || v === "" ? NaN : Number(String(v).replace(",", "."))))
        .filter((n) => !isNaN(n));
      if (opts.fillMissingNumeric !== "none" && nums.length > 0) {
        let fill = 0;
        if (opts.fillMissingNumeric === "mean") fill = ss.mean(nums);
        else if (opts.fillMissingNumeric === "median") fill = ss.median(nums);
        let filled = 0;
        data = data.map((r) => {
          const v = r[col];
          if (
            v === null ||
            v === "" ||
            v === undefined ||
            isNaN(Number(String(v).replace(",", ".")))
          ) {
            filled++;
            return { ...r, [col]: fill };
          }
          return { ...r, [col]: Number(String(v).replace(",", ".")) };
        });
        if (filled > 0)
          report.push(
            `Coluna "${col}": ${filled} valores ausentes preenchidos (${opts.fillMissingNumeric}).`,
          );
      }
      if (opts.removeOutliers && nums.length > 4) {
        const q1 = ss.quantile(nums, 0.25);
        const q3 = ss.quantile(nums, 0.75);
        const iqr = q3 - q1;
        const lo = q1 - 1.5 * iqr;
        const hi = q3 + 1.5 * iqr;
        const before = data.length;
        data = data.filter((r) => {
          const n = Number(r[col]);
          return isNaN(n) || (n >= lo && n <= hi);
        });
        const removed = before - data.length;
        if (removed > 0) report.push(`Coluna "${col}": ${removed} outliers removidos (IQR).`);
      }
    } else if (type === "string") {
      if (opts.fillMissingString !== "none") {
        const fill = opts.fillMissingString === "empty" ? "" : "unknown";
        let filled = 0;
        data = data.map((r) => {
          if (r[col] === null || r[col] === undefined) {
            filled++;
            return { ...r, [col]: fill };
          }
          return r;
        });
        if (filled > 0) report.push(`Coluna "${col}": ${filled} strings ausentes preenchidas.`);
      }
    }
  }

  report.unshift(`Registros: ${initial} → ${data.length}.`);
  return { cleaned: data, report };
}

// ============ Perfil / Estatística ============
export function profileColumn(
  name: string,
  values: (string | number | null)[],
): ColumnProfile {
  const type = detectType(values);
  const nonEmpty = values.filter((v) => v !== null && v !== "" && v !== undefined);
  const missing = values.length - nonEmpty.length;
  const unique = new Set(nonEmpty.map(String)).size;
  const base: ColumnProfile = { name, type, count: values.length, missing, unique };
  if (type === "number") {
    const nums = nonEmpty
      .map((v) => Number(String(v).replace(",", ".")))
      .filter((n) => !isNaN(n));
    if (nums.length > 0) {
      base.min = ss.min(nums);
      base.max = ss.max(nums);
      base.mean = ss.mean(nums);
      base.median = ss.median(nums);
      base.stdDev = nums.length > 1 ? ss.standardDeviation(nums) : 0;
      base.variance = nums.length > 1 ? ss.variance(nums) : 0;
      if (nums.length > 3) {
        base.q1 = ss.quantile(nums, 0.25);
        base.q3 = ss.quantile(nums, 0.75);
        base.iqr = base.q3 - base.q1;
        const lo = base.q1 - 1.5 * base.iqr;
        const hi = base.q3 + 1.5 * base.iqr;
        base.outliers = nums.filter((n) => n < lo || n > hi);
      }
    }
  } else {
    const counts = new Map<string, number>();
    for (const v of nonEmpty) {
      const s = String(v);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    base.topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));
  }
  return base;
}

export function profileAll(rows: Row[]): ColumnProfile[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  return cols.map((c) => profileColumn(c, rows.map((r) => r[c])));
}

// ============ Correlação (Pearson) ============
export function correlationMatrix(
  rows: Row[],
): { columns: string[]; matrix: number[][] } {
  const profiles = profileAll(rows);
  const numericCols = profiles.filter((p) => p.type === "number").map((p) => p.name);
  const series = numericCols.map((c) =>
    rows.map((r) => Number(String(r[c] ?? "").replace(",", "."))).filter((n) => !isNaN(n)),
  );
  const matrix = numericCols.map((_, i) =>
    numericCols.map((_, j) => {
      if (i === j) return 1;
      const a = series[i];
      const b = series[j];
      const n = Math.min(a.length, b.length);
      if (n < 2) return 0;
      return Number(ss.sampleCorrelation(a.slice(0, n), b.slice(0, n)).toFixed(3));
    }),
  );
  return { columns: numericCols, matrix };
}

// ============ Tendência (regressão linear) ============
export function linearTrend(values: number[]): {
  slope: number;
  intercept: number;
  direction: "alta" | "baixa" | "estável";
  r2: number;
} {
  if (values.length < 2) return { slope: 0, intercept: 0, direction: "estável", r2: 0 };
  const pts = values.map((y, x) => [x, y] as [number, number]);
  const reg = ss.linearRegression(pts);
  const line = ss.linearRegressionLine(reg);
  const r2 = ss.rSquared(pts, line);
  const direction = Math.abs(reg.m) < 1e-6 ? "estável" : reg.m > 0 ? "alta" : "baixa";
  return { slope: reg.m, intercept: reg.b, direction, r2 };
}

// ============ Insights automáticos ============
export function generateInsights(rows: Row[]): string[] {
  const insights: string[] = [];
  const profiles = profileAll(rows);
  insights.push(`Dataset com ${rows.length} registros e ${profiles.length} colunas.`);

  for (const p of profiles) {
    if (p.missing > 0) {
      const pct = ((p.missing / p.count) * 100).toFixed(1);
      if (p.missing / p.count > 0.3)
        insights.push(
          `⚠️ "${p.name}" tem ${pct}% de valores ausentes — considere excluir ou imputar.`,
        );
    }
    if (p.type === "number" && p.outliers && p.outliers.length > 0) {
      insights.push(`📊 "${p.name}" possui ${p.outliers.length} outliers (método IQR).`);
    }
    if (p.type === "number" && p.stdDev !== undefined && p.mean !== undefined && p.mean !== 0) {
      const cv = Math.abs(p.stdDev / p.mean);
      if (cv > 1) insights.push(`📈 "${p.name}" tem alta variabilidade (CV=${cv.toFixed(2)}).`);
    }
    if (p.type === "number") {
      const series = rows
        .map((r) => Number(String(r[p.name] ?? "").replace(",", ".")))
        .filter((n) => !isNaN(n));
      const trend = linearTrend(series);
      if (trend.r2 > 0.5)
        insights.push(
          `📉 "${p.name}" apresenta tendência de ${trend.direction} (R²=${trend.r2.toFixed(2)}).`,
        );
    }
    if (p.type === "string" && p.topValues && p.topValues[0]) {
      const top = p.topValues[0];
      const pct = ((top.count / p.count) * 100).toFixed(1);
      if (top.count / p.count > 0.7)
        insights.push(`🎯 "${p.name}" é dominado por "${top.value}" (${pct}%).`);
    }
  }

  const corr = correlationMatrix(rows);
  for (let i = 0; i < corr.columns.length; i++) {
    for (let j = i + 1; j < corr.columns.length; j++) {
      const v = corr.matrix[i][j];
      if (Math.abs(v) > 0.7)
        insights.push(`🔗 Correlação forte entre "${corr.columns[i]}" e "${corr.columns[j]}": ${v}.`);
    }
  }
  return insights;
}

// ============ Recomendações de decisão ============
export function decisionRecommendations(rows: Row[]): string[] {
  const recs: string[] = [];
  const profiles = profileAll(rows);
  const numeric = profiles.filter((p) => p.type === "number");
  if (numeric.length === 0) {
    recs.push("Adicione colunas numéricas para análises quantitativas.");
    return recs;
  }
  for (const p of numeric) {
    if (p.mean !== undefined && p.median !== undefined) {
      if (Math.abs(p.mean - p.median) / (Math.abs(p.mean) + 1) > 0.2) {
        recs.push(`Distribuição assimétrica em "${p.name}" — use mediana como referência.`);
      }
    }
    if (p.outliers && p.outliers.length > rows.length * 0.05) {
      recs.push(`"${p.name}" tem muitos outliers — investigar causa antes de decidir.`);
    }
  }
  recs.push("Priorize métricas com correlação forte para otimização de processos.");
  recs.push("Automatize a coleta das colunas com maior taxa de missing.");
  return recs;
}

// ============ Export CSV ============
export function rowsToCSV(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadFile(name: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
