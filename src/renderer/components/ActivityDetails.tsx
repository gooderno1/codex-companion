import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityDetailsRequest, ActivityDetailsResponse, ActivityProject, ActivitySession, ActivityTotals } from "../../shared/activityDetails";
import type { PeriodMetric } from "../../shared/contracts";
import "./activity-details.css";

type View = "projects" | "sessions";
const number = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const dateTime = (at: string | null) => at ? new Date(at).toLocaleString("zh-CN", { hour12: false }) : "未观测";
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const rowId = (item: ActivityProject | ActivitySession) => "id" in item ? item.id : item.sessionId;

function rangeFor(preset: string, period?: PeriodMetric | null): ActivityDetailsRequest {
  const now = new Date();
  if (preset === "current" && period) return { startAt: period.startAt, endAt: period.endAt };
  if (preset === "all") return { startAt: null, endAt: now.toISOString() };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - Number(preset) + 1);
  return { startAt: start.toISOString(), endAt: now.toISOString() };
}

function Breakdown({ item }: { item: ActivityTotals }) {
  return <>
    <h4>Token 拆分</h4>
    <dl className="activity-facts">
      {[["总 Token", item.tokens.total], ["输入总量", item.tokens.input], ["其中缓存输入", item.tokens.cachedInput], ["输出总量", item.tokens.output], ["其中推理输出", item.tokens.reasoningOutput], ["用量事件", item.events]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(Number(value))}</dd></div>)}
    </dl>
    <p className="activity-note">缓存已包含在输入中，推理已包含在输出中；分项不能重复相加。</p>
    <h4>模型构成</h4>
    <div className="activity-mini-table"><table><thead><tr><th>模型</th><th>Token / 占比</th><th>API 等价成本</th></tr></thead><tbody>
      {item.models.map(model => <tr key={model.key}><td>{model.key}</td><td>{number(model.tokens.total)}<small>{item.tokens.total ? (model.tokens.total / item.tokens.total * 100).toFixed(1) : 0}%</small></td><td>{model.priced ? money(model.apiCostUsd) : "未定价"}</td></tr>)}
    </tbody></table></div>
    <h4>每日用量 <span>本地日期 · {item.days.length} 个活跃日</span></h4>
    <div className="activity-mini-table activity-days"><table><thead><tr><th>日期</th><th>Token</th><th>API 等价成本</th><th>事件</th></tr></thead><tbody>
      {item.days.map(day => <tr key={day.key}><td>{day.key}</td><td>{number(day.tokens.total)}</td><td>{money(day.apiCostUsd)}{!day.priced ? " *" : ""}</td><td>{number(day.events)}</td></tr>)}
    </tbody></table></div>
    {!item.events && <p className="activity-empty">所选范围没有可观测的 Token 事件。</p>}
  </>;
}

export function ActivityDetails({ initialView, initialId, initialPeriod, onClose }: { initialView: View; initialId?: string; initialPeriod?: PeriodMetric | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const [view, setView] = useState<View>(initialView);
  const [preset, setPreset] = useState(initialPeriod ? "current" : initialId ? "all" : "30");
  const [request, setRequest] = useState(() => rangeFor(initialPeriod ? "current" : initialId ? "all" : "30", initialPeriod));
  const [data, setData] = useState<ActivityDetailsResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(initialId ?? "");
  const [today] = useState(() => localDay(new Date()));
  const [startDay, setStartDay] = useState(() => localDay(new Date(Date.now() - 29 * 86400000)));
  const [endDay, setEndDay] = useState(() => localDay(new Date()));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    window.codexCompanion.getActivityDetails(request).then(result => {
      if (active && id === requestId.current) { setData(result); setBusy(false); }
    }).catch(() => {
      if (active && id === requestId.current) { setError("详情读取失败，请重试；也可在设置中核对本地数据目录。"); setBusy(false); }
    });
    return () => { active = false; };
  }, [request]);

  const rows = useMemo(() => {
    if (!data) return [];
    const source: Array<ActivityProject | ActivitySession> = view === "projects" ? data.projects : data.sessions;
    const needle = query.trim().toLowerCase();
    return source.filter(item => {
      if ("sessionId" in item && projectFilter && item.projectId !== projectFilter) return false;
      const project = "projectId" in item ? data.projects.find(p => p.id === item.projectId) : item;
      const text = [rowId(item), project?.name, project?.path, "cwd" in item ? item.cwd : "", ...item.models.map(m => m.key)].join(" ").toLowerCase();
      return text.includes(needle);
    }).sort((a, b) => {
      if (sort === "token") return b.tokens.total - a.tokens.total || rowId(a).localeCompare(rowId(b));
      if (sort === "cost") return b.apiCostUsd - a.apiCostUsd || rowId(a).localeCompare(rowId(b));
      if (sort === "name") return ("name" in a ? a.name : a.sessionId).localeCompare("name" in b ? b.name : b.sessionId);
      return (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? "") || rowId(a).localeCompare(rowId(b));
    });
  }, [data, view, query, projectFilter, sort]);
  const selected = rows.find(item => rowId(item) === selectedId);
  const totalPages = Math.max(1, Math.ceil(rows.length / 25));
  const visiblePage = Math.min(page, totalPages - 1);
  const filteredTokens = rows.reduce((sum, row) => sum + row.tokens.total, 0);
  const filteredCost = rows.reduce((sum, row) => sum + row.apiCostUsd, 0);
  const unpriced = rows.some(row => row.models.some(model => !model.priced));
  const load = (next: ActivityDetailsRequest, preserveSelection = false) => {
    setBusy(true); setError(""); setDateError(""); setPage(0);
    if (!preserveSelection) setSelectedId("");
    setRequest(next);
  };
  const changeView = (next: View) => { setView(next); setSelectedId(""); setQuery(""); setProjectFilter(""); setPage(0); };
  const customRange = () => {
    const start = new Date(`${startDay}T00:00:00`), end = new Date(`${endDay}T00:00:00`);
    end.setDate(end.getDate() + 1);
    if (!startDay || !endDay || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || start > new Date()) { setDateError("请选择有效日期，开始日不能晚于结束日或今天。"); return; }
    load({ startAt: start.toISOString(), endAt: end.toISOString() });
  };
  const relatedSessions = (projectId: string) => { setView("sessions"); setProjectFilter(projectId); setQuery(""); setSelectedId(""); setPage(0); };

  return <dialog ref={dialog} className="activity-dialog" aria-labelledby="activity-title" onCancel={onClose}>
    <header className="activity-header"><div><span className="activity-eyebrow">本地活动详情</span><h2 id="activity-title">{view === "projects" ? "项目概览详情" : "会话归因详情"}</h2></div><button className="activity-close" onClick={onClose} aria-label="关闭详情">关闭 ×</button></header>
    <div className="activity-controls">
      <div className="activity-range-row"><div className="activity-segments" aria-label="时间范围">
        {[...(initialPeriod ? [["current", "当前入口周期"]] : []), ["7", "近 7 天"], ["30", "近 30 天"], ["90", "近 90 天"], ["365", "近一年"], ["all", "全部本地记录"], ["custom", "自定义"]].map(([value, label]) => <button key={value} aria-pressed={preset === value} onClick={() => { setPreset(value); setDateError(""); if (value !== "custom") load(rangeFor(value, initialPeriod)); }}>{label}</button>)}
      </div><button className="activity-button" disabled={busy} onClick={() => load({ ...(preset === "custom" ? request : rangeFor(preset, initialPeriod)), force: true }, true)}>重新读取</button></div>
      {preset === "custom" && <div className="activity-date-row"><label>开始日期<input type="date" value={startDay} max={today} onChange={event => setStartDay(event.target.value)} /></label><label>结束日期<input type="date" value={endDay} min={startDay} max={today} onChange={event => setEndDay(event.target.value)} /></label><button className="activity-button" onClick={customRange}>应用日期</button><span role="alert">{dateError}</span></div>}
      <div className="activity-range-caption">{busy ? "正在读取所选范围… 首次扫描全部本地记录可能需要一些时间。" : data ? <>统计范围：{data.range.startAt ? dateTime(data.range.startAt) : "本地全部历史"} — {dateTime(data.range.endAt)}<span>结束时刻不含在内 · 数据采集 {dateTime(data.generatedAt)}</span></> : "尚未读取数据"}</div>
    </div>
    <div className="activity-scroll" aria-busy={busy}>
      {busy ? <div className="activity-state" role="status"><h3>正在整理活动详情</h3><p>读取本地会话统计和 Git 历史，不会修改额度或会话内容。</p></div> : error ? <div className="activity-state" role="alert"><p>{error}</p><button className="activity-button" onClick={() => load({ ...request, force: true }, true)}>重试</button></div> : data && <>
        <div className="activity-filter-row"><div className="activity-segments" aria-label="详情视图"><button aria-pressed={view === "projects"} onClick={() => changeView("projects")}>项目</button><button aria-pressed={view === "sessions"} onClick={() => changeView("sessions")}>会话</button></div><label className="activity-search">搜索<input type="search" placeholder={view === "projects" ? "项目名、路径或模型" : "会话 ID、项目、路径或模型"} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>{view === "sessions" && <label>归因项目<select value={projectFilter} onChange={event => { setProjectFilter(event.target.value); setPage(0); }}><option value="">全部项目</option>{data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}<label>排序<select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="recent">最近 Token 活动</option><option value="token">Token 从高到低</option><option value="cost">成本从高到低</option><option value="name">名称 / ID</option></select></label></div>
        <div className="activity-summary"><div><span>筛选后的{view === "projects" ? "项目" : "会话"}</span><strong>{number(rows.length)}</strong></div><div><span>范围内 Token</span><strong>{number(filteredTokens)}</strong></div><div><span>API 等价成本{unpriced ? " · 部分未定价" : ""}</span><strong>{money(filteredCost)}</strong></div></div>
        <div className="activity-content"><section className="activity-results" aria-label="详情列表"><div className="activity-results-table"><table><thead><tr><th>{view === "projects" ? "项目 / 路径" : "会话 / 项目"}</th><th>Token</th><th>API 等价成本</th><th>{view === "projects" ? "会话" : "用量事件"}</th></tr></thead><tbody>{rows.slice(visiblePage * 25, visiblePage * 25 + 25).map(row => <tr key={rowId(row)} className={selected === row ? "is-selected" : ""}><td><button className="activity-row-button" onClick={() => setSelectedId(rowId(row))}>{"name" in row ? row.name : row.sessionId}<small>{"path" in row ? row.path ?? "会话目录未匹配 Git 仓库" : data.projects.find(p => p.id === row.projectId)?.name ?? "未归因"}</small></button><small>{dateTime(row.lastEventAt)}</small></td><td>{number(row.tokens.total)}</td><td>{money(row.apiCostUsd)}{row.models.some(model => !model.priced) ? " *" : ""}</td><td>{"sessions" in row ? row.sessions : row.events}</td></tr>)}</tbody></table>{!rows.length && <p className="activity-empty">没有符合当前日期或搜索条件的记录。可扩大时间范围或清除筛选。</p>}</div><footer className="activity-pagination"><span>共 {rows.length} 项 · 每页 25 项</span><button disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)}>上一页</button><span>{visiblePage + 1} / {totalPages}</span><button disabled={visiblePage + 1 >= totalPages} onClick={() => setPage(visiblePage + 1)}>下一页</button></footer></section>
        <aside className="activity-object" aria-label="对象详情">{!selected ? <div className="activity-empty"><h3>{selectedId ? "该对象不在当前结果中" : "选择一项查看详情"}</h3><p>{selectedId ? "可扩大日期范围或清除搜索条件。" : "点击左侧名称，查看完整归因、模型与每日用量。"}</p></div> : <>
          <h3>{"name" in selected ? selected.name : "会话详情"}</h3>
          <dl className="activity-metadata">{"sessionId" in selected ? <><dt>完整会话 ID</dt><dd>{selected.sessionId}</dd><dt>归因项目</dt><dd>{data.projects.find(project => project.id === selected.projectId)?.name ?? "未归因"}</dd><dt>工作目录</dt><dd>{selected.cwd ?? "未记录"}</dd><dt>会话创建</dt><dd>{dateTime(selected.startedAt)}</dd></> : <><dt>项目路径</dt><dd>{selected.path ?? "未匹配到本地 Git 仓库"}</dd><dt>范围内会话</dt><dd>{selected.sessions} <button className="text-button" onClick={() => relatedSessions(selected.id)}>查看关联会话 →</button></dd></>}<dt>本范围首次 / 最后 Token 活动</dt><dd>{dateTime(selected.firstEventAt)}<br />{dateTime(selected.lastEventAt)}</dd></dl>
          {"code" in selected && <><h4>Git 历史活动</h4>{selected.code ? <dl className="activity-facts">{[["提交", selected.code.commits], ["新增行", selected.code.additions], ["删除行", selected.code.deletions], ["净增行", selected.code.net]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(Number(value))}</dd></div>)}</dl> : <p className="activity-note">{selected.path ? "Git 历史未能读取，当前值未知。" : "未归因会话没有对应的 Git 活动。"}</p>}<p className="activity-note">当前 HEAD 可达提交的文本行统计；不含未提交修改，不能归因到单个会话。</p></>}
          <Breakdown item={selected} />
        </>}</aside></div>
        <p className="activity-coverage">本地覆盖：{dateTime(data.coverage.firstEventAt)} — {dateTime(data.coverage.lastEventAt)} · 扫描 {data.coverage.files} 个会话文件（含归档）。全部仅指本机保留的记录，不包含已删除或仅云端的历史。</p>
        <p className="activity-note">API 等价成本按已知标准单价估算，非账单实付；* 表示包含未定价模型，仅汇总已知成本。详情不展示对话正文。</p>
      </>}
    </div>
  </dialog>;
}
