const DAYS = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
const STORAGE_KEY = "temeh-routine-week";
const DATA_VERSION = 4;
const GYM_DAYS = [1, 3, 5]; // یکشنبه، سه‌شنبه، پنجشنبه
const POINTS_PER_CHECK = 10;

const FIXED_TASKS = [
  { text: "مسواک سه بار", occurrences: 3 },
  { text: "آب‌رسان دو بار", occurrences: 2 },
  { text: "ضد آفتاب دو بار", occurrences: 2 },
  { text: "زبان آلمانی", occurrences: 1 },
  { text: "زبان انگلیسی", occurrences: 1 },
  { text: "مطالعه", occurrences: 1 },
  { text: "آب ۲ لیتر", occurrences: 1 },
  { text: "پادکست", occurrences: 1 },
  { text: "غذاهای سالم", occurrences: 1 },
  { text: "آب جوش + لیمو", occurrences: 1 },
  { text: "بیداری قبل از ساعت ۷", occurrences: 1 },
  { text: "قطره چشم سه بار", occurrences: 3 },
  { text: "قرص‌ها (صبح، ظهر، شب)", occurrences: 3 }
];

function todayIndex(){
  const jsDay = new Date().getDay();
  return (jsDay + 1) % 7;
}

function makeTask(text, occurrences){
  return {
    id: crypto.randomUUID(),
    text,
    occurrences,
    checks: new Array(occurrences).fill(false)
  };
}

function defaultData(){
  const data = { version: DATA_VERSION, tasksByDay: {}, expensesByDay: {} };
  DAYS.forEach((_, i) => {
    const tasks = FIXED_TASKS.map(t => makeTask(t.text, t.occurrences));
    if(GYM_DAYS.includes(i)){
      tasks.push(makeTask("باشگاه", 1));
    }
    data.tasksByDay[i] = tasks;
    data.expensesByDay[i] = [];
  });
  return data;
}

function toToman(n){
  return n.toLocaleString("en-US") + " تومان";
}

let state = null;
let activeDay = todayIndex();

async function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    if(!parsed || parsed.version !== DATA_VERSION){
      throw new Error("outdated data version");
    }
    state = parsed;
    if(!state.expensesByDay){
      state.expensesByDay = {};
      DAYS.forEach((_, i) => { state.expensesByDay[i] = []; });
    }
  }catch(e){
    state = defaultData();
    await saveData();
  }
}

async function saveData(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error("خطا در ذخیره‌سازی", e);
  }
}

function dayEarned(dayIdx){
  return (state.tasksByDay[dayIdx] || [])
    .reduce((sum, t) => sum + t.checks.filter(Boolean).length * POINTS_PER_CHECK, 0);
}

function dayMax(dayIdx){
  return (state.tasksByDay[dayIdx] || [])
    .reduce((sum, t) => sum + t.occurrences * POINTS_PER_CHECK, 0);
}

function dayPercent(dayIdx){
  const max = dayMax(dayIdx);
  return max > 0 ? Math.round((dayEarned(dayIdx) / max) * 100) : 0;
}

function weekEarned(){
  return DAYS.reduce((sum, _, i) => sum + dayEarned(i), 0);
}
function weekMax(){
  return DAYS.reduce((sum, _, i) => sum + dayMax(i), 0);
}
function weekPercent(){
  const max = weekMax();
  return max > 0 ? Math.round((weekEarned() / max) * 100) : 0;
}

function renderTabs(){
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = "";
  DAYS.forEach((name, i) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === activeDay ? " active" : "");
    btn.innerHTML = name + '<span class="day-score">' + dayPercent(i) + '%</span>';
    btn.onclick = () => { activeDay = i; renderAll(); };
    tabs.appendChild(btn);
  });
}

function renderDailyStat(){
  document.getElementById("dailyLbl").textContent = "امتیاز " + DAYS[activeDay];
  document.getElementById("dailyPercent").textContent = dayPercent(activeDay) + "%";
}

function renderTaskList(){
  const list = document.getElementById("taskList");
  const tasks = state.tasksByDay[activeDay] || [];
  list.innerHTML = "";
  if(tasks.length === 0){
    list.innerHTML = '<p class="empty-msg">کاری برای ' + DAYS[activeDay] + ' ثبت نشده. یکی اضافه کن.</p>';
    return;
  }
  tasks.forEach((task, taskIdx) => {
    const allDone = task.checks.every(Boolean);
    const row = document.createElement("div");
    row.className = "task-row" + (allDone ? " done-all" : "");
    const checksHtml = task.checks.map((c, idx) =>
      `<button class="checkbox${c ? " checked" : ""}" data-id="${task.id}" data-idx="${idx}">${c ? "✓" : ""}</button>`
    ).join("");
    row.innerHTML = `
      <div class="reorder-group">
        <button class="reorder-btn" data-dir="up" ${taskIdx === 0 ? "disabled" : ""} aria-label="بالا">▲</button>
        <button class="reorder-btn" data-dir="down" ${taskIdx === tasks.length - 1 ? "disabled" : ""} aria-label="پایین">▼</button>
      </div>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="checks">${checksHtml}</div>
      <span class="points-badge">${task.checks.filter(Boolean).length * POINTS_PER_CHECK}/${task.occurrences * POINTS_PER_CHECK}</span>
      <button class="del-btn" data-id="${task.id}" aria-label="حذف">✕</button>
    `;
    row.querySelectorAll(".checkbox").forEach(cb => {
      cb.onclick = () => toggleCheck(task.id, parseInt(cb.dataset.idx));
    });
    row.querySelector(".del-btn").onclick = () => deleteTask(task.id);
    row.querySelectorAll(".reorder-btn").forEach(btn => {
      btn.onclick = () => moveTask(task.id, btn.dataset.dir);
    });
    list.appendChild(row);
  });
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function dayExpenseTotal(dayIdx){
  return (state.expensesByDay[dayIdx] || []).reduce((sum, e) => sum + e.amount, 0);
}

function weekExpenseTotal(){
  return DAYS.reduce((sum, _, i) => sum + dayExpenseTotal(i), 0);
}

function renderExpenses(){
  document.getElementById("expenseTitle").textContent = "خرج‌های " + DAYS[activeDay];
  document.getElementById("expenseDayTotal").textContent = toToman(dayExpenseTotal(activeDay));
  document.getElementById("weekExpenseTotal").textContent = toToman(weekExpenseTotal());

  const list = document.getElementById("expenseList");
  const expenses = state.expensesByDay[activeDay] || [];
  list.innerHTML = "";
  if(expenses.length === 0){
    list.innerHTML = '<p class="expense-empty">خرجی برای ' + DAYS[activeDay] + ' ثبت نشده.</p>';
    return;
  }
  expenses.forEach(exp => {
    const row = document.createElement("div");
    row.className = "expense-row";
    row.innerHTML = `
      <span class="expense-label">${escapeHtml(exp.label || "بدون عنوان")}</span>
      <span class="expense-amount">${toToman(exp.amount)}</span>
      <button class="del-btn" aria-label="حذف">✕</button>
    `;
    row.querySelector(".del-btn").onclick = () => deleteExpense(exp.id);
    list.appendChild(row);
  });
}

function addExpense(label, amount){
  if(!state.expensesByDay[activeDay]) state.expensesByDay[activeDay] = [];
  state.expensesByDay[activeDay].push({
    id: crypto.randomUUID(),
    label: label.trim(),
    amount: Math.max(0, Math.round(amount))
  });
  saveData();
  renderAll();
}

function deleteExpense(id){
  state.expensesByDay[activeDay] = state.expensesByDay[activeDay].filter(e => e.id !== id);
  saveData();
  renderAll();
}

function renderWeekly(){
  const wp = weekPercent();
  document.getElementById("weekPercent").textContent = wp + "%";
  const isLastDay = activeDay === 6;
  document.getElementById("weeklyTitle").textContent = isLastDay ? "امتیاز نهایی این هفته" : "امتیاز هفتگی";
  const descEl = document.getElementById("weekDesc");
  if(weekEarned() === 0){
    descEl.textContent = "هنوز کاری تیک نخورده. شروع کن!";
  } else if(wp < 40){
    descEl.textContent = isLastDay ? "این هفته رو تموم کردی؛ هفته بعد بهتر می‌شه." : "شروع خوبیه، ادامه بده.";
  } else if(wp < 75){
    descEl.textContent = isLastDay ? "هفته خوبی بود." : "هفته خوبی رو داری می‌سازی.";
  } else {
    descEl.textContent = isLastDay ? "هفته‌ی عالی‌ای بود!" : "عالی پیش می‌ری، همینطور ادامه بده.";
  }

  const bars = document.getElementById("bars");
  bars.innerHTML = "";
  DAYS.forEach((name, i) => {
    const pct = dayPercent(i);
    const col = document.createElement("div");
    col.className = "bar-col" + (i === todayIndex() ? " today" : "");
    col.innerHTML = `
      <span class="bar-val">${pct}%</span>
      <div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div>
      <span class="bar-day">${name.slice(0,2)}</span>
    `;
    bars.appendChild(col);
  });
}

function toggleCheck(taskId, idx){
  const task = state.tasksByDay[activeDay].find(t => t.id === taskId);
  if(task){ task.checks[idx] = !task.checks[idx]; }
  saveData();
  renderAll();
}

function moveTask(taskId, direction){
  const list = state.tasksByDay[activeDay];
  const idx = list.findIndex(t => t.id === taskId);
  if(idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if(swapWith < 0 || swapWith >= list.length) return;
  [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
  saveData();
  renderAll();
}

function deleteTask(id){
  state.tasksByDay[activeDay] = state.tasksByDay[activeDay].filter(t => t.id !== id);
  saveData();
  renderAll();
}

function addTask(text, occurrences){
  if(!state.tasksByDay[activeDay]) state.tasksByDay[activeDay] = [];
  const count = Math.max(1, Math.min(10, Math.round(occurrences)));
  state.tasksByDay[activeDay].push(makeTask(text.trim(), count));
  saveData();
  renderAll();
}

async function resetWeek(){
  DAYS.forEach((_, i) => {
    (state.tasksByDay[i] || []).forEach(t => t.checks = new Array(t.occurrences).fill(false));
    state.expensesByDay[i] = [];
  });
  await saveData();
  renderAll();
}

function renderAll(){
  renderTabs();
  renderDailyStat();
  renderTaskList();
  renderExpenses();
  renderWeekly();
}

document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const textEl = document.getElementById("newTaskText");
  const countEl = document.getElementById("newTaskCount");
  if(!textEl.value.trim()) return;
  addTask(textEl.value, parseFloat(countEl.value) || 1);
  textEl.value = "";
  countEl.value = "1";
  textEl.focus();
});

document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const labelEl = document.getElementById("newExpenseLabel");
  const amountEl = document.getElementById("newExpenseAmount");
  const amount = parseFloat(amountEl.value);
  if(isNaN(amount) || amount < 0) return;
  addExpense(labelEl.value, amount);
  labelEl.value = "";
  amountEl.value = "";
  labelEl.focus();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if(confirm("همه‌ی تیک‌ها و خرج‌های این هفته پاک بشه؟ (خود کارها حذف نمی‌شن)")){
    resetWeek();
  }
});

(async function init(){
  await loadData();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "block";
  renderAll();
})();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
