# DataFlow Intelligence

Plataforma de demonstração de um sistema completo de mapeamento, limpeza e análise de dados empresariais — construída como peça de portfólio em **React + TypeScript**.

🔗 **Demo ao vivo:** [benjaminreiis.github.io/DataFlow-Intelligence](https://benjaminreiis.github.io/DataFlow-Intelligence/)

## Visão geral

O projeto simula, ponta a ponta, o fluxo de trabalho de um analista/engenheiro de dados dentro de uma empresa: coleta de dados brutos, limpeza e padronização, análise estatística, geração de gráficos, identificação de padrões e tendências, apoio à tomada de decisão e otimização de processos — tudo rodando 100% no navegador, sem back-end e sem envio de dados a servidores.

## O que o sistema faz

- **Limpeza e organização de dados** — detecta e corrige valores ausentes, duplicatas, formatos inconsistentes e outliers (via IQR), com log detalhado de cada correção aplicada
- **Tratamento e padronização** — normalização de nomes, datas, categorias e status
- **Análise estatística** — média, mediana, desvio padrão, coeficiente de variação e matriz de correlação entre métricas de negócio
- **Geração de gráficos e relatórios** — receita vs. custo, distribuição por canal, novos clientes vs. churn, dispersão satisfação x receita, atualizados em tempo real
- **Identificação de padrões e tendências** — regressão linear sobre séries temporais e detecção de anomalias por z-score
- **Apoio à tomada de decisão** — motor de regras que cruza indicadores (margem, churn, satisfação, LTV/CAC) e gera recomendações priorizadas
- **Otimização de processos** — funil de conversão com identificação automática do maior gargalo
- **Geração de insights de negócio** — síntese executiva final combinando todas as etapas anteriores

A aplicação é organizada em abas interativas, e um botão de **simulação** regera o dataset e atualiza toda a análise em tempo real, para demonstrar que o pipeline é dinâmico e não uma tela estática.

## Stack

- **React + TypeScript**
- Roteamento baseado em arquivos (`src/routes/`)
- Sem dependência de back-end — todo o "motor de dados" roda no cliente

## Estrutura do projeto

```
src/
├── lib/
│   ├── data-analysis.ts   # motor: limpeza, estatística, correlação e geração de insights
│   └── sample-data.ts     # dataset de exemplo (dados simulados)
└── routes/
    └── index.tsx          # UI completa, organizada em abas
```

- **`data-analysis.ts`** concentra toda a lógica de negócio: funções puras de limpeza (remoção de duplicatas, tratamento de valores ausentes, detecção de outliers por IQR), estatística descritiva (média, mediana, desvio padrão, correlação) e regras de geração de insights e recomendações.
- **`sample-data.ts`** define o dataset simulado (receita, custos, clientes, churn, satisfação, funil de conversão) usado para alimentar toda a demonstração.
- **`routes/index.tsx`** consome o motor de análise e renderiza o dashboard, dividido em abas: Visão Geral, Limpeza de Dados, Análise Estatística, Gráficos & Relatórios, Padrões & Tendências, e Decisão & Otimização/Insights.

## Como rodar localmente

```bash
# instalar dependências
npm install

# ambiente de desenvolvimento
npm run dev

# build de produção
npm run build
```

## Deploy

O projeto é publicado via **GitHub Pages**, a partir do build estático gerado em `npm run build`.

```bash
npm run build
npm run deploy   # se configurado com gh-pages
```

## Por que este projeto

Este repositório foi construído como demonstração prática de um pipeline de dados completo — da ingestão de dados sujos até a geração de insights de negócio — reunindo em um único produto competências de limpeza e tratamento de dados, estatística aplicada, visualização e apoio à decisão orientado a dados.
