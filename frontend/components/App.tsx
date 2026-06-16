"use client";
/* Arc Pettycash — petty cash with limits. Layout NGANG theo ảnh 28 ("Welcome back" dashboard,
   nav pill ngang, cột trái stat cards, cột phải bar chart tím/vàng). GIỮ tab cũ + Top up. Self-contained.
   ABI preserved: createRun(name)/addRecipient(id,to,amount)/fundAndPay(id)payable/get/count/total. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "createRun", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "addRecipient", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "fundAndPay", type: "function", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "name", type: "string" }, { name: "totalAmt", type: "uint256" }, { name: "paid", type: "bool" }, { name: "at", type: "uint256" }] }] },
  { name: "count", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BARS = [[80, 20], [100, 30], [64, 16], [110, 34], [86, 22], [116, 38], [92, 24], [72, 18], [104, 32], [88, 22], [114, 36]];
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.pc{--bg:#0a0a0f;--card:#16151f;--card2:#1f1e2a;--bd:#232231;--bd2:#34323f;--mut:#8a879a;--txt:#efeef5;--acc:#a78bfa;--acc2:#c4b5fd;--amb:#fbbf24;min-height:100vh;background:#07070b;color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif;padding:16px}
.pc *{box-sizing:border-box}.pc a{color:var(--acc2);text-decoration:none}.pc .mono{font-family:ui-monospace,monospace}
.pc .shell{max-width:1080px;margin:0 auto;background:var(--bg);border:1px solid #1c1b24;border-radius:22px;padding:18px 20px 26px}
.pc .bar{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.pc .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px}
.pc .mark{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#a78bfa,#fbbf24);display:grid;place-items:center;font-size:14px}
.pc .tabs{display:flex;gap:4px;background:#141320;border:1px solid var(--bd);border-radius:11px;padding:4px}
.pc .tab{border:0;background:none;color:var(--mut);font:inherit;font-weight:600;font-size:13px;padding:7px 16px;border-radius:8px;cursor:pointer}.pc .tab.on{background:#efeef5;color:#15131f;font-weight:700}
.pc .btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;padding:8px 15px;transition:.15s}.pc .btn:disabled{opacity:.5;cursor:not-allowed}
.pc .pri{background:var(--acc);color:#1a0f33}.pc .pri:hover:not(:disabled){background:var(--acc2)}.pc .gho{background:var(--card2);color:var(--txt);border:1px solid var(--bd2)}.pc .red{background:#dc2626;color:#fff}
.pc .acct{background:#141320;border:1px solid var(--bd);border-radius:99px;padding:6px 14px;font-size:12.5px;color:#c9c7d6}
.pc .hero{margin-bottom:16px}.pc .hero .s{font-size:12px;color:var(--mut)}.pc .hero .h{font-size:28px;font-weight:800;margin-top:2px}
.pc .grid{display:grid;grid-template-columns:0.95fr 1.4fr;gap:14px;align-items:start}
.pc .col{display:flex;flex-direction:column;gap:12px}
.pc .c{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px}
.pc .l{font-size:12px;color:var(--mut)}.pc .v{font-size:30px;font-weight:800;margin-top:6px}
.pc .plus{width:24px;height:24px;border-radius:7px;background:var(--card2);display:grid;place-items:center;color:var(--acc)}
.pc .ex{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px solid #201f2b}.pc .ex:last-child{border-bottom:0}
.pc .run{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px;margin-bottom:10px}
.pc label{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 5px}
.pc input{width:100%;background:#0f0e17;border:1px solid var(--bd2);border-radius:9px;padding:10px 12px;font:inherit;font-size:14px;color:var(--txt);outline:none}.pc input:focus{border-color:var(--acc)}
.pc .seg{display:flex;gap:4px;background:#0f0e17;border:1px solid var(--bd);border-radius:9px;padding:3px}
.pc .seg span{font-size:11px;color:var(--mut);padding:4px 9px;border-radius:6px}.pc .seg span.on{background:var(--acc);color:#15131f;font-weight:700}
.pc .menu{position:absolute;right:0;top:116%;background:var(--card2);border:1px solid var(--bd2);border-radius:10px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.pc .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:7px;cursor:pointer}.pc .menu button:hover{background:rgba(255,255,255,.05)}
@media(max-width:820px){.pc .grid{grid-template-columns:1fr}.pc .tabs{flex-wrap:wrap}}
`;
function Run({ id, me, busy, write }: { id: bigint; me?: string; busy: boolean; write: (fn: string, args: any[], v?: bigint) => void }) {
  const { data: r } = useReadContract({ address: C, abi: ABI, functionName: "get", args: [id] });
  const { data: cnt } = useReadContract({ address: C, abi: ABI, functionName: "count", args: [id] });
  const [rec, setRec] = useState({ to: "", amount: "" });
  if (!r) return null; const x = r as any; const mine = me?.toLowerCase() === x.owner.toLowerCase();
  return (
    <div className="run">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(167,139,250,.16)", display: "grid", placeItems: "center", fontSize: 17 }}>💵</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{x.name || `Float #${id}`}</div><div className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>${usd(x.totalAmt)} · {cnt?.toString() ?? "0"} expenses · {cut(x.owner)}</div></div>
        {x.paid && <span style={{ fontSize: 11, color: "#4ade80" }}>Settled ✓</span>}
      </div>
      {mine && !x.paid && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}><input value={rec.to} onChange={e => setRec(s => ({ ...s, to: e.target.value }))} placeholder="holder 0x…" style={{ flex: 1, fontFamily: "ui-monospace", fontSize: 12.5 }} /><input value={rec.amount} onChange={e => setRec(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="amt" style={{ width: 90 }} /><button className="btn gho" disabled={busy || !isAddress(rec.to) || !(Number(rec.amount) > 0)} onClick={() => write("addRecipient", [id, rec.to as `0x${string}`, parseEther(rec.amount || "0")])}>Add</button></div>
        <button className="btn pri" disabled={busy || x.totalAmt === 0n} onClick={() => write("fundAndPay", [id], x.totalAmt)}>{busy ? "…" : `Fund & settle $${usd(x.totalAmt)}`}</button>
      </div>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"overview" | "floats" | "new" | "topup">("overview");
  const [nm, setNm] = useState(""); const [tu, setTu] = useState({ to: "", amount: "" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const send = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: send.data, query: { enabled: !!send.data } });
  const busy = tx.isPending || rcpt.isLoading; const sbusy = send.isPending || srcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setNm(""); total.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { send.reset(); setTu({ to: "", amount: "" }); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const write = (fn: string, args: any[], v?: bigint) => tx.writeContract({ address: C, abi: ABI, functionName: fn as any, args, value: v });
  const tabs: [typeof tab, string][] = [["overview", "Dashboard"], ["floats", "Floats"], ["new", "Open"], ["topup", "Reload"]];
  return (
    <div className="pc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="shell">
        <div className="bar">
          <div className="logo"><span className="mark">💵</span>Pettycash</div>
          <div className="tabs" style={{ marginLeft: 8 }}>{tabs.map(([t, l]) => <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>)}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            {wrong && <button className="btn red" onClick={toArc}>Switch to Arc</button>}
            {isConnected && <span className="acct">{cut(address)}</span>}
            <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? "Account" : "Connect"}</button>
              {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#f87171" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
          </div>
        </div>
        <div className="hero"><div className="s">Petty cash for smart teams</div><div className="h">Welcome back <span style={{ color: "var(--mut)" }}>{isConnected ? cut(address) : "team"}</span></div></div>
        {tab === "overview" && <div className="grid">
          <div className="col">
            <div className="c"><div style={{ display: "flex", justifyContent: "space-between" }}><span className="l">Active floats</span><span className="plus">+</span></div><div className="v">{n}<span style={{ fontSize: 13, color: "var(--mut)", fontWeight: 600 }}> open</span></div></div>
            <div style={{ display: "flex", gap: 12 }}>
              <div className="c" style={{ flex: 1 }}><div className="l">Spend rate</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "var(--amb)" }}>34%</div></div>
              <div className="c" style={{ flex: 1 }}><div className="l">Per-tx cap</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>$200</div></div>
            </div>
            <div className="c">
              <div className="l" style={{ marginBottom: 6 }}>Recent expenses</div>
              <div className="ex">☕ Coffee — @an<span style={{ fontWeight: 700 }}>−$28</span></div>
              <div className="ex">🚕 Taxi — @leo<span style={{ fontWeight: 700 }}>−$15</span></div>
              <div className="ex">📦 Supplies — @maya<span style={{ fontWeight: 700 }}>−$120</span></div>
            </div>
          </div>
          <div className="c">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div><div className="l">Spend snapshot</div><div style={{ fontSize: 24, fontWeight: 800 }}>$28,165</div></div>
              <div className="seg"><span className="on">M</span><span>Q</span><span>Y</span></div>
            </div>
            <svg viewBox="0 0 460 170" style={{ width: "100%", height: 190 }}>
              {BARS.map((b, i) => { const x = 12 + i * 41; return <g key={i}><rect x={x} y={156 - b[0]} width="26" height={b[0]} rx="5" fill="#a78bfa" /><rect x={x} y={156 - b[1]} width="26" height={b[1]} rx="5" fill="#fbbf24" /></g>; })}
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--mut)", marginTop: 4 }}><span><span style={{ color: "var(--acc)" }}>●</span> budget</span><span><span style={{ color: "var(--amb)" }}>●</span> spent</span></div>
          </div>
        </div>}
        {tab === "floats" && <div>{n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <Run key={id.toString()} id={id} me={address} busy={busy} write={write} />) : <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No floats yet — create one 💵</div>}</div>}
        {tab === "new" && <div className="c" style={{ maxWidth: 440 }}>
          <label>Float name</label><input value={nm} onChange={e => setNm(e.target.value)} placeholder="e.g. Office June" />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !nm} onClick={() => write("createRun", [nm])}>{busy ? "…" : "Create float 💵"}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", textAlign: "center", marginTop: 8 }}>Open it under Floats to add expenses and settle.</div>
        </div>}
        {tab === "topup" && <div className="c" style={{ maxWidth: 440 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Top up petty cash</div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Send USDC to a card holder's wallet on Arc.</div>
          <label>Holder address</label><input value={tu.to} onChange={e => setTu(s => ({ ...s, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label>Amount (USDC)</label><input value={tu.amount} onChange={e => setTu(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || sbusy || !isAddress(tu.to) || !(Number(tu.amount) > 0)} onClick={() => send.sendTransaction({ to: tu.to as `0x${string}`, value: parseEther(tu.amount || "0") })}>{sbusy ? "Sending…" : "Top up ＄"}</button>
          {srcpt.isSuccess && <div style={{ fontSize: 12, color: "#4ade80", textAlign: "center", marginTop: 8 }}>✓ Topped up</div>}
        </div>}
        <div style={{ textAlign: "center", color: "#56546a", fontSize: 12, marginTop: 22 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
