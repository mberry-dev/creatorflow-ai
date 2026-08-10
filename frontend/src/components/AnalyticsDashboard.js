import React from 'react';

export default function AnalyticsDashboard({ savedAssets }) {
  // 📊 Compute Live Metrics from Saved Cloud Vault Assets
  const totalAssets = savedAssets.length;

  const categoryCounts = savedAssets.reduce((acc, asset) => {
    const cat = asset.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const titleCount = categoryCounts['Title'] || 0;
  const descriptionCount = categoryCounts['Description'] || 0;
  const hashtagCount = categoryCounts['Hashtags'] || 0;
  const seoCount = categoryCounts['SEO Keywords'] || 0;

  // Calculate platform percentages based on asset content inspection or category distributions
  const getPercentage = (count) => (totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* EXECUTIVE HEADER */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-sm">
        <h2 className="text-xl font-black text-white">Content Creation Analytics 📈</h2>
        <p className="text-xs text-gray-400 mt-1 font-mono">
          Real-time metrics calculated from your Cloud Vault assets.
        </p>
      </div>

      {/* TOP STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">Total Assets Saved</span>
          <span className="text-3xl font-black text-cyan-400 mt-2 block">{totalAssets}</span>
          <span className="text-xs text-gray-400 mt-1 block">In Cloud Vault</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">Titles Generated</span>
          <span className="text-3xl font-black text-emerald-400 mt-2 block">{titleCount}</span>
          <span className="text-xs text-gray-400 mt-1 block">{getPercentage(titleCount)}% of total assets</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">Descriptions Saved</span>
          <span className="text-3xl font-black text-indigo-400 mt-2 block">{descriptionCount}</span>
          <span className="text-xs text-gray-400 mt-1 block">{getPercentage(descriptionCount)}% of total assets</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">Hashtags & SEO Sets</span>
          <span className="text-3xl font-black text-amber-400 mt-2 block">{hashtagCount + seoCount}</span>
          <span className="text-xs text-gray-400 mt-1 block">{getPercentage(hashtagCount + seoCount)}% of total assets</span>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN PROGRESS METERS */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Vault Content Distribution
        </h3>

        <div className="space-y-4">
          {/* Titles Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-300">Titles</span>
              <span className="text-cyan-400">{titleCount} items ({getPercentage(titleCount)}%)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-cyan-400 h-full transition-all duration-500" style={{ width: `${getPercentage(titleCount)}%` }}></div>
            </div>
          </div>

          {/* Descriptions Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-300">Descriptions</span>
              <span className="text-indigo-400">{descriptionCount} items ({getPercentage(descriptionCount)}%)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-indigo-400 h-full transition-all duration-500" style={{ width: `${getPercentage(descriptionCount)}%` }}></div>
            </div>
          </div>

          {/* Hashtags Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-300">Hashtags</span>
              <span className="text-emerald-400">{hashtagCount} items ({getPercentage(hashtagCount)}%)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${getPercentage(hashtagCount)}%` }}></div>
            </div>
          </div>

          {/* SEO Keywords Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-300">SEO Targets</span>
              <span className="text-amber-400">{seoCount} items ({getPercentage(seoCount)}%)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${getPercentage(seoCount)}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}