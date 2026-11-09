const store = require('../../utils/store.js');
const { generatePick } = require('../../utils/engine.js');

Page({
  data: {
    games: store.GAME_IDS.map(id => ({ id, name: store.GAME[id].name })),
    gameId: 'ssq',
    strategies: store.STRATEGIES,
    strategy: 'smart',
    strategyDesc: '',
    pickCount: 1,
    opts: {
      sumRange: true,
      oddEven: true,
      zoneBalance: true,
      noTripleRun: true
    },
    picks: [],
    pickMeta: '',
    filterMode: 'must',
    filterAreas: [],
    mustBanStatus: '定胆必含，杀号排除',
    manualAreas: [],
    manualStatus: '点击号码选球'
  },

  onLoad() {
    const desc = store.STRATEGIES.filter(s => s.key === store.state.strategy)[0];
    this.setData({
      strategy: store.state.strategy,
      strategyDesc: desc ? desc.desc : ''
    });
    this.read();
  },

  onShow() {
    this.read();
  },

  read() {
    const s = store.state;
    const desc = store.STRATEGIES.filter(item => item.key === s.strategy)[0];
    this.setData({
      gameId: s.game,
      strategy: s.strategy,
      strategyDesc: desc ? desc.desc : '',
      filterMode: s.filterMode
    });
    this.renderPicks();
    this.renderFilter();
    this.renderManual();
  },

  onSwitchGame(e) {
    const id = e.currentTarget.dataset.id;
    if (id === store.state.game) return;
    store.setGame(id);
    this.setData({ gameId: id, picks: [] });
    this.read();
  },

  onStrategy(e) {
    const key = e.currentTarget.dataset.key;
    const desc = store.STRATEGIES.filter(s => s.key === key)[0];
    store.state.strategy = key;
    this.setData({ strategy: key, strategyDesc: desc ? desc.desc : '' });
  },

  onPickCount() {
    wx.showActionSheet({
      itemList: ['1 注', '5 注', '10 注'],
      success: res => {
        this.setData({ pickCount: [1, 5, 10][res.tapIndex] });
      }
    });
  },

  onToggleOpt(e) {
    const key = e.currentTarget.dataset.key;
    const opts = Object.assign({}, this.data.opts);
    opts[key] = !opts[key];
    this.setData({ opts });
  },

  buildOpts() {
    const opts = this.data.opts;
    return {
      windowSize: store.state.windowSize,
      sumRange: opts.sumRange,
      oddEven: opts.oddEven,
      zoneBalance: opts.zoneBalance,
      noTripleRun: opts.noTripleRun,
      must: store.state.must,
      exclude: store.state.ban
    };
  },

  onGenerate() {
    const count = this.data.pickCount;
    const opts = this.buildOpts();
    const picks = [];
    try {
      for (let i = 0; i < count; i++) {
        picks.push(
          generatePick(
            store.state.game,
            this.data.strategy,
            opts,
            (Date.now() * 31 + i * 7 + Math.floor(Math.random() * 1e9)) >>> 0
          )
        );
      }
    } catch (err) {
      wx.showToast({ title: err.message || '定胆或杀号设置冲突', icon: 'none' });
      return;
    }
    store.state.picks = picks;
    this.renderPicks();
    wx.showToast({ title: '已生成 ' + count + ' 注', icon: 'none' });
  },

  renderPicks() {
    const picks = store.state.picks;
    const g = store.game();
    const labels = {};
    store.STRATEGIES.forEach(s => { labels[s.key] = s.label; });
    const view = picks.map((p, i) => ({
      k: 'pick-' + i,
      balls: store.pickBalls(p),
      scoreText: p.score !== null && p.score !== undefined ? '智能评分 ' + (p.score * 100).toFixed(0) : '',
      fav: this.isFav(p)
    }));
    const meta = picks.length === 0
      ? ''
      : g.name + ' · ' + labels[store.state.strategy] + ' · ' + picks.length +
        ' 注 · 生成于 ' + new Date(picks[0].ts).toLocaleTimeString();
    this.setData({ picks: view, pickMeta: meta });
  },

  isFav(p) {
    const text = store.pickText(p);
    return store.state.favs.some(f => store.pickText(f) === text);
  },

  onCopyPick(e) {
    const p = store.state.picks[Number(e.currentTarget.dataset.index)];
    this.copy(store.pickText(p));
  },

  onCopyAll() {
    const text = store.state.picks.map(store.pickText).join('\n');
    this.copy(text, store.state.picks.length + ' 注已复制');
  },

  onFavPick(e) {
    const p = store.state.picks[Number(e.currentTarget.dataset.index)];
    this.toggleFav(p);
  },

  toggleFav(p) {
    const favs = store.state.favs;
    const text = store.pickText(p);
    const idx = favs.findIndex(f => store.pickText(f) === text);
    if (idx >= 0) {
      favs.splice(idx, 1);
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      favs.unshift({ areas: JSON.parse(JSON.stringify(p.areas)), game: store.state.game, ts: Date.now() });
      wx.showToast({ title: '已加入收藏', icon: 'none' });
    }
    store.saveFavs();
    this.renderPicks();
    this.renderManual();
  },

  copy(text, msg) {
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: msg || '已复制到剪贴板', icon: 'none' })
    });
  },

  onFilterMode(e) {
    const mode = e.currentTarget.dataset.mode;
    store.state.filterMode = mode;
    this.setData({ filterMode: mode });
    this.renderFilter();
  },

  renderFilter() {
    const s = store.state;
    const areas = store.game().areas.map(area => {
      const must = s.must[area.key] || [];
      const ban = s.ban[area.key] || [];
      const nums = [];
      for (let n = area.min; n <= area.max; n++) {
        const isMust = must.indexOf(n) >= 0;
        const isBan = ban.indexOf(n) >= 0;
        const blocked = s.filterMode === 'must' && isBan;
        nums.push({
          n,
          label: store.pad(n),
          mark: isMust ? 'must-mark' : isBan ? 'ban-mark' : '',
          disabled: blocked
        });
      }
      return {
        key: area.key,
        label: area.label,
        cls: area.cls,
        nums,
        mustCount: must.length,
        banCount: ban.length
      };
    });
    const totalMust = store.game().areas.reduce((sum, a) => sum + (s.must[a.key] || []).length, 0);
    const totalBan = store.game().areas.reduce((sum, a) => sum + (s.ban[a.key] || []).length, 0);
    const status = totalMust + totalBan === 0
      ? '定胆必含，杀号排除'
      : '定胆 ' + totalMust + ' 个 · 杀号 ' + totalBan + ' 个（下次生成生效）';
    this.setData({ filterAreas: areas, mustBanStatus: status });
  },

  onFilterTap(e) {
    const ds = e.currentTarget.dataset;
    if (Number(ds.disabled)) return;
    this.toggleFilterMark(ds.area, Number(ds.n));
  },

  toggleFilterMark(areaKey, n) {
    const s = store.state;
    const area = store.game().areas.filter(a => a.key === areaKey)[0];
    if (s.filterMode === 'must') {
      const ban = s.ban[areaKey];
      const must = s.must[areaKey];
      const bi = ban.indexOf(n);
      if (bi >= 0) ban.splice(bi, 1);
      const mi = must.indexOf(n);
      if (mi >= 0) {
        must.splice(mi, 1);
      } else {
        if (must.length >= area.pick) {
          wx.showToast({ title: area.label + '定胆最多 ' + area.pick + ' 个', icon: 'none' });
          return;
        }
        must.push(n);
        must.sort((a, b) => a - b);
      }
    } else {
      const must = s.must[areaKey];
      const ban = s.ban[areaKey];
      const mi = must.indexOf(n);
      if (mi >= 0) must.splice(mi, 1);
      const bi = ban.indexOf(n);
      if (bi >= 0) {
        ban.splice(bi, 1);
      } else {
        const remain = area.max - area.min + 1 - must.length - ban.length;
        if (remain <= area.pick) {
          wx.showToast({ title: area.label + '杀号过多，剩余号码不足', icon: 'none' });
          return;
        }
        ban.push(n);
        ban.sort((a, b) => a - b);
      }
    }
    this.renderFilter();
  },

  onFilterClear() {
    store.resetFilters();
    this.renderFilter();
  },

  renderManual() {
    const s = store.state;
    const areas = store.game().areas.map(area => {
      const selected = s.manual[area.key] || [];
      const nums = [];
      for (let n = area.min; n <= area.max; n++) {
        nums.push({ n, label: store.pad(n), picked: selected.indexOf(n) >= 0 });
      }
      return {
        key: area.key,
        label: area.label,
        cls: area.cls,
        pick: area.pick,
        selectedCount: selected.length,
        nums
      };
    });
    const done = store.manualComplete();
    const remain = store.game().areas.reduce(
      (sum, a) => sum + (a.pick - (s.manual[a.key] || []).length),
      0
    );
    const status = done ? '已选满一注，可收藏或参与模拟开奖' : '还需选择 ' + remain + ' 个号码';
    this.setData({ manualAreas: areas, manualStatus: status });
  },

  onManualTap(e) {
    const ds = e.currentTarget.dataset;
    this.toggleManual(ds.area, Number(ds.n));
  },

  toggleManual(areaKey, n) {
    const s = store.state;
    const area = store.game().areas.filter(a => a.key === areaKey)[0];
    const list = s.manual[areaKey];
    const idx = list.indexOf(n);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= area.pick) {
        wx.showToast({ title: area.label + '最多选 ' + area.pick + ' 个', icon: 'none' });
        return;
      }
      list.push(n);
      list.sort((a, b) => a - b);
    }
    this.renderManual();
  },

  onManualClear() {
    store.resetManual();
    this.renderManual();
  },

  onManualFill() {
    const s = store.state;
    store.game().areas.forEach(area => {
      const list = s.manual[area.key];
      const remaining = [];
      for (let n = area.min; n <= area.max; n++) {
        if (list.indexOf(n) < 0) remaining.push(n);
      }
      while (list.length < area.pick && remaining.length > 0) {
        const i = Math.floor(Math.random() * remaining.length);
        list.push(remaining.splice(i, 1)[0]);
      }
      list.sort((a, b) => a - b);
    });
    this.renderManual();
    wx.showToast({ title: '已随机补全', icon: 'none' });
  },

  onManualFav() {
    if (!store.manualComplete()) {
      wx.showToast({ title: '请先选满一注', icon: 'none' });
      return;
    }
    this.toggleFav({ areas: JSON.parse(JSON.stringify(store.state.manual)) });
  }
});
