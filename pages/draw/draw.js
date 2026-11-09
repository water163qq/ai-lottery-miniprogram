const store = require('../../utils/store.js');
const { generatePick, prizeInfo } = require('../../utils/engine.js');

const COMPARE_MODES = [
  { key: 'latest', label: '对比最近一次生成结果' },
  { key: 'manual', label: '对比手选号码' },
  { key: 'random', label: '对比一注新机选' }
];

const RANK = { '一等奖': 1, '二等奖': 2, '三等奖': 3, '四等奖': 4, '五等奖': 5, '六等奖': 6 };

Page({
  data: {
    games: store.GAME_IDS.map(id => ({ id, name: store.GAME[id].name })),
    gameId: 'ssq',
    compareMode: 'latest',
    compareLabel: COMPARE_MODES[0].label,
    running: false,
    stage: [],
    compareBalls: [],
    drawn: false,
    mainHit: 0,
    specialHit: 0,
    mainLabel: '红球',
    specialLabel: '蓝球',
    prize: '',
    won: false,
    hitText: '',
    resultText: '',
    stats: { count: 0, win: 0, rate: '0.0', bestText: '—' }
  },

  onLoad() {
    this.timers = [];
    this.spinTimer = null;
    this.read();
  },

  onShow() {
    this.read();
  },

  onUnload() {
    this.cleanup();
  },

  onHide() {
    this.cleanup();
  },

  cleanup() {
    if (this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = null;
    }
    (this.timers || []).forEach(t => clearTimeout(t));
    this.timers = [];
    if (this.data.running) this.setData({ running: false, drawn: false, stage: [] });
  },

  read() {
    const s = store.state;
    const g = store.game();
    this.setData({
      gameId: s.game,
      mainLabel: g.main === 'red' ? '红球' : '前区',
      specialLabel: g.special === 'blue' ? '蓝球' : '后区'
    });
    this.renderStats();
  },

  onSwitchGame(e) {
    const id = e.currentTarget.dataset.id;
    if (id === store.state.game) return;
    this.cleanup();
    store.setGame(id);
    this.setData({
      gameId: id,
      stage: [],
      compareBalls: [],
      drawn: false
    });
    this.read();
  },

  renderStats() {
    const s = store.state.stats;
    const rate = s.count > 0 ? ((s.win / s.count) * 100).toFixed(1) : '0.0';
    this.setData({
      stats: {
        count: s.count,
        win: s.win,
        rate,
        bestText: s.best ? s.best : '—'
      }
    });
  },

  onClearStats() {
    store.state.stats = { count: 0, win: 0, best: null };
    store.saveStats();
    this.renderStats();
    wx.showToast({ title: '战绩已清空', icon: 'none' });
  },

  onCompareMode() {
    wx.showActionSheet({
      itemList: COMPARE_MODES.map(m => m.label),
      success: res => {
        const mode = COMPARE_MODES[res.tapIndex];
        this.setData({ compareMode: mode.key, compareLabel: mode.label });
      }
    });
  },

  onDraw() {
    if (this.data.running) return;
    const mode = this.data.compareMode;
    if (mode === 'manual' && !store.manualComplete()) {
      wx.showToast({ title: '请先在手选号码中选满一注', icon: 'none' });
      return;
    }
    const g = store.game();
    const startGame = store.state.game;

    let comparePick;
    if (mode === 'manual') {
      comparePick = { areas: JSON.parse(JSON.stringify(store.state.manual)) };
    } else if (mode === 'latest' && store.state.picks.length > 0) {
      comparePick = store.state.picks[0];
    } else {
      comparePick = generatePick(startGame, 'random', this.randomOpts(), Math.floor(Math.random() * 0xffffffff));
    }

    const drawn = generatePick(
      startGame,
      'random',
      { windowSize: 0, sumRange: false, oddEven: false, zoneBalance: false, noTripleRun: false },
      (Math.floor(Math.random() * 0xffffffff) >>> 0) ^ 0x85ebca6b
    );

    this.setData({
      running: true,
      drawn: false,
      compareBalls: store.pickBalls(comparePick, true)
    });

    const mainArea = g.areas[0];
    const specialArea = g.areas[1];
    const mainList = drawn.areas[g.main];
    const specialList = drawn.areas[g.special];
    const stage = [];
    const slots = [];

    const mkSlot = (area, finalN) => {
      const k = 'slot-' + stage.length;
      stage.push({ k, n: store.pad(this.randInt(area)), cls: 'ball ' + area.cls + ' spinning', opacity: 1 });
      const slot = { index: stage.length - 1, area, final: finalN };
      slots.push(slot);
    };

    mainList.forEach(n => mkSlot(mainArea, n));
    stage.push({ k: 'plus', n: '+', cls: 'ball plus', opacity: 0 });
    const plusIndex = stage.length - 1;
    specialList.forEach(n => mkSlot(specialArea, n));

    this.setData({ stage });

    this.spinTimer = setInterval(() => {
      const spinning = slots.filter(s => s.index >= 0);
      const patch = {};
      spinning.forEach(s => {
        if (!s.locked) {
          patch['stage[' + s.index + '].n'] = store.pad(this.randInt(s.area));
        }
      });
      if (Object.keys(patch).length > 0) this.setData(patch);
    }, 70);

    const later = (fn, ms) => this.timers.push(setTimeout(fn, ms));
    const freeze = slot => {
      slot.locked = true;
      const patch = {};
      patch['stage[' + slot.index + '].n'] = store.pad(slot.final);
      patch['stage[' + slot.index + '].cls'] = 'ball ' + slot.area.cls + ' locked';
      this.setData(patch);
    };

    const FREEZE_GAP = 420;
    let t = 800;
    slots.slice(0, mainList.length).forEach(slot => {
      later(() => freeze(slot), t);
      t += FREEZE_GAP;
    });
    later(() => this.setData({ ['stage[' + plusIndex + '].opacity']: 1 }), t - 120);
    slots.slice(mainList.length).forEach(slot => {
      later(() => freeze(slot), t);
      t += FREEZE_GAP;
    });

    later(() => {
      this.cleanup();
      const finalStage = [];
      slots.slice(0, mainList.length).forEach((s, i) => {
        finalStage.push({ k: 'final-' + i, n: store.pad(s.final), cls: 'ball ' + s.area.cls + ' locked', opacity: 1 });
      });
      finalStage.push({ k: 'final-plus', n: '+', cls: 'ball plus', opacity: 1 });
      slots.slice(mainList.length).forEach((s, i) => {
        finalStage.push({ k: 'final-s-' + i, n: store.pad(s.final), cls: 'ball ' + s.area.cls + ' locked', opacity: 1 });
      });
      this.setData({ running: false, stage: finalStage });
      if (store.state.game !== startGame) return;
      this.finish(comparePick, drawn, startGame);
    }, t + 200);
  },

  randomOpts() {
    return {
      windowSize: store.state.windowSize,
      sumRange: false,
      oddEven: false,
      zoneBalance: false,
      noTripleRun: false
    };
  },

  finish(comparePick, drawn, gameId) {
    const g = store.GAME[gameId];
    const mainHit = comparePick.areas[g.main].filter(n => drawn.areas[g.main].indexOf(n) >= 0).length;
    const specialHit = comparePick.areas[g.special].filter(n => drawn.areas[g.special].indexOf(n) >= 0).length;
    const prize = prizeInfo(gameId, mainHit, specialHit);
    const won = prize !== '未中奖';
    const mainLabel = g.main === 'red' ? '红球' : '前区';
    const specialLabel = g.special === 'blue' ? '蓝球' : '后区';
    this.setData({
      drawn: true,
      mainHit,
      specialHit,
      prize,
      won,
      hitText: mainLabel + '命中 ' + mainHit + ' 个 · ' + specialLabel + '命中 ' + specialHit + ' 个',
      resultText: (won ? '恭喜，模拟中出「' + prize + '」' : '很遗憾，模拟未中奖') + '（仅供娱乐）'
    });
    this.recordStats(gameId, prize);
  },

  recordStats(gameId, prize) {
    if (store.state.game !== gameId) return;
    const s = store.state.stats;
    s.count++;
    if (prize !== '未中奖') {
      s.win++;
      if (!s.best || RANK[prize] < RANK[s.best]) s.best = prize;
    }
    store.saveStats();
    this.renderStats();
  },

  randInt(area) {
    return area.min + Math.floor(Math.random() * (area.max - area.min + 1));
  }
});
