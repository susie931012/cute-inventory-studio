'use strict';
const FRAME_STYLES = { soft: '柔和圆角', polaroid: '拍立得', double: '双线描边', stitch: '布艺缝线', scallop: '花边邮票', none: '透明无框' };
const TEXT_STYLES = { pill: '圆润胶囊', ribbon: '缎带标签', ticket: '小票边', outline: '细线描边', notebook: '便签横线', glass: '半透明', none: '无底框' };
const FONT_PRESETS = {
  sans: { name: '清晰黑体', family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  song: { name: '经典宋体', family: '"SimSun", "Songti SC", "Noto Serif CJK SC", serif' },
  kai: { name: '手写楷体', family: '"KaiTi", "STKaiti", "Kaiti SC", serif' },
  fang: { name: '秀气仿宋', family: '"FangSong", "STFangsong", serif' },
  deng: { name: '轻盈等线', family: '"DengXian", "Microsoft JhengHei", "PingFang SC", sans-serif' }
};
function normalizeAppearance(data) {
  normalizeTitles(data);
  if (!Object.hasOwn(FRAME_STYLES, data.imageFrame)) data.imageFrame = 'soft';
  if (!Object.hasOwn(TEXT_STYLES, data.textFrame)) data.textFrame = 'pill';
  if (!data.customFont) data.customFont = null;
  if (!Object.hasOwn(FONT_PRESETS, data.fontChoice) && !(data.fontChoice === 'custom' && data.customFont)) data.fontChoice = 'sans';
  return data;
}
const fontCache = new Map();
let fontSequence = 0;
async function resolvePosterFont(data) {
  if (data.fontChoice !== 'custom' || !data.customFont) return (FONT_PRESETS[data.fontChoice] || FONT_PRESETS.sans).family;
  const source = data.customFont.data;
  if (!fontCache.has(source)) {
    const family = 'CollectionCustomFont' + (++fontSequence);
    const task = (async () => {
      const face = new FontFace(family, `url(${source})`);
      await face.load(); document.fonts.add(face); return `"${family}", ${FONT_PRESETS.sans.family}`;
    })();
    fontCache.set(source, task);
    task.catch(() => fontCache.delete(source));
  }
  return fontCache.get(source);
}
function drawImageFrame(ctx, style, x, y, w, h, artH, theme) {
  ctx.save();
  if (style === 'none') { ctx.restore(); return; }
  if (style === 'polaroid') {
    round(ctx, x+3, y+4, w-3, h-4, 3, theme.border);
    round(ctx, x, y, w-3, h-4, 3, theme.card, theme.border);
    round(ctx, x+10, y+10, w-23, artH, 1, theme.art);
    ctx.fillStyle = theme.chip; ctx.globalAlpha = .8;
    ctx.translate(x+w/2, y+4); ctx.rotate(-.07); ctx.fillRect(-w*.15,-2,w*.3,11);
  } else if (style === 'double') {
    round(ctx,x,y,w,h,10,theme.card,theme.accent);
    round(ctx,x+5,y+5,w-10,h-10,7,null,theme.border);
    round(ctx,x+11,y+11,w-22,artH-1,6,theme.art);
  } else if (style === 'stitch') {
    round(ctx,x,y,w,h,21,theme.chip,theme.border);
    ctx.setLineDash([5,4]); round(ctx,x+6,y+6,w-12,h-12,17,null,theme.accent); ctx.setLineDash([]);
    round(ctx,x+12,y+12,w-24,artH-2,13,theme.card);
  } else if (style === 'scallop') {
    const inset=4, step=16, left=x+inset, right=x+w-inset, top=y+inset, bottom=y+h-inset;
    ctx.beginPath(); ctx.moveTo(left,top);
    let count=Math.max(1,Math.round((right-left)/step));
    for(let i=0;i<count;i++){const a=left+(right-left)*i/count,b=left+(right-left)*(i+1)/count;ctx.quadraticCurveTo((a+b)/2,top-7,b,top);}
    count=Math.max(1,Math.round((bottom-top)/step));
    for(let i=0;i<count;i++){const a=top+(bottom-top)*i/count,b=top+(bottom-top)*(i+1)/count;ctx.quadraticCurveTo(right+7,(a+b)/2,right,b);}
    count=Math.max(1,Math.round((right-left)/step));
    for(let i=0;i<count;i++){const a=right-(right-left)*i/count,b=right-(right-left)*(i+1)/count;ctx.quadraticCurveTo((a+b)/2,bottom+7,b,bottom);}
    count=Math.max(1,Math.round((bottom-top)/step));
    for(let i=0;i<count;i++){const a=bottom-(bottom-top)*i/count,b=bottom-(bottom-top)*(i+1)/count;ctx.quadraticCurveTo(left-7,(a+b)/2,left,b);}
    ctx.closePath();ctx.fillStyle=theme.card;ctx.fill();ctx.strokeStyle=theme.border;ctx.lineWidth=1.5;ctx.stroke();
    round(ctx,x+10,y+10,w-20,artH,9,theme.art);
  } else {
    round(ctx,x,y+3,w,h,18,theme.border);round(ctx,x,y,w,h,18,theme.card,theme.border);
    round(ctx,x+10,y+10,w-20,artH,12,theme.art);
  }
  ctx.restore();
}
function drawTextFrame(ctx, style, x, y, w, h, theme) {
  ctx.save();
  if (style==='none') { ctx.restore(); return; }
  if (style==='ribbon') {
    const notch=Math.min(15,h*.3);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w-notch,y+h/2);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x+notch,y+h/2);ctx.closePath();ctx.fillStyle=theme.chip;ctx.fill();
    ctx.strokeStyle=theme.border;ctx.lineWidth=1.3;ctx.stroke();
  } else if (style==='ticket') {
    const r=Math.min(8,h/5);ctx.beginPath();ctx.moveTo(x+3,y);ctx.lineTo(x+w-3,y);ctx.lineTo(x+w,y+3);ctx.lineTo(x+w,y+h/2-r);ctx.arc(x+w,y+h/2,r,-Math.PI/2,-Math.PI*1.5,true);ctx.lineTo(x+w,y+h-3);ctx.lineTo(x+w-3,y+h);ctx.lineTo(x+3,y+h);ctx.lineTo(x,y+h-3);ctx.lineTo(x,y+h/2+r);ctx.arc(x,y+h/2,r,Math.PI/2,-Math.PI/2,true);ctx.lineTo(x,y+3);ctx.closePath();ctx.fillStyle=theme.chip;ctx.fill();ctx.strokeStyle=theme.border;ctx.lineWidth=1.2;ctx.stroke();
    ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x+14,y+5);ctx.lineTo(x+14,y+h-5);ctx.moveTo(x+w-14,y+5);ctx.lineTo(x+w-14,y+h-5);ctx.stroke();
  } else if (style==='outline') {
    round(ctx,x,y,w,h,8,theme.card,theme.accent);
  } else if (style==='notebook') {
    round(ctx,x,y,w,h,4,theme.card,theme.border);ctx.strokeStyle=theme.border;ctx.lineWidth=1;
    for(let yy=y+h-8;yy>y+8;yy-=22){ctx.beginPath();ctx.moveTo(x+8,yy);ctx.lineTo(x+w-8,yy);ctx.stroke();}
    ctx.fillStyle=theme.accent;ctx.globalAlpha=.4;ctx.fillRect(x+7,y+5,3,h-10);
  } else if (style==='glass') {
    ctx.globalAlpha=.72;round(ctx,x,y,w,h,13,theme.card);ctx.globalAlpha=.9;round(ctx,x+1,y+1,w-2,h-2,12,null,theme.border);
  } else { round(ctx,x,y,w,h,h/2,theme.chip); }
  ctx.restore();
}
function appearanceSample(kind, style, theme) {
  const c=document.createElement('canvas');c.width=180;c.height=112;c.setAttribute('aria-hidden','true');const ctx=c.getContext('2d');ctx.fillStyle='#FBF8FA';ctx.fillRect(0,0,180,112);
  if(kind==='image') {drawImageFrame(ctx,style,44,7,92,96,57,theme);ctx.fillStyle=theme.accent;ctx.font='29px sans-serif';ctx.textAlign='center';ctx.fillText('♡',90,52);ctx.font='11px sans-serif';ctx.fillStyle=theme.ink;ctx.fillText('收藏',90,87);}
  else {drawTextFrame(ctx,style,10,34,160,46,theme);ctx.fillStyle=theme.ink;ctx.textAlign='center';ctx.font='17px sans-serif';ctx.fillText('心动物品',90,64);}
  return c;
}
