function drawFreqChart(ctx, width, height, analysis, areas) {
  ctx.clearRect(0, 0, width, height);
  const area = analysis.area;
  const pool = area.max - area.min + 1;
  const padL = 26;
  const padB = 16;
  const padT = 8;
  const chartW = width - padL - 4;
  const chartH = height - padB - padT;
  const freqs = analysis.freq.slice(1);
  const maxF = Math.max.apply(null, freqs);
  const bw = chartW / pool;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.fillStyle = '#8a93a8';
  ctx.font = '10px sans-serif';
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();

  for (let n = area.min; n <= area.max; n++) {
    const f = analysis.freq[n];
    const h = maxF > 0 ? (f / maxF) * chartH : 0;
    const x = padL + (n - area.min) * bw;
    const grad = ctx.createLinearGradient(0, padT + chartH - h, 0, padT + chartH);
    const isHot = analysis.hot.indexOf(n) >= 0;
    const isCold = analysis.cold.indexOf(n) >= 0;
    if (isHot) {
      grad.addColorStop(0, '#ff8a8a');
      grad.addColorStop(1, '#c92a2a');
    } else if (isCold) {
      grad.addColorStop(0, '#74c0fc');
      grad.addColorStop(1, '#1864ab');
    } else {
      grad.addColorStop(0, 'rgba(108,140,255,0.85)');
      grad.addColorStop(1, 'rgba(108,140,255,0.25)');
    }
    ctx.fillStyle = grad;
    const gap = bw > 8 ? 2 : 0.5;
    ctx.fillRect(x + gap / 2, padT + chartH - h, Math.max(bw - gap, 0.5), h);
    if (pool <= 35 && (n - area.min) % Math.ceil(pool / 12) === 0) {
      ctx.fillStyle = '#8a93a8';
      ctx.fillText(String(n), x, height - 4);
    }
  }
  ctx.fillStyle = '#8a93a8';
  ctx.fillText(String(maxF), 4, padT + 8);
}

function drawSumChart(ctx, width, height, analysis, sumIdeal) {
  ctx.clearRect(0, 0, width, height);
  const source = analysis.sumSeries || [];
  const data = source.slice().reverse();
  if (data.length === 0) return;
  const padL = 30;
  const padR = 8;
  const padT = 12;
  const padB = 18;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const rawMin = Math.min.apply(null, data);
  const rawMax = Math.max.apply(null, data);
  const minV = rawMin - 4;
  const maxV = rawMax + 4;
  const span = Math.max(maxV - minV, 1);
  const x = i => (data.length === 1 ? padL + chartW / 2 : padL + (i / (data.length - 1)) * chartW);
  const y = v => padT + chartH - ((v - minV) / span) * chartH;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();

  const lo = sumIdeal[0];
  const hi = sumIdeal[1];
  const bandTop = y(Math.min(hi, maxV));
  const bandBottom = y(Math.max(lo, minV));
  if (bandBottom > bandTop) {
    ctx.fillStyle = 'rgba(108,140,255,0.08)';
    ctx.fillRect(padL, bandTop, chartW, bandBottom - bandTop);
    ctx.strokeStyle = 'rgba(108,140,255,0.25)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, bandTop);
    ctx.lineTo(padL + chartW, bandTop);
    ctx.moveTo(padL, bandBottom);
    ctx.lineTo(padL + chartW, bandBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (data.length > 1) {
    ctx.fillStyle = 'rgba(108,140,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(x(0), padT + chartH);
    data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(data.length - 1), padT + chartH);
    ctx.closePath();
    ctx.fill();
  }

  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(176,108,255,0.95)');
  grad.addColorStop(1, 'rgba(108,140,255,0.95)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.stroke();

  const lastX = x(data.length - 1);
  const lastY = y(data[data.length - 1]);
  ctx.fillStyle = '#b06cff';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8a93a8';
  ctx.font = '10px sans-serif';
  ctx.fillText(String(maxV), 3, padT + 4);
  ctx.fillText(String(minV), 3, padT + chartH);

  const step = Math.max(1, Math.ceil(data.length / 5));
  ctx.fillStyle = '#8a93a8';
  for (let i = 0; i < data.length; i += step) {
    const ago = data.length - 1 - i;
    ctx.fillText(ago === 0 ? '本期' : '-' + ago, x(i) - (ago === 0 ? 6 : 4), height - 4);
  }
  if (data.length > 1 && (data.length - 1) % step !== 0) {
    ctx.fillText('本期', x(data.length - 1) - 6, height - 4);
  }
}

module.exports = { drawFreqChart, drawSumChart };
