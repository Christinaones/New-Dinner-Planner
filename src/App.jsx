import { useState, useRef } from "react";

const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const DAY_EMOJIS = ["🌱", "🌿", "🍃", "🌾", "🍂", "🌻", "🌸"];

function buildShoppingText(weekPlan, scope, dayIdx) {
  if (!weekPlan) return "";
  let text = "";
  if (scope === "week") {
    text = "🛒 本周晚餐购物清单\n\n";
    const merged = {};
    weekPlan.forEach(day => {
      (day.shopping || []).forEach(cat => {
        if (!merged[cat.category]) merged[cat.category] = { emoji: cat.emoji, items: [] };
        (cat.items || []).forEach(item => {
          if (!merged[cat.category].items.find(x => x.name === item.name))
            merged[cat.category].items.push(item);
        });
      });
    });
    Object.entries(merged).forEach(([cat, v]) => {
      text += `${v.emoji} ${cat}\n`;
      v.items.forEach(it => { text += `  • ${it.name} ${it.amount}${it.note ? `（${it.note}）` : ""}\n`; });
      text += "\n";
    });
  } else {
    const day = weekPlan[dayIdx];
    text = `🛒 ${day.day}晚餐购物清单\n\n`;
    (day.shopping || []).forEach(cat => {
      text += `${cat.emoji} ${cat.category}\n`;
      (cat.items || []).forEach(it => { text += `  • ${it.name} ${it.amount}${it.note ? `（${it.note}）` : ""}\n`; });
      text += "\n";
    });
  }
  text += "——由家庭晚餐助手生成";
  return text;
}

function mergeWeeklyShopping(weekPlan) {
  const merged = {};
  (weekPlan || []).forEach(day => {
    (day.shopping || []).forEach(cat => {
      if (!merged[cat.category]) merged[cat.category] = { emoji: cat.emoji, items: [] };
      (cat.items || []).forEach(item => {
        if (!merged[cat.category].items.find(x => x.name === item.name))
          merged[cat.category].items.push({ ...item });
      });
    });
  });
  return Object.entries(merged).map(([category, v]) => ({ category, emoji: v.emoji, items: v.items }));
}

function proteinColor(p) {
  if (!p) return "#999";
  if (p.includes("鸡") || p.includes("鸭")) return "#d07818";
  if (p.includes("猪")) return "#c03858";
  if (p.includes("牛")) return "#984828";
  if (p.includes("豆") || p.includes("蛋")) return "#487838";
  if (p.includes("鱼") || p.includes("虾") || p.includes("海")) return "#1870b8";
  return "#707070";
}

// 调用后端 /api/chat，API Key 安全存在服务器环境变量里
async function callDeepSeek(prompt, maxTokens = 4000) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error("生成失败，请重试");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || "";
}

export default function DinnerPlanner() {
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [weekPlan, setWeekPlan] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [activeTab, setActiveTab] = useState("menu");
  const [shopScope, setShopScope] = useState("week");
  const [editingDish, setEditingDish] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [regenLoading, setRegenLoading] = useState(null);
  const [shareText, setShareText] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const shareRef = useRef(null);

  const today = new Date();
  const weekLabel = `${today.getMonth() + 1}月${today.getDate()}日起一周`;

  const WEEK_PROMPT = `你是专业家庭营养师。为四口之家（含老人和小孩）制定本周7天晚餐菜单。
规则：
1. 口味清淡不辣，低盐低油，儿童友好，老人易消化，家常便饭风格
2. 每天主蛋白质要不同，轮换：鸡肉、猪肉、牛肉、鸭肉、豆腐蛋类
3. 海鲜限制：整周最多2天含海鲜，其他天绝不出现任何海鲜食材
4. 相邻两天约30%食材重叠（利用剩菜），leftover_note说明食材衔接
5. 每天3-4道菜，荤素均衡，7天菜名不重复
严格只返回JSON：{"week":[{"day":"周一","theme":"主题4-6字","protein":"主蛋白","has_seafood":false,"leftover_note":"","dishes":[{"name":"","type":"荤菜|素菜|汤羹|主食","emoji":"","difficulty":"简单|中等|稍难","time":"20分钟","tip":"贴士12字内","nutrition":"营养8字内"}],"cook_order":"一句话","total_time":"45分钟","shopping":[{"category":"肉类","emoji":"🥩","items":[{"name":"","amount":"","note":""}]}]}]}`;

  const fetchWeekPlan = async () => {
    setLoading(true); setError(""); setWeekPlan(null);
    try {
      const text = await callDeepSeek(WEEK_PROMPT, 4000);
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setWeekPlan(parsed.week);
      setActiveDay(0); setActiveTab("menu"); setCheckedItems({}); setShopScope("week"); setShareText("");
      setScreen("result");
    } catch (e) { setError(e.message || "生成失败，请重试"); }
    finally { setLoading(false); }
  };

  const regenDay = async (dayIdx) => {
    setRegenLoading(dayIdx);
    const prevDay = dayIdx > 0 ? weekPlan[dayIdx - 1] : null;
    const existingProteins = weekPlan.map((d, i) => i !== dayIdx ? d.protein : null).filter(Boolean);
    const seafoodDays = weekPlan.filter((d, i) => i !== dayIdx && d.has_seafood).length;
    const prompt = `重新生成${DAYS[dayIdx]}晚餐菜单（四口之家，清淡不辣低盐，家常便饭）。本周其他天蛋白质：${existingProteins.join("、")}，今天换一种。本周已有${seafoodDays}天海鲜，${seafoodDays >= 2 ? "今天绝对不能有海鲜" : "可酌情加海鲜"}。${prevDay ? `昨天菜单：${prevDay.dishes.map(d => d.name).join("、")}，今天30%食材可重叠。` : ""}严格只返回单天JSON：{"day":"${DAYS[dayIdx]}","theme":"","protein":"","has_seafood":false,"leftover_note":"","dishes":[{"name":"","type":"荤菜|素菜|汤羹|主食","emoji":"","difficulty":"简单|中等|稍难","time":"","tip":"","nutrition":""}],"cook_order":"","total_time":"","shopping":[{"category":"","emoji":"","items":[{"name":"","amount":"","note":""}]}]}`;
    try {
      const text = await callDeepSeek(prompt, 1500);
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setWeekPlan(prev => prev.map((d, i) => i === dayIdx ? parsed : d));
    } catch {}
    finally { setRegenLoading(null); }
  };

  const openEdit = (dayIdx, dishIdx) => {
    setEditForm({ ...weekPlan[dayIdx].dishes[dishIdx] });
    setEditingDish({ dayIdx, dishIdx });
  };
  const saveEdit = () => {
    setWeekPlan(prev => prev.map((day, di) => di !== editingDish.dayIdx ? day : {
      ...day, dishes: day.dishes.map((dish, dishi) => dishi === editingDish.dishIdx ? { ...dish, ...editForm } : dish)
    }));
    setEditingDish(null);
  };

  const showShareText = () => {
    const text = buildShoppingText(weekPlan, shopScope, activeDay);
    setShareText(text);
    setTimeout(() => { shareRef.current?.select(); }, 100);
  };
  const copyShareText = () => {
    if (shareRef.current) {
      shareRef.current.select();
      document.execCommand("copy");
      setCopyMsg("已复制 ✓ 可直接粘贴到微信");
      setTimeout(() => setCopyMsg(""), 3000);
    }
  };

  const toggleCheck = (key) => setCheckedItems(p => ({ ...p, [key]: !p[key] }));
  const currentDay = weekPlan?.[activeDay];
  const shoppingList = shopScope === "week" ? mergeWeeklyShopping(weekPlan) : (currentDay?.shopping || []);

  return (
    <div className="aw">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ece8e2}
        .aw{min-height:100vh;background:#ece8e2;display:flex;justify-content:center;font-family:'Noto Sans SC',sans-serif}
        .sc{width:100%;max-width:430px;min-height:100vh;background:#f8f6f2;color:#2a2418;overflow-y:auto}
        .h-hero{background:linear-gradient(148deg,#fffdf8 0%,#fff8ec 100%);padding:56px 26px 32px;border-bottom:1px solid #e8e2d8;position:relative;overflow:hidden}
        .h-hero::after{content:'🥘';position:absolute;right:20px;top:48px;font-size:72px;opacity:.13;transform:rotate(10deg)}
        .h-tag{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:#fff8e6;border:1px solid #eac860;border-radius:20px;font-size:11px;color:#a87018;font-weight:600;letter-spacing:.5px;margin-bottom:16px}
        .h-title{font-family:'Noto Serif SC',serif;font-size:42px;font-weight:700;color:#1c1810;line-height:1.1;margin-bottom:10px}
        .h-title span{color:#c87818}
        .h-sub{font-size:14px;color:#887860;line-height:1.75}
        .h-chips{margin:20px 22px 0;padding:14px 16px;background:#fff;border:1px solid #e8e2d8;border-radius:14px;display:flex;flex-wrap:wrap;gap:8px}
        .chip{font-size:12px;color:#685e48;background:#f4f0ea;padding:5px 10px;border-radius:9px}
        .h-feats{margin:14px 22px 0;display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .feat{padding:14px 13px;background:#fff;border:1px solid #e8e2d8;border-radius:13px}
        .feat-ic{font-size:20px;margin-bottom:5px;display:block}
        .feat-t{font-size:13px;font-weight:600;color:#2a2418;margin-bottom:2px}
        .feat-d{font-size:11px;color:#9a8e78;line-height:1.5}
        .h-cta{padding:22px 22px 44px}
        .btn-p{width:100%;padding:17px;background:linear-gradient(135deg,#e08818,#c06010);border:none;border-radius:15px;color:#fff;font-family:'Noto Sans SC',sans-serif;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(192,96,16,.26);transition:all .2s}
        .btn-p:hover{transform:translateY(-1px)}
        .ld-sc{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:18px;background:#f8f6f2;padding:40px;text-align:center}
        .ld-bowl{font-size:60px;animation:wb 1.2s ease-in-out infinite}
        @keyframes wb{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
        .ld-t{font-size:18px;font-weight:600;color:#2a2418}
        .ld-s{font-size:13px;color:#9a8e78;line-height:1.7}
        .ld-steps{display:flex;flex-direction:column;gap:7px;margin-top:6px}
        .ld-step{font-size:12px;color:#b8a888;display:flex;align-items:center;gap:7px}
        .dot{width:6px;height:6px;border-radius:50%;background:#c87818;animation:pp 1.4s ease-in-out infinite;flex-shrink:0}
        @keyframes pp{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        .er-sc{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;padding:40px;text-align:center}
        .er-ic{font-size:52px}
        .er-msg{color:#a06060;font-size:15px;line-height:1.6}
        .r-sc{padding-bottom:44px}
        .r-top{position:sticky;top:0;z-index:20;background:rgba(248,246,242,.96);backdrop-filter:blur(8px);border-bottom:1px solid #e8e2d8;padding:46px 18px 11px;display:flex;align-items:center;justify-content:space-between}
        .bk-btn{background:none;border:none;color:#9a8e78;font-size:13px;font-family:'Noto Sans SC',sans-serif;cursor:pointer;padding:5px 0}
        .bk-btn:hover{color:#c87818}
        .top-r{display:flex;align-items:center;gap:8px}
        .wk-lbl{font-size:12px;color:#b8a888}
        .btn-rw{padding:6px 11px;background:#fff8e6;border:1px solid #eac860;border-radius:9px;color:#a87018;font-size:12px;font-weight:600;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
        .d-nav{background:#fff;border-bottom:1px solid #e8e2d8;padding:10px 0 0;overflow-x:auto;scrollbar-width:none;display:flex}
        .d-nav::-webkit-scrollbar{display:none}
        .d-tab{flex-shrink:0;padding:7px 12px 11px;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;position:relative;min-width:54px}
        .d-tab.act::after{content:'';position:absolute;bottom:0;left:18%;right:18%;height:2.5px;background:#c87818;border-radius:2px}
        .d-em{font-size:17px}
        .d-lbl{font-size:11px;font-weight:600;color:#c0b098}
        .d-tab.act .d-lbl{color:#c87818}
        .d-pro{font-size:9px;padding:1px 5px;border-radius:5px;font-weight:600;white-space:nowrap}
        .sf-dot{position:absolute;top:5px;right:7px;width:6px;height:6px;border-radius:50%;background:#1870b8}
        .d-ban{margin:14px 14px 0;padding:16px;background:linear-gradient(135deg,#fffdf4,#fff8ea);border:1px solid #ecd888;border-radius:17px;animation:fi .3s ease}
        @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .ban-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px}
        .ban-day{font-size:11px;color:#b09850;letter-spacing:.5px;margin-bottom:2px}
        .ban-theme{font-family:'Noto Serif SC',serif;font-size:20px;color:#1c1810;font-weight:700}
        .ban-r{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
        .ban-time{font-size:12px;color:#9a8e78}
        .btn-rd{padding:5px 10px;background:#fff;border:1px solid #ddd8cc;border-radius:8px;color:#9a8e78;font-size:11px;font-family:'Noto Sans SC',sans-serif;cursor:pointer;display:flex;align-items:center;gap:4px}
        .btn-rd:disabled{opacity:.4;cursor:not-allowed}
        .rs{animation:sp .7s linear infinite;display:inline-block}
        @keyframes sp{to{transform:rotate(360deg)}}
        .lo-note{font-size:11px;color:#a09060;background:#fffaee;padding:6px 10px;border-radius:8px;border-left:2px solid #eac860;margin-bottom:8px}
        .ban-stats{display:flex;gap:7px;flex-wrap:wrap}
        .stat{font-size:11px;padding:3px 9px;border-radius:7px;background:#fff;border:1px solid #e8e2d8;color:#887860}
        .tab-bar{display:flex;margin:12px 14px 0;background:#ede9e2;border-radius:11px;padding:3px;gap:3px}
        .tab{flex:1;padding:9px;background:none;border:none;font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#9a8e78;border-radius:8px;cursor:pointer}
        .tab.act{background:#fff;color:#c87818;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.08)}
        .dishes{padding:10px 14px 0;display:flex;flex-direction:column;gap:8px}
        .d-card{background:#fff;border:1px solid #e8e2d8;border-radius:15px;padding:13px;display:flex;gap:10px;animation:fi .3s ease both;position:relative}
        .d-l{display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0}
        .d-em2{font-size:25px}
        .d-ty{font-size:9px;padding:2px 5px;border-radius:5px;font-weight:700}
        .ty-荤菜{background:#fde8e8;color:#b83838}
        .ty-素菜{background:#e4f5e4;color:#387838}
        .ty-汤羹{background:#e4eefe;color:#2858b8}
        .ty-主食{background:#fef3e0;color:#b87018}
        .d-c{flex:1}
        .d-nm{font-size:15px;font-weight:600;color:#1c1810;margin-bottom:4px}
        .d-tip{font-size:11px;color:#9a8e78;margin-bottom:2px}
        .d-nut{font-size:11px;color:#687858}
        .d-r{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}
        .diff{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600}
        .df-简单{background:#e4f5e4;color:#387838}
        .df-中等{background:#fef3e0;color:#b07018}
        .df-稍难{background:#fde8e8;color:#b83838}
        .d-t{font-size:11px;color:#b8a888}
        .ed-btn{position:absolute;top:9px;right:9px;width:26px;height:26px;background:#f4f0ea;border:1px solid #e4ddd0;border-radius:7px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
        .d-card:hover .ed-btn{opacity:1}
        .cook-ord{margin:9px 14px 0;padding:9px 13px;background:#f4f0ea;border-radius:9px;font-size:12px;color:#887860;line-height:1.6}
        .sh-area{padding:10px 14px 0}
        .sh-scope{display:flex;gap:8px;margin-bottom:12px}
        .sc-btn{padding:7px 14px;background:#fff;border:1.5px solid #e4ddd0;border-radius:9px;font-size:12px;font-weight:600;color:#887860;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
        .sc-btn.act{border-color:#c87818;color:#c87818;background:#fff8ea}
        .sh-cat{margin-bottom:13px;animation:fi .3s ease both}
        .cat-t{font-size:12px;font-weight:700;color:#b8a888;letter-spacing:.5px;padding:7px 0 5px;border-bottom:1px solid #e8e2d8;margin-bottom:4px}
        .sh-it{display:flex;align-items:center;gap:10px;padding:10px 7px;border-radius:9px;cursor:pointer;transition:background .12s}
        .sh-it:hover{background:#f4f0ea}
        .sh-it.ck{opacity:.45}
        .sh-chk{width:20px;height:20px;border:1.5px solid #d4ccbc;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px}
        .sh-it.ck .sh-chk{background:#c87818;border-color:#c87818;color:#fff}
        .sh-info{flex:1}
        .sh-nm{font-size:14px;color:#2a2418}
        .sh-it.ck .sh-nm{text-decoration:line-through;color:#b8a888}
        .sh-note{font-size:11px;color:#b8a888;margin-top:1px}
        .sh-amt{font-size:12px;font-weight:600;color:#b87018;background:#fff8e6;padding:3px 8px;border-radius:7px;flex-shrink:0}
        .share-section{margin:14px 0 0;padding:14px;background:#fff;border:1.5px solid #e8e2d8;border-radius:13px}
        .share-title{font-size:13px;font-weight:600;color:#2a2418;margin-bottom:4px}
        .share-sub{font-size:11px;color:#9a8e78;margin-bottom:10px}
        .share-row{display:flex;gap:7px;margin-bottom:9px}
        .sh-btn-gen{flex:1;padding:10px;background:#fff8ea;border:1.5px solid #eac860;border-radius:9px;font-size:13px;font-weight:600;color:#a87018;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
        .sh-btn-copy{flex:1;padding:10px;background:#c87818;border:none;border-radius:9px;font-size:13px;font-weight:600;color:#fff;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
        .share-ta{width:100%;min-height:120px;padding:10px 12px;background:#f8f6f2;border:1.5px solid #e4ddd0;border-radius:9px;font-size:12px;color:#2a2418;font-family:'Noto Sans SC',sans-serif;resize:vertical;line-height:1.6}
        .copy-hint{font-size:11px;color:#9a8e78;margin-top:6px}
        .copy-ok{font-size:12px;color:#487838;font-weight:600;margin-top:6px}
        .m-ov{position:fixed;inset:0;background:rgba(0,0,0,.32);z-index:100;display:flex;align-items:flex-end;justify-content:center}
        .m-box{width:100%;max-width:430px;background:#f8f6f2;border-radius:22px 22px 0 0;padding:22px 18px 40px;animation:su .25s ease}
        @keyframes su{from{transform:translateY(36px);opacity:0}to{transform:translateY(0);opacity:1}}
        .m-hdl{width:34px;height:4px;background:#e0d8cc;border-radius:2px;margin:0 auto 18px}
        .m-title{font-size:17px;font-weight:700;color:#1c1810;margin-bottom:16px}
        .f-row{margin-bottom:13px}
        .f-lbl{font-size:11px;color:#9a8e78;font-weight:600;letter-spacing:.4px;margin-bottom:5px}
        .f-in{width:100%;padding:11px 13px;background:#fff;border:1.5px solid #e4ddd0;border-radius:10px;font-size:14px;color:#1c1810;font-family:'Noto Sans SC',sans-serif;outline:none}
        .f-in:focus{border-color:#c87818}
        .f-row2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .f-sel{width:100%;padding:11px 13px;background:#fff;border:1.5px solid #e4ddd0;border-radius:10px;font-size:14px;color:#1c1810;font-family:'Noto Sans SC',sans-serif;outline:none;appearance:none;cursor:pointer}
        .m-acts{display:flex;gap:9px;margin-top:18px}
        .btn-can{flex:1;padding:13px;background:#ede9e2;border:none;border-radius:12px;font-size:14px;color:#887860;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
        .btn-sv{flex:2;padding:13px;background:linear-gradient(135deg,#e08818,#c06010);border:none;border-radius:12px;font-size:14px;font-weight:700;color:#fff;font-family:'Noto Sans SC',sans-serif;cursor:pointer}
      `}</style>

      {loading && (
        <div className="sc ld-sc">
          <div className="ld-bowl">🥘</div>
          <div className="ld-t">AI 正在规划本周菜单…</div>
          <div className="ld-s">正在为四口之家精心搭配7天晚餐</div>
          <div className="ld-steps">
            {["规划每日蛋白质轮换","考虑相邻食材衔接利用剩菜","生成整周购物清单"].map((s,i) => (
              <div key={i} className="ld-step">
                <span className="dot" style={{animationDelay:`${i*0.4}s`}} />{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="sc er-sc">
          <span className="er-ic">😕</span>
          <p className="er-msg">{error}</p>
          <button className="btn-p" style={{maxWidth:280}} onClick={fetchWeekPlan}>重新生成</button>
        </div>
      )}

      {!loading && !error && screen === "home" && (
        <div className="sc">
          <div className="h-hero">
            <div className="h-tag">✨ AI 家庭晚餐助手</div>
            <h1 className="h-title">本周<br /><span>吃什么？</span></h1>
            <p className="h-sub">一次生成7天晚餐菜谱<br />营养均衡 · 减少剩菜 · 轻松购物</p>
          </div>
          <div className="h-chips">
            {["👨‍👩‍👧‍👦 四口之家","🌿 清淡不辣","💧 低盐少油","🧒 儿童友好","🚫🦐 少海鲜"].map((c,i) => (
              <span key={i} className="chip">{c}</span>
            ))}
          </div>
          <div className="h-feats">
            {[
              {ic:"🔄",t:"蛋白质每天轮换",d:"鸡猪牛鸭豆蛋轮流，营养全面"},
              {ic:"♻️",t:"剩菜巧利用",d:"相邻两天30%食材重叠，减少浪费"},
              {ic:"✏️",t:"随时手动修改",d:"每道菜可单独编辑，灵活调整"},
              {ic:"📤",t:"一键转发清单",d:"购物清单发给家人，协作购物"},
            ].map((f,i) => (
              <div key={i} className="feat">
                <span className="feat-ic">{f.ic}</span>
                <div className="feat-t">{f.t}</div>
                <div className="feat-d">{f.d}</div>
              </div>
            ))}
          </div>
          <div className="h-cta">
            <button className="btn-p" onClick={fetchWeekPlan}>生成本周7天菜单 ✨</button>
          </div>
        </div>
      )}

      {!loading && !error && screen === "result" && weekPlan && (
        <div className="sc r-sc">
          <div className="r-top">
            <button className="bk-btn" onClick={() => setScreen("home")}>← 首页</button>
            <div className="top-r">
              <span className="wk-lbl">{weekLabel}</span>
              <button className="btn-rw" onClick={fetchWeekPlan}>🔄 换菜单</button>
            </div>
          </div>
          <div className="d-nav">
            {weekPlan.map((day,i) => (
              <button key={i} className={`d-tab ${activeDay===i?"act":""}`}
                onClick={() => { setActiveDay(i); setActiveTab("menu"); }}>
                {day.has_seafood && <span className="sf-dot" />}
                <span className="d-em">{DAY_EMOJIS[i]}</span>
                <span className="d-lbl">{day.day}</span>
                <span className="d-pro" style={{background:proteinColor(day.protein)+"1a",color:proteinColor(day.protein)}}>
                  {day.protein}
                </span>
              </button>
            ))}
          </div>
          {currentDay && (
            <div className="d-ban" key={activeDay}>
              <div className="ban-top">
                <div>
                  <div className="ban-day">{currentDay.day} · {weekLabel}</div>
                  <div className="ban-theme">{currentDay.theme}</div>
                </div>
                <div className="ban-r">
                  <span className="ban-time">⏱ {currentDay.total_time}</span>
                  <button className="btn-rd" onClick={() => regenDay(activeDay)} disabled={regenLoading===activeDay}>
                    {regenLoading===activeDay ? <><span className="rs">↻</span> 生成中</> : <>↻ 换这天</>}
                  </button>
                </div>
              </div>
              {currentDay.leftover_note && <div className="lo-note">♻️ {currentDay.leftover_note}</div>}
              <div className="ban-stats">
                <span className="stat" style={{color:proteinColor(currentDay.protein),background:proteinColor(currentDay.protein)+"18"}}>🥩 {currentDay.protein}</span>
                {currentDay.has_seafood && <span className="stat" style={{color:"#1870b8",background:"#ddf0ff"}}>🐟 含海鲜</span>}
                <span className="stat">👨‍🍳 {currentDay.cook_order}</span>
              </div>
            </div>
          )}
          <div className="tab-bar">
            <button className={`tab ${activeTab==="menu"?"act":""}`} onClick={() => setActiveTab("menu")}>🍽 菜单</button>
            <button className={`tab ${activeTab==="shopping"?"act":""}`} onClick={() => setActiveTab("shopping")}>🛒 购物</button>
          </div>
          {activeTab === "menu" && currentDay && (
            <>
              <div className="dishes">
                {currentDay.dishes.map((dish,di) => (
                  <div key={di} className="d-card" style={{animationDelay:`${di*0.06}s`}}>
                    <button className="ed-btn" onClick={() => openEdit(activeDay,di)}>✏️</button>
                    <div className="d-l">
                      <span className="d-em2">{dish.emoji}</span>
                      <span className={`d-ty ty-${dish.type}`}>{dish.type}</span>
                    </div>
                    <div className="d-c">
                      <div className="d-nm">{dish.name}</div>
                      <div className="d-tip">💡 {dish.tip}</div>
                      <div className="d-nut">🌿 {dish.nutrition}</div>
                    </div>
                    <div className="d-r">
                      <span className={`diff df-${dish.difficulty}`}>{dish.difficulty}</span>
                      <span className="d-t">{dish.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cook-ord">👨‍🍳 {currentDay.cook_order}</div>
            </>
          )}
          {activeTab === "shopping" && (
            <div className="sh-area">
              <div className="sh-scope">
                <button className={`sc-btn ${shopScope==="week"?"act":""}`} onClick={() => { setShopScope("week"); setShareText(""); }}>📅 全周清单</button>
                <button className={`sc-btn ${shopScope==="day"?"act":""}`} onClick={() => { setShopScope("day"); setShareText(""); }}>📋 {currentDay?.day}</button>
              </div>
              {shoppingList.map((cat,ci) => (
                <div key={`${shopScope}-${ci}`} className="sh-cat" style={{animationDelay:`${ci*0.05}s`}}>
                  <div className="cat-t">{cat.emoji} {cat.category}</div>
                  {(cat.items||[]).map((item,ii) => {
                    const key = `${shopScope}-${ci}-${ii}`;
                    return (
                      <div key={ii} className={`sh-it ${checkedItems[key]?"ck":""}`} onClick={() => toggleCheck(key)}>
                        <div className="sh-chk">{checkedItems[key]?"✓":""}</div>
                        <div className="sh-info">
                          <div className="sh-nm">{item.name}</div>
                          {item.note && <div className="sh-note">{item.note}</div>}
                        </div>
                        <div className="sh-amt">{item.amount}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="share-section">
                <div className="share-title">📤 转发购物清单到微信</div>
                <div className="share-sub">生成文本后复制，粘贴到微信发送给家人</div>
                <div className="share-row">
                  <button className="sh-btn-gen" onClick={showShareText}>生成{shopScope==="week"?"全周":currentDay?.day}文本</button>
                  {shareText && <button className="sh-btn-copy" onClick={copyShareText}>一键复制</button>}
                </div>
                {shareText && (
                  <>
                    <textarea ref={shareRef} className="share-ta" value={shareText} readOnly onClick={e => e.target.select()} />
                    {copyMsg ? <div className="copy-ok">✓ {copyMsg}</div> : <div className="copy-hint">👆 点击文本框全选，或点「一键复制」</div>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {editingDish && (
        <div className="m-ov" onClick={e => e.target===e.currentTarget && setEditingDish(null)}>
          <div className="m-box">
            <div className="m-hdl" />
            <div className="m-title">编辑菜品</div>
            <div className="f-row">
              <div className="f-lbl">菜名</div>
              <input className="f-in" value={editForm.name||""} onChange={e => setEditForm(p=>({...p,name:e.target.value}))} />
            </div>
            <div className="f-row2">
              <div className="f-row">
                <div className="f-lbl">类型</div>
                <select className="f-sel" value={editForm.type||"荤菜"} onChange={e => setEditForm(p=>({...p,type:e.target.value}))}>
                  {["荤菜","素菜","汤羹","主食"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="f-row">
                <div className="f-lbl">难度</div>
                <select className="f-sel" value={editForm.difficulty||"简单"} onChange={e => setEditForm(p=>({...p,difficulty:e.target.value}))}>
                  {["简单","中等","稍难"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="f-row2">
              <div className="f-row">
                <div className="f-lbl">烹饪时间</div>
                <input className="f-in" value={editForm.time||""} onChange={e => setEditForm(p=>({...p,time:e.target.value}))} />
              </div>
              <div className="f-row">
                <div className="f-lbl">Emoji</div>
                <input className="f-in" value={editForm.emoji||""} onChange={e => setEditForm(p=>({...p,emoji:e.target.value}))} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-lbl">烹饪小贴士</div>
              <input className="f-in" value={editForm.tip||""} onChange={e => setEditForm(p=>({...p,tip:e.target.value}))} />
            </div>
            <div className="f-row">
              <div className="f-lbl">营养亮点</div>
              <input className="f-in" value={editForm.nutrition||""} onChange={e => setEditForm(p=>({...p,nutrition:e.target.value}))} />
            </div>
            <div className="m-acts">
              <button className="btn-can" onClick={() => setEditingDish(null)}>取消</button>
              <button className="btn-sv" onClick={saveEdit}>保存修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
