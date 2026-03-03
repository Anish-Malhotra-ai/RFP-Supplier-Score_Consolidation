import React, { useState } from "react";
import Papa from "papaparse";
import {
  UploadCloud,
  File,
  AlertCircle,
  CheckCircle2,
  Play,
  Trash2,
} from "lucide-react";
import { exampleRules, exampleScores } from "../utils/exampleData";

export default function DataUpload({
  onDataLoaded,
  onReset,
}: {
  onDataLoaded: (rules: any[], scores: any[]) => void;
  onReset: () => void;
}) {
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [scoresFile, setScoresFile] = useState<File | null>(null);
  const [rulesData, setRulesData] = useState<any[] | null>(null);
  const [scoresData, setScoresData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "rules" | "scores",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "rules") setRulesFile(file);
    else setScoresFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (type === "rules") setRulesData(results.data);
        else setScoresData(results.data);
      },
      error: (err) => {
        setError(`Error parsing ${type} file: ${err.message}`);
      },
    });
  };

  const handleProcess = () => {
    if (rulesData && scoresData) {
      onDataLoaded(rulesData, scoresData);
    } else {
      setError("Please upload both files before processing.");
    }
  };

  const loadDemo = () => {
    const parsedRules = Papa.parse(exampleRules, {
      header: true,
      skipEmptyLines: true,
    }).data;
    const parsedScores = Papa.parse(exampleScores, {
      header: true,
      skipEmptyLines: true,
    }).data;
    setRulesData(parsedRules);
    setScoresData(parsedScores);
    setRulesFile(
      new File([exampleRules], "example_rules.csv", { type: "text/csv" }),
    );
    setScoresFile(
      new File([exampleScores], "example_scores.csv", { type: "text/csv" }),
    );
    onDataLoaded(parsedRules, parsedScores);
  };

  const downloadTemplate = (type: "rules" | "scores") => {
    const content = type === "rules" ? exampleRules : exampleScores;
    const filename =
      type === "rules"
        ? "rules_engine_template.csv"
        : "scoring_sheet_template.csv";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Data Upload & Processing
          </h2>
          <p className="text-slate-500 mt-1">
            Upload your Rules Engine and Scoring Sheet CSVs to begin.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadDemo}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium"
          >
            <Play className="w-4 h-4" />
            <span>Load Demo Data</span>
          </button>
          <button
            onClick={() => {
              setRulesFile(null);
              setScoresFile(null);
              setRulesData(null);
              setScoresData(null);
              setError(null);
              onReset();
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset All</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rules Engine Upload */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative group">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileUpload(e, "rules")}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          {rulesFile ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">
                {rulesFile.name}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {rulesData?.length || 0} rules loaded
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Rules Engine CSV
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                Drag and drop or click to upload your scoring rules and weights.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadTemplate("rules");
                }}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium z-20 relative"
              >
                Download Template
              </button>
            </>
          )}
        </div>

        {/* Scoring Sheet Upload */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative group">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileUpload(e, "scores")}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          {scoresFile ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">
                {scoresFile.name}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {scoresData?.length || 0} scores loaded
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <File className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Scoring Sheet CSV
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                Drag and drop or click to upload the raw evaluator scores.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadTemplate("scores");
                }}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium z-20 relative"
              >
                Download Template
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleProcess}
          disabled={!rulesData || !scoresData}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Process & Reconcile Data
        </button>
      </div>
    </div>
  );
}
