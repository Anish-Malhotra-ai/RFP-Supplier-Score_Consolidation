import React, { useMemo, useState, useRef } from "react";
import { ReconciledScore } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  LabelList,
} from "recharts";
import {
  Download,
  AlertTriangle,
  ChevronRight,
  X,
  Image as ImageIcon,
  FileSpreadsheet,
  Info,
  SlidersHorizontal,
  Lightbulb,
  LayoutTemplate
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";

interface DashboardProps {
  reconciledData: ReconciledScore[];
  warnings: string[];
}

const InfoTooltip = ({ content }: { content: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      <Info className="w-4 h-4 text-slate-400 hover:text-indigo-500 cursor-pointer ml-2" />
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

const CustomScatterLabel = (props: any) => {
  const { x, y, value, index } = props;
  // Alternate positions to avoid overlap
  const positions = [
    { dx: 0, dy: -15 }, // top
    { dx: 0, dy: 20 },  // bottom
    { dx: 15, dy: 0 },  // right
    { dx: -15, dy: 0 }, // left
  ];
  const pos = positions[index % positions.length];
  
  return (
    <text 
      x={x} 
      y={y} 
      dx={pos.dx} 
      dy={pos.dy} 
      fill="#0f172a" 
      fontSize={11} 
      fontWeight={600} 
      textAnchor={pos.dx > 0 ? "start" : pos.dx < 0 ? "end" : "middle"}
      dominantBaseline={pos.dy > 0 ? "hanging" : pos.dy < 0 ? "bottom" : "central"}
    >
      {value}
    </text>
  );
};

export default function Dashboard({
  reconciledData,
  warnings,
}: DashboardProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showScenarioModeler, setShowScenarioModeler] = useState(false);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});
  const [labelLayout, setLabelLayout] = useState<"diagonal" | "two-tier">("diagonal");
  const comparisonChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);
  const biasChartRef = useRef<HTMLDivElement>(null);

  // Aggregations
  const supplierScores = useMemo(() => {
    const scoresBySupplier: Record<
      string,
      { total: number; categories: Record<string, number> }
    > = {};

    const supplierSubCatScores: Record<
      string,
      Record<string, Record<string, number[]>>
    > = {};

    reconciledData.forEach((row) => {
      if (!supplierSubCatScores[row.supplier])
        supplierSubCatScores[row.supplier] = {};
      if (!supplierSubCatScores[row.supplier][row.category])
        supplierSubCatScores[row.supplier][row.category] = {};
      if (!supplierSubCatScores[row.supplier][row.category][row.subCategory])
        supplierSubCatScores[row.supplier][row.category][row.subCategory] = [];

      supplierSubCatScores[row.supplier][row.category][row.subCategory].push(
        row.weightedScore,
      );
    });

    Object.keys(supplierSubCatScores).forEach((supplier) => {
      scoresBySupplier[supplier] = { total: 0, categories: {} };

      Object.keys(supplierSubCatScores[supplier]).forEach((category) => {
        let categoryTotal = 0;
        const weightMultiplier = categoryWeights[category] ?? 1;
        Object.keys(supplierSubCatScores[supplier][category]).forEach(
          (subCat) => {
            const scores = supplierSubCatScores[supplier][category][subCat];
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            categoryTotal += avgScore;
          },
        );

        scoresBySupplier[supplier].categories[category] = categoryTotal * weightMultiplier;
        scoresBySupplier[supplier].total += categoryTotal * weightMultiplier;
      });
    });

    return Object.entries(scoresBySupplier)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [reconciledData, categoryWeights]);

  const comparisonChartData = useMemo(() => {
    return supplierScores.map((s) => {
      const data: any = { name: s.name };
      
      // For two-tier layout, split the name into two lines if it contains a space
      if (labelLayout === "two-tier" && s.name.includes(" ")) {
        const parts = s.name.split(" ");
        data.nameLine1 = parts[0];
        data.nameLine2 = parts.slice(1).join(" ");
      } else {
        data.nameLine1 = s.name;
        data.nameLine2 = "";
      }

      Object.entries(s.categories).forEach(([cat, val]) => {
        data[cat] = Number((val as number).toFixed(2));
      });
      return data;
    });
  }, [supplierScores, labelLayout]);

  const scatterPlotData = useMemo(() => {
    return supplierScores.map((s) => {
      const techKey =
        Object.keys(s.categories).find((k) =>
          k.toLowerCase().includes("tech"),
        ) || "Technical";
      const commKey =
        Object.keys(s.categories).find((k) =>
          k.toLowerCase().includes("comm"),
        ) || "Commercial";

      return {
        name: s.name,
        technical: Number((s.categories[techKey] || 0).toFixed(2)),
        commercial: Number((s.categories[commKey] || 0).toFixed(2)),
        total: Number(s.total.toFixed(2)),
      };
    });
  }, [supplierScores]);

  const evaluatorBiasData = useMemo(() => {
    const evaluatorScores: Record<string, number[]> = {};
    reconciledData.forEach((row) => {
      if (!evaluatorScores[row.evaluator]) evaluatorScores[row.evaluator] = [];
      if (row.scoringType === "Higher is Better") {
        evaluatorScores[row.evaluator].push(row.rawScore / row.maxScore);
      }
    });

    return Object.entries(evaluatorScores).map(([name, scores]) => {
      const avg = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      return {
        name,
        averageNormalizedScore: Number((avg * 100).toFixed(1)),
      };
    });
  }, [reconciledData]);

  const insights = useMemo(() => {
    if (supplierScores.length === 0) return null;
    
    const topSupplier = supplierScores[0];
    const runnerUp = supplierScores.length > 1 ? supplierScores[1] : null;
    const scoreDiff = runnerUp ? (topSupplier.total - runnerUp.total).toFixed(1) : "0";
    
    // Find best value (highest tech + comm ratio, or just top right quadrant)
    let bestValue = scatterPlotData[0];
    let maxRatio = 0;
    scatterPlotData.forEach(s => {
      const ratio = s.technical + s.commercial; 
      if (ratio > maxRatio) {
        maxRatio = ratio;
        bestValue = s;
      }
    });

    const biasScores = evaluatorBiasData.map(d => d.averageNormalizedScore);
    const biasVariance = biasScores.length > 0 ? Math.max(...biasScores) - Math.min(...biasScores) : 0;
    const consensus = biasVariance < 15 ? "High Consensus" : "Low Consensus";

    let recommendationReason = "";
    if (topSupplier.name === bestValue?.name) {
      recommendationReason = "Highest total score and best price-to-quality ratio.";
    } else {
      recommendationReason = `Highest total score, though ${bestValue?.name} offers a better pure price-to-quality ratio.`;
    }

    return {
      topSupplier: topSupplier.name,
      runnerUp: runnerUp?.name,
      scoreDiff,
      bestValue: bestValue?.name,
      consensus,
      biasVariance: biasVariance.toFixed(1),
      recommendationReason
    };
  }, [supplierScores, scatterPlotData, evaluatorBiasData]);

  const drillDownData = useMemo(() => {
    if (!selectedSupplier) return [];
    
    const data = reconciledData
      .filter((d) => d.supplier === selectedSupplier)
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.subCategory.localeCompare(b.subCategory),
      );

    // Calculate subcategory stats
    const stats: Record<string, { min: number, max: number, sum: number, count: number }> = {};
    data.forEach(row => {
      const key = `${row.category}-${row.subCategory}`;
      if (!stats[key]) {
        stats[key] = { min: row.rawScore, max: row.rawScore, sum: 0, count: 0 };
      }
      stats[key].min = Math.min(stats[key].min, row.rawScore);
      stats[key].max = Math.max(stats[key].max, row.rawScore);
      stats[key].sum += row.rawScore;
      stats[key].count += 1;
    });

    return data.map(row => {
      const key = `${row.category}-${row.subCategory}`;
      const stat = stats[key];
      return {
        ...row,
        subCatAvg: stat.sum / stat.count,
        subCatMin: stat.min,
        subCatMax: stat.max
      };
    });
  }, [reconciledData, selectedSupplier]);

  const exportCSV = () => {
    const csv = Papa.unparse(reconciledData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "reconciled_scores.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Final Leaderboard
    const leaderboardData = supplierScores.map((s, i) => ({
      Rank: i + 1,
      Supplier: s.name,
      "Total Score": s.total.toFixed(2),
      ...Object.fromEntries(
        Object.entries(s.categories).map(([k, v]) => [
          k,
          (v as number).toFixed(2),
        ]),
      ),
    }));
    const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
    XLSX.utils.book_append_sheet(wb, wsLeaderboard, "Leaderboard");

    // Sheet 2: Reconciled Raw Data
    const wsRawData = XLSX.utils.json_to_sheet(reconciledData);
    XLSX.utils.book_append_sheet(wb, wsRawData, "All Reconciled Data");

    // Sheet 3: Evaluator Bias
    const wsBias = XLSX.utils.json_to_sheet(evaluatorBiasData);
    XLSX.utils.book_append_sheet(wb, wsBias, "Evaluator Bias");

    XLSX.writeFile(wb, "RFP_Evaluation_Results.xlsx");
  };

  const exportChartToPNG = async (
    chartRef: React.RefObject<HTMLDivElement | null>,
    filename: string,
  ) => {
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = image;
      link.click();
    }
  };

  const colors = [
    "#4f46e5",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];
  const categories = Array.from(new Set(reconciledData.map((d) => d.category)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Evaluation Dashboard
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowScenarioModeler(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Scenario Modeler</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center space-x-2 text-amber-800 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Reconciliation Warnings ({warnings.length})</span>
          </div>
          <ul className="list-disc list-inside text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Insights */}
      {insights && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-md">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-300" />
            Automated Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
              <p className="text-indigo-100 text-sm font-medium mb-1">Recommended Supplier</p>
              <p className="text-xl font-bold">{insights.topSupplier}</p>
              <p className="text-xs text-indigo-100 mt-2 font-medium">
                {insights.recommendationReason}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
              <p className="text-indigo-100 text-sm font-medium mb-1">Best Value (Price/Quality)</p>
              <p className="text-xl font-bold">{insights.bestValue}</p>
              <p className="text-xs text-indigo-100 mt-2 font-medium">
                Highest combined Technical & Commercial score.
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
              <p className="text-indigo-100 text-sm font-medium mb-1">Evaluator Alignment</p>
              <p className="text-xl font-bold">{insights.consensus}</p>
              <p className="text-sm text-indigo-100 mt-2">
                {insights.biasVariance}% variance in scoring bias
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Leaderboard
            </h3>
            <InfoTooltip content="The final ranked list of suppliers based on their total weighted scores across all categories. Click a supplier to see a detailed breakdown." />
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2">
            {supplierScores.map((supplier, index) => (
              <div
                key={supplier.name}
                onClick={() => setSelectedSupplier(supplier.name)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  index === 0
                    ? "bg-indigo-50 border-indigo-200"
                    : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="font-semibold text-slate-900">
                    {supplier.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-indigo-600">
                    {supplier.total.toFixed(1)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold text-slate-900">
                Score Breakdown by Category
              </h3>
              <InfoTooltip content="A stacked bar chart showing how each supplier's total score is distributed across different categories (e.g., Technical, Commercial). This helps identify strengths and weaknesses." />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLabelLayout(prev => prev === "diagonal" ? "two-tier" : "diagonal")}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                title="Toggle Label Layout"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>{labelLayout === "diagonal" ? "Two-Tier Labels" : "Diagonal Labels"}</span>
              </button>
              <button
                onClick={() =>
                  exportChartToPNG(comparisonChartRef, "Score_Breakdown")
                }
                className="text-slate-500 hover:text-indigo-600 transition-colors"
                title="Download Chart"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="h-80" ref={comparisonChartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={labelLayout === "diagonal" ? 80 : 50}
                  tickMargin={10}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    if (labelLayout === "diagonal") {
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={16} textAnchor="end" fill="#475569" fontSize={11} fontWeight={500} transform="rotate(-35)">
                            {payload.value}
                          </text>
                        </g>
                      );
                    } else {
                      // Two-tier layout
                      const dataItem = comparisonChartData.find(d => d.name === payload.value);
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={16} textAnchor="middle" fill="#475569" fontSize={11} fontWeight={500}>
                            <tspan x="0" dy="0">{dataItem?.nameLine1}</tspan>
                            {dataItem?.nameLine2 && <tspan x="0" dy="14">{dataItem.nameLine2}</tspan>}
                          </text>
                        </g>
                      );
                    }
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <RechartsTooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#0f172a",
                    fontWeight: 500,
                  }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                {categories.map((cat, i) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="a"
                    fill={colors[i % colors.length]}
                    radius={
                      i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                    }
                  >
                    <LabelList
                      dataKey={cat}
                      position="center"
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight={600}
                      formatter={(v: number) => (v > 2 ? v.toFixed(1) : "")}
                    />
                    {i === categories.length - 1 && (
                      <LabelList
                        dataKey="total"
                        position="top"
                        fill="#0f172a"
                        fontSize={12}
                        fontWeight={600}
                        formatter={(v: number) => (v ? v.toFixed(1) : "")}
                      />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price-to-Quality Scatter Plot */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  Price-to-Quality Matrix
                </h3>
                <InfoTooltip content="A scatter plot mapping Technical Score (Quality) against Commercial Score (Price). Since Commercial Score is normalized (Higher is Better), the Top-Right quadrant represents the Best Value (High Quality, Low Price)." />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Top-Right quadrant represents Best Value (High Tech, High Comm
                Score = Low Price).
              </p>
            </div>
            <button
              onClick={() =>
                exportChartToPNG(scatterChartRef, "Price_Quality_Matrix")
              }
              className="text-slate-500 hover:text-indigo-600 transition-colors"
              title="Download Chart"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80" ref={scatterChartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="technical"
                  name="Technical Score"
                  domain={["dataMin - 5", "dataMax + 5"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  label={{
                    value: "Technical Score (Higher is Better)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="commercial"
                  name="Commercial Score"
                  domain={["dataMin - 5", "dataMax + 5"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  label={{
                    value: "Commercial Score (Higher is Better)",
                    angle: -90,
                    position: "insideLeft",
                    offset: -10,
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                />
                <ZAxis type="number" range={[150, 150]} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
                          <p className="font-bold text-slate-900">
                            {data.name}
                          </p>
                          <p className="text-sm text-slate-600 font-medium">
                            Tech Score: {data.technical}
                          </p>
                          <p className="text-sm text-slate-600 font-medium">
                            Comm Score: {data.commercial}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Suppliers" data={scatterPlotData} fill="#4f46e5">
                  <LabelList
                    dataKey="name"
                    content={<CustomScatterLabel />}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evaluator Bias */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  Evaluator Bias Detection
                </h3>
                <InfoTooltip content="Evaluator Bias shows if someone is a 'harsh' or 'lenient' grader. It calculates the average score each evaluator gave across all suppliers. If Alice's average is 60% and Bob's is 80%, Alice is grading much harsher than Bob. This helps identify if a supplier won just because they got the 'easy' grader." />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Average normalized score given by each evaluator (Higher is
                Better categories).
              </p>
            </div>
            <button
              onClick={() => exportChartToPNG(biasChartRef, "Evaluator_Bias")}
              className="text-slate-500 hover:text-indigo-600 transition-colors"
              title="Download Chart"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80" ref={biasChartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={evaluatorBiasData}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#0f172a", fontSize: 12, fontWeight: 500 }}
                  width={100}
                />
                <RechartsTooltip
                  cursor={{ fill: "#f8fafc" }}
                  formatter={(value: number) => [`${value}%`, "Avg Score"]}
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#0f172a",
                    fontWeight: 500,
                  }}
                />
                <Bar
                  dataKey="averageNormalizedScore"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                >
                  <LabelList
                    dataKey="averageNormalizedScore"
                    position="right"
                    formatter={(val: number) => `${val}%`}
                    fill="#0f172a"
                    fontSize={12}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scenario Modeler Modal */}
      {showScenarioModeler && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Scenario Modeler
                </h3>
                <p className="text-sm text-slate-500">
                  Adjust category weights to see how it impacts the final ranking. Categories are dynamically extracted from your uploaded data.
                </p>
              </div>
              <button
                onClick={() => setShowScenarioModeler(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {categories.map((cat) => (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700">
                      {cat} Weight Multiplier
                    </label>
                    <span className="text-sm font-bold text-indigo-600">
                      {(categoryWeights[cat] ?? 1).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={categoryWeights[cat] ?? 1}
                    onChange={(e) =>
                      setCategoryWeights((prev) => ({
                        ...prev,
                        [cat]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              ))}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setCategoryWeights({})}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedSupplier} - Score Drill-Down
                </h3>
                <p className="text-sm text-slate-500">
                  Detailed breakdown of all evaluator scores.
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 font-semibold">Evaluator</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Sub-Category</th>
                    <th className="pb-3 font-semibold">Raw Score</th>
                    <th className="pb-3 font-semibold">Sub-Cat Stats</th>
                    <th className="pb-3 font-semibold">Weight</th>
                    <th className="pb-3 font-semibold text-right">
                      Weighted Score
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {drillDownData.map((row, i) => {
                    const isNewSubCat = i === 0 || drillDownData[i-1].subCategory !== row.subCategory;
                    
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${isNewSubCat ? 'border-t-2 border-t-slate-100' : ''}`}
                      >
                        <td className="py-3 font-medium text-slate-900">
                          {row.evaluator}
                        </td>
                        <td className="py-3 text-slate-600">{row.category}</td>
                        <td className="py-3 text-slate-600">
                          {row.subCategory}
                        </td>
                        <td className="py-3 text-slate-900 font-medium">
                          {row.scoringType === "Lower is Better"
                            ? `$${Number(row.rawScore).toLocaleString()}`
                            : row.rawScore}
                        </td>
                        <td className="py-3 text-xs text-slate-500">
                          {isNewSubCat && (
                            <div className="flex flex-col space-y-0.5">
                              <span className="text-indigo-600 font-medium">Avg: {row.subCatAvg.toFixed(1)}</span>
                              <span>Min: {row.subCatMin} | Max: {row.subCatMax}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-600">{row.weight}</td>
                        <td className="py-3 font-semibold text-indigo-600 text-right">
                          {row.weightedScore.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
