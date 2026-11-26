const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static(__dirname+'/public'));
process.on('uncaughtException',e=>console.error('erro:',e));
// Mapa ORBITAL 09: retângulos andáveis [x,y,w,h,nome], estações de tarefa [x,y,sala], mesa de reunião T
const R=[[60,60,380,260,'Refeitório'],[620,60,360,260,'Laboratório'],[1160,60,380,260,'Enfermaria'],[60,320,1480,260,'Corredor'],[60,580,380,260,'Reator'],[620,580,360,260,'Segurança'],[1160,580,380,260,'Comunicações']];
const S=[[150,150,'Refeitório'],[780,130,'Laboratório'],[1300,130,'Enfermaria'],[150,740,'Reator'],[780,740,'Segurança'],[1300,740,'Comunicações'],[500,450,'Corredor Oeste'],[1100,450,'Corredor Leste']];
const T=[800,450],MAP={R,S,T};
const ok=(x,y)=>R.some(r=>x>=r[0]&&x<=r[0]+r[2]&&y>=r[1]&&y<=r[1]+r[3]);
const can=(x,y)=>ok(x-12,y-12)&&ok(x+12,y-12)&&ok(x-12,y+12)&&ok(x+12,y+12);
const rooms={},now=Date.now,list=r=>Object.values(r.P),near=(p,x,y,d)=>Math.hypot(p.x-x,p.y-y)<d;
const to=(p,e,d)=>io.to(p.sid).emit(e,d),all=(r,e,d)=>io.to(r.code).emit(e,d);
const sync=r=>all(r,'room',{code:r.code,host:r.host,ph:r.ph,s:r.s,pl:list(r).map(p=>({id:p.id,n:p.n,c:p.c}))});
const prog=r=>all(r,'prog',[r.dn,r.total]);
const v=d=>d&&typeof d.id==='string'&&d.id.length<40;
const mk=()=>{let c;do c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');while(rooms[c]);return c};
const ring=r=>{const a=list(r);a.forEach((q,i)=>{const t=i*6.283/a.length;q.x=T[0]+Math.cos(t)*70;q.y=T[1]+Math.sin(t)*70;q.dx=q.dy=0})};
const go=(r,p)=>({role:p.role,tasks:p.tasks.filter(i=>!p.done.includes(i)),mates:p.role==='imp'?list(r).filter(q=>q.role==='imp').map(q=>q.id):[],kcd:Math.max(0,p.kcd-now())});
const mt=r=>({by:r.m.by,body:r.m.body,left:Math.max(0,r.m.end-now()),al:list(r).filter(q=>q.alive).map(q=>q.id)});

function add(r,s,d){const u=list(r).map(p=>p.c);let c=0;while(u.includes(c))c++;
  const p=r.P[d.id]={id:d.id,n:String(d.n||'').trim().slice(0,12)||'Jogador',c,sid:s.id,x:T[0],y:T[1],dx:0,dy:0,role:'crew',alive:1,tasks:[],done:[],kcd:0,em:0,conn:1};
  s.pid=d.id;s.code=r.code;s.join(r.code);s.emit('map',MAP);return p}

function end(r,w){if(r.ph==='end'||r.ph==='lobby')return;clearTimeout(r.tm);r.ph='end';r.m=null;
  all(r,'end',{w,r:list(r).map(p=>({n:p.n,c:p.c,role:p.role}))});
  r.tm=setTimeout(()=>{r.ph='lobby';list(r).forEach(p=>{p.alive=1;p.x=T[0];p.y=T[1];p.dx=p.dy=0});r.B=[];sync(r)},9000)}
function wins(r){const a=list(r).filter(p=>p.alive),i=a.filter(p=>p.role==='imp').length;if(!i)end(r,'crew');else if(i>=a.length-i)end(r,'imp')}
function meet(r,p,body){r.ph='meeting';r.B=[];r.m={v:Object.create(null),end:now()+r.s.vote*1000,by:p.n,body};ring(r);all(r,'mtg',mt(r));r.tm=setTimeout(()=>tally(r),r.s.vote*1000)}
function tally(r){if(r.ph!=='meeting')return;const c=Object.create(null);Object.values(r.m.v).forEach(t=>c[t]=(c[t]||0)+1);
  let top=null,mx=0,tie=0;for(const k in c){if(c[k]>mx){mx=c[k];top=k;tie=0}else if(c[k]===mx)tie=1}
  const e=!tie&&top&&top!=='skip'?r.P[top]:null;if(e)e.alive=0;
  r.ph='result';all(r,'mres',{c,out:e?e.n:null,role:e?e.role:null});
  r.tm=setTimeout(()=>{if(r.ph!=='result')return;r.ph='play';r.m=null;list(r).forEach(p=>p.kcd=Math.max(p.kcd,now()+10000));all(r,'resume');wins(r)},5000)}
function drop(r,p){delete r.P[p.id];const a=list(r);if(!a.length){clearTimeout(r.tm);delete rooms[r.code];return}
  if(r.host===p.id)r.host=a[0].id;sync(r);
  if(['play','meeting','result'].includes(r.ph)){if(p.role==='crew'){r.total-=p.tasks.length;r.dn-=p.done.length;prog(r)}
    if(r.total>0&&r.dn>=r.total)return end(r,'crew');wins(r)}}

io.on('connection',s=>{
  const g=ph=>{const r=rooms[s.code],p=r&&r.P[s.pid];return r&&p&&(!ph||r.ph===ph)?[r,p]:null};
  s.on('create',d=>{if(!v(d)||g())return;const code=mk(),r=rooms[code]={code,host:d.id,P:Object.create(null),s:{max:8,imps:1,spd:4,vote:45},ph:'lobby',B:[],m:null,dn:0,total:0};add(r,s,d);sync(r)});
  s.on('join',d=>{if(!v(d)||g())return;const r=rooms[String(d.code||'').toUpperCase()];
    if(!r)return s.emit('err','Sala não encontrada');if(r.ph!=='lobby')return s.emit('err','A partida já começou');
    if(list(r).length>=r.s.max)return s.emit('err','Sala cheia');add(r,s,d);sync(r)});
  s.on('rejoin',d=>{if(!v(d))return;const r=rooms[d.code],p=r&&r.P[d.id];if(!p)return s.emit('gone');
    p.sid=s.id;p.conn=1;s.pid=d.id;s.code=r.code;s.join(r.code);s.emit('map',MAP);sync(r);prog(r);
    if(r.ph!=='lobby'&&r.ph!=='end')to(p,'go',go(r,p));
    if(r.ph==='meeting'){to(p,'mtg',mt(r));to(p,'voted',Object.keys(r.m.v))}});
  s.on('set',(k,x)=>{const q=g('lobby');if(!q||q[0].host!==s.pid)return;const L={max:[3,10],imps:[1,3],spd:[2,6],vote:[15,90]}[k];if(!L)return;q[0].s[k]=Math.max(L[0],Math.min(L[1],x|0));sync(q[0])});
  s.on('start',()=>{const q=g('lobby');if(!q||q[0].host!==s.pid)return;const r=q[0],a=list(r);if(a.length<3)return s.emit('err','Mínimo de 3 jogadores');
    const ni=Math.min(r.s.imps,(a.length-1)>>1),ids=S.map((_,i)=>i);
    a.forEach(p=>Object.assign(p,{role:'crew',alive:1,done:[],tasks:[],kcd:now()+15000,em:0,to:0}));
    a.slice().sort(()=>Math.random()-.5).slice(0,ni).forEach(p=>p.role='imp');
    r.total=0;r.dn=0;r.B=[];r.ph='play';ring(r);
    a.forEach(p=>{if(p.role==='crew'){p.tasks=ids.slice().sort(()=>Math.random()-.5).slice(0,4);r.total+=4}to(p,'go',go(r,p))});
    sync(r);prog(r)});
  s.on('in',(x,y)=>{const q=g();if(!q)return;x=+x||0;y=+y||0;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}q[1].dx=x;q[1].dy=y});
  s.on('open',i=>{const q=g('play');if(!q)return;const p=q[1];i|=0;if(p.role!=='crew'||!p.tasks.includes(i)||p.done.includes(i)||!near(p,S[i][0],S[i][1],90))return;p.to={i,t:now()};s.emit('mini',i)});
  s.on('done',i=>{const q=g('play');if(!q)return;const[r,p]=q;i|=0;if(!p.to||p.to.i!==i||now()-p.to.t<2000||!near(p,S[i][0],S[i][1],110))return;
    p.to=0;p.done.push(i);r.dn++;s.emit('ok',i);prog(r);if(r.dn>=r.total)end(r,'crew')});
  s.on('kill',()=>{const q=g('play');if(!q)return;const[r,p]=q;if(p.role!=='imp'||!p.alive||now()<p.kcd)return;
    const t=list(r).find(u=>u.alive&&u.role==='crew'&&near(p,u.x,u.y,80));if(!t)return;
    t.alive=0;r.B.push({x:t.x,y:t.y,c:t.c});p.x=t.x;p.y=t.y;p.kcd=now()+20000;to(t,'dead');s.emit('kcd',20000);all(r,'snd','kill');wins(r)});
  s.on('report',()=>{const q=g('play');if(q&&q[1].alive&&q[0].B.some(b=>near(q[1],b.x,b.y,100)))meet(q[0],q[1],1)});
  s.on('emerg',()=>{const q=g('play');if(q&&q[1].alive&&q[1].em<1&&near(q[1],T[0],T[1],100)){q[1].em++;meet(q[0],q[1],0)}});
  s.on('vote',t=>{const q=g('meeting');if(!q)return;const[r,p]=q;if(!p.alive||p.id in r.m.v)return;if(t!=='skip'&&!(r.P[t]&&r.P[t].alive))return;
    r.m.v[p.id]=t;all(r,'voted',Object.keys(r.m.v));if(list(r).filter(u=>u.alive).every(u=>u.id in r.m.v)){clearTimeout(r.tm);tally(r)}});
  s.on('chat',t=>{const q=g();if(!q||typeof t!=='string')return;const[r,p]=q;
    if(!(r.ph==='lobby'||(r.ph==='meeting'&&p.alive))||now()-(p.ct||0)<800)return;p.ct=now();all(r,'chat',{n:p.n,c:p.c,t:t.slice(0,120)})});
  s.on('leave',()=>{const q=g();if(!q)return;s.leave(q[0].code);drop(q[0],q[1]);s.code=s.pid=null});
  s.on('disconnect',()=>{const q=g();if(!q||q[1].sid!==s.id)return;const[r,p]=q;p.conn=0;setTimeout(()=>{if(!p.conn&&r.P[p.id]===p)drop(r,p)},60000)});
});

// Loop do servidor (20x/s): move quem está jogando e envia o estado. Mortos só aparecem para mortos.
setInterval(()=>{for(const c in rooms){const r=rooms[c],a=list(r);
  if(r.ph==='play')a.forEach(p=>{const m=r.s.spd*3,x=p.x+p.dx*m,y=p.y+p.dy*m;if(can(x,p.y))p.x=x;if(can(p.x,y))p.y=y});
  const f=q=>[q.id,Math.round(q.x),Math.round(q.y),q.alive,q.c,q.dx>0?1:q.dx<0?-1:0],live=a.filter(q=>q.alive).map(f),ga=a.map(f),b=r.B.map(x=>[x.x,x.y,x.c]);
  a.forEach(p=>to(p,'st',{p:p.alive?live:ga,b}))}},50);

const PORT=process.env.PORT||3000;
srv.listen(PORT,()=>console.log('UNKNOWN SIGNAL rodando em http://localhost:'+PORT));
