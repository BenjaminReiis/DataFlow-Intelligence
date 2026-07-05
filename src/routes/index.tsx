import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  cleanData, correlationMatrix, decisionRecommendations, downloadFile,
  generateInsights, linearTrend, profileAll, rowsToCSV,
  type CleanOptions, type Row,
} from "@/lib/data-analysis";
import { sampleSalesData } from "@/lib/sample-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Database, Sparkles, TrendingUp, Download, Upload, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DataMap — Análise de Dados, Insights e Decisões" },
      {
        name: "description",
        content:
          "Sistema completo de mapeamento de dados: limpeza, estatísticas, gráficos, padrões, tendências e insights para tomada de decisão.",
      },
    ],
  }),
  component: DataMapApp,
});

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function DataMapApp() {
  const [rawData, setRawData] = useState<Row[]>([]);
  const [cleanedData, setCleanedData] = useState<Row[]>([]);
  const [cleanReport, setCleanReport] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const [opts, setOpts] = useState<CleanOptions>({
    removeDuplicates: true,
    trimStrings: true,
    fillMissingNumeric: "mean",
    fillMissingString: "unknown",
    removeOutliers: false,
    normalizeCase: "none",
  });

  const data = cleanedData.length > 0 ? cleanedData : rawData;
  const profiles = useMemo(() => profileAll(data), [data]);
  const numericCols = profiles.filter((p) => p.type === "number").map((p) => p.name);
  const categoricalCols = profiles.filter((p) => p.type === "string").map((p) => p.name);

  const [chartX, setChartX] = useState<string>("");
  const [chartY, setChartY] = useState<string>("");
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");

  const insights = useMemo(() => (data.length ? generateInsights(data) : []), [data]);
  const recs = useMemo(() => (data.length ? decisionRecommendations(data) : []), [data]);
  const corr = useMemo(
    () => (data.length ? correlationMatrix(data) : { columns: [], matrix: [] }),
    [data],
  );

  function handleFile(f: File) {
    setFileName(f.name);
    Papa.parse<Row>(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        setRawData(result.data as Row[]);
        setCleanedData([]);
        setCleanReport([]);
      },
    });
  }

  function loadSample() {
    setFileName("exemplo-vendas.csv");
    setRawData(sampleSalesData());
    setCleanedData([]);
    setCleanReport([]);
  }

  function runClean() {
    const { cleaned, report } = cleanData(rawData, opts);
    setCleanedData(cleaned);
    setCleanReport(report);
  }

  function exportCSV() {
    downloadFile(`${fileName || "dados"}-limpo.csv`, rowsToCSV(data), "text/csv");
  }

  function exportReport() {
    const lines: string[] = [];
    lines.push(`# Relatório de Análise — ${fileName || "dataset"}`);
    lines.push(`Registros: ${data.length}\nColunas: ${profiles.length}\n`);
    lines.push(`## Limpeza`);
    lines.push(...(cleanReport.length ? cleanReport : ["Nenhuma limpeza aplicada."]));
    lines.push(`\n## Perfil das Colunas`);
    for (const p of profiles) {
      lines.push(`\n### ${p.name} (${p.type})`);
      lines.push(`- Total: ${p.count} | Ausentes: ${p.missing} | Únicos: ${p.unique}`);
      if (p.type === "number") {
        lines.push(
          `- Min: ${p.min} | Max: ${p.max} | Média: ${p.mean?.toFixed(2)} | Mediana: ${p.median} | Desvio: ${p.stdDev?.toFixed(2)}`,
        );
        if (p.outliers) lines.push(`- Outliers: ${p.outliers.length}`);
      } else if (p.topValues) {
        lines.push(
          `- Top: ${p.topValues.slice(0, 5).map((v) => `${v.value}(${v.count})`).join(", ")}`,
        );
      }
    }
    lines.push(`\n## Insights`);
    lines.push(...insights.map((i) => `- ${i}`));
    lines.push(`\n## Recomendações`);
    lines.push(...recs.map((r) => `- ${r}`));
    downloadFile(`${fileName || "dados"}-relatorio.md`, lines.join("\n"), "text/markdown");
  }

  const chartData = useMemo(() => {
    if (!chartX || !chartY || data.length === 0) return [];
    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of data) {
      const k = String(r[chartX] ?? "—");
      const v = Number(r[chartY]);
      if (isNaN(v)) continue;
      const cur = agg.get(k) ?? { sum: 0, count: 0 };
      cur.sum += v;
      cur.count += 1;
      agg.set(k, cur);
    }
    return [...agg.entries()]
      .map(([name, { sum, count }]) => ({
        name,
        valor: Number(sum.toFixed(2)),
        media: Number((sum / count).toFixed(2)),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 20);
  }, [data, chartX, chartY]);

  const trend = useMemo(() => {
    if (!chartY) return null;
    const series = data.map((r) => Number(r[chartY])).filter((n) => !isNaN(n));
    return series.length > 1 ? linearTrend(series) : null;
  }, [data, chartY]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">DataMap</h1>
              <p className="text-xs text-muted-foreground">
                Mapeamento • Limpeza • Estatística • Insights
              </p>
            </div>
          </div>
          {data.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button size="sm" onClick={exportReport}>
                <Download className="mr-2 h-4 w-4" /> Relatório
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {data.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Carregar dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Faça upload de um arquivo CSV ou carregue um dataset de exemplo para começar.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button variant="secondary" onClick={loadSample}>
                  <Sparkles className="mr-2 h-4 w-4" /> Usar dataset de exemplo
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Visão</TabsTrigger>
              <TabsTrigger value="clean">Limpeza</TabsTrigger>
              <TabsTrigger value="stats">Estatística</TabsTrigger>
              <TabsTrigger value="charts">Gráficos</TabsTrigger>
              <TabsTrigger value="patterns">Padrões</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* VISÃO */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Registros" value={data.length} />
                <StatCard label="Colunas" value={profiles.length} />
                <StatCard label="Numéricas" value={numericCols.length} />
                <StatCard label="Categóricas" value={categoricalCols.length} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Amostra ({fileName})</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(data[0]).map((c) => (
                          <TableHead key={c}>{c}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          {Object.keys(data[0]).map((c) => (
                            <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LIMPEZA */}
            <TabsContent value="clean" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" /> Opções de limpeza & tratamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={opts.removeDuplicates}
                      onCheckedChange={(v) => setOpts({ ...opts, removeDuplicates: !!v })}
                    />
                    Remover duplicatas
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={opts.trimStrings}
                      onCheckedChange={(v) => setOpts({ ...opts, trimStrings: !!v })}
                    />
                    Trim de strings
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={opts.removeOutliers}
                      onCheckedChange={(v) => setOpts({ ...opts, removeOutliers: !!v })}
                    />
                    Remover outliers (IQR)
                  </label>
                  <div>
                    <Label>Preencher numéricos ausentes</Label>
                    <Select
                      value={opts.fillMissingNumeric}
                      onValueChange={(v) =>
                        setOpts({
                          ...opts,
                          fillMissingNumeric: v as CleanOptions["fillMissingNumeric"],
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="mean">Média</SelectItem>
                        <SelectItem value="median">Mediana</SelectItem>
                        <SelectItem value="zero">Zero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Preencher strings ausentes</Label>
                    <Select
                      value={opts.fillMissingString}
                      onValueChange={(v) =>
                        setOpts({
                          ...opts,
                          fillMissingString: v as CleanOptions["fillMissingString"],
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="empty">Vazio</SelectItem>
                        <SelectItem value="unknown">"unknown"</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Normalizar caixa</Label>
                    <Select
                      value={opts.normalizeCase}
                      onValueChange={(v) =>
                        setOpts({ ...opts, normalizeCase: v as CleanOptions["normalizeCase"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Manter</SelectItem>
                        <SelectItem value="lower">minúsculas</SelectItem>
                        <SelectItem value="upper">MAIÚSCULAS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={runClean}>Executar limpeza</Button>
                  </div>
                </CardContent>
              </Card>
              {cleanReport.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Relatório de limpeza</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {cleanReport.map((r, i) => (<li key={i}>• {r}</li>))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ESTATÍSTICA */}
            <TabsContent value="stats" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Perfil estatístico</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coluna</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ausentes</TableHead>
                        <TableHead>Únicos</TableHead>
                        <TableHead>Min</TableHead>
                        <TableHead>Max</TableHead>
                        <TableHead>Média</TableHead>
                        <TableHead>Mediana</TableHead>
                        <TableHead>Desvio</TableHead>
                        <TableHead>Outliers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell><Badge variant="secondary">{p.type}</Badge></TableCell>
                          <TableCell>{p.missing}</TableCell>
                          <TableCell>{p.unique}</TableCell>
                          <TableCell>{fmt(p.min)}</TableCell>
                          <TableCell>{fmt(p.max)}</TableCell>
                          <TableCell>{fmt(p.mean)}</TableCell>
                          <TableCell>{fmt(p.median)}</TableCell>
                          <TableCell>{fmt(p.stdDev)}</TableCell>
                          <TableCell>{p.outliers?.length ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* GRÁFICOS */}
            <TabsContent value="charts" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Configurar gráfico</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Categoria (X)</Label>
                    <Select value={chartX} onValueChange={setChartX}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {[...categoricalCols, ...numericCols].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor (Y numérico)</Label>
                    <Select value={chartY} onValueChange={setChartY}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {numericCols.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={chartType}
                      onValueChange={(v) => setChartType(v as "bar" | "line" | "pie")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Barras</SelectItem>
                        <SelectItem value="line">Linha</SelectItem>
                        <SelectItem value="pie">Pizza</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {chartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>{chartY} por {chartX}</CardTitle></CardHeader>
                  <CardContent style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="valor" fill={COLORS[0]} />
                        </BarChart>
                      ) : chartType === "line" ? (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="valor" stroke={COLORS[0]} strokeWidth={2} />
                          <Line type="monotone" dataKey="media" stroke={COLORS[1]} strokeWidth={2} />
                        </LineChart>
                      ) : (
                        <PieChart>
                          <Tooltip />
                          <Legend />
                          <Pie data={chartData} dataKey="valor" nameKey="name" outerRadius={140} label>
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {trend && chartY && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" /> Tendência em {chartY}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <Badge>Direção: {trend.direction}</Badge>
                      <Badge variant="secondary">Inclinação: {trend.slope.toFixed(4)}</Badge>
                      <Badge variant="secondary">R²: {trend.r2.toFixed(3)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* PADRÕES / CORRELAÇÕES */}
            <TabsContent value="patterns" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Matriz de correlação (Pearson)</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  {corr.columns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem colunas numéricas suficientes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead></TableHead>
                          {corr.columns.map((c) => (<TableHead key={c}>{c}</TableHead>))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {corr.matrix.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{corr.columns[i]}</TableCell>
                            {row.map((v, j) => (
                              <TableCell
                                key={j}
                                style={{
                                  background: `oklch(0.9 ${Math.abs(v) * 0.15} ${v > 0 ? 150 : 20} / ${Math.abs(v)})`,
                                }}
                              >
                                {v.toFixed(2)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* INSIGHTS */}
            <TabsContent value="insights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" /> Insights de negócio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {insights.map((i, idx) => (
                      <li key={idx} className="rounded-md border bg-card p-3">{i}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recomendações para tomada de decisão</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {recs.map((r, idx) => (
                      <li key={idx} className="rounded-md border bg-card p-3">✅ {r}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function fmt(v: number | undefined) {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
