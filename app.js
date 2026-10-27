'use strict';
const $ = (id) => document.getElementById(id);
const THEMES = {
  cream: { name: '草莓奶油', bg: 'assets/cream-bg.webp', ribbon: 'assets/cream-ribbon.webp', ink: '#67444E', accent: '#99546B', card: '#FFFDFD', chip: '#FCE8ED', art: '#FFF4F5', border: '#E8C5D0' },
  candy: { name: '糖果泡泡', bg: 'assets/candy-bg.webp', ribbon: 'assets/candy-ribbon.webp', ink: '#3B567C', accent: '#426F9E', card: '#FFFFFF', chip: '#E7F3FF', art: '#F2F9FF', border: '#C7DEEF' },
  garden: { name: '云朵花园', bg: 'assets/garden-bg.webp', ribbon: 'assets/garden-ribbon.webp', ink: '#66577F', accent: '#79619E', card: '#FFFFFF', chip: '#EEE8F8', art: '#F8F5FF', border: '#DCD0EB' },
  peach: { name: '蜜桃甜心', bg: 'assets/peach-bg.webp', ribbon: 'assets/peach-ribbon.webp', ink: '#7C4B40', accent: '#AE6552', card: '#FFFCF8', chip: '#FFE5D8', art: '#FFF3EA', border: '#EBC6B3' },
  mint: { name: '薄荷茶会', bg: 'assets/mint-bg.webp', ribbon: 'assets/mint-ribbon.webp', ink: '#3F6251', accent: '#4E826A', card: '#FFFFFA', chip: '#E7F2DE', art: '#F3F8EF', border: '#B9D2B7' },
  stars: { name: '星糖梦境', bg: 'assets/stars-bg.webp', ribbon: 'assets/stars-ribbon.webp', ink: '#55567D', accent: '#7776A6', card: '#FFFEFC', chip: '#EDEBFC', art: '#F5F4FF', border: '#CEC9EC' },
  gothic: {"name": "暗黑甜酷", "ink": "#F8BAD1", "accent": "#CD7DA2", "card": "#21151F", "chip": "#36202E", "art": "#181218", "border": "#98627F", "panel": "#171118", "base": "#100D12", "fade": "16,13,18", "subtitleInk": "#F8BAD1", "bg": "assets/gothic-bg.webp", "ribbon": "assets/gothic-ribbon.webp"},
  princess: {"name": "粉绸公主", "ink": "#923D65", "accent": "#C36A91", "card": "#FFF8F5", "chip": "#FCE4EE", "art": "#FFF2F5", "border": "#D9A1BA", "panel": "#FFF3F3", "base": "#F9D5E3", "fade": "255,244,247", "subtitleInk": "#923D65", "bg": "assets/princess-bg.webp", "ribbon": "assets/princess-ribbon.webp"},
  swan: {"name": "黑天鹅典藏", "ink": "#49313B", "accent": "#9A704B", "card": "#FFF5EF", "chip": "#F0DCE2", "art": "#FCF0ED", "border": "#B9946D", "panel": "#F8ECE8", "base": "#100E12", "fade": "16,14,18", "subtitleInk": "#F7E5C4", "bg": "assets/swan-bg.webp", "ribbon": "assets/swan-ribbon.webp"}
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const uid = () => 'id-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
const assetUrl = (v) => window.LOCAL_ASSETS?.[v] || v;
const imgCache = new Map();
let state = normalizeAppearance(clone(window.INVENTORY_SEED)), active = state.categories[0]?.id, history = [], db, revision = 0;
let dirty = false, saveTimer, saveChain = Promise.resolve(), conflict = false, renderSerial = 0, renderTimer, hits = [];
let modalSubmit = null, modalDirty = false, modalImage = '', modalItem = null, focusBeforeModal, modalEpoch = 0;
const fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (key === 'class') n.className = val;
    else if (key.startsWith('on')) n.addEventListener(key.slice(2), val);
    else if (key === 'text') n.textContent = val;
    else if (key === 'value') n.value = val;
    else n.setAttribute(key, val);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) n.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return n;
}
function button(text, fn, props = {}) { return el('button', { type: 'button', text, onclick: fn, ...props }); }
function notify(text, delay = 4200) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => $('toast').hidden = true, delay);
}
function showStorageError(text) {
  const box = $('storageError'); box.hidden = false; box.replaceChildren(el('span', { text }), button('下载当前备份', backup), button('重新载入', async () => {
    if (await ask('重新载入已保存的收藏册？', '当前未保存的修改会被替换，建议先下载备份。', '重新载入')) { dirty = false; location.reload(); }
  }));
}
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  src = assetUrl(src);
  if (!imgCache.has(src)) imgCache.set(src, new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { imgCache.delete(src); reject(new Error('图片无法读取，请重新上传。')); }; image.src = src;
  }));
  return imgCache.get(src);
}
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cute-inventory-studio-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function readSaved() {
  return new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('main'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
function queueSave() {
  dirty = true; $('saveStatus').textContent = '正在保存修改…';
  clearTimeout(saveTimer); saveTimer = setTimeout(() => saveChain = saveChain.then(save).catch(handleSaveError), 300);
}
function handleSaveError(error) {
  $('saveStatus').textContent = '尚未保存 · 请下载备份';
  showStorageError(error.message || '浏览器存储不可用，当前修改仍在页面中，请下载备份。');
}
async function save() {
  if (conflict) throw new Error('另一个窗口已更新收藏册。请先下载当前备份，再重新载入。');
  if (!db) throw new Error('浏览器存储不可用，当前修改仍在页面中，请下载备份。');
  const snapshot = clone(state);
  await new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), req = store.get('main');
    let next;
    req.onsuccess = () => {
      if ((req.result?.revision || 0) !== revision) { conflict = true; tx.abort(); return; }
      next = revision + 1; store.put({ state: snapshot, revision: next }, 'main');
    };
    tx.oncomplete = () => { revision = next; resolve(); };
    tx.onerror = () => reject(new Error('保存失败，可能是浏览器存储空间不足。请下载备份后重试。'));
    tx.onabort = () => reject(new Error('另一个窗口已更新收藏册。请先下载当前备份，再重新载入。'));
  });
  if (JSON.stringify(state) === JSON.stringify(snapshot)) { dirty = false; $('saveStatus').textContent = '已保存在此浏览器'; }
}
function commit(mutator, message, refresh = true) {
  history.push(clone(state)); if (history.length > 12) history.shift();
  mutator(state); queueSave(); $('undo').disabled = false;
  if (refresh) renderEditor(); scheduleRender(); if (message) notify(message);
}
function selected() { return state.categories.find(c => c.id === active); }
function sorted(items) { return [...items.filter(i => i.image), ...items.filter(i => !i.image)]; }
function renderEditor() {
  if (!selected()) active = state.categories[0]?.id;
  $('categories').replaceChildren(...state.categories.map(c => button(c.name, () => { active = c.id; $('search').value = ''; renderEditor(); }, { 'aria-pressed': String(c.id === active) })));
  const cat = selected(); $('activeName').textContent = cat?.name || '还没有分类';
  for (const id of ['addItem', 'batchText', 'batchUpload', 'editCategory', 'search']) $(id).disabled = !cat;
  const idx = state.categories.indexOf(cat); $('categoryUp').disabled = idx <= 0; $('categoryDown').disabled = idx < 0 || idx === state.categories.length - 1;
  renderItems(); renderDesign();
}
function renderItems() {
  const cat = selected(), query = $('search').value.trim().toLocaleLowerCase(); $('clearSearch').hidden = !query;
  const items = cat ? sorted(cat.items).filter(i => i.name.toLocaleLowerCase().includes(query)) : [];
  if (!items.length) { $('itemList').replaceChildren(el('div', { class: 'empty', text: query ? '没有找到匹配物品，试试其他名称。' : cat ? '这个分类还是空的，添加第一件物品吧。' : '先新建一个分类，开始整理收藏。' })); return; }
  $('itemList').replaceChildren(...items.map(item => {
    const open = button('', () => openItem(item.id), { class: 'item-open', 'aria-label': '编辑物品：' + item.name });
    if (item.image) open.append(el('img', { src: assetUrl(item.image), alt: '', loading: 'lazy' }));
    else open.append(el('span', { class: 'placeholder', text: 'Aa', 'aria-hidden': 'true' }));
    open.append(el('span', { class: 'name', text: item.name }));
    const group = cat.items.filter(v => Boolean(v.image) === Boolean(item.image));
    const index = group.indexOf(item);
    const up = button('↑', () => moveItem(item.id, -1), { 'aria-label': '前移 ' + item.name, title: '前移' }); up.disabled = index === 0;
    const down = button('↓', () => moveItem(item.id, 1), { 'aria-label': '后移 ' + item.name, title: '后移' }); down.disabled = index === group.length - 1;
    return el('article', { class: 'item-card' + (!item.image ? ' text-only' : '') }, open, el('div', { class: 'item-controls' }, up, down, button('删除', () => removeItem(item.id), { 'aria-label': '删除 ' + item.name })));
  }));
}
function renderDesign() {
  renderTitleControls();
  $('themes').replaceChildren(...Object.entries(THEMES).map(([key, theme]) => {
    const b = button('', () => commit(s => { s.theme = key; s.accent = ''; s.background = null; s.categories.forEach(c => { if (!c.ribbon) c.ribbon = null; }); }, '已切换为' + theme.name), { class: 'theme-card', 'aria-pressed': String(state.theme === key) });
    b.append(el('img', { src: assetUrl(theme.bg), alt: '' }), el('span', { text: theme.name })); return b;
  }));
  $('posterTitle').value = state.title; $('posterSubtitle').value = state.subtitle;
  $('columns').value = state.columns; $('fontSize').value = state.fontSize;
  for (const [container, kind, values, fieldName] of [['frameChoices','image',FRAME_STYLES,'imageFrame'],['textChoices','text',TEXT_STYLES,'textFrame']]) {
    $(container).replaceChildren(...Object.entries(values).map(([key,name]) => {
      const b = button('', () => { commit(s => s[fieldName] = key); $(container).querySelector('[aria-pressed="true"]').focus(); }, { class:'style-choice', 'aria-label': name, 'aria-pressed':String(state[fieldName] === key) });
      b.append(appearanceSample(kind,key,THEMES[state.theme]),el('span',{text:name}));return b;
    }));
  }
  $('fontChoice').replaceChildren(...Object.entries(FONT_PRESETS).map(([key,f]) => el('option',{value:key,text:f.name})), ...(state.customFont ? [el('option',{value:'custom',text:'已上传：'+state.customFont.name})] : []));
  $('fontChoice').value = state.fontChoice;
  $('customFontStatus').textContent = state.customFont ? '已保存字体：'+state.customFont.name+'（包含在下载备份中）' : '可上传 TTF / OTF / WOFF / WOFF2，最大 15MB。';
  $('removeFont').disabled = !state.customFont;
  const choice = state.fontChoice;
  resolvePosterFont(state).then(f => { if (state.fontChoice === choice) $('fontSample').style.fontFamily = f; }).catch(() => {});
  $('accentColor').value = state.accent || THEMES[state.theme].ink; $('accentValue').textContent = $('accentColor').value.toUpperCase();
  $('backgroundMode').value = state.backgroundMode; $('bgOpacity').value = state.bgOpacity; $('bgOpacityValue').textContent = state.bgOpacity + '%';
  $('backgroundThumb').src = assetUrl(state.background === '' ? transparentPixel : state.background || THEMES[state.theme].bg);
}
function moveItem(id, delta) {
  const cat = selected(), item = cat.items.find(v => v.id === id);
  const group = cat.items.filter(v => Boolean(v.image) === Boolean(item.image)), i = group.indexOf(item);
  if (i < 0 || !group[i + delta]) return;
  const a = cat.items.indexOf(item), b = cat.items.indexOf(group[i + delta]);
  commit(() => { [cat.items[a], cat.items[b]] = [cat.items[b], cat.items[a]]; });
}
function removeItem(id) { const cat = selected(), item = cat.items.find(v => v.id === id); commit(() => cat.items = cat.items.filter(v => v.id !== id), '已删除「' + item.name + '」，可点击顶部撤销。'); }
function moveCategory(delta) {
  const i = state.categories.findIndex(c => c.id === active); if (i < 0 || !state.categories[i + delta]) return;
  commit(s => [s.categories[i], s.categories[i + delta]] = [s.categories[i + delta], s.categories[i]]);
}
const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function field(labelText, control) { return el('div', { class: 'field' }, el('label', { for: control.id, text: labelText }), control); }
function openModal(title, children, submit) {
  modalEpoch++;
  focusBeforeModal = document.activeElement; modalSubmit = submit; modalDirty = false;
  $('modalTitle').textContent = title; $('modalBody').replaceChildren(...children); $('modalError').textContent = '';
  $('saveModal').textContent = '保存'; $('saveModal').disabled = false; $('modal').showModal();
  setTimeout(() => $('modalBody').querySelector('input,textarea,select,button')?.focus(), 0);
}
function closeModal() { modalEpoch++; $('modal').close(); modalSubmit = null; modalDirty = false; if (focusBeforeModal?.isConnected) focusBeforeModal.focus(); else (selected() ? $('addItem') : $('addCategory')).focus(); }
async function modalUpload(file, apply) {
  const epoch = modalEpoch; $('saveModal').disabled = true; $('saveModal').textContent = '正在处理图片…';
  try { const data = await readImage(file); if (epoch === modalEpoch) { apply(data); modalDirty = true; } }
  catch (e) { if (epoch === modalEpoch) $('modalError').textContent = e.message; }
  finally { if (epoch === modalEpoch) { $('saveModal').disabled = false; $('saveModal').textContent = '保存'; } }
}
async function cancelModal() {
  if (modalDirty && !await ask('放弃尚未保存的修改？', '收藏册中的原有内容不会改变。', '放弃修改')) return;
  closeModal();
}
function ask(title, message, yesText = '删除') {
  return new Promise(resolve => {
    const d = $('confirmDialog'); $('confirmTitle').textContent = title; $('confirmMessage').textContent = message; $('confirmYes').textContent = yesText;
    const done = value => { d.close(); $('confirmYes').onclick = null; $('confirmNo').onclick = null; d.oncancel = null; resolve(value); };
    $('confirmYes').onclick = () => done(true); $('confirmNo').onclick = () => done(false); d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal(); $('confirmNo').focus();
  });
}
function openItem(id = null) {
  const cat = selected(); if (!cat) return;
  const original = cat.items.find(i => i.id === id); modalImage = original?.image || ''; modalItem = id;
  const name = el('input', { id: 'itemName', value: original?.name || '', maxlength: '80', 'aria-describedby': 'modalError' });
  const image = el('img', { class: 'modal-preview', id: 'itemPreview', alt: '物品图片预览', src: assetUrl(modalImage || transparentPixel) });
  const imageControls = el('div', { class: 'actions' }, button('上传 / 替换图片', () => pickImage(false, files => modalUpload(files[0], data => {
    modalImage = data; image.src = data; if (!name.value.trim()) name.value = fileName(files[0].name);
  }))), button('移除图片', () => { modalImage = ''; image.src = transparentPixel; modalDirty = true; }));
  const dest = el('select', { id: 'itemCategory' }, ...state.categories.map(c => el('option', { value: c.id, text: c.name }))); dest.value = cat.id;
  openModal(original ? '编辑物品' : '添加物品', [field('物品名称', name), field('所在分类', dest), image, el('p', { class: 'help', text: 'PNG / JPG / WebP / GIF，每张 ≤ 20MB；图片可留空，成品直接显示名称。' }), imageControls], () => {
    if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); name.focus(); throw new Error('请填写物品名称。'); }
    const target = state.categories.find(c => c.id === dest.value);
    commit(() => {
      const data = { id: id || uid(), name: name.value.trim(), image: modalImage };
      if (id) { const i = cat.items.findIndex(v => v.id === id); if (target === cat) cat.items[i] = data; else { cat.items.splice(i, 1); target.items.push(data); } }
      else target.items.push(data);
      active = target.id;
    }, original ? '物品已更新' : '物品已添加'); closeModal();
  });
}
function openCategory(create = false) {
  const cat = create ? null : selected(); let ribbon = cat?.ribbon ?? null;
  const name = el('input', { id: 'categoryName', value: cat?.name || '', maxlength: '30', 'aria-describedby': 'modalError' });
  const preview = el('img', { class: 'modal-preview', alt: '分类标题装饰', src: assetUrl(ribbon || THEMES[state.theme].ribbon) });
  const children = [field('分类名称', name), preview, el('div', { class: 'actions' }, button('替换标题装饰', () => pickImage(false, files => modalUpload(files[0], data => { ribbon = data; preview.src = data; }))), button('跟随主题', () => { ribbon = null; preview.src = assetUrl(THEMES[state.theme].ribbon); modalDirty = true; }))];
  if (cat) children.push(el('p', { class: 'help', text: '删除分类会连同分类内的物品一起移除，可通过顶部撤销恢复。' }), button('删除此分类', async () => {
    if (!await ask('删除「' + cat.name + '」？', '分类与其中所有物品将从当前收藏册移除，可撤销恢复。')) return;
    commit(s => s.categories = s.categories.filter(c => c.id !== cat.id), '分类已删除，可点击顶部撤销。'); closeModal();
  }, { class: 'danger' }));
  openModal(create ? '新建分类' : '编辑分类', children, () => {
    if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); name.focus(); throw new Error('请填写分类名称。'); }
    commit(s => { if (cat) { cat.name = name.value.trim(); cat.ribbon = ribbon; } else { const newCat = { id: uid(), name: name.value.trim(), ribbon, items: [] }; s.categories.push(newCat); active = newCat.id; } }, '分类已保存'); closeModal();
  });
}
function openBatchText() {
  const cat = selected(); if (!cat) return;
  const area = el('textarea', { id: 'batchNames', rows: '9', placeholder: '每行填写一个物品名称\n例如：\n白玫瑰\n兔小美\n闪戒*23', style: 'resize: none', 'aria-describedby': 'modalError' });
  openModal('批量添加到「' + cat.name + '」', [field('物品名称 · 每行一个', area)], () => {
    const names = area.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!names.length) { area.setAttribute('aria-invalid', 'true'); area.focus(); throw new Error('请至少填写一个物品名称。'); }
    if (names.some(n => n.length > 80)) throw new Error('单个物品名称请控制在 80 字以内。');
    commit(() => names.forEach(name => cat.items.push({ id: uid(), name, image: '' })), '文字物品已添加'); closeModal();
  });
}
function pickImage(multiple, callback) {
  const input = $('filePicker'); input.accept = 'image/png,image/jpeg,image/webp,image/gif'; input.multiple = multiple; input.value = '';
  input.onchange = () => { if (input.files.length) callback([...input.files]); }; input.click();
}
function fileName(name) { return name.replace(/\.[^.]+$/, '').replace(/^\d+[.、_\s-]+/, '').trim().slice(0, 80) || '未命名物品'; }
async function readImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('请选择 PNG、JPG、WebP 或 GIF 图片。');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片超过 20MB，请选择较小的图片。');
  const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('文件读取失败，请重新选择。')); r.readAsDataURL(file); });
  const image = await loadImage(data);
  if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 100000000) throw new Error('图片尺寸过大，请先缩小到 10000 × 10000 像素以内。');
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height)), c = document.createElement('canvas');
  c.width = Math.round(image.width * scale); c.height = Math.round(image.height * scale); c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
  imgCache.delete(data); return c.toDataURL('image/webp', .9);
}
async function batchUpload(files) {
  const cat = selected(); if (!cat || !files.length) return;
  $('batchUpload').disabled = true; const valid = [], failures = [];
  for (let i = 0; i < files.length; i++) {
    $('uploadStatus').textContent = `正在读取 ${i + 1} / ${files.length}：${files[i].name}`;
    try { valid.push({ name: fileName(files[i].name), image: await readImage(files[i]) }); } catch (e) { failures.push(files[i].name + '：' + e.message); }
  }
  if (valid.length) commit(() => valid.forEach(v => { const existing = cat.items.find(i => i.name === v.name); if (existing) existing.image = v.image; else cat.items.push({ id: uid(), ...v }); }), '图片已添加，同名物品已匹配更新。');
  $('batchUpload').disabled = false; $('uploadStatus').textContent = failures.length ? failures.join('\n') : '图片已处理完成。';
}
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(renderPreview, 80); }
function round(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
}
function lines(ctx, text, width) {
  const result = []; let current = '';
  for (const letter of String(text)) { if (current && ctx.measureText(current + letter).width > width) { result.push(current); current = letter; } else current += letter; }
  if (current) result.push(current); return result.length ? result : [''];
}
function drawLines(ctx, text, x, y, width, size, color, align = 'center', weight = 600, family = fontFamily) {
  ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ls = lines(ctx, text, width); ls.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.4)); return ls.length * size * 1.4;
}
function contained(ctx, image, x, y, w, h) {
  if (!image) return; const scale = Math.min(w / image.width, h / image.height); const iw = image.width * scale, ih = image.height * scale;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
async function drawPoster(data, targetWidth = 1500) {
  normalizeAppearance(data);
  const family = await resolvePosterFont(data);
  const theme = THEMES[data.theme], ink = data.accent || theme.ink;
  const required = new Set([theme.ribbon, ...(data.background === '' ? [] : [data.background || theme.bg])]);
  data.categories.forEach(c => { if (c.ribbon) required.add(c.ribbon); c.items.forEach(i => { if (i.image) required.add(i.image); }); });
  const images = new Map(); await Promise.all([...required].map(async src => images.set(src, await loadImage(src))));
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), w = 1500, margin = 65, gap = 17;
  const cols = data.columns, cardW = (w - margin * 2 - gap * (cols - 1)) / cols;
  const size = ({ small: 20, normal: 24, large: 29 })[data.fontSize];
  const artH = cardW * .79, regions = [], operations = [];
  ctx.font = `600 ${size}px ${family}`;
  const mainTitle=data.titleLayout.main, categoryTitle=data.titleLayout.category;
  const mainBottom=mainTitle.frameY+mainTitle.height;
  let y = data.title ? mainBottom+30 : 65;
  const titleSize = Math.min(68, 730 / Math.max(1, data.title.length));
  if (data.subtitle) y += 48;
  for (const cat of data.categories) {
    const sectionY = y; y += categoryTitle.frameY+categoryTitle.height+18;
    const pics = cat.items.filter(i => i.image), text = cat.items.filter(i => !i.image);
    const cards = [], chips = [];
    for (let row = 0; row < pics.length; row += cols) {
      const rowItems = pics.slice(row, row + cols);
      const textH = Math.max(...rowItems.map(i => lines(ctx, i.name, cardW - 54).length)) * size * 1.4;
      const height = artH + textH + 48;
      rowItems.forEach((item, j) => { const x = margin + j * (cardW + gap); cards.push({ item, x, y, height }); regions.push({ x, y, w: cardW, h: height, cat: cat.id, item: item.id }); });
      y += height + gap;
    }
    const chipCols = Math.min(cols, 5), chipW = (w - 2 * margin - gap * (chipCols - 1)) / chipCols;
    for (let row = 0; row < text.length; row += chipCols) {
      const rowItems = text.slice(row, row + chipCols), height = Math.max(...rowItems.map(i => lines(ctx, i.name, chipW - 44).length)) * size * 1.4 + 20;
      rowItems.forEach((item, j) => { const x = margin + j * (chipW + gap); chips.push({ item, x, y, w: chipW, height }); regions.push({ x, y, w: chipW, h: height, cat: cat.id, item: item.id }); });
      y += height + 11;
    }
    if (!cat.items.length) y += 35;
    operations.push({ cat, sectionY, endY: y, cards, chips }); y += 58;
  }
  const height = Math.max(650, y + 40), scale = targetWidth / w;
  if (height * scale > 32000 || targetWidth * height * scale > 110000000) throw new Error('收藏册太长，请减少物品或增加每行图片数量后重试。');
  canvas.width = targetWidth; canvas.height = Math.ceil(height * scale); ctx.scale(scale, scale);
  ctx.fillStyle = theme.base || '#FFFCFD'; ctx.fillRect(0, 0, w, height);
  if (data.background !== '') {
    const bg = images.get(data.background || theme.bg);
    if (data.backgroundMode === 'cover') { const ratio = Math.max(w / bg.width, height / bg.height); ctx.drawImage(bg, (w - bg.width * ratio) / 2, (height - bg.height * ratio) / 2, bg.width * ratio, bg.height * ratio); }
    else { const h = bg.height / bg.width * w; for (let pos = 0; pos < height; pos += h) ctx.drawImage(bg, 0, pos, w, h); }
    ctx.fillStyle = `rgba(${theme.fade || '255,255,255'},${data.bgOpacity / 100})`; ctx.fillRect(0, 0, w, height);
  }
  const ribbon = images.get(theme.ribbon);
  if (data.title) drawEditableTitle(ctx,ribbon,data.title,Math.max(0,Math.min(w-mainTitle.width,(w-mainTitle.width)/2+mainTitle.frameX)),mainTitle.frameY,mainTitle,ink,family);
  if (data.subtitle) drawLines(ctx, data.subtitle, 750, data.title ? mainBottom+8 : 38, 1250, 23, data.accent || theme.subtitleInk || ink, 'center', 400, family);
  for (const { cat, sectionY, endY, cards, chips } of operations) {
    if (theme.panel) {
      ctx.save(); ctx.lineWidth = 2;
      round(ctx, margin - 20, sectionY + 14, w - margin * 2 + 40, endY - sectionY + 4, 26, theme.panel, theme.border);
      round(ctx, margin - 13, sectionY + 21, w - margin * 2 + 26, endY - sectionY - 10, 21, null, theme.border);
      ctx.restore();
    }
    const titleX=Math.max(0,Math.min(w-categoryTitle.width,margin-5+categoryTitle.frameX));
    drawEditableTitle(ctx,images.get(cat.ribbon || theme.ribbon),cat.name,titleX,sectionY+categoryTitle.frameY,categoryTitle,ink,family);
    const lineX=titleX+categoryTitle.width+30;
    if(lineX<w-margin){ctx.strokeStyle=theme.border;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lineX,sectionY+categoryTitle.frameY+categoryTitle.height/2);ctx.lineTo(w-margin,sectionY+categoryTitle.frameY+categoryTitle.height/2);ctx.stroke();}
    for (const card of cards) {
      const { x, y, height: h, item } = card;
      drawImageFrame(ctx, data.imageFrame, x, y, cardW, h, artH, theme);
      contained(ctx, images.get(item.image), x + 19, y + 18, cardW - 38, artH - 16);
      drawTextFrame(ctx, data.textFrame, x + 10, y + artH + 17, cardW - 20, h - artH - 27, theme);
      drawLines(ctx, item.name, x + cardW / 2, y + artH + 27, cardW - 54, size, ink, 'center', 600, family);
    }
    for (const chip of chips) { drawTextFrame(ctx, data.textFrame, chip.x, chip.y, chip.w, chip.height, theme); drawLines(ctx, chip.item.name, chip.x + chip.w / 2, chip.y + 10, chip.w - 44, size, ink, 'center', 600, family); }
  }
  return { canvas, regions };
}
async function renderPreview() {
  const serial = ++renderSerial; $('previewStatus').textContent = '正在更新预览…';
  try {
    const result = await drawPoster(clone(state)); if (serial !== renderSerial) return;
    const target = $('poster'); target.width = result.canvas.width; target.height = result.canvas.height; target.getContext('2d').drawImage(result.canvas, 0, 0); hits = result.regions;
    $('previewStatus').textContent = '所有分类已显示 · 图片优先排列 · 名称自动换行'; applyZoom();
  } catch (e) { if (serial === renderSerial) $('previewStatus').textContent = e.message + ' 可重新上传相关图片后重试。'; }
}
function applyZoom() {
  const zoom = $('zoom').value; $('paperWrap').style.width = zoom === 'fit' ? '100%' : 1500 * Number(zoom) / 100 + 'px';
  $('paperWrap').style.maxWidth = zoom === 'fit' ? '850px' : 'none';
}
function download(blob, name) { const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
function safeFilename(text) { return text.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 60) || '收藏册'; }
async function exportPng() {
  $('export').disabled = true; $('export').textContent = '正在生成…';
  try { const { canvas } = await drawPoster(clone(state), 2400); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('图片生成失败，请重试。'); download(blob, safeFilename(state.title) + '.png'); notify('长图已生成，已开始下载。'); }
  catch (e) { notify('导出失败：' + e.message, 7000); }
  finally { $('export').disabled = false; $('export').textContent = '↓ 导出长图'; }
}
async function inlineImage(src) {
  if (!src || src.startsWith('data:')) return src;
  const im = await loadImage(src), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/webp', .95);
}
async function backup() {
  $('backup').disabled = true;
  try {
    const data = clone(state);
    await Promise.all(data.categories.flatMap(c => [inlineImage(c.ribbon).then(v => c.ribbon = v), ...c.items.map(i => inlineImage(i.image).then(v => i.image = v))]));
    if (data.background) data.background = await inlineImage(data.background);
    const blob = new Blob([JSON.stringify({ format: 'cute-inventory-studio', version: 1, exportedAt: new Date().toISOString(), data })], { type: 'application/json' });
    download(blob, safeFilename(state.title) + '-含图片备份.json'); notify('含图片的备份已下载。');
  } catch (e) { notify('备份失败：' + e.message, 7000); } finally { $('backup').disabled = false; }
}
function validateBackup(raw) {
  if (raw?.format !== 'cute-inventory-studio' || raw.version !== 1 || !raw.data || !Array.isArray(raw.data.categories)) throw new Error('这不是收藏册编辑台的有效备份文件。');
  const d = raw.data, str = (s, max) => typeof s === 'string' && s.length <= max;
  const validImage = v => v === '' || v === null || (typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 30000000);
  if (!str(d.title, 40) || !str(d.subtitle, 100) || !Object.hasOwn(THEMES, d.theme) || !Number.isInteger(d.columns) || d.columns < 3 || d.columns > 8 || !['small','normal','large'].includes(d.fontSize) || !['repeat','cover'].includes(d.backgroundMode) || !Number.isFinite(d.bgOpacity) || d.bgOpacity < 0 || d.bgOpacity > 90 || !/^(#[0-9a-fA-F]{6})?$/.test(d.accent || '') || !validImage(d.background) || d.categories.length > 60) throw new Error('备份中的主题或排版设置不完整，请选择正确的备份。');
  let total = 0;
  const categories = d.categories.map(c => {
    if (!str(c.name, 30) || !c.name.trim() || !validImage(c.ribbon) || !Array.isArray(c.items)) throw new Error('备份中的分类内容无效。');
    total += c.items.length; if (total > 1500) throw new Error('备份物品过多，最多支持 1500 项。');
    return { id: uid(), name: c.name, ribbon: c.ribbon, items: c.items.map(i => { if (!str(i.name, 80) || !i.name.trim() || !validImage(i.image)) throw new Error('备份中有无效的物品名称或图片。'); return { id: uid(), name: i.name, image: i.image || '' }; }) };
  });
  for (const [key, values] of [['imageFrame',FRAME_STYLES],['textFrame',TEXT_STYLES]]) if (d[key] !== undefined && !Object.hasOwn(values,d[key])) throw new Error('备份中的边框样式无效。');
  if (d.fontChoice !== undefined && d.fontChoice !== 'custom' && !Object.hasOwn(FONT_PRESETS,d.fontChoice)) throw new Error('备份中的字体设置无效。');
  let customFont = null;
  if (d.customFont) {
    if (!str(d.customFont.name,120) || typeof d.customFont.data !== 'string' || d.customFont.data.length > 22000000 || !/^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(d.customFont.data)) throw new Error('备份中的字体文件无效。');
    customFont = { name:d.customFont.name, data:d.customFont.data };
  }
  if (d.fontChoice === 'custom' && !customFont) throw new Error('备份缺少自定义字体文件。');
  return normalizeAppearance({ version:1, title:d.title, subtitle:d.subtitle, theme:d.theme, columns:d.columns, fontSize:d.fontSize, backgroundMode:d.backgroundMode, bgOpacity:d.bgOpacity, accent:d.accent || '', background:d.background, categories, imageFrame:d.imageFrame, textFrame:d.textFrame, fontChoice:d.fontChoice, titleLayout:d.titleLayout, customFont });
}
async function restoreFile(file) {
  if (!file) return;
  try {
    if (file.size > 150 * 1024 * 1024) throw new Error('备份超过 150MB，请使用较小的备份。');
    const data = validateBackup(JSON.parse(await file.text()));
    // Decode every uploaded image before replacing the current collection.
    const images = [data.background, ...data.categories.flatMap(c => [c.ribbon, ...c.items.map(i => i.image)])].filter(Boolean);
    await Promise.all([...new Set(images)].map(loadImage));
    if (data.customFont) await resolvePosterFont({ ...data, fontChoice:'custom' });
    if (!await ask('导入并替换当前收藏册？', '当前内容会被备份中的内容替换。导入后可点击顶部撤销。', '导入备份')) return;
    commit(() => { state = data; active = state.categories[0]?.id; }, '备份已导入');
  } catch (e) { notify('导入失败：' + e.message, 8000); }
}
function wire() {
  $('undo').onclick = () => { if (!history.length) return; state = history.pop(); $('undo').disabled = !history.length; queueSave(); renderEditor(); scheduleRender(); notify('已撤销上一步修改'); };
  $('addCategory').onclick = () => openCategory(true); $('editCategory').onclick = () => openCategory(); $('addItem').onclick = () => openItem(); $('batchText').onclick = openBatchText;
  $('categoryUp').onclick = () => moveCategory(-1); $('categoryDown').onclick = () => moveCategory(1);
  $('search').addEventListener('input', e => { if (!e.isComposing) renderItems(); }); $('search').addEventListener('compositionend', renderItems);
  $('clearSearch').onclick = () => { $('search').value = ''; renderItems(); $('search').focus(); };
  $('batchUpload').onclick = () => pickImage(true, batchUpload);
  $('batchUpload').ondragover = e => { e.preventDefault(); $('batchUpload').classList.add('drag'); };
  $('batchUpload').ondragleave = () => $('batchUpload').classList.remove('drag');
  $('batchUpload').ondrop = e => { e.preventDefault(); $('batchUpload').classList.remove('drag'); if (!$('batchUpload').disabled) batchUpload([...e.dataTransfer.files]); };
  function liveText(id, key) {
    let grouped = false;
    $(id).addEventListener('focus', () => grouped = false);
    const update = e => {
      if (e.isComposing || state[key] === $(id).value) return;
      if (!grouped) { history.push(clone(state)); if (history.length > 12) history.shift(); grouped = true; }
      state[key] = $(id).value; $('undo').disabled = false; queueSave(); scheduleRender();
    };
    $(id).addEventListener('input', update); $(id).addEventListener('compositionend', update);
  }
  liveText('posterTitle', 'title'); liveText('posterSubtitle', 'subtitle');
  for (const [id, key] of [['columns','columns'],['fontSize','fontSize'],['fontChoice','fontChoice'],['backgroundMode','backgroundMode'],['accentColor','accent']]) $(id).onchange = e => commit(s => s[key] = key === 'columns' ? Number(e.target.value) : e.target.value);
  $('uploadFont').onclick = () => { $('fontPicker').value=''; $('fontPicker').click(); };
  $('fontPicker').onchange = async () => {
    const file=$('fontPicker').files[0];if(!file)return;
    $('uploadFont').disabled=true;$('customFontStatus').textContent='正在读取并验证字体…';
    try {
      if(!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size>15*1024*1024)throw new Error('请选择 15MB 以内的 TTF、OTF、WOFF 或 WOFF2 字体文件。');
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('字体读取失败。'));reader.readAsDataURL(file);});
      const customFont={name:file.name.slice(0,120),data:'data:application/octet-stream;base64,'+String(encoded).split(',')[1]};
      await resolvePosterFont({fontChoice:'custom',customFont});
      commit(s=>{s.customFont=customFont;s.fontChoice='custom';},'字体已上传并应用，备份会包含此字体。');
    } catch(e) { $('customFontStatus').textContent='上传失败：'+e.message;notify('字体无法使用，请检查文件后重试。'); }
    finally { $('uploadFont').disabled=false; }
  };
  $('removeFont').onclick=()=>commit(s=>{s.customFont=null;if(s.fontChoice==='custom')s.fontChoice='sans';},'已移除上传字体');
  $('bgOpacity').oninput = e => $('bgOpacityValue').textContent = e.target.value + '%';
  $('bgOpacity').onchange = e => commit(s => s.bgOpacity = Number(e.target.value));
  $('resetColor').onclick = () => commit(s => s.accent = '');
  $('uploadBackground').onclick = () => pickImage(false, async files => { try { const bg = await readImage(files[0]); commit(s => s.background = bg, '背景已替换'); } catch (e) { notify(e.message); } });
  $('resetBackground').onclick = () => commit(s => s.background = null, '已恢复主题背景'); $('plainBackground').onclick = () => commit(s => s.background = '', '已使用纯色背景');
  $('zoom').onchange = applyZoom; $('export').onclick = exportPng; $('backup').onclick = backup;
  $('restore').onclick = () => { $('backupPicker').value = ''; $('backupPicker').click(); }; $('backupPicker').onchange = () => restoreFile($('backupPicker').files[0]);
  $('modalForm').onsubmit = async e => { e.preventDefault(); if (!modalSubmit || $('saveModal').disabled) return; $('saveModal').disabled = true; try { await modalSubmit(); } catch (err) { $('modalError').textContent = err.message; } finally { $('saveModal').disabled = false; } };
  $('modalForm').addEventListener('input', () => modalDirty = true);
  $('modalForm').addEventListener('change', () => modalDirty = true);
  $('cancelModal').onclick = cancelModal; $('closeModal').onclick = cancelModal; $('modal').oncancel = e => { e.preventDefault(); cancelModal(); };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-pressed', String(t === b))); $('itemsPanel').hidden = b.dataset.tab !== 'items'; $('designPanel').hidden = b.dataset.tab !== 'design'; });
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { document.body.dataset.view = b.dataset.view; document.querySelectorAll('[data-view]').forEach(t => t.setAttribute('aria-pressed', String(t === b))); });
  $('poster').onclick = e => {
    const rect = $('poster').getBoundingClientRect(), scale = 1500 / rect.width, x = (e.clientX - rect.left) * scale, y = (e.clientY - rect.top) * scale;
    const hit = hits.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (hit) { active = hit.cat; renderEditor(); openItem(hit.item); }
  };
  window.addEventListener('beforeunload', e => { if (dirty || modalDirty) { e.preventDefault(); e.returnValue = ''; } });
}
async function init() {
  wire();
  try { db = await openDatabase(); const saved = await readSaved(); if (saved?.state) { state = saved.state; revision = saved.revision || 0; } $('saveStatus').textContent = '已保存在此浏览器'; }
  catch (e) { handleSaveError(new Error('浏览器存储不可用。你仍可编辑和导出，请下载备份保存修改。')); }
  normalizeAppearance(state); renderEditor(); await renderPreview();
}
init();
