/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import DataUpload from "./components/DataUpload";
import Dashboard from "./components/Dashboard";
import { reconcileAndScore } from "./utils/scoring";
import { Rule, Score, ReconciledScore } from "./types";

export default function App() {
  const [currentTab, setCurrentTab] = useState("upload");
  const [reconciledData, setReconciledData] = useState<ReconciledScore[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("rfp_reconciled_data");
    const savedWarnings = localStorage.getItem("rfp_warnings");
    if (savedData) {
      setReconciledData(JSON.parse(savedData));
      setCurrentTab("dashboard");
    }
    if (savedWarnings) {
      setWarnings(JSON.parse(savedWarnings));
    }
  }, []);

  const handleDataLoaded = (rulesRaw: any[], scoresRaw: any[]) => {
    // Map raw CSV data to typed objects
    const rules: Rule[] = rulesRaw
      .map((r) => ({
        category: r["Category"] || r["category"],
        subCategory: r["Sub-Category"] || r["subCategory"],
        weight: parseFloat(r["Weight"] || r["weight"] || "0"),
        scoringType: (r["Scoring Type"] || r["scoringType"]) as
          | "Higher is Better"
          | "Lower is Better",
        maxScore: parseFloat(r["Max Score"] || r["maxScore"] || "10") || 10,
      }))
      .filter((r) => r.category && r.subCategory);

    const scores: Score[] = scoresRaw
      .map((s) => ({
        evaluator: s["Evaluator"] || s["evaluator"],
        supplier: s["Supplier"] || s["supplier"],
        category: s["Category"] || s["category"],
        subCategory: s["Sub-Category"] || s["subCategory"],
        rawScore: parseFloat(s["Raw Score"] || s["rawScore"] || "0"),
      }))
      .filter((s) => s.evaluator && s.supplier && s.category && s.subCategory);

    const { reconciled, warnings: newWarnings } = reconcileAndScore(
      rules,
      scores,
    );

    setReconciledData(reconciled);
    setWarnings(newWarnings);

    localStorage.setItem("rfp_reconciled_data", JSON.stringify(reconciled));
    localStorage.setItem("rfp_warnings", JSON.stringify(newWarnings));

    setCurrentTab("dashboard");
  };

  const handleReset = () => {
    setReconciledData([]);
    setWarnings([]);
    localStorage.removeItem("rfp_reconciled_data");
    localStorage.removeItem("rfp_warnings");
    setCurrentTab("upload");
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {currentTab === "upload" && (
            <DataUpload onDataLoaded={handleDataLoaded} onReset={handleReset} />
          )}

          {currentTab === "dashboard" &&
            (reconciledData.length > 0 ? (
              <Dashboard reconciledData={reconciledData} warnings={warnings} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                <p className="text-lg mb-4">No data loaded yet.</p>
                <button
                  onClick={() => setCurrentTab("upload")}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Go to Data Upload
                </button>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
