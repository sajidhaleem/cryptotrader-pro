"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  label: string;
  isTestnet: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [form, setForm] = useState({ label: "My Binance Key", apiKey: "", secretKey: "", isTestnet: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchKeys() {
    const res = await fetch("/api/keys");
    if (res.ok) {
      const d = await res.json();
      setKeys(d.keys ?? []);
    }
  }

  useEffect(() => { fetchKeys(); }, []);

  async function addKey() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg({ type: "success", text: "API key added successfully!" });
      setShowAddKey(false);
      setForm({ label: "My Binance Key", apiKey: "", secretKey: "", isTestnet: false });
      fetchKeys();
    } else {
      setMsg({ type: "error", text: d.error ?? "Failed to add key" });
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    fetchKeys();
  }

  const plans = [
    { name: "Free", price: "$0/mo", features: ["Paper trading", "5 pairs signals", "1 bot"], current: true, color: "border-[#1e2130]" },
    { name: "Pro", price: "$29/mo", features: ["Live trading", "50+ signals", "Unlimited bots", "Advanced analytics"], current: false, color: "border-[#7c3aed]" },
    { name: "Enterprise", price: "$99/mo", features: ["Everything in Pro", "Multi-account", "API access", "Custom strategies"], current: false, color: "border-[#00ff88]" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[#64748b] text-sm mt-1">Manage your account, API keys, and subscription</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm ${msg.type === "success" ? "bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {/* Binance API Keys */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-white">Binance API Keys</h2>
            <p className="text-xs text-[#64748b] mt-1">Your keys are AES-256 encrypted at rest</p>
          </div>
          <button
            onClick={() => setShowAddKey(!showAddKey)}
            className="px-4 py-2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded-xl text-sm font-medium hover:bg-[#00ff88]/20 transition-colors"
          >
            + Add Key
          </button>
        </div>

        {showAddKey && (
          <div className="mb-5 p-5 bg-[#1a1f2e] rounded-xl border border-[#1e2130] space-y-4">
            <h3 className="text-sm font-medium text-white">Add New API Key</h3>

            <div className="p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-lg text-xs text-yellow-300 space-y-1">
              <p className="font-semibold">⚠️ Security tips:</p>
              <p>• Enable IP restriction to your server IP in Binance</p>
              <p>• Only grant &quot;Spot Trading&quot; permission — never withdrawal</p>
              <p>• Use testnet keys to test before going live</p>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Label</label>
                <input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#0f1117] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
              </div>
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="vmPUZE6mv9SD5VNHk4HlbWithBinanceKey..."
                  className="w-full px-4 py-3 bg-[#0f1117] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50 font-mono placeholder-[#475569]"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Secret Key</label>
                <input
                  type="password"
                  value={form.secretKey}
                  onChange={(e) => setForm(f => ({ ...f, secretKey: e.target.value }))}
                  placeholder="NhqptiLzn6RvBinanceSecretKey..."
                  className="w-full px-4 py-3 bg-[#0f1117] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50 font-mono placeholder-[#475569]"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="testnet"
                  checked={form.isTestnet}
                  onChange={(e) => setForm(f => ({ ...f, isTestnet: e.target.checked }))}
                  className="w-4 h-4 accent-[#00ff88]"
                />
                <label htmlFor="testnet" className="text-sm text-[#94a3b8]">
                  Use Binance Testnet (safe for testing)
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={addKey} disabled={saving || !form.apiKey || !form.secretKey}
                className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl text-sm hover:bg-[#00cc6a] transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save Key"}
              </button>
              <button onClick={() => setShowAddKey(false)} className="px-5 py-2.5 border border-[#1e2130] text-[#64748b] rounded-xl text-sm hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="text-center py-8 text-[#64748b] text-sm">
            No API keys added yet. Add your Binance API key to enable live trading.
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center gap-4 p-4 bg-[#1a1f2e] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 flex items-center justify-center text-sm">🔑</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{key.label}</p>
                  <p className="text-xs text-[#64748b]">
                    {key.isTestnet ? "Testnet" : "Live"} • Added {new Date(key.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${key.isActive ? "bg-[#00ff88]/10 text-[#00ff88]" : "bg-[#1e2130] text-[#64748b]"}`}>
                  {key.isActive ? "Active" : "Inactive"}
                </span>
                <button onClick={() => deleteKey(key.id)} className="text-xs text-[#64748b] hover:text-red-400 transition-colors">🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-5">Subscription Plan</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`p-5 rounded-xl border-2 ${plan.color} ${plan.current ? "bg-[#1a1f2e]" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white">{plan.name}</h3>
                {plan.current && <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-xl font-bold text-white mb-3">{plan.price}</p>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-[#64748b] flex items-start gap-1.5">
                    <span className="text-[#00ff88] mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              {!plan.current && (
                <button className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${plan.name === "Pro" ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9]" : "bg-[#00ff88] text-black hover:bg-[#00cc6a]"}`}>
                  Upgrade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Paper Trading */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-2">Paper Trading</h2>
        <p className="text-sm text-[#64748b] mb-4">Reset your virtual balance back to $10,000 to start fresh.</p>
        <button
          onClick={async () => {
            if (confirm("Reset paper balance to $10,000? All paper trades will be cleared.")) {
              await fetch("/api/paper-trade/reset", { method: "POST" });
              setMsg({ type: "success", text: "Paper balance reset to $10,000" });
            }
          }}
          className="px-5 py-2.5 border border-[#ef4444]/30 text-red-400 rounded-xl text-sm hover:bg-red-400/5 transition-colors"
        >
          Reset Paper Balance
        </button>
      </div>
    </div>
  );
}
