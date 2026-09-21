import { useEffect, useMemo, useRef, useState } from "react";
import type { EstimationSlice, EstimationWindow, QuotaEstimationRequest, QuotaEstimationResponse } from "../../shared/quotaEstimation";
import { formatCompactToken, exactTokenLabel } from "../../shared/tokenFormat";
import { nextTableSort, sortTableRows, type TableSortState } from "../../shared/tableSort";
import { TableSortHeader } from "./TableSortHeader";
import "./quota-estimation.css";

type SortKey = "date" | "token" | "cost" | "days" | "samples" | "percent";
type View = "months" | "windows";
interface Filters { preset: "6" | "12" | "all" | "custom"; start: string; end: string; catalog: string; mode: "snapshot" | "historical" }
const storageKey = "codex-companion.quota-estimation.v1";
const money = (value: number | null) => value === null ? "未定价" : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateTime = (at: string) => new Date(at).toLocaleString("zh-CN", { hour12: false });
const shortDate = (at: string) => new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
const evidence = { insufficient: "样本不足", exploratory: "探索性", moderate: "中等证据" };
function defaults(): Filters { const now = new Date(); return { preset: "6", start: day(new Date(now.getFullYear(), now.getMonth() - 5, 1)), end: day(now), catalog: "", mode: "snapshot" }; }
function restore(): { filters: Filters; view: View; monthSort: TableSortState<SortKey>; windowSort: TableSortState<SortKey> } {
  const fallback = { filters: defaults(), view: "months" as View, monthSort: { key: "date", direction: "desc" } as TableSortState<SortKey>, windowSort: { key: "date", direction: "desc" } as TableSortState<SortKey> };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved) return fallback;
    if (["6", "12", "all", "custom"].includes(saved.filters?.preset) && ["snapshot", "historical"].includes(saved.filters?.mode) && ["start", "end", "catalog"].every(k => typeof saved.filters[k] === "string")) fallback.filters = saved.filters;
    if (["months", "windows"].includes(saved.view)) fallback.view = saved.view;
    for (const key of ["monthSort", "windowSort"] as const) if (["date", "token", "cost", "days", "samples", "percent"].includes(saved[key]?.key) && ["asc", "desc"].includes(saved[key]?.direction)) fallback[key] = saved[key];
  } catch { /* 存储不可用或旧偏好损坏时回退。 */ }
  return fallback;
}
export function estimationRange(filters: Filters, now = new Date()): QuotaEstimationRequest {
  let start: Date | null = null, end = now;
  if (filters.preset === "custom") {
    const parse = (value: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("请填写完整日期。"); const date = new Date(`${value}T00:00:00`); if (!Number.isFinite(date.getTime()) || day(date) !== value) throw new Error("日期无效。"); return date; };
    start = parse(filters.start); end = parse(filters.end); end.setDate(end.getDate() + 1);
    end = new Date(Math.min(end.getTime(), now.getTime()));
    if (start.getTime() >= end.getTime()) throw new Error("开始日期不能晚于结束日期，且不能完全位于未来。");
  } else if (filters.preset !== "all") start = new Date(now.getFullYear(), now.getMonth() - Number(filters.preset) + 1, 1);
  return { startAt: start?.toISOString() ?? null, endAt: end.toISOString(), catalogVersion: filters.catalog || undefined, priceMode: filters.mode };
}
const cache = new Map<string, { at: number; result: QuotaEstimationResponse }>();
function Token({ value }: { value: number }) { return <span title={exactTokenLabel(value)}>{formatCompactToken(value)}</span>; }
function Cost({ item }: { item: EstimationSlice }) {
  return <>{item.events ? money(item.costUsd) : "无本地记录"}{item.costUsd !== null && item.unpricedEvents > 0 && <small>已知部分</small>}</>;
}
function SliceTable({ rows, label }: { rows: EstimationSlice[]; label: string }) {
  const [sort, setSort] = useState<TableSortState<"name" | "token" | "cost" | "events">>({ key: "token", direction: "desc" });
  const sorted = useMemo(() => sortTableRows(rows, sort, (r, key) => key === "name" ? r.key : key === "token" ? r.tokens.total : key === "events" ? r.events : r.costUsd, r => r.key), [rows, sort]);
  return <div className="qe-table-scroll"><table><caption>{label}</caption><thead><tr>{([["name", label], ["token", "Token"], ["cost", "等价成本"], ["events", "事件"]] as const).map(([key, text]) => <TableSortHeader key={key} label={text} sortKey={key} sort={sort} onSort={k => setSort(s => nextTableSort(s, k))} />)}</tr></thead><tbody>
    {sorted.map(row => <tr key={row.key}><td>{row.key}</td><td><Token value={row.tokens.total} /></td><td><Cost item={row} /></td><td>{row.events.toLocaleString("zh-CN")}</td></tr>)}
  </tbody></table></div>;
}
function WindowChart({ windows, selected, onSelect }: { windows: EstimationWindow[]; selected: string; onSelect: (id: string) => void }) {
  const values = windows.filter(w => w.capacityUsd !== null);
  if (!values.length) return null;
  const start = Math.min(...values.map(w => Date.parse(w.startAt))), end = Math.max(...values.map(w => Date.parse(w.endAt))), max = Math.max(...values.map(w => w.p90Usd ?? w.capacityUsd ?? 0), 1);
  const x = (at: string) => 55 + (Date.parse(at) - start) / Math.max(end - start, 1) * 820;
  const y = (value: number) => 175 - value / max * 135;
  return <div className="qe-chart"><svg viewBox="0 0 920 215" role="img" aria-label="各周窗口样本期的满额等价值，空白处无合格估值">
    {[0, .5, 1].map(f => <g key={f}><line x1="55" x2="880" y1={y(max * f)} y2={y(max * f)} className="qe-grid" /><text x="48" y={y(max * f) + 4} textAnchor="end">${Math.round(max * f)}</text></g>)}
    {values.map(w => <g key={w.id} role="button" tabIndex={0} aria-label={`${shortDate(w.startAt)} 至 ${shortDate(w.endAt)}，${money(w.capacityUsd)}，${evidence[w.evidence]}`} className={w.id === selected ? "selected" : ""} onClick={() => onSelect(w.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(w.id); } }}>
      <title>{`${dateTime(w.startAt)} — ${dateTime(w.endAt)}：${money(w.capacityUsd)}；${evidence[w.evidence]}`}</title>
      {w.samples.map(s => <g key={s.startAt}>
        <rect x={x(s.startAt)} width={Math.max(1, x(s.endAt) - x(s.startAt))} y={y(w.p90Usd!)} height={Math.max(4, y(w.p10Usd!) - y(w.p90Usd!))} className="qe-band" />
        <line x1={x(s.startAt)} x2={x(s.endAt)} y1={y(w.capacityUsd!)} y2={y(w.capacityUsd!)} className={`qe-segment ${w.evidence}`} />
      </g>)}
      <circle cx={x(w.endAt)} cy={y(w.capacityUsd!)} r="4" />
    </g>)}
    <text x="55" y="203">{day(new Date(start))}</text><text x="880" y="203" textAnchor="end">{day(new Date(end))}</text>
  </svg><p>横线为实际样本期，浅色带为经验 P10–P90；空白不插值。点击片段查看依据。</p></div>;
}
export function QuotaEstimationPage({ sourceKey }: { sourceKey: string }) {
  const [initial] = useState(restore);
  const [filters, setFilters] = useState(initial.filters), [draft, setDraft] = useState(initial.filters);
  const [view, setView] = useState<View>(initial.view);
  const [monthSort, setMonthSort] = useState(initial.monthSort), [windowSort, setWindowSort] = useState(initial.windowSort);
  const [data, setData] = useState<QuotaEstimationResponse | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [page, setPage] = useState(0), [selected, setSelected] = useState("");
  const lastRefresh = useRef(0);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { const refreshPage = () => setRefresh(r => r + 1); window.addEventListener("quota-estimation:refresh", refreshPage); return () => window.removeEventListener("quota-estimation:refresh", refreshPage); }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ filters, view, monthSort, windowSort })); } catch { /* 本地偏好存储可选。 */ } }, [filters, view, monthSort, windowSort]);
  useEffect(() => {
    let active = true;
    void (async () => {
    await Promise.resolve();
    if (!active) return;
    setError(""); setPage(0); setSelected("");
    if (!sourceKey) { setBusy(true); return; }
    let request: QuotaEstimationRequest;
    try { request = estimationRange(filters); } catch (e) { setData(null); setBusy(false); setError(e instanceof Error ? e.message : "时间范围无效。"); return; }
    const force = refresh !== lastRefresh.current; lastRefresh.current = refresh;
    const key = JSON.stringify([sourceKey, filters]), saved = cache.get(key);
    if (!force && saved && Date.now() - saved.at < 60_000) { setData(saved.result); setBusy(false); return; }
    setData(null); setBusy(true);
    void window.codexCompanion.getQuotaEstimation({ ...request, force }).then(result => {
      if (!active) return;
      if (cache.size >= 8) cache.clear(); cache.set(key, { at: Date.now(), result }); setData(result);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "读取失败，请重试。"); })
      .finally(() => { if (active) setBusy(false); });
    })();
    return () => { active = false; };
  }, [filters, refresh, sourceKey]);
  const monthRows = useMemo(() => sortTableRows(data?.months ?? [], monthSort, (r, k) => k === "date" ? r.key : k === "cost" ? r.costUsd : k === "days" ? r.activeDays : r.tokens.total, r => r.key), [data, monthSort]);
  const windowRows = useMemo(() => sortTableRows(data?.windows ?? [], windowSort, (r, k) => k === "date" ? r.startAt : k === "cost" ? r.capacityUsd : k === "percent" ? r.deltaPercent : r.samples.length, r => r.id), [data, windowSort]);
  const selectedMonth = data?.months.find(m => m.key === selected), selectedWindow = data?.windows.find(w => w.id === selected);
  const rows = view === "months" ? monthRows : windowRows, pages = Math.max(1, Math.ceil(rows.length / 25));
  const catalog = data?.catalogs.find(c => c.version === data.catalogVersion);
  const select = (id: string) => { setSelected(id); requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })); };
  const apply = () => { try { estimationRange(draft); setError(""); if (JSON.stringify(draft) === JSON.stringify(filters)) setRefresh(r => r + 1); else setFilters({ ...draft }); } catch (e) { setError(e instanceof Error ? e.message : "日期无效。"); } };
  const coverage = data?.summary.tokens.total ? (1 - data.summary.unpricedTokens / data.summary.tokens.total) * 100 : null;
  return <div className="qe-page">
    <section className="qe-toolbar qe-card" aria-label="额度估算筛选">
      <div className="qe-toolbar-fields">
        <label>时间范围<select value={draft.preset} onChange={e => setDraft(f => ({ ...f, preset: e.target.value as Filters["preset"] }))}><option value="6">近 6 个月</option><option value="12">近 12 个月</option><option value="all">全部历史</option><option value="custom">自定义</option></select></label>
        {draft.preset === "custom" && <><label>开始日期<input type="date" value={draft.start} onChange={e => setDraft(f => ({ ...f, start: e.target.value }))} /></label><label>结束日期<input type="date" value={draft.end} max={day(new Date())} onChange={e => setDraft(f => ({ ...f, end: e.target.value }))} /></label></>}
        <label>价格口径<select value={draft.mode} onChange={e => setDraft(f => ({ ...f, mode: e.target.value as Filters["mode"] }))}><option value="snapshot">固定快照重估</option><option value="historical">按当时价格</option></select></label>
        <label>价格快照<select value={draft.catalog} disabled={draft.mode === "historical"} onChange={e => setDraft(f => ({ ...f, catalog: e.target.value }))}><option value="">当前目录</option>{data?.catalogs.map(c => <option key={c.version} value={c.version}>{c.version}</option>)}{!data && draft.catalog && <option value={draft.catalog}>{draft.catalog}</option>}</select></label>
      </div>
      <button className="action-button" onClick={apply} disabled={busy}>应用筛选</button><button className="secondary-button" onClick={() => setRefresh(r => r + 1)} disabled={busy}>重新读取</button>
    </section>
    <div className="qe-tabs" role="tablist" aria-label="额度估算视图">{([["months", "按月已用成本"], ["windows", "按窗口估值"]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} onClick={() => { setView(key); setPage(0); setSelected(""); }}>{label}</button>)}</div>
    {error && <div className="qe-error" role="alert">{error}<button className="secondary-button" onClick={() => setRefresh(r => r + 1)} disabled={busy}>重试</button></div>}
    {busy && <section className="qe-card qe-loading" role="status"><strong>正在整理历史用量与额度观测…</strong><p>首次建立索引需要读取本地历史文件，后续只更新变化文件。你可以继续切换其他页面。</p></section>}
    {data && !busy && <>
      <div className="qe-meta"><span>本机记录 · 账户覆盖未知 · 自然月</span><span>{data.range.startAt ? day(new Date(data.range.startAt)) : "最早记录"} — {day(new Date(Date.parse(data.range.endAt) - 1))}</span><span>{filters.mode === "snapshot" ? `价格快照 ${data.catalogVersion}` : "历史生效价格"}</span></div>
      {data.priceMode === "historical" && !data.catalogs.some(c => c.historicalAvailable) && <p className="qe-empty" role="status">当前缺少可靠历史生效价格，金额保持未定价。选择“固定快照重估”可查看按已核实标准价计算的结果。</p>}
      <section className="qe-stats">
        <div className="qe-card"><span>已记录标准等价成本</span><strong><Cost item={data.summary} /></strong><small>API 美元基准 · 非套餐实付</small></div>
        <div className="qe-card"><span>已记录 Token</span><strong><Token value={data.summary.tokens.total} /></strong><small>{data.months.reduce((n, m) => n + m.activeDays, 0)} 个有记录日</small></div>
        <div className="qe-card"><span>可定价 Token 占比</span><strong>{coverage === null ? "—" : `${coverage.toFixed(2)}%`}</strong><small>{data.summary.unpricedEvents.toLocaleString("zh-CN")} 条事件未定价 · 非账户覆盖率</small></div>
      </section>
      <section className="qe-card">
        <div className="qe-section-head"><div><h3>{view === "months" ? "月度成本" : "周窗口满额等价值"}</h3><p>{view === "months" ? "按事件所在自然月求和；点击月份查看模型与每日用量。" : "主额度池 · 7 天窗口；用对齐成本和官方已用比例增量反推。"}</p></div><span>{rows.length} {view === "months" ? "个月" : "个片段"}</span></div>
        {view === "windows" && <WindowChart windows={data.windows} selected={selected} onSelect={select} />}
        {view === "months" ? <div className="qe-table-scroll"><table><thead><tr>{([["date", "月份"], ["token", "Token"], ["cost", "标准等价成本"], ["days", "活跃日"]] as const).map(([key, label]) => <TableSortHeader key={key} label={label} sortKey={key} sort={monthSort} onSort={k => { setMonthSort(s => nextTableSort(s, k)); setPage(0); }} />)}<th>定价覆盖</th></tr></thead><tbody>
          {monthRows.slice(page * 25, page * 25 + 25).map(m => <tr key={m.key} className={m.key === selected ? "selected" : ""}><td><button className="qe-link" onClick={() => select(m.key)}>{m.key}</button>{m.partial && <small>所选范围为部分月份</small>}</td><td><Token value={m.tokens.total} /></td><td><Cost item={m} /></td><td>{m.activeDays}</td><td>{m.tokens.total ? `${((1 - m.unpricedTokens / m.tokens.total) * 100).toFixed(2)}%` : "无本地记录"}</td></tr>)}
        </tbody></table></div> : <div className="qe-table-scroll"><table><thead><tr>{([["date", "有效样本期"], ["cost", "满额等价值"], ["samples", "样本数"], ["percent", "已用增量"]] as const).map(([key, label]) => <TableSortHeader key={key} label={label} sortKey={key} sort={windowSort} onSort={k => { setWindowSort(s => nextTableSort(s, k)); setPage(0); }} />)}<th>证据</th></tr></thead><tbody>
          {windowRows.slice(page * 25, page * 25 + 25).map(w => <tr key={w.id} className={w.id === selected ? "selected" : ""}><td><button className="qe-link" title={`${dateTime(w.startAt)} — ${dateTime(w.endAt)}`} onClick={() => select(w.id)}>{day(new Date(w.startAt))} — {shortDate(w.endAt)}</button><small>{w.plan ?? "套餐未知"} · {w.pool === "legacy" ? "早期未标明池" : "Codex 主池"} · 截止 {shortDate(w.resetsAt)}</small></td><td>{w.capacityUsd === null ? "暂不估值" : money(w.capacityUsd)}{w.capacityUsd !== null && <small>P10–P90 {money(w.p10Usd)}–{money(w.p90Usd)}</small>}</td><td>{w.samples.length}</td><td>{w.deltaPercent.toFixed(1)} 个百分点</td><td><span className={`qe-evidence ${w.evidence}`}>{evidence[w.evidence]}</span>{w.changeDetected && <small>换算关系有变化</small>}</td></tr>)}
        </tbody></table></div>}
        {!rows.length && <p className="qe-empty">{view === "months" ? "所选范围没有本地用量记录。" : "所选范围没有可用周窗口观测，暂时无法反推额度。"}</p>}
        <div className="qe-pagination"><span>先对全部结果排序，再每页显示 25 条</span><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>上一页</button><span>{page + 1} / {pages}</span><button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>下一页</button></div>
      </section>
      {selectedMonth && view === "months" && <section ref={detail} className="qe-card qe-detail"><div className="qe-section-head"><h3>{selectedMonth.key} · 成本详情</h3><button className="secondary-button" onClick={() => setSelected("")}>收起详情</button></div>
        <div className="qe-breakdown">{[["输入总量", selectedMonth.tokens.input], ["其中缓存输入", selectedMonth.tokens.cachedInput], ["输出总量", selectedMonth.tokens.output], ["其中推理输出", selectedMonth.tokens.reasoningOutput]] .map(([label, value]) => <div key={label}><span>{label}</span><strong><Token value={Number(value)} /></strong></div>)}</div>
        <p>缓存已包含在输入、推理已包含在输出，分项不重复相加。未定价模型保留 Token，仅合计已知成本。</p>
        {selectedMonth.events ? <><SliceTable rows={selectedMonth.models} label="模型构成" /><SliceTable rows={selectedMonth.days} label="每日用量" /></> : <p>本月没有本地记录，无法判断是未使用还是数据缺失。</p>}
      </section>}
      {selectedWindow && view === "windows" && <section ref={detail} className="qe-card qe-detail"><div className="qe-section-head"><h3>窗口计算依据</h3><button className="secondary-button" onClick={() => setSelected("")}>收起详情</button></div>
        <p>{selectedWindow.boundary} · {selectedWindow.pool === "codex" ? "Codex 主池" : "早期池未标明"} · 套餐原始字段 {selectedWindow.plan ?? "未知"} · 周窗口截止 {dateTime(selectedWindow.resetsAt)}</p>
        <div className="qe-formula">100 × {money(selectedWindow.costUsd)} ÷ {selectedWindow.deltaPercent.toFixed(1)} 个百分点 = {selectedWindow.capacityUsd === null ? "暂无合格样本" : `${money(selectedWindow.capacityUsd)} / 满额`}</div>
        <p>每段至少 10 个百分点、最长 48 小时，主池未知 Token ≤ 2%。不跨已确认重置和套餐变化；99% / 100% 截顶观测不拟合。至少 3 段 / 30 个百分点且离散程度合格才标记中等证据。检测到的边界不等于兑换重置次数。</p>
        <div className="qe-table-scroll"><table><caption>有效区间明细</caption><thead><tr><th>区间</th><th>官方已用变化</th><th>对齐成本</th><th>满额等价值</th><th>时间偏移 ±2 分钟</th></tr></thead><tbody>{selectedWindow.samples.map(s => <tr key={s.startAt}><td>{dateTime(s.startAt)}<small>至 {dateTime(s.endAt)}</small></td><td>{s.fromPercent.toFixed(1)}% → {s.toPercent.toFixed(1)}%</td><td>{money(s.costUsd)}<small><Token value={s.tokens} /> Token</small></td><td>{money(s.capacityUsd)}</td><td>{money(s.alignmentLowUsd)}–{money(s.alignmentHighUsd)}</td></tr>)}</tbody></table></div>
        {!selectedWindow.samples.length && <p className="qe-empty">此片段没有通过质量门槛的样本，不能给出满额估值。</p>}
        <div className="qe-exclusions">{Object.entries(selectedWindow.excluded).map(([label, n]) => <span key={label}>{label}：{n}</span>)}</div>
        {selectedWindow.changeDetected && <p>后续连续 3 个区间相对前一段超出 20%，提示换算关系变化；模型、Fast、其他设备等仍可能造成差异，不能据此断言官方缩减额度。</p>}
      </section>}
      <details className="qe-card qe-method"><summary>计算口径、价格来源与数据覆盖</summary><ul>{data.warnings.map(w => <li key={w}>{w}</li>)}</ul><p>标准成本 = [(输入 − 缓存输入) × 输入价 + 缓存输入 × 缓存价 + 输出 × 输出价] ÷ 1,000,000。历史价格缺少生效证据时不回填；价格核对日不是生效日。</p>
        <p>索引 {data.coverage.files} 个文件 · 范围内及边界上下文 {data.coverage.observations.toLocaleString("zh-CN")} 条额度观测 · 最早记录 {data.coverage.firstEventAt ? dateTime(data.coverage.firstEventAt) : "未知"} · 最近记录 {data.coverage.lastEventAt ? dateTime(data.coverage.lastEventAt) : "未知"}</p>
        <p>本次解析 {data.performance.parsedFiles} 个文件、复用 {data.performance.reusedFiles} 个；索引 {data.performance.indexMs} ms，查询计算 {data.performance.queryMs} ms。读取时间 {dateTime(data.generatedAt)}。</p>
        <div className="qe-exclusions">{Object.entries(data.exclusions).map(([label, n]) => <span key={label}>{label}：{n.toLocaleString("zh-CN")}</span>)}</div>
        <h4>价格快照 {catalog?.version} · 核对 {catalog?.verifiedAt}</h4><p>{catalog?.historicalAvailable ? "含明确生效证据" : "可靠历史生效时间未知"}；费率单位为 USD / 百万 Token。</p>
        <div className="qe-table-scroll"><table><thead><tr><th>模型</th><th>普通输入</th><th>缓存输入</th><th>输出</th></tr></thead><tbody>{catalog?.rates.map(r => <tr key={r.model}><td>{r.model}</td><td>{r.input}</td><td>{r.cached}</td><td>{r.output}</td></tr>)}</tbody></table></div>
        <ul>{catalog?.sources.map(url => <li key={url} className="qe-source">{url}</li>)}</ul>
      </details>
    </>}
  </div>;
}
