const store = require('../../utils/store.js');
const { analyze } = require('../../utils/engine.js');
const chart = require('../../utils/chart.js');

const WINDOWS = [
  { value: 30, label: '最近 30 期' },
  { value: 50, label: '最近 50 期' },
  { value: 100, label: '最近 100 期' },
  { value: 0, label: '全部数据' }
];

Page({
  data: {
    games: store.GAME_IDS.map(id => ({ id, name: store.GAME[id].name })),
    gameId: 'ssq',
    windowLabel: '最近 50 期',
    dataCount: 0,
    dataSource: '',
    latestIssue: '',
    latestDate: '',
    latestBalls: [],
    hot: [],
    cold: [],
    omission: [],
    omissionMeta: '',
    freqMeta: '50',
    sumMeta: '',
    history: []
  },

  onLoad() {
    this.gameId = store.state.game;
    this.windowSize = store.state.windowSize;
    this.read();
  },

  onReady() {
    this.drawCharts();
  },

  onShow() {
    if (this.gameId !== store.state.game) {
      this.gameId = store.state.game;
      this.read();
    }
  },

  onSwitchGame(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.gameId) return;
    store.setGame(id);
    this.gameId = id;
    this.read();
  },

  onWindowTap() {
    const items = WINDOWS.map(w => w.label);
    wx.showActionSheet({
      itemList: items,
      success: res => {
        const chosen = WINDOWS[res.tapIndex];
        this.windowSize = chosen.value;
        store.state.windowSize = chosen.value;
        this.setData({ windowLabel: chosen.label });
        this.read();
      }
    });
  },

  read() {
    const gameId = this.gameId;
    const g = store.GAME[gameId];
    const history = store.HISTORY[gameId];
    const meta = store.DATA_META[gameId];
    const analysisMap = analyze(gameId, this.windowSize);
    const main = analysisMap[g.main];
    const special = analysisMap[g.special];
    const latest = history[0];

    const pad = store.pad;
    const balls = [];
    g.areas.forEach((area, i) => {
      if (i > 0) balls.push({ k: 'latest-plus-' + i, n: '+', cls: 'ball plus sm' });
      (latest.areas[area.key] || []).forEach(n => {
        balls.push({ k: 'latest-' + area.key + '-' + n, n: pad(n), cls: 'ball ' + area.cls });
      });
    });

    const historyView = history.slice(0, 8).map(d => ({
      issue: d.issue,
      balls: store.pickBalls(d, true)
    }));

    this.mainAreaLabel = g.main === 'red' ? '红球' : '前区';
    this.specialAreaLabel = g.special === 'blue' ? '蓝球' : '后区';

    this.setData({
      gameId,
      dataCount: history.length,
      dataSource: meta.live ? '官方数据 · 更新于 ' + store.formatUpdated(meta.updatedAt) : '离线内置数据',
      latestIssue: latest.issue,
      latestDate: latest.date || '',
      latestBalls: balls,
      hot: main.hot.map(n => ({ n: pad(n), freq: main.freq[n] })),
      cold: main.cold.map(n => ({ n: pad(n), omission: main.omission[n] })),
      omission: main.maxOmissionNums.map(n => ({ n: pad(n), omission: main.omission[n] })),
      omissionMeta:
        this.mainAreaLabel + '平均遗漏约 ' + main.gap.toFixed(1) +
        ' 期 · ' + this.specialAreaLabel + '最深遗漏 ' +
        Math.max.apply(null, special.omission.slice(1)) + ' 期',
      freqMeta: String(main.window),
      sumMeta: main.window + ' 期 · 区间 ' + g.sumIdeal[0] + '-' + g.sumIdeal[1],
      history: historyView
    });

    this.currentMain = main;
    this.currentSumIdeal = g.sumIdeal;
    this.canvasRetries = {};
    wx.nextTick(() => this.drawCharts());
  },

  drawCharts() {
    if (!this.currentMain) return;
    this.renderCanvas('freqChart', (ctx, w, h) => {
      chart.drawFreqChart(ctx, w, h, this.currentMain);
    });
    this.renderCanvas('sumChart', (ctx, w, h) => {
      chart.drawSumChart(ctx, w, h, this.currentMain, this.currentSumIdeal);
    });
  },

  renderCanvas(id, draw) {
    const query = wx.createSelectorQuery();
    query.select('#' + id).fields({ node: true, size: true }).exec(res => {
      const info = res && res[0];
      if (!info || !info.node || !info.width || !info.height) {
        this.canvasRetries = this.canvasRetries || {};
        const used = this.canvasRetries[id] || 0;
        if (used < 2) {
          this.canvasRetries[id] = used + 1;
          setTimeout(() => this.drawCharts(), 120);
        }
        return;
      }
      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
      canvas.width = info.width * dpr;
      canvas.height = info.height * dpr;
      ctx.scale(dpr, dpr);
      draw(ctx, info.width, info.height);
    });
  }
});
