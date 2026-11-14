import { useEffect, useMemo, useState } from "react";
import indexText from "../../../docs/model-pricing-history.md?raw";
import { commonRuleHistory, modelHistory, type PricingHistorySnapshot, type RuleChange, type RuleValue } from "../../shared/modelPricingHistory";
import { ruleText } from "./pricingRuleText";

// Read the maintained model table, leaving unknown announcement dates explicit.
const announcements = new Map<string, { date: string; channel: string }>();
for (const line of indexText.split("\n")) {
  const match = /^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/.exec(line);
  if (match) announcements.set(match[1], { date: match[2].trim(), channel: match[3].trim() });
}

function Value({ value }: { value: RuleValue }) {
  if (value === null || value === undefined) return <>未知</>;
  if (typeof value === "boolean") return <>{value ? "是" : "否"}</>;
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === "string")) return <>{value.map(item => ruleText(String(item))).join("、")}</>;
    return <ul>{value.map((item, i) => <li key={i}><Value value={item} /></li>)}</ul>;
  }
  if (typeof value === "object") return <dl>{Object.entries(value).map(([key, child]) =>
    <div key={key}><dt>{ruleText(key)}</dt><dd><Value value={child} /></dd></div>
  )}</dl>;
  return <>{ruleText(String(value))}</>;
}

function RuleTimeline({ entries }: { entries: { date: string; changes: RuleChange[] }[] }) {
  if (!entries.length) return <p>已保存的快照中没有该项规则记录。</p>;
  return <div className="ph-timeline">{entries.map(({ date, changes }, index) =>
    <details key={date} open={index === 0}>
      <summary><time>{date}</time> {changes.slice(0, 3).map(change => ruleText(change.key)).join("、")}{changes.length > 3 && " 等"}</summary>
      {changes.map(change => <div className="ph-change" key={change.key}>
        <strong>{ruleText(change.key)}</strong>
        {change.after === undefined ? <span>本期移除此项记录</span> : <Value value={change.after} />}
        {change.before !== undefined && <details className="ph-before"><summary>上次记录</summary><Value value={change.before} /></details>}
      </div>)}
    </details>
  )}</div>;
}

export function ModelPricingHistory() {
  const [snapshots, setSnapshots] = useState<PricingHistorySnapshot[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    window.codexCompanion.getPricingHistory().then(result => {
      if (active) setSnapshots(result);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  const models = useMemo(() => [...new Set([...announcements.keys(), ...snapshots.flatMap(s =>
    [...Object.keys(s.rates), ...Object.keys(s.rules), ...s.pending.map(item => item.modelId)])])], [snapshots]);
  const model = selected || models[0];
  const announcement = announcements.get(model);
  const history = useMemo(() => modelHistory(snapshots, model), [snapshots, model]);
  const common = useMemo(() => commonRuleHistory(snapshots), [snapshots]);
  const first = snapshots.find(snapshot => snapshot.rates[model]);
  if (error) return <div className="qe-error" role="alert">本机价格目录读取失败。<button onClick={() => { setError(false); setAttempt(n => n + 1); }}>重试</button></div>;
  if (!snapshots.length) return <p role="status">正在读取随应用保存的价格快照…</p>;
  return <div className="ph-panel" role="tabpanel" aria-label="模型计费历史">
    <section className="qe-card qe-toolbar">
      <label>模型<select value={model} onChange={event => setSelected(event.target.value)}>{models.map(id => <option key={id}>{id}</option>)}</select></label>
      <dl className="ph-dates"><div><dt>API 公告日</dt><dd>{announcement?.date ?? "未知"}</dd></div><div><dt>首次收录价格</dt><dd>{first?.date ?? "尚未收录"}</dd></div></dl>
      {announcement && announcement.channel !== "API 发布" && <p>{announcement.channel}</p>}
    </section>
    <section className="qe-card">
      <div className="qe-section-head"><div><h3>标准短上下文价格</h3><p>每百万 Token，按快照核对日倒序。仅列首次收录、价格或保留状态变化。</p></div></div>
      <div className="qe-table-scroll"><table><thead><tr><th>核对日期</th><th>计费单位</th><th>普通输入</th><th>缓存读取</th><th>输出</th></tr></thead>
        <tbody>{history.prices.flatMap(({ date, rate, retained }) => [
          { unit: "API · USD", values: [rate?.inputUsdPerMillion, rate?.cachedInputUsdPerMillion, rate?.outputUsdPerMillion] },
          { unit: retained ? "Codex · credits（历史保留价）" : "Codex · credits", values: [rate?.inputCreditsPerMillion, rate?.cachedInputCreditsPerMillion, rate?.outputCreditsPerMillion] }
        ].map(({ unit, values }) => <tr key={date + unit}><td>{date}</td><td>{unit}</td>{values.map((n, i) => <td key={i}>{n ?? "未知"}</td>)}</tr>))}</tbody>
      </table></div>
      {!history.prices.length && <p>尚无已收录的标准价格。</p>}
    </section>
    <section key={model} className="qe-card"><div className="qe-section-head"><div><h3>模型规则变化</h3><p>日期是项目核对日。官方公布的生效日期、促销期限和适用条件见各项记录。</p></div></div>
      <RuleTimeline entries={history.rules} />
    </section>
    <details className="qe-card qe-method"><summary>通用计费规则</summary><RuleTimeline entries={common} /></details>
  </div>;
}
