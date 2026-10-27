const TITLE_LIMITS = {width:[240,1400],height:[70,500],frameX:[-300,300],frameY:[0,180],size:[12,140],textX:[-400,400],textY:[-160,160],safeWidth:[25,90]};
function titleDefaults(kind) { return {width:kind==='main'?960:500,height:kind==='main'?260:145,frameX:0,frameY:kind==='main'?25:0,size:kind==='main'?68:42,textX:0,textY:0,safeWidth:60,autoFit:true}; }
function normalizeTitles(data) {
 const source=data.titleLayout||{}; data.titleLayout={};
 for(const kind of ['main','category']) {
  const value=source[kind]||{}, result=titleDefaults(kind);
  for(const [key,[min,max]] of Object.entries(TITLE_LIMITS))if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.max(min,Math.min(max,value[key]));
  result.autoFit=value.autoFit!==false;data.titleLayout[kind]=result;
 }
 return data;
}
function renderTitleControls() {
 normalizeTitles(state);
 for(const kind of ['main','category']) {
  const host=$('title-'+kind);host.replaceChildren();
  const labels={width:'图片框宽度',height:'图片框高度',frameX:'图片框左右偏移',frameY:'图片框向下偏移',size:'文字大小',textX:'文字左右偏移',textY:'文字上下偏移',safeWidth:'文字可用宽度（%）'};
  for(const [key,label] of Object.entries(labels)) {
   const id=`title-${kind}-${key}`, [min,max]=TITLE_LIMITS[key], input=el('input',{id,type:'range',min,max,step:1,value:state.titleLayout[kind][key]});
   const output=el('output',{for:id,text:String(input.value)});
   let grouped=false;input.onpointerdown=()=>{grouped=false;};input.onfocus=()=>{grouped=false;};
   input.oninput=()=>{if(!grouped){history.push(clone(state));if(history.length>12)history.shift();grouped=true;}
    state.titleLayout[kind][key]=Number(input.value);output.textContent=input.value;$('undo').disabled=false;queueSave();scheduleRender();};
   host.append(el('div',{class:'field title-adjust'},el('label',{for:id,text:label}),output,input));
  }
  const check=el('input',{id:`title-${kind}-autoFit`,type:'checkbox'});check.checked=state.titleLayout[kind].autoFit;
  check.onchange=()=>commit(s=>s.titleLayout[kind].autoFit=check.checked);
  host.append(el('label',{class:'title-check',for:check.id},check,'长标题自动缩小，保持在文字区域内'),button('恢复默认',()=>commit(s=>s.titleLayout[kind]=titleDefaults(kind),'已恢复标题默认排版')));
 }
}
function drawEditableTitle(ctx,image,text,x,y,config,color,family) {
 ctx.drawImage(image,x,y,config.width,config.height);
 const cx=x+config.width/2+config.textX, cy=y+config.height*.53+config.textY;
 let size=config.size; const available=config.width*config.safeWidth/100;
 ctx.save();ctx.font=`600 ${size}px ${family}`;
 if(config.autoFit){const m=ctx.measureText(text),height=(m.actualBoundingBoxAscent||size*.8)+(m.actualBoundingBoxDescent||size*.2);size*=Math.min(1,available/Math.max(1,m.width),config.height*.32/Math.max(1,height));}
 ctx.font=`600 ${size}px ${family}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle=color;
 const m=ctx.measureText(text);ctx.fillText(text,cx,cy+((m.actualBoundingBoxAscent||size*.8)-(m.actualBoundingBoxDescent||size*.2))/2);ctx.restore();
}

