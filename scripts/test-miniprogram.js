"use strict";

const assert = require('assert');
const path = require('path');

const storage = new Map();
const toasts = [];
const sheets = [];
let sheetQueue = [];
let modalConfirm = true;
const clipboard = [];

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

global.wx = {
  getStorageSync(key) {
    return storage.has(key) ? clone(storage.get(key)) : '';
  },
  setStorageSync(key, value) {
    storage.set(key, clone(value));
  },
  showToast(opts) {
    toasts.push(opts.title);
  },
  showActionSheet(opts) {
    sheets.push(opts.itemList);
    const index = sheetQueue.length ? sheetQueue.shift() : 0;
    opts.success({ tapIndex: index });
  },
  showModal(opts) {
    if (opts.success) opts.success({ confirm: modalConfirm, cancel: !modalConfirm });
  },
  setClipboardData(opts) {
    clipboard.push(opts.data);
    if (opts.success) opts.success();
  },
  nextTick(fn) {
    fn();
  },
  createSelectorQuery() {
    return {
      select() {
        return {
          fields() {
            return {
              exec(cb) {
                cb([null]);
              }
            };
          }
        };
      }
    };
  },
  getWindowInfo() {
    return { pixelRatio: 2 };
  },
  getSystemInfoSync() {
    return { pixelRatio: 2 };
  }
};

let appInstance = null;
global.App = cfg => {
  appInstance = cfg;
};
global.getApp = () => appInstance;

const pageDefs = {};
global.Page = cfg => {
  pageDefs.__last = cfg;
};

function loadPage(rel) {
  delete require.cache[require.resolve(rel)];
  require(rel);
  return pageDefs.__last;
}

function instantiate(def) {
  const page = Object.assign({}, def);
  page.data = clone(def.data);
  page.setData = function (patch) {
    Object.keys(patch).forEach(key => {
      if (/\[(\d+)\]/.test(key)) {
        const m = key.match(/^([^[]+)\[(\d+)\]\.?(.*)$/);
        if (!m) throw new Error('bad setData path ' + key);
        const arr = this.data[m[1]];
        const idx = Number(m[2]);
        if (m[3]) {
          arr[idx][m[3]] = patch[key];
        } else {
          arr[idx] = patch[key];
        }
      } else {
        this.data[key] = patch[key];
      }
    });
  };
  return page;
}

function run() {
  require(path.resolve(__dirname, '../app.js'));
  assert(appInstance, 'App registered');

  // ---------- analysis ----------
  const analysisDef = loadPage('../pages/analysis/analysis.js');
  const analysis = instantiate(analysisDef);
  analysis.onLoad();
  assert.strictEqual(analysis.data.gameId, 'ssq');
  assert(analysis.data.latestBalls.length === 8, 'ssq 6 red + plus + 1 blue');
  assert.strictEqual(analysis.data.dataCount, 500);
  assert(analysis.data.hot.length > 0);
  assert(analysis.data.history.length === 8);

  analysis.onSwitchGame({ currentTarget: { dataset: { id: 'dlt' } } });
  assert.strictEqual(analysis.data.gameId, 'dlt');
  assert(analysis.data.latestBalls.length === 8, 'dlt 5 front + plus + 2 back');

  sheetQueue = [0];
  analysis.onSwitchGame({ currentTarget: { dataset: { id: 'ssq' } } });
  analysis.onWindowTap();
  assert.strictEqual(analysis.windowSize, 30);
  assert.strictEqual(analysis.data.freqMeta, '30');

  // ---------- pick ----------
  const pickDef = loadPage('../pages/pick/pick.js');
  const pick = instantiate(pickDef);
  pick.onLoad();
  assert.strictEqual(pick.data.strategy, 'smart');
  assert(pick.data.filterAreas.length === 2);
  assert(pick.data.manualAreas.length === 2);

  // must mark through store
  pick.onFilterMode({ currentTarget: { dataset: { mode: 'must' } } });
  pick.onFilterTap({ currentTarget: { dataset: { area: 'red', n: 5, disabled: false } } });
  assert.deepStrictEqual(pick.data.filterAreas[0].nums[4].mark, 'must-mark');

  // ban mark
  pick.onFilterMode({ currentTarget: { dataset: { mode: 'ban' } } });
  pick.onFilterTap({ currentTarget: { dataset: { area: 'red', n: 8, disabled: false } } });
  assert.deepStrictEqual(pick.data.filterAreas[0].nums[7].mark, 'ban-mark');

  pick.onGenerate();
  assert(pick.data.picks.length === 1, 'one pick generated');
  assert(pick.data.picks[0].balls.length === 8);
  assert(/智能评分/.test(pick.data.picks[0].scoreText));

  // copy
  pick.onCopyPick({ currentTarget: { dataset: { index: 0 } } });
  assert(clipboard.length === 1);

  // favorite
  pick.onFavPick({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(store().state.favs.length, 1);
  assert.strictEqual(pick.data.picks[0].fav, true);
  pick.onFavPick({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(store().state.favs.length, 0);

  // manual selection flow
  for (let i = 0; i < 6; i++) {
    pick.onManualTap({ currentTarget: { dataset: { area: 'red', n: i + 1 } } });
  }
  pick.onManualTap({ currentTarget: { dataset: { area: 'blue', n: 3 } } });
  assert(/已选满一注/.test(pick.data.manualStatus));
  pick.onManualFav();
  assert.strictEqual(store().state.favs.length, 1);
  pick.onManualClear();
  assert(!/已选满一注/.test(pick.data.manualStatus));
  pick.onManualFill();
  assert(/已选满一注/.test(pick.data.manualStatus));

  pick.onFilterClear();
  assert.strictEqual(pick.data.mustBanStatus, '定胆必含，杀号排除');

  // ---------- draw ----------
  const drawDef = loadPage('../pages/draw/draw.js');
  const draw = instantiate(drawDef);
  draw.onLoad();
  assert.strictEqual(draw.data.mainLabel, '红球');

  draw.onCompareMode();
  assert(sheets.length > 0);

  // manual compare requires full manual; current manual from pick is full
  draw.setData({ compareMode: 'random' });
  draw.onDraw();
  assert.strictEqual(draw.data.running, true);
  assert(draw.data.stage.length === 8);
  // fast-forward timers
  draw.timers.forEach(t => clearTimeout(t));
  draw.timers = [];
  clearInterval(draw.spinTimer);
  draw.cleanup();
  // simulate finish
  const engine = require('../utils/engine.js');
  const st = store();
  const comparePick = engine.generatePick('ssq', 'random', { windowSize: 0, sumRange: false, oddEven: false, zoneBalance: false, noTripleRun: false }, 1);
  const drawn = engine.generatePick('ssq', 'random', { windowSize: 0, sumRange: false, oddEven: false, zoneBalance: false, noTripleRun: false }, 2);
  draw.finish(comparePick, drawn, 'ssq');
  assert.strictEqual(draw.data.drawn, true);
  assert.strictEqual(typeof draw.data.prize, 'string');

  draw.onClearStats();
  assert.strictEqual(draw.data.stats.count, 0);

  // ---------- news ----------
  const newsDef = loadPage('../pages/news/news.js');
  const news = instantiate(newsDef);
  news.onShow();
  assert.strictEqual(news.data.draws.length, 2);
  news.data.draws.forEach(d => {
    assert(d.balls.length >= 7, 'news balls count ' + d.balls.length);
  });
  assert(news.data.news.length > 0);
  news.onOpenNews({ currentTarget: { dataset: { url: 'https://example.com/a' } } });
  assert(/example\.com/.test(clipboard[clipboard.length - 1]));

  // ---------- fav ----------
  const favDef = loadPage('../pages/fav/fav.js');
  const fav = instantiate(favDef);
  fav.onShow();
  assert.strictEqual(fav.data.favCount, 1);
  fav.onCheckAll();
  assert.strictEqual(fav.data.checkRows.length, 1);
  assert(fav.data.drawnBalls.length >= 7);
  assert(/→/.test(fav.data.checkRows[0].text));

  fav.onCopy({ currentTarget: { dataset: { index: 0 } } });
  fav.onRemove({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(store().state.favs.length, 0);
  assert.strictEqual(fav.data.favCount, 0);

  console.log('ALL MINI PROGRAM TESTS PASSED');
  console.log('toasts:', toasts.length, 'clipboard:', clipboard.length);
}

function store() {
  return require('../utils/store.js');
}

run();
