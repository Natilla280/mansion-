const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const W=960,H=600,TS=48,RANGE=260,HALF=0.55;
const dark=document.createElement('canvas');dark.width=W;dark.height=H;
const dctx=dark.getContext('2d');
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const DEF={s:{sp:62,r:12,dmg:14},w:{sp:128,r:9,dmg:10},c:{sp:40,r:18,dmg:30}};

const kb={},pend={},mouse={x:W/2,y:H/2,clicked:false};
addEventListener('keydown',e=>{
  if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();
  if(!kb[e.code]&&!e.repeat)pend[e.code]=true;
  kb[e.code]=true;
});
addEventListener('keyup',e=>{kb[e.code]=false;});
function mpos(e){const r=cv.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;}
cv.addEventListener('mousemove',mpos);
cv.addEventListener('mousedown',e=>{mpos(e);mouse.clicked=true;});

let gs='MENU',floor=1,cols,rows,map,flow,seen,ens=[],items=[],exitC={x:0,y:0};
const P={x:0,y:0,ang:0},cam={x:0,y:0};
let hp=100,bat=100,stam=100,lightOn=true,llaves=0,totalT=0,tt=0,iframes=0,flashT=0,msgT=0,msg='',burstT=0,destCd=0,nextT=0,bfsT=0;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=n=>Math.floor(Math.random()*n);
const fmt=t=>{const s=Math.floor(t);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function say(t){msg=t;msgT=2.2;}
function solid(x,y){const c=Math.floor(x/TS),r=Math.floor(y/TS);return c<0||r<0||c>=cols||r>=rows||map[r][c]===1;}
function blk(x,y,r){return solid(x-r,y-r)||solid(x+r,y-r)||solid(x-r,y+r)||solid(x+r,y+r);}
function move(o,dx,dy,r){
  let ok=true;
  if(!blk(o.x+dx,o.y,r))o.x+=dx;else ok=false;
  if(!blk(o.x,o.y+dy,r))o.y+=dy;else ok=false;
  return ok;
}
function los(x1,y1,x2,y2){
  const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/8);
  for(let i=1;i<n;i++)if(solid(x1+(x2-x1)*i/n,y1+(y2-y1)*i/n))return false;
  return true;
}

function genMap(c,r){
  const m=[];for(let y=0;y<r;y++)m.push(new Array(c).fill(1));
  const stack=[[1,1]];m[1][1]=0;
  while(stack.length){
    const[x,y]=stack[stack.length-1];
    const opts=DIRS.map(([dx,dy])=>[dx*2,dy*2]).filter(([dx,dy])=>{
      const nx=x+dx,ny=y+dy;return nx>0&&ny>0&&nx<c-1&&ny<r-1&&m[ny][nx]===1;
    });
    if(!opts.length){stack.pop();continue;}
    const[dx,dy]=opts[rnd(opts.length)];
    m[y+dy/2][x+dx/2]=0;m[y+dy][x+dx]=0;stack.push([x+dx,y+dy]);
  }
  for(let y=1;y<r-1;y++)for(let x=1;x<c-1;x++)if(m[y][x]&&Math.random()<0.09)m[y][x]=0;
  for(let k=0;k<3;k++){
    const rw=3+rnd(3),rh=3+rnd(2),rx=2+rnd(c-rw-4),ry=2+rnd(r-rh-4);
    for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)m[y][x]=0;
  }
  m[r-2][c-2]=0;
  return m;
}

function mk(t,p){const d=DEF[t];return{t,x:p.x,y:p.y,sp:d.sp,r:d.r,dmg:d.dmg,st:0,al:false,cd:0,hd:Math.random()*6.283,ht:0};}

function loadFloor(n){
  floor=n;cols=21+4*(n-1);rows=15+2*(n-1);
  map=genMap(cols,rows);flow=new Int32Array(cols*rows);seen=new Uint8Array(cols*rows);
  P.x=TS*1.5;P.y=TS*1.5;P.ang=0;llaves=0;burstT=0;destCd=0;bfsT=0;
  exitC={x:(cols-2)*TS+TS/2,y:(rows-2)*TS+TS/2};
  const cells=[];
  for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++)if(!map[y][x])cells.push([x*TS+TS/2,y*TS+TS/2]);
  const pick=md=>{
    for(let k=0;k<3000;k++){
      const c=cells[rnd(cells.length)];
      if(Math.hypot(c[0]-P.x,c[1]-P.y)>md)return{x:c[0],y:c[1]};
    }
    return{x:cells[0][0],y:cells[0][1]};
  };
  items=[];ens=[];
  for(let i=0;i<3;i++)items.push({t:'k',...pick(320)});
  for(let i=0;i<3;i++)items.push({t:'b',...pick(120)});
  for(let i=0;i<2;i++)items.push({t:'m',...pick(200)});
  for(let i=0;i<3+n;i++)ens.push(mk('s',pick(420)));
  for(let i=0;i<n-1;i++)ens.push(mk('w',pick(420)));
  for(let i=0;i<n-2;i++)ens.push(mk('c',pick(520)));
  bfs();
}

function start(){hp=100;bat=100;stam=100;lightOn=true;totalT=0;iframes=0;flashT=0;loadFloor(1);gs='PLAY';}

function bfs(){
  flow.fill(-1);
  const sx=clamp(Math.floor(P.x/TS),0,cols-1),sy=clamp(Math.floor(P.y/TS),0,rows-1);
  const q=[sy*cols+sx];flow[sy*cols+sx]=0;
  for(let h=0;h<q.length;h++){
    const i=q[h],x=i%cols,y=(i-x)/cols,v=flow[i]+1;
    for(const[dx,dy]of DIRS){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=cols||ny>=rows||map[ny][nx])continue;
      const j=ny*cols+nx;
      if(flow[j]<0){flow[j]=v;q.push(j);}
    }
  }
}

function chase(e,dt){
  const tx=clamp(Math.floor(e.x/TS),0,cols-1),ty=clamp(Math.floor(e.y/TS),0,rows-1);
  let bv=flow[ty*cols+tx];if(bv<0)bv=1e9;
  let gx=P.x,gy=P.y;
  for(const[dx,dy]of DIRS){
    const nx=tx+dx,ny=ty+dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows||map[ny][nx])continue;
    const v=flow[ny*cols+nx];
    if(v>=0&&v<bv){bv=v;gx=nx*TS+TS/2;gy=ny*TS+TS/2;}
  }
  const a=Math.atan2(gy-e.y,gx-e.x);
  move(e,Math.cos(a)*e.sp*dt,Math.sin(a)*e.sp*dt,e.r);
}

function wander(e,dt){
  e.ht-=dt;
  if(e.ht<=0){e.hd=Math.random()*6.283;e.ht=1+Math.random()*2.5;}
  const s=e.sp*0.4*dt;
  if(!move(e,Math.cos(e.hd)*s,Math.sin(e.hd)*s,e.r))e.ht=0;
}

function inCone(e){
  const dx=e.x-P.x,dy=e.y-P.y;
  if(dx*dx+dy*dy>RANGE*RANGE)return false;
  let a=Math.atan2(dy,dx)-P.ang;
  a=Math.atan2(Math.sin(a),Math.cos(a));
  return Math.abs(a)<HALF;
}

function lightPoly(){
  const pts=[],N=40;
  for(let i=0;i<=N;i++){
    const a=P.ang-HALF+2*HALF*i/N;
    let d=8;
    while(d<RANGE&&!solid(P.x+Math.cos(a)*d,P.y+Math.sin(a)*d))d+=4;
    pts.push([P.x+Math.cos(a)*d-cam.x,P.y+Math.sin(a)*d-cam.y]);
  }
  pts.push([P.x-cam.x,P.y-cam.y]);
  return pts;
}

function pathPoly(c,pts){
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  c.closePath();
}

function hurt(d){
  if(iframes>0)return;
  hp=Math.max(0,hp-d);iframes=0.5;flashT=0.25;
}

function updPlayer(dt){
  const run=!!(kb.ShiftLeft||kb.ShiftRight);
  const mx=(kb.KeyD||kb.ArrowRight?1:0)-(kb.KeyA||kb.ArrowLeft?1:0);
  const my=(kb.KeyS||kb.ArrowDown?1:0)-(kb.KeyW||kb.ArrowUp?1:0);
  const moving=mx||my;
  const sprinting=run&&moving&&stam>0;
  stam=sprinting?Math.max(0,stam-35*dt):Math.min(100,stam+20*dt);
  const sp=sprinting?175:115;
  if(moving){const l=Math.hypot(mx,my);move(P,mx/l*sp*dt,my/l*sp*dt,10);}
  P.ang=Math.atan2(mouse.y+cam.y-P.y,mouse.x+cam.x-P.x);
  return sprinting;
}

function updEnemies(dt,run){
  const noise=(lightOn?240:100)+(run?80:0);
  for(const e of ens){
    e.cd-=dt;
    const d=Math.hypot(P.x-e.x,P.y-e.y);
    if(e.t!=='c'&&lightOn&&bat>0&&inCone(e)&&los(P.x,P.y,e.x,e.y))e.st=Math.max(e.st,0.3);
    if(!e.al&&d<noise*(e.t==='w'?1.2:1))e.al=true;
    if(e.al&&d>450)e.al=false;
    if(e.st>0){e.st-=dt;continue;}
    if(e.al)chase(e,dt);else wander(e,dt);
    if(d<e.r+12&&e.cd<=0){hurt(e.dmg);e.cd=1.1;e.al=true;}
  }
}

function update(dt){
  tt+=dt;
  if(gs==='NEXT'){nextT-=dt;if(nextT<=0){loadFloor(floor+1);gs='PLAY';}return;}
  if(gs!=='PLAY'){if(pend.Enter||pend.Space)start();return;}
  totalT+=dt;iframes-=dt;flashT-=dt;msgT-=dt;destCd-=dt;burstT-=dt;
  if(pend.KeyF)lightOn=!lightOn;
  if(pend.Space&&destCd<=0&&bat>=30){
    bat-=30;destCd=5;burstT=0.5;
    for(const e of ens)if(e.t!=='c'&&Math.hypot(e.x-P.x,e.y-P.y)<170)e.st=3;
  }
  if(lightOn&&bat>0)bat=Math.max(0,bat-1.6*dt);
  const run=updPlayer(dt);
  bfsT-=dt;if(bfsT<=0){bfs();bfsT=0.2;}
  updEnemies(dt,run);
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(Math.hypot(it.x-P.x,it.y-P.y)<22){
      if(it.t==='k'){llaves++;say(¡Llave encontrada! (${llaves}/3));}
      else if(it.t==='b'){bat=Math.min(100,bat+35);say('+35 de pila');}
      else{hp=Math.min(100,hp+40);say('+40 de vida');}
      items.splice(i,1);
    }
  }
  if(Math.hypot(exitC.x-P.x,exitC.y-P.y)<22){
    if(llaves>=3){if(floor>=5)gs='WIN';else{gs='NEXT';nextT=2.5;}}
    else if(msgT<=0)say(La puerta está cerrada: faltan ${3-llaves} llave(s));
  }
  if(hp<=0)gs='OVER';
  cam.x=clamp(P.x-W/2,0,Math.max(0,cols*TS-W));
  cam.y=clamp(P.y-H/2,0,Math.max(0,rows*TS-H));
  const cx=Math.floor(P.x/TS),cy=Math.floor(P.y/TS);
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
    const x=cx+dx,y=cy+dy;
    if(x>=0&&y>=0&&x<cols&&y<rows&&dx*dx+dy*dy<=25)seen[y*cols+x]=1;
  }
}

function drawWorld(){
  const x0=Math.max(0,Math.floor(cam.x/TS)),x1=Math.min(cols-1,Math.floor((cam.x+W)/TS));
  const y0=Math.max(0,Math.floor(cam.y/TS)),y1=Math.min(rows-1,Math.floor((cam.y+H)/TS));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const sx=x*TS-cam.x,sy=y*TS-cam.y;
    if(map[y][x]){
      ctx.fillStyle='#2a2636';ctx.fillRect(sx,sy,TS,TS);
      ctx.fillStyle='#3d3750';ctx.fillRect(sx+3,sy+3,TS-6,TS-6);
      ctx.fillStyle='#24202e';ctx.fillRect(sx+3,sy+TS/2-1,TS-6,2);
    }else{
      ctx.fillStyle=(x+y)%2?'#201d2a':'#1b1823';ctx.fillRect(sx,sy,TS,TS);
      if((x*31+y*17)%9===0){ctx.fillStyle='#1c1926';ctx.fillRect(sx+18,sy+18,6,6);}
    }
  }
  const ex=exitC.x-cam.x,ey=exitC.y-cam.y,open=llaves>=3;
  ctx.fillStyle=open?'rgba(40,220,110,0.25)':'rgba(200,40,40,0.2)';
  ctx.beginPath();ctx.arc(ex,ey,30+4*Math.sin(tt*3),0,6.283);ctx.fill();
  ctx.fillStyle=open?'#2fd46a':'#7a2222';ctx.fillRect(ex-22,ey-18,44,36);
  ctx.fillStyle='#fff';ctx.font='bold 9px monospace';ctx.textAlign='center';
  ctx.fillText(open?'SALIDA':'CERRADA',ex,ey+4);
  for(const it of items){
    const x=it.x-cam.x,y=it.y-cam.y,b=Math.sin(tt*4+it.x)*2;
    if(it.t==='k'){
      ctx.fillStyle='#f0c040';ctx.beginPath();ctx.arc(x,y-4+b,6,0,6.283);ctx.fill();
      ctx.fillRect(x-1,y+b,2,12);ctx.fillRect(x+1,y+b+8,4,2);
    }else if(it.t==='b'){
      ctx.fillStyle='#f5d020';ctx.fillRect(x-6,y-9+b,12,18);
      ctx.fillStyle='#333';ctx.fillRect(x-3,y-11+b,6,3);
    }else{
      ctx.fillStyle='#fff';ctx.fillRect(x-9,y-9+b,18,18);
      ctx.fillStyle='#d22';ctx.fillRect(x-2,y-7+b,4,14);ctx.fillRect(x-7,y-2+b,14,4);
    }
  }
  for(const e of ens)drawEnemy(e);
  drawPlayer();
}

function drawEnemy(e){
  const x=e.x-cam.x,y=e.y-cam.y,ea=Math.atan2(P.y-e.y,P.x-e.x),ex=Math.cos(ea),ey=Math.sin(ea);
  if(e.t==='c'){
    ctx.fillStyle='#1c0606';ctx.beginPath();ctx.arc(x,y,e.r,0,6.283);ctx.fill();
    ctx.fillStyle='#ff2020';ctx.beginPath();
    ctx.arc(x+ex*8-ey*6,y+ey*8+ex*6,3,0,6.283);
    ctx.arc(x+ex*8+ey*6,y+ey*8-ex*6,3,0,6.283);
    ctx.fill();
  }else if(e.t==='w'){
    ctx.fillStyle=rgba(180,110,255,${0.55+0.25*Math.sin(tt*14)});
    ctx.beginPath();ctx.arc(x,y,e.r,0,6.283);ctx.fill();
  }else{
    ctx.fillStyle='rgba(110,170,255,0.5)';ctx.beginPath();ctx.arc(x,y,e.r,0,6.283);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();
    ctx.arc(x+ex*4-ey*4,y+ey*4+ex*4,2,0,6.283);
    ctx.arc(x+ex*4+ey*4,y+ey*4-ex*4,2,0,6.283);
    ctx.fill();
  }
  if(e.st>0){ctx.strokeStyle='#ffe44d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,e.r+5,0,6.283);ctx.stroke();}
}

function drawPlayer(){
  ctx.save();ctx.translate(P.x-cam.x,P.y-cam.y);ctx.rotate(P.ang);
  const hit=flashT>0;
  ctx.fillStyle=hit?'#d9534f':'#3d4a36';ctx.beginPath();ctx.ellipse(0,0,11,9,0,0,6.283);ctx.fill();
  ctx.fillStyle=hit?'#ffb0b0':'#e2b48c';ctx.beginPath();ctx.arc(2,0,6,0,6.283);ctx.fill();
  ctx.fillStyle='#2a2a2a';ctx.fillRect(9,-3,14,6);
  ctx.fillStyle=lightOn&&bat>0?'#fff3b0':'#444';ctx.fillRect(22,-4,3,8);
  ctx.restore();
}

function drawLight(lp){
  const sx=P.x-cam.x,sy=P.y-cam.y;
  dctx.globalCompositeOperation='source-over';dctx.clearRect(0,0,W,H);
  dctx.fillStyle='rgba(2,2,8,0.88)';dctx.fillRect(0,0,W,H);
  dctx.globalCompositeOperation='destination-out';
  const ag=dctx.createRadialGradient(sx,sy,0,sx,sy,60);
  ag.addColorStop(0,'#000');ag.addColorStop(1,'rgba(0,0,0,0)');
  dctx.fillStyle=ag;dctx.beginPath();dctx.arc(sx,sy,60,0,6.283);dctx.fill();
  if(lp){
    pathPoly(dctx,lp);
    const lg=dctx.createRadialGradient(sx,sy,0,sx,sy,RANGE);
    lg.addColorStop(0,'#000');lg.addColorStop(0.75,'rgba(0,0,0,0.9)');lg.addColorStop(1,'rgba(0,0,0,0)');
    dctx.fillStyle=lg;dctx.fill();
  }
  if(burstT>0){dctx.fillStyle=rgba(0,0,0,${burstT/0.5});dctx.beginPath();dctx.arc(sx,sy,170,0,6.283);dctx.fill();}
  dctx.globalCompositeOperation='source-over';
  ctx.drawImage(dark,0,0);
  if(lp){
    pathPoly(ctx,lp);ctx.globalCompositeOperation='lighter';
    ctx.fillStyle='rgba(255,200,120,0.07)';ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }
}

function bar(x,y,w,h,v,col,label){
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle=col;ctx.fillRect(x,y,w*clamp(v,0,1),h);
  if(label){ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(label,x+4,y+h-3);}
}

function drawHUD(){
  bar(12,12,170,14,hp/100,'#b22222',VIDA ${Math.ceil(hp)});
  bar(12,32,170,14,bat/100,'#d9a520',PILA ${Math.ceil(bat)}%  ${lightOn&&bat>0?'ON':'OFF'});
  bar(12,52,170,8,stam/100,'#3a9d8a','');
  ctx.textAlign='right';ctx.fillStyle='#eee';ctx.font='bold 14px monospace';
  ctx.fillText(PISO ${floor}/5,W-12,24);
  ctx.fillText(LLAVES ${llaves}/3,W-12,44);
  ctx.fillText(fmt(totalT),W-12,64);

  const mx=W-12-cols*3,my=80;
  ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(mx-3,my-3,cols*3+6,rows*3+6);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    if(!seen[y*cols+x])continue;
    ctx.fillStyle=map[y][x]?'#4a4558':'#22202a';ctx.fillRect(mx+x*3,my+y*3,3,3);
  }
  if(seen[(rows-2)*cols+(cols-2)]){ctx.fillStyle='#2fd46a';ctx.fillRect(mx+(cols-2)*3,my+(rows-2)*3,3,3);}
  ctx.fillStyle='#ffe066';ctx.fillRect(mx+P.x/TS*3-2,my+P.y/TS*3-2,4,4);

  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,H-26,W,26);
  ctx.fillStyle='#aaa';ctx.font='12px monospace';ctx.textAlign='center';
  ctx.fillText(WASD mover · Shift correr · Ratón apuntar · F linterna · Espacio destello (${destCd>0?Math.ceil(destCd)+'s':'listo'}),W/2,H-9);

  if(msgT>0){
    ctx.globalAlpha=Math.min(1,msgT);
    ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(W/2-220,H-70,440,30);
    ctx.fillStyle='#ffe066';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText(msg,W/2,H-50);
    ctx.globalAlpha=1;
  }
  if(hp<35){
    const a=(35-hp)/35*(0.4+0.15*Math.sin(tt*6));
    const g=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,W*0.6);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,rgba(160,0,0,${a}));
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  if(flashT>0){ctx.fillStyle=rgba(255,0,0,${flashT*0.5});ctx.fillRect(0,0,W,H);}
}

function button(x,y,w,h,label){
  const hov=mouse.x>x&&mouse.x<x+w&&mouse.y>y&&mouse.y<y+h;
  ctx.fillStyle=hov?'#5a1414':'#2a0a0a';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#c33';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
  ctx.fillStyle='#fff';ctx.font='bold 20px monospace';ctx.textAlign='center';
  ctx.fillText(label,x+w/2,y+h/2+7);
  return hov&&mouse.clicked;
}

function drawMenu(){
  ctx.fillStyle='#07060a';ctx.fillRect(0,0,W,H);
  for(let i=0;i<7;i++){
    const f=0.5+0.5*Math.sin(tt*2.3+i*1.7);
    ctx.fillStyle=rgba(255,150,60,${0.05+0.05*f});
    ctx.beginPath();ctx.arc(60+i*150,H-40,70+f*18,0,6.283);ctx.fill();
  }
  ctx.textAlign='center';
  ctx.fillStyle='#b00000';ctx.font='bold 46px Georgia, serif';ctx.fillText('LA MANSIÓN DEL SILENCIO',W/2,120);
  ctx.fillStyle='#bdb49a';ctx.font='16px monospace';
  ctx.fillText('Atraviesa 5 pisos a oscuras. Reúne 3 llaves en cada uno y encuentra la salida.',W/2,160);
  const info=[
    'Sombra: se paraliza al recibir la luz de tu linterna.',
    'Susurro: rápido y frágil; también se paraliza con la luz.',
    'Coloso: ignora la luz. Aléjate de su camino.',
    'Te oyen si corres (Shift) o si enciendes la linterna.'
  ];
  info.forEach((t,i)=>ctx.fillText(t,W/2,220+i*26));
  ctx.fillStyle='#777';ctx.font='13px monospace';
  ctx.fillText('WASD mover · Ratón apuntar · F linterna · Shift correr · Espacio destello',W/2,350);
  if(button(W/2-115,390,230,52,'JUGAR'))start();
  ctx.fillStyle='#555';ctx.font='12px monospace';ctx.textAlign='center';
  ctx.fillText('Enter también inicia',W/2,470);
}

function overlay(t1,c1,t2,label){
  ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=c1;ctx.font='bold 54px Georgia, serif';ctx.fillText(t1,W/2,210);
  ctx.fillStyle='#ddd';ctx.font='18px monospace';ctx.fillText(t2,W/2,260);
  return button(W/2-120,320,240,52,label);
}

function draw(){
  if(gs==='MENU'){drawMenu();return;}
  ctx.clearRect(0,0,W,H);
  drawWorld();
  drawLight(lightOn&&bat>0?lightPoly():null);
  for(const e of ens){
    if(e.al&&Math.hypot(e.x-P.x,e.y-P.y)<360){
      ctx.strokeStyle=rgba(255,40,40,${0.25+0.2*Math.sin(tt*8)});ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(e.x-cam.x,e.y-cam.y,14,0,6.283);ctx.stroke();
    }
  }
  drawHUD();
  if(gs==='NEXT'){
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.fillStyle='#e0c040';ctx.font='bold 30px Georgia, serif';
    ctx.fillText(Piso ${floor} superado,W/2,250);
    ctx.fillStyle='#ddd';ctx.font='16px monospace';
    ctx.fillText(Bajando al piso ${floor+1}...,W/2,290);
  }
  if(gs==='OVER'&&overlay('HAS CAÍDO','#b00000',Llegaste al piso ${floor} · ${fmt(totalT)},'REINTENTAR'))start();
  if(gs==='WIN'&&overlay('ESCAPASTE','#e0c040',Saliste de la mansión en ${fmt(totalT)},'JUGAR DE NUEVO'))start();
}

let last=0;
function loop(ts){
  const dt=Math.min((ts-last)/1000,0.05);last=ts;
  update(dt);draw();
  mouse.clicked=false;
  for(const k in pend)delete pend[k];
  requestAnimationFrame(loop);
}

loadFloor(1);
requestAnimationFrame(loop);
