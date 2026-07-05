import type { Row } from "./data-analysis";

export function sampleSalesData(): Row[] {
  const regions = ["Norte", "Sul", "Sudeste", "Nordeste", "Centro-Oeste"];
  const products = ["Produto A", "Produto B", "Produto C", "Produto D"];
  const rows: Row[] = [];
  for (let i = 0; i < 120; i++) {
    const month = (i % 12) + 1;
    const year = 2024 + Math.floor(i / 12);
    rows.push({
      data: `${year}-${String(month).padStart(2, "0")}-15`,
      regiao: regions[i % regions.length],
      produto: products[i % products.length],
      vendas: Math.round(1000 + Math.random() * 5000 + i * 20),
      custo: Math.round(500 + Math.random() * 2000),
      clientes: Math.round(10 + Math.random() * 100),
      satisfacao: Number((3 + Math.random() * 2).toFixed(1)),
    });
  }
  return rows;
}
