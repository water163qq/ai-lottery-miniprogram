const store = require('../../utils/store.js');
const { generatePick, prizeInfo } = require('../../utils/engine.js');

Page({
  data: {
    games: store.GAME_IDS.map(id => ({ id, name: store.GAME[id].name })),
    gameId: 'ssq',
    favs: [],
    favCount: 0,
    checkRows: [],
    drawnBalls: [],
    winCount: 0
  },

  onShow() {
    this.read();
  },

  read() {
    const s = store.state;
    const favs = s.favs.map((f, i) => ({ k: 'fav-' + i, balls: store.pickBalls(f) }));
    this.setData({
      gameId: s.game,
      favs,
      favCount: s.favs.length,
      checkRows: [],
      drawnBalls: [],
      winCount: 0
    });
  },

  onSwitchGame(e) {
    const id = e.currentTarget.dataset.id;
    if (id === store.state.game) return;
    store.setGame(id);
    this.read();
  },

  onCopy(e) {
    const f = store.state.favs[Number(e.currentTarget.dataset.index)];
    wx.setClipboardData({
      data: store.pickText(f),
      success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'none' })
    });
  },

  onRemove(e) {
    const index = Number(e.currentTarget.dataset.index);
    wx.showModal({
      title: '移除收藏',
      content: '确定要移除这一注收藏吗？',
      success: res => {
        if (!res.confirm) return;
        store.state.favs.splice(index, 1);
        store.saveFavs();
        this.read();
      }
    });
  },

  onCheckAll() {
    const s = store.state;
    if (s.favs.length === 0) {
      wx.showToast({ title: '收藏夹为空，先收藏几注再检票', icon: 'none' });
      return;
    }
    const g = store.game();
    const drawn = generatePick(
      s.game,
      'random',
      { windowSize: 0, sumRange: false, oddEven: false, zoneBalance: false, noTripleRun: false },
      (Date.now() & 0xffffffff) ^ 0x9e3779b9
    );

    let winCount = 0;
    const rows = s.favs.map((f, i) => {
      const mainHit = f.areas[g.main].filter(n => drawn.areas[g.main].indexOf(n) >= 0).length;
      const specialHit = f.areas[g.special].filter(n => drawn.areas[g.special].indexOf(n) >= 0).length;
      const prize = prizeInfo(s.game, mainHit, specialHit);
      const won = prize !== '未中奖';
      if (won) winCount++;
      return {
        k: 'check-' + i,
        index: String(i + 1).padStart(2, '0'),
        balls: store.pickBalls(f, true),
        won,
        text:
          (g.main === 'red' ? '红' : '前') + mainHit + ' · ' +
          (g.special === 'blue' ? '蓝' : '后') + specialHit + ' → ' + prize
      };
    });

    this.setData({
      drawnBalls: store.pickBalls(drawn, true),
      checkRows: rows,
      winCount
    });
  }
});
