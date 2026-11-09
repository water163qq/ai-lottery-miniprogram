const store = require('../../utils/store.js');

Page({
  data: {
    updatedText: '',
    draws: [],
    news: [],
    newsCountText: ''
  },

  onShow() {
    this.read();
  },

  onRefresh() {
    this.read();
    wx.showToast({ title: '已刷新资讯', icon: 'none' });
  },

  read() {
    const live = store.LIVE_DATA || {};
    const info = live.info || {};
    const news = Array.isArray(live.news) ? live.news : [];

    const draws = store.GAME_IDS.map(id => {
      const g = store.GAME[id];
      const latest = store.HISTORY[id] && store.HISTORY[id][0];
      if (!latest) return null;
      const meta = store.DATA_META[id] || {};
      const detail = info[id] || {};
      const metaRows = [];
      if (detail.sales) metaRows.push({ label: '销售额', value: store.formatMoney(detail.sales) });
      if (detail.pool) metaRows.push({ label: '奖池', value: store.formatMoney(detail.pool) });
      if (detail.firstCount) {
        let value = detail.firstCount + ' 注';
        if (detail.firstPrize) value += ' · ' + store.formatMoney(detail.firstPrize) + ' 元/注';
        metaRows.push({ label: '一等奖', value });
      }
      return {
        id,
        name: g.name,
        issue: latest.issue,
        date: latest.date || '',
        balls: store.pickBalls(latest, false, id),
        meta: metaRows,
        content: detail.content || '',
        source: (meta.live ? '官方数据' : '内置数据') +
          (meta.updatedAt ? ' · 更新于 ' + store.formatUpdated(meta.updatedAt) : '')
      };
    }).filter(Boolean);

    this.setData({
      draws,
      news: news.map((n, i) => ({
        k: 'news-' + i,
        url: n.url,
        title: n.title,
        source: n.source || '资讯',
        date: store.formatNewsDate(n.date)
      })),
      newsCountText: news.length > 0 ? '共 ' + news.length + ' 条' : '',
      updatedText: live.updatedAt ? '· 更新于 ' + store.formatUpdated(live.updatedAt) : ''
    });
  },

  onOpenNews(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '小程序无法直接打开外部网页，链接已复制到剪贴板，请在浏览器中粘贴访问。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  }
});
