const { GAME, HISTORY, DATA_META } = require('./data.js');
const { LIVE_DATA } = require('./livedata.js');

const STORE_PREFIX = 'ai_lot_';

const state = {
  game: 'ssq',
  windowSize: 50,
  strategy: 'smart',
  picks: [],
  favs: [],
  manual: {},
  must: {},
  ban: {},
  filterMode: 'must',
  stats: { count: 0, win: 0, best: null }
};

const GAME_IDS = Object.keys(GAME);

const STRATEGIES = [
  { key: 'smart', label: '智能平衡', desc: '综合冷热搭配、和值、奇偶、区间均衡多维打分，从大量候选中择优' },
  { key: 'hot', label: '追热', desc: '近期出现频率高的号码获得更高权重' },
  { key: 'cold', label: '追冷', desc: '长期未开出的冷号获得更高权重，博冷回补' },
  { key: 'omission', label: '遗漏回补', desc: '聚焦当前遗漏接近或超过平均遗漏周期的号码' },
  { key: 'random', label: '纯随机', desc: '均匀随机机选，等概率覆盖全部号码' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function game() {
  return GAME[state.game];
}

function read(key, fallback) {
  try {
    const raw = wx.getStorageSync(STORE_PREFIX + key);
    if (raw === '' || raw === null || raw === undefined) return fallback;
    return raw;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(STORE_PREFIX + key, value);
  } catch (e) {
    /* storage full or unavailable */
  }
}

function loadStats(key) {
  const v = read(key, null);
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { count: 0, win: 0, best: null };
  }
  return {
    count: Number.isFinite(v.count) ? v.count : 0,
    win: Number.isFinite(v.win) ? v.win : 0,
    best: typeof v.best === 'string' ? v.best : null
  };
}

function ensureAreaState() {
  if (!state.manual || typeof state.manual !== 'object') state.manual = {};
  if (!state.must || typeof state.must !== 'object') state.must = {};
  if (!state.ban || typeof state.ban !== 'object') state.ban = {};
  game().areas.forEach(a => {
    if (!Array.isArray(state.manual[a.key])) state.manual[a.key] = [];
    if (!Array.isArray(state.must[a.key])) state.must[a.key] = [];
    if (!Array.isArray(state.ban[a.key])) state.ban[a.key] = [];
  });
}

function resetManual() {
  state.manual = {};
  game().areas.forEach(a => { state.manual[a.key] = []; });
}

function resetFilters() {
  state.must = {};
  state.ban = {};
  game().areas.forEach(a => {
    state.must[a.key] = [];
    state.ban[a.key] = [];
  });
}

function manualComplete() {
  ensureAreaState();
  return game().areas.every(a => state.manual[a.key].length === a.pick);
}

function init() {
  state.game = 'ssq';
  state.windowSize = 50;
  state.strategy = 'smart';
  state.picks = [];
  state.filterMode = 'must';
  state.favs = read('favs_ssq', []);
  state.stats = loadStats('stats_ssq');
  resetManual();
  resetFilters();
}

function setGame(id) {
  if (!GAME[id]) return;
  state.game = id;
  state.picks = [];
  state.favs = read('favs_' + id, []);
  state.stats = loadStats('stats_' + id);
  resetManual();
  resetFilters();
}

function saveFavs() {
  write('favs_' + state.game, state.favs);
}

function saveStats() {
  write('stats_' + state.game, state.stats);
}

function pickText(pick) {
  return game().areas.map(a => (pick.areas[a.key] || []).map(pad).join(' ')).join(' + ');
}

function pickBalls(pick, small, gameId) {
  const g = GAME[gameId] || game();
  const balls = [];
  let seq = 0;
  g.areas.forEach((area, i) => {
    if (i > 0) {
      balls.push({ k: 'plus-' + i, n: '+', cls: 'ball plus' + (small ? ' sm' : '') });
    }
    (pick.areas[area.key] || []).forEach(n => {
      balls.push({ k: area.key + '-' + n + '-' + seq++, n: pad(n), cls: 'ball ' + area.cls + (small ? ' sm' : '') });
    });
  });
  return balls;
}

function formatUpdated(iso) {
  if (!iso) return '未知时间';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '未知时间';
  const diff = Math.max(0, Date.now() - d.getTime());
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) {
    const mins = Math.floor(diff / 60000);
    return mins <= 1 ? '刚刚' : mins + ' 分钟前';
  }
  if (hours < 24) return hours + ' 小时前';
  return Math.floor(hours / 24) + ' 天前';
}

function formatMoney(raw) {
  const n = Number(String(raw).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 100000000) return (n / 100000000).toFixed(2).replace(/\.?0+$/, '') + ' 亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.?0+$/, '') + ' 万';
  return String(n);
}

function formatNewsDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  return m ? m[2] + '-' + m[3] : (date || '');
}

module.exports = {
  GAME,
  HISTORY,
  DATA_META,
  LIVE_DATA,
  GAME_IDS,
  STRATEGIES,
  state,
  pad,
  game,
  read,
  write,
  loadStats,
  resetManual,
  resetFilters,
  manualComplete,
  init,
  setGame,
  saveFavs,
  saveStats,
  pickText,
  pickBalls,
  formatUpdated,
  formatMoney,
  formatNewsDate
};
