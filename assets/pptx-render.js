/* TAP APP — PPTX → canvas renderer (own code, MIT-style, no deps except JSZip). Приблизительная отрисовка слайдов. */
(function(){
'use strict';
var PT=12700;
function px(s){return new DOMParser().parseFromString(s,'application/xml')}
function kid(el,n){for(var c=el&&el.firstElementChild;c;c=c.nextElementSibling)if(c.localName===n)return c;return null}
function kids(el,n){var r=[];for(var c=el&&el.firstElementChild;c;c=c.nextElementSibling)if(!n||c.localName===n)r.push(c);return r}
function pth(el,p){var a=p.split('/');for(var i=0;i<a.length&&el;i++)el=kid(el,a[i]);return el}
function at(el,n,d){var v=el&&el.getAttribute(n);return v==null?d:v}
function nm(el,n,d){var v=el&&el.getAttribute(n);return(v==null||v==='')?d:+v}
function dirOf(p){var i=p.lastIndexOf('/');return i<0?'':p.slice(0,i+1)}
function embedId(e){return e&&(e.getAttribute('r:embed')||e.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed'))}
function resolve(base,t){
  if(t.charAt(0)==='/')return t.slice(1);
  var parts=(dirOf(base)+t).split('/'),o=[];
  parts.forEach(function(s){if(s==='..')o.pop();else if(s&&s!=='.')o.push(s)});
  return o.join('/');
}

/* ---------- цвет ---------- */
var PRST={black:'000000',white:'ffffff',red:'ff0000',green:'008000',blue:'0000ff',yellow:'ffff00',gray:'808080',grey:'808080',orange:'ffa500',purple:'800080',cyan:'00ffff',magenta:'ff00ff',lime:'00ff00',navy:'000080',teal:'008080',silver:'c0c0c0',maroon:'800000',olive:'808000',darkGray:'a9a9a9',lightGray:'d3d3d3'};
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return[parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0]}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0,d=mx-mn;
  if(d){s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}return[h,s,l]}
function hsl2rgb(h,s,l){function f(p,q,t){if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p}
  if(!s){var v=Math.round(l*255);return[v,v,v]}var q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return[Math.round(f(p,q,h+1/3)*255),Math.round(f(p,q,h)*255),Math.round(f(p,q,h-1/3)*255)]}
function css(c){return c?'rgba('+c[0]+','+c[1]+','+c[2]+','+(c[3]==null?1:c[3])+')':null}

/* ---------- основной рендер ---------- */
function Deck(zip){this.zip=zip;this.cache={};this.imgs={}}
Deck.prototype.text=function(p){var z=this.zip.file(p);return z?z.async('string'):Promise.resolve(null)};
Deck.prototype.xml=function(p){var me=this;if(this.cache[p])return this.cache[p];
  return this.cache[p]=this.text(p).then(function(s){return s?px(s):null})};
Deck.prototype.rels=function(p){
  var me=this,rp=dirOf(p)+'_rels/'+p.slice(dirOf(p).length)+'.rels';
  return this.xml(rp).then(function(d){var m={};if(d)kids(d.documentElement,'Relationship').forEach(function(r){
    var t=at(r,'Target','');m[at(r,'Id')]={type:at(r,'Type','').split('/').pop(),path:at(r,'TargetMode')==='External'?null:resolve(p,t)}});return m});
};
Deck.prototype.img=function(path){
  var me=this;if(!path)return Promise.resolve(null);
  if(this.imgs[path])return this.imgs[path];
  var z=this.zip.file(path);if(!z)return Promise.resolve(null);
  var ext=(path.split('.').pop()||'').toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',svg:'image/svg+xml'}[ext];
  if(!mime)return Promise.resolve(null);
  return this.imgs[path]=z.async('arraybuffer').then(function(ab){
    var b=new Blob([ab],{type:mime});
    if(window.createImageBitmap&&mime!=='image/svg+xml')return createImageBitmap(b).catch(function(){return null});
    return new Promise(function(res){var u=URL.createObjectURL(b),im=new Image();im.onload=function(){res(im)};im.onerror=function(){res(null)};im.src=u});
  }).catch(function(){return null});
};

function themeOf(deck,path){
  return deck.xml(path).then(function(d){
    var T={colors:{},major:'Calibri',minor:'Calibri'};if(!d)return T;
    var cs=pth(d.documentElement,'themeElements/clrScheme');
    kids(cs).forEach(function(c){var v=kid(c,'srgbClr')||kid(c,'sysClr');
      if(v)T.colors[c.localName]=at(v,'val')&&v.localName==='srgbClr'?at(v,'val'):at(v,'lastClr','000000')});
    var fs=pth(d.documentElement,'themeElements/fontScheme');
    var mj=pth(fs,'majorFont/latin'),mn=pth(fs,'minorFont/latin');
    if(mj)T.major=at(mj,'typeface','Calibri');if(mn)T.minor=at(mn,'typeface','Calibri');
    T.fillStyles=kids(pth(d.documentElement,'themeElements/fmtScheme/fillStyleLst'));
    T.lnStyles=kids(pth(d.documentElement,'themeElements/fmtScheme/lnStyleLst'));
    T.bgStyles=kids(pth(d.documentElement,'themeElements/fmtScheme/bgFillStyleLst'));
    return T;
  });
}

/* контекст рендера слайда */
function Ctx(deck,theme,clrMap,rels){this.deck=deck;this.theme=theme;this.clrMap=clrMap;this.rels=rels}
Ctx.prototype.colorOf=function(c,ph){
  if(!c)return null;var n=c.localName,hex=null;
  if(n==='srgbClr')hex=at(c,'val','000000');
  else if(n==='sysClr')hex=at(c,'lastClr','000000');
  else if(n==='prstClr')hex=PRST[at(c,'val','black')]||'000000';
  else if(n==='schemeClr'){var v=at(c,'val','tx1');
    if(v==='phClr'){if(ph)return ph;hex='000000'}
    else{var m=this.clrMap[v]||v;hex=this.theme.colors[m]||this.theme.colors[v]||'000000'}}
  else return null;
  var rgb=hex2rgb(hex),a=1;
  kids(c).forEach(function(m){
    var v=nm(m,'val',100000)/100000,k=m.localName;
    if(k==='alpha')a=v;
    else if(k==='lumMod'||k==='lumOff'){var h=rgb2hsl(rgb[0],rgb[1],rgb[2]);
      if(k==='lumMod')h[2]=Math.min(1,h[2]*v);else h[2]=Math.min(1,Math.max(0,h[2]+v));rgb=hsl2rgb(h[0],h[1],h[2])}
    else if(k==='satMod'){var h2=rgb2hsl(rgb[0],rgb[1],rgb[2]);h2[1]=Math.min(1,h2[1]*v);rgb=hsl2rgb(h2[0],h2[1],h2[2])}
    else if(k==='tint')rgb=rgb.map(function(x){return Math.round(x*v+255*(1-v))});
    else if(k==='shade')rgb=rgb.map(function(x){return Math.round(x*v)});
  });
  return[rgb[0],rgb[1],rgb[2],a];
};
Ctx.prototype.colorIn=function(parent,ph){
  if(!parent)return null;
  var c=kid(parent,'srgbClr')||kid(parent,'schemeClr')||kid(parent,'sysClr')||kid(parent,'prstClr');
  return this.colorOf(c,ph);
};

/* ---------- геометрия ---------- */
function shapePath(prst,w,h,av){
  function a(i,d){var v=av&&av[i];return v==null?d:v}
  return function(c,x,y){
    c.beginPath();
    var m=Math.min(w,h);
    switch(prst){
    case 'ellipse':case 'flowChartConnector':c.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);break;
    case 'roundRect':case 'flowChartAlternateProcess':case 'round2SameRect':case 'round1Rect':case 'flowChartTerminator':{
      var r=prst==='flowChartTerminator'?m/2:m*Math.min(a('adj',16667),50000)/100000;
      c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);
      c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();break}
    case 'triangle':{var p=w*a('adj',50000)/100000;c.moveTo(x+p,y);c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.closePath();break}
    case 'rtTriangle':c.moveTo(x,y);c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.closePath();break;
    case 'diamond':case 'flowChartDecision':c.moveTo(x+w/2,y);c.lineTo(x+w,y+h/2);c.lineTo(x+w/2,y+h);c.lineTo(x,y+h/2);c.closePath();break;
    case 'parallelogram':case 'flowChartInputOutput':{var o=m*a('adj',25000)/100000;c.moveTo(x+o,y);c.lineTo(x+w,y);c.lineTo(x+w-o,y+h);c.lineTo(x,y+h);c.closePath();break}
    case 'trapezoid':{var o2=m*a('adj',25000)/100000;c.moveTo(x+o2,y);c.lineTo(x+w-o2,y);c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.closePath();break}
    case 'hexagon':{var o3=m*a('adj',25000)/100000;c.moveTo(x+o3,y);c.lineTo(x+w-o3,y);c.lineTo(x+w,y+h/2);c.lineTo(x+w-o3,y+h);c.lineTo(x+o3,y+h);c.lineTo(x,y+h/2);c.closePath();break}
    case 'homePlate':case 'pentagon':{var o4=m*a('adj',50000)/100000;c.moveTo(x,y);c.lineTo(x+w-o4,y);c.lineTo(x+w,y+h/2);c.lineTo(x+w-o4,y+h);c.lineTo(x,y+h);c.closePath();break}
    case 'chevron':{var o5=m*a('adj',50000)/100000;c.moveTo(x,y);c.lineTo(x+w-o5,y);c.lineTo(x+w,y+h/2);c.lineTo(x+w-o5,y+h);c.lineTo(x,y+h);c.lineTo(x+o5,y+h/2);c.closePath();break}
    case 'rightArrow':case 'leftArrow':{
      var th=h*a('adj1',50000)/100000,hd=m*a('adj2',50000)/100000,t=(h-th)/2,L=prst==='leftArrow';
      var X=function(v){return L?x+w-v:x+v};
      c.moveTo(X(0),y+t);c.lineTo(X(w-hd),y+t);c.lineTo(X(w-hd),y);c.lineTo(X(w),y+h/2);c.lineTo(X(w-hd),y+h);c.lineTo(X(w-hd),y+h-t);c.lineTo(X(0),y+h-t);c.closePath();break}
    case 'plus':case 'mathPlus':{var o6=m*a('adj',25000)/100000;c.moveTo(x+o6,y);c.lineTo(x+w-o6,y);c.lineTo(x+w-o6,y+o6);c.lineTo(x+w,y+o6);c.lineTo(x+w,y+h-o6);c.lineTo(x+w-o6,y+h-o6);c.lineTo(x+w-o6,y+h);c.lineTo(x+o6,y+h);c.lineTo(x+o6,y+h-o6);c.lineTo(x,y+h-o6);c.lineTo(x,y+o6);c.lineTo(x+o6,y+o6);c.closePath();break}
    case 'star5':{var cx=x+w/2,cy=y+h/2;for(var i=0;i<10;i++){var rr=i%2?0.4:1,an=-Math.PI/2+i*Math.PI/5,px_=cx+Math.cos(an)*w/2*rr,py_=cy+Math.sin(an)*h/2*rr;i?c.lineTo(px_,py_):c.moveTo(px_,py_)}c.closePath();break}
    case 'line':case 'straightConnector1':case 'bentConnector3':case 'curvedConnector3':c.moveTo(x,y);c.lineTo(x+w,y+h);break;
    default:c.rect(x,y,w,h)}
  };
}
function custPath(g,w,h){
  var paths=kids(pth(g,'pathLst'),'path');
  return function(c,x,y){
    c.beginPath();
    paths.forEach(function(p){
      var pw=nm(p,'w',0)||w,ph=nm(p,'h',0)||h,sx=w/pw,sy=h/ph,cur=[0,0];
      function P(n){return[x+nm(n,'x',0)*sx,y+nm(n,'y',0)*sy]}
      kids(p).forEach(function(cmd){var k=cmd.localName,pts=kids(cmd,'pt').map(P);
        if(k==='moveTo'&&pts[0]){c.moveTo(pts[0][0],pts[0][1]);cur=pts[0]}
        else if(k==='lnTo'&&pts[0]){c.lineTo(pts[0][0],pts[0][1]);cur=pts[0]}
        else if(k==='cubicBezTo'&&pts.length>=3){c.bezierCurveTo(pts[0][0],pts[0][1],pts[1][0],pts[1][1],pts[2][0],pts[2][1]);cur=pts[2]}
        else if(k==='quadBezTo'&&pts.length>=2){c.quadraticCurveTo(pts[0][0],pts[0][1],pts[1][0],pts[1][1]);cur=pts[1]}
        else if(k==='arcTo'){var wR=nm(cmd,'wR',0)*sx,hR=nm(cmd,'hR',0)*sy,st=nm(cmd,'stAng',0)/60000*Math.PI/180,sw=nm(cmd,'swAng',0)/60000*Math.PI/180;
          if(wR&&hR){var cx=cur[0]-wR*Math.cos(st),cy=cur[1]-hR*Math.sin(st);c.ellipse(cx,cy,wR,hR,0,st,st+sw,sw<0);cur=[cx+wR*Math.cos(st+sw),cy+hR*Math.sin(st+sw)]}}
        else if(k==='close')c.closePath();
      });
    });
  };
}

/* ---------- наследование плейсхолдеров ---------- */
function phOf(sp){var ph=pth(sp,'nvSpPr/nvPr/ph')||pth(sp,'nvPicPr/nvPr/ph')||pth(sp,'nvGraphicFramePr/nvPr/ph');return ph?{type:at(ph,'type','body'),idx:at(ph,'idx',null)}:null}
function findPh(tree,ph){
  if(!tree||!ph)return null;var best=null;
  kids(tree).forEach(function(s){var p=phOf(s);if(!p)return;
    if(ph.idx!=null&&p.idx===ph.idx)best=best||s;
    else if(!best&&p.idx==null&&norm(p.type)===norm(ph.type))best=s;
    else if(!best&&ph.idx==null&&norm(p.type)===norm(ph.type))best=s});
  if(!best&&ph.idx!=null){kids(tree).forEach(function(s){var p=phOf(s);if(!best&&p&&norm(p.type)===norm(ph.type))best=s})}
  return best;
}
function norm(t){return t==='ctrTitle'?'title':(t==='subTitle'||t==='obj'||t==='body'||t==='tbl'||t==='chart'||t==='pic'||t==='media'||t==='clipArt'||t==='dgm')?'body':t}

/* ---------- текст ---------- */
function mergeFrom(cfg,pPr){
  if(!pPr)return;
  ['algn','marL','indent'].forEach(function(a){var v=at(pPr,a,null);if(v!=null)cfg[a]=a==='algn'?v:+v});
  var ls=pth(pPr,'lnSpc');if(ls){var p=kid(ls,'spcPct'),q=kid(ls,'spcPts');if(p)cfg.lnPct=nm(p,'val',100000)/100000;else if(q)cfg.lnPts=nm(q,'val',0)/100}
  ['spcBef','spcAft'].forEach(function(n){var s=pth(pPr,n);if(s){var p2=kid(s,'spcPct'),q2=kid(s,'spcPts');if(p2)cfg[n]={pct:nm(p2,'val',0)/100000};else if(q2)cfg[n]={pts:nm(q2,'val',0)/100}}});
  if(kid(pPr,'buNone'))cfg.bu=null;
  var bc=kid(pPr,'buChar');if(bc)cfg.bu={ch:at(bc,'char','•')};
  var ba=kid(pPr,'buAutoNum');if(ba)cfg.bu={num:at(ba,'type','arabicPeriod'),start:nm(ba,'startAt',1)};
  var bcl=kid(pPr,'buClr');if(bcl)cfg.buClr=bcl;
  var bs=pth(pPr,'buSzPct');if(bs)cfg.buSz=nm(bs,'val',100000)/100000;
  var d=kid(pPr,'defRPr');if(d)cfg.r=mergeR(cfg.r,d);
}
function mergeR(base,rPr){
  var r={};for(var k in base)r[k]=base[k];if(!rPr)return r;
  var sz=at(rPr,'sz',null);if(sz)r.sz=+sz;
  ['b','i'].forEach(function(a){var v=at(rPr,a,null);if(v!=null)r[a]=v==='1'||v==='true'});
  var u=at(rPr,'u',null);if(u!=null)r.u=u!=='none';
  var st=at(rPr,'strike',null);if(st!=null)r.strike=st!=='noStrike';
  var lt=kid(rPr,'latin');if(lt&&at(lt,'typeface'))r.face=at(lt,'typeface');
  var sf=kid(rPr,'solidFill');if(sf)r.fill=sf;
  var bl=at(rPr,'baseline',null);if(bl!=null)r.base=+bl;
  var cap=at(rPr,'cap',null);if(cap)r.cap=cap;
  return r;
}
function lvlP(ls,l){return ls?kid(ls,'lvl'+(l+1)+'pPr'):null}

function Fonts(ctx){this.ctx=ctx}
function faceOf(ctx,f){
  if(!f)f='+mn-lt';
  if(f==='+mj-lt')f=ctx.theme.major;else if(f==='+mn-lt')f=ctx.theme.minor;
  return '"'+f.replace(/"/g,'')+'","Helvetica Neue",Helvetica,Arial,sans-serif';
}
function autoNum(t,n){
  if(/alphaLc/.test(t))return String.fromCharCode(96+((n-1)%26+1))+(/Paren/.test(t)?')':'.');
  if(/alphaUc/.test(t))return String.fromCharCode(64+((n-1)%26+1))+(/Paren/.test(t)?')':'.');
  return n+(/ParenR/.test(t)?')':/ParenBoth/.test(t)?')':'.');
}

/* рисуем txBody в прямоугольник (EMU→px уже в box). opts: ctx2d, rc(Ctx), tx(txBody), box{x,y,w,h}, stylesChain, k (px per EMU) */
function drawText(g,rc,tx,box,chain,k,phCfg,opt){
  if(!tx)return;
  opt=opt||{};
  var bp=kid(tx,'bodyPr')||null,pbp=phCfg&&phCfg.bodyPr||null;
  function ba(n,d){var v=at(bp,n,null);if(v==null)v=at(pbp,n,null);return v==null?d:v}
  var lI=+ba('lIns',opt.ins!=null?opt.ins:91440)*k,tI=+ba('tIns',opt.ins!=null?opt.ins/2:45720)*k,rI=+ba('rIns',opt.ins!=null?opt.ins:91440)*k,bI=+ba('bIns',opt.ins!=null?opt.ins/2:45720)*k;
  var anchor=ba('anchor','t'),wrap=ba('wrap','square')!=='none';
  var fit=kid(bp,'normAutofit')||kid(pbp,'normAutofit');
  var fscale=fit?nm(fit,'fontScale',100000)/100000:1;
  var W=box.w-lI-rI,H=box.h-tI-bI;
  var pPrs=kids(tx,'p');
  var pxPt=PT*k;
  function build(scale){
    var lines=[],total=0,counters=[0,0,0,0,0,0,0,0,0],prevLvl=0;
    pPrs.forEach(function(p,pi){
      var pPr=kid(p,'pPr'),lvl=nm(pPr,'lvl',0),cfg={r:{}};
      chain.forEach(function(ls){mergeFrom(cfg,lvlP(ls,lvl))});
      mergeFrom(cfg,pPr);
      var marL=(cfg.marL||0)*k,ind=(cfg.indent||0)*k,algn=cfg.algn||'l';
      var runs=[];
      kids(p).forEach(function(n){
        if(n.localName==='r'||n.localName==='fld'){var t=kid(n,'t');if(!t)return;var rr=mergeR(cfg.r,kid(n,'rPr'));runs.push({t:t.textContent,r:rr})}
        else if(n.localName==='br')runs.push({br:1,r:mergeR(cfg.r,kid(n,'rPr'))});
      });
      var endR=mergeR(cfg.r,kid(p,'endParaRPr'));
      var defSz=(endR.sz||1800)/100*pxPt*scale;
      var bu=cfg.bu,label=null;
      if(bu&&runs.some(function(r){return r.t&&r.t.trim()})){
        if(bu.num){for(var d=lvl+1;d<9;d++)counters[d]=0;counters[lvl]=(counters[lvl]||0)+1;if(counters[lvl]===1)counters[lvl]=bu.start||1;label=autoNum(bu.num,counters[lvl])}
        else label=bu.ch;
      }else{counters[lvl]=0}
      prevLvl=lvl;
      /* токены */
      var toks=[];
      runs.forEach(function(r){
        if(r.br){toks.push({br:1,sz:(r.r.sz||1800)/100*pxPt*scale});return}
        var f=r.r;if(opt.forceBold)f=mergeR(f,{getAttribute:function(n){return n==='b'?'1':null},firstElementChild:null});var sz=(f.sz||1800)/100*pxPt*scale*(f.base?0.65:1),txt=f.cap==='all'?r.t.toUpperCase():r.t;
        var font=(f.i?'italic ':'')+(f.b?'bold ':'')+Math.max(1,sz).toFixed(1)+'px '+faceOf(rc,f.face);
        var col=f.fill?rc.colorIn(f.fill,opt.phClr):null;
        txt.split(/(\s+)/).forEach(function(w){if(w)toks.push({t:w,font:font,sz:sz,col:col,u:f.u,st:f.strike,base:f.base})});
      });
      var avail=W-marL-(label?0:0);
      var first=Math.max(0,label?marL:marL+ind),rest=marL,L=[],cur={toks:[],w:0,sz:0,left:first,max:W-first};
      function push(){L.push(cur);cur={toks:[],w:0,sz:0,left:rest,max:W-rest}}
      toks.forEach(function(t){
        if(t.br){cur.sz=Math.max(cur.sz,t.sz);push();return}
        g.font=t.font;t.w=g.measureText(t.t).width;
        var space=/^\s+$/.test(t.t);
        if(!space&&wrap&&cur.w+t.w>cur.max+0.5&&cur.toks.length){
          while(cur.toks.length&&/^\s+$/.test(cur.toks[cur.toks.length-1].t)){cur.w-=cur.toks.pop().w}
          push();
        }
        if(space&&!cur.toks.length)return;
        cur.toks.push(t);cur.w+=t.w;cur.sz=Math.max(cur.sz,t.sz);
      });
      L.push(cur);
      var lnPct=cfg.lnPct||1;
      var bef=cfg.spcBef?(cfg.spcBef.pts!=null?cfg.spcBef.pts*pxPt*scale:cfg.spcBef.pct*defSz*1.2):0;
      var aft=cfg.spcAft?(cfg.spcAft.pts!=null?cfg.spcAft.pts*pxPt*scale:cfg.spcAft.pct*defSz*1.2):0;
      if(pi===0)bef=0;
      var para={lines:L,algn:algn,label:label,cfg:cfg,bef:bef,aft:aft,lnPct:lnPct,defSz:defSz,marL:marL,ind:ind,endR:endR,first:first};
      L.forEach(function(l){var s=l.sz||defSz;l.h=cfg.lnPts?cfg.lnPts*pxPt*scale:s*1.2*lnPct;l.s=s});
      para.h=bef+L.reduce(function(a,l){return a+l.h},0)+aft;total+=para.h;
      lines.push(para);
    });
    return {paras:lines,total:total};
  }
  var sc=fscale,res=build(sc);
  if(fit){var n=0;while(res.total>H*1.01&&sc>0.35&&n++<14){sc*=0.93;res=build(sc)}}
  if(opt.measure)return res.total+tI+bI;
  g.save();
  g.beginPath();g.rect(box.x-1,box.y-1,box.w+2,box.h+2);g.clip();
  var y=box.y+tI;
  if(anchor==='ctr')y=box.y+tI+(H-res.total)/2;else if(anchor==='b')y=box.y+box.h-bI-res.total;
  g.textBaseline='alphabetic';
  res.paras.forEach(function(p){
    y+=p.bef;
    p.lines.forEach(function(l,li){
      var x0=box.x+lI+l.left,lw=l.w,ax=x0;
      var avail=W-l.left;
      if(p.algn==='ctr')ax=x0+(avail-lw)/2;else if(p.algn==='r')ax=x0+avail-lw;
      var base=y+l.h-(l.s)*0.26;
      if(li===0&&p.label){
        var br=p.cfg.r,bsz=(br.sz||1800)/100*pxPt*sc*(p.cfg.buSz||1);
        g.font=(br.b?'bold ':'')+bsz.toFixed(1)+'px '+faceOf(rc,br.face);
        var fc=p.cfg.buClr?rc.colorIn(p.cfg.buClr,opt.phClr):(l.toks[0]&&l.toks[0].col)||(br.fill?rc.colorIn(br.fill,opt.phClr):null);
        g.fillStyle=css(fc||opt.defCol||[0,0,0,1]);
        g.textAlign='left';g.fillText(p.label,box.x+lI+p.marL+p.ind,base);
      }
      var x=ax;g.textAlign='left';
      l.toks.forEach(function(t){
        g.font=t.font;g.fillStyle=css(t.col||opt.defCol||[0,0,0,1]);
        var by=base+(t.base>0?-t.sz*0.35:t.base<0?t.sz*0.2:0);
        g.fillText(t.t,x,by);
        if(t.u){g.fillRect(x,base+t.sz*0.1,t.w,Math.max(1,t.sz/16))}
        if(t.st){g.fillRect(x,base-t.sz*0.3,t.w,Math.max(1,t.sz/16))}
        x+=t.w;
      });
      y+=l.h;
    });
    y+=p.aft;
  });
  g.restore();
}

/* ---------- заливки/линии ---------- */
function gradOf(g,rc,gf,b,phClr){
  var gs=kids(pth(gf,'gsLst'),'gs');if(!gs.length)return null;
  var lin=kid(gf,'lin'),path=kid(gf,'path'),gr;
  if(path){gr=g.createRadialGradient(b.x+b.w/2,b.y+b.h/2,0,b.x+b.w/2,b.y+b.h/2,Math.max(b.w,b.h)/2)}
  else{var ang=(lin?nm(lin,'ang',0):0)/60000*Math.PI/180,cx=b.x+b.w/2,cy=b.y+b.h/2,dx=Math.cos(ang),dy=Math.sin(ang),hl=(Math.abs(dx)*b.w+Math.abs(dy)*b.h)/2;
    gr=g.createLinearGradient(cx-dx*hl,cy-dy*hl,cx+dx*hl,cy+dy*hl)}
  gs.forEach(function(s){var c=rc.colorIn(s,phClr)||[0,0,0,1];try{gr.addColorStop(Math.min(1,Math.max(0,nm(s,'pos',0)/100000)),css(c))}catch(e){}});
  return gr;
}
/* возвращает {style}|{img}|null */
function fillOf(g,rc,spPr,styleEl,b,rels){
  var f=null;
  ['noFill','solidFill','gradFill','blipFill','pattFill'].forEach(function(n){if(!f){var e=kid(spPr,n);if(e)f=e}});
  if(f){
    if(f.localName==='noFill')return null;
    if(f.localName==='solidFill')return {style:css(rc.colorIn(f))};
    if(f.localName==='gradFill')return {style:gradOf(g,rc,f,b)};
    if(f.localName==='pattFill'){var fg=rc.colorIn(kid(f,'fgClr'));return {style:css(fg)}}
    if(f.localName==='blipFill'){var rid=embedId(kid(f,'blip'));var r=rid&&rels[rid];return {imgPath:r&&r.path,src:kid(f,'srcRect')}}
  }
  if(styleEl){var fr=kid(styleEl,'fillRef');if(fr&&nm(fr,'idx',0)>0){
    var ph=rc.colorIn(fr);var lst=rc.theme.fillStyles||[],st=lst[nm(fr,'idx',1)-1];
    if(st&&st.localName==='gradFill'){var gg=gradOfPh(g,rc,st,b,ph);return {style:gg}}
    return {style:css(ph)}}}
  return null;
}
function gradOfPh(g,rc,gf,b,ph){return gradOf(g,rc,gf,b,ph)}
function lineOf(rc,spPr,styleEl){
  var ln=kid(spPr,'ln'),o=null;
  if(ln){
    if(kid(ln,'noFill'))return null;
    var sf=kid(ln,'solidFill');
    if(sf)o={col:css(rc.colorIn(sf)),w:nm(ln,'w',9525)};
    else if(kid(ln,'gradFill')){var gs=kids(pth(ln,'gradFill/gsLst'),'gs')[0];o={col:css(rc.colorIn(gs)),w:nm(ln,'w',9525)}}
    if(o){var d=pth(ln,'prstDash');o.dash=d?at(d,'val','solid'):'solid';
      o.head=at(pth(ln,'headEnd'),'type','none');o.tail=at(pth(ln,'tailEnd'),'type','none');o.cap=at(ln,'cap','flat');return o}
  }
  if(styleEl){var lr=kid(styleEl,'lnRef');if(lr&&nm(lr,'idx',0)>0){
    var c=rc.colorIn(lr),st=(rc.theme.lnStyles||[])[nm(lr,'idx',1)-1];
    return {col:css(c),w:ln?nm(ln,'w',nm(st,'w',9525)):nm(st,'w',9525),dash:'solid',head:'none',tail:'none',cap:'flat'}}}
  if(ln&&!o){var w=nm(ln,'w',null);if(w!=null)return null}
  return null;
}
function strokeOf(g,ln,k){
  g.strokeStyle=ln.col;g.lineWidth=Math.max(0.5,ln.w*k);
  var u=g.lineWidth,m={dash:[4*u,3*u],sysDash:[3*u,u],dot:[u,2*u],sysDot:[u,u],lgDash:[8*u,3*u],dashDot:[4*u,3*u,u,3*u]};
  g.setLineDash(m[ln.dash]||[]);
  g.lineCap=ln.cap==='rnd'?'round':ln.cap==='sq'?'square':'butt';
}
function arrow(g,ln,x1,y1,x2,y2,k){
  if(!ln||ln.tail==='none')return;
  var a=Math.atan2(y2-y1,x2-x1),s=Math.max(6,ln.w*k*4);
  g.save();g.setLineDash([]);g.fillStyle=ln.col;g.translate(x2,y2);g.rotate(a);
  g.beginPath();g.moveTo(0,0);g.lineTo(-s,-s/2);g.lineTo(-s,s/2);g.closePath();g.fill();g.restore();
}
function drawImgFill(g,img,srcRect,b){
  if(!img)return;
  var iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight;if(!iw||!ih)return;
  var l=nm(srcRect,'l',0)/100000,t=nm(srcRect,'t',0)/100000,r=nm(srcRect,'r',0)/100000,bt=nm(srcRect,'b',0)/100000;
  var sx=iw*l,sy=ih*t,sw=iw*(1-l-r),sh=ih*(1-t-bt);
  if(sw<=0||sh<=0)return;
  g.drawImage(img,sx,sy,sw,sh,b.x,b.y,b.w,b.h);
}

/* ---------- обход дерева ---------- */
function xfrmOf(sp,tag){
  var x=pth(sp,tag||'spPr/xfrm')||pth(sp,'xfrm')||pth(sp,'grpSpPr/xfrm');if(!x)return null;
  var o=kid(x,'off'),e=kid(x,'ext');if(!o||!e)return null;
  return {x:nm(o,'x',0),y:nm(o,'y',0),w:nm(e,'cx',0),h:nm(e,'cy',0),rot:nm(x,'rot',0)/60000,fh:at(x,'flipH')==='1',fv:at(x,'flipV')==='1',
    co:kid(x,'chOff'),ce:kid(x,'chExt')};
}

function renderTree(g,rc,tree,env,xf){
  /* xf: {sx,sy,tx,ty} преобразование EMU-координат группы */
  kids(tree).forEach(function(n){
    var nme=n.localName;
    try{
      if(nme==='sp'||nme==='cxnSp')drawSp(g,rc,n,env,xf);
      else if(nme==='pic')drawPic(g,rc,n,env,xf);
      else if(nme==='grpSp')drawGrp(g,rc,n,env,xf);
      else if(nme==='graphicFrame')drawFrame(g,rc,n,env,xf);
    }catch(e){if(window.console&&console.warn)console.warn('pptx shape',e)}
  });
}
function mapBox(x,xf,k){
  if(!x)return null;
  return {x:(xf.tx+x.x*xf.sx)*k,y:(xf.ty+x.y*xf.sy)*k,w:x.w*xf.sx*k,h:x.h*xf.sy*k,rot:x.rot,fh:x.fh,fv:x.fv};
}
function drawGrp(g,rc,n,env,xf){
  var x=xfrmOf(n,'grpSpPr/xfrm');if(!x){renderTree(g,rc,n,env,xf);return}
  var co=x.co,ce=x.ce,cx=nm(co,'x',x.x),cy=nm(co,'y',x.y),cw=nm(ce,'cx',x.w)||x.w||1,ch=nm(ce,'cy',x.h)||x.h||1;
  var sx=x.w/cw,sy=x.h/ch;
  var nx={sx:xf.sx*sx,sy:xf.sy*sy,tx:xf.tx+(x.x-cx*sx)*xf.sx,ty:xf.ty+(x.y-cy*sy)*xf.sy};
  renderTree(g,rc,n,env,nx);
}
function withXf(g,b,fn){
  g.save();g.translate(b.x+b.w/2,b.y+b.h/2);
  if(b.rot)g.rotate(b.rot*Math.PI/180);
  fn();g.restore();
}
function drawSp(g,rc,sp,env,xf){
  var k=env.k,ph=phOf(sp),lay=null,mas=null;
  var isTx=sp.localName==='sp';
  if(ph&&(ph.type==='sldNum'||ph.type==='dt'||ph.type==='ftr')&&env.isSlide)return;
  var x=xfrmOf(sp);
  var layS=ph&&env.layout?findPh(pth(env.layout,'cSld/spTree'),ph):null;
  var masS=ph&&env.master?findPh(pth(env.master,'cSld/spTree'),ph):null;
  if(!x&&layS)x=xfrmOf(layS);if(!x&&masS)x=xfrmOf(masS);
  if(!x)return;
  var b=mapBox(x,xf,k);if(b.w<0||b.h<0)return;
  var spPr=kid(sp,'spPr'),style=kid(sp,'style');
  var pre=at(pth(spPr,'prstGeom'),'prst','rect'),cust=pth(spPr,'custGeom');
  if(!spPr||(!kid(spPr,'prstGeom')&&!cust)){var ps=(layS&&pth(layS,'spPr/prstGeom'))||(masS&&pth(masS,'spPr/prstGeom'));if(ps)pre=at(ps,'prst','rect')}
  var av={};kids(pth(spPr,'prstGeom/avLst'),'gd').forEach(function(d){var m=/val\s+(-?\d+)/.exec(at(d,'fmla',''));if(m)av[at(d,'name')]=+m[1]});
  var pf=cust?custPath(cust,b.w,b.h):shapePath(pre,b.w,b.h,av);
  var inheritSpPr=(layS&&kid(layS,'spPr'))||(masS&&kid(masS,'spPr'));
  var fillSrc=spPr&&['noFill','solidFill','gradFill','blipFill','pattFill'].some(function(n){return kid(spPr,n)})?spPr:(inheritSpPr&&['noFill','solidFill','gradFill','blipFill','pattFill'].some(function(n){return kid(inheritSpPr,n)})?inheritSpPr:spPr);
  var lnSrc=spPr&&kid(spPr,'ln')?spPr:(inheritSpPr&&kid(inheritSpPr,'ln')?inheritSpPr:spPr);
  var isLine=/line|Connector/i.test(pre)||sp.localName==='cxnSp';
  withXf(g,b,function(){
    var bx={x:-b.w/2,y:-b.h/2,w:b.w,h:b.h};
    g.save();
    if(b.fh||b.fv)g.scale(b.fh?-1:1,b.fv?-1:1);
    if(!isLine){
      var fl=fillOf(g,rc,fillSrc,style,bx,env.rels);
      if(fl){
        if(fl.imgPath){g.save();pf(g,bx.x,bx.y);g.clip();env.pending.push(rc.deck.img(fl.imgPath).then(function(im){}));g.restore();
          /* картинка-заливка рисуется синхронно из кэша (подгружена заранее) */
          var im=env.imgCache[fl.imgPath];if(im){g.save();pf(g,bx.x,bx.y);g.clip();drawImgFill(g,im,fl.src,bx);g.restore()}}
        else if(fl.style){g.fillStyle=fl.style;pf(g,bx.x,bx.y);g.fill()}
      }
    }
    var ln=lineOf(rc,lnSrc,style);
    if(ln&&ln.col){strokeOf(g,ln,k);pf(g,bx.x,bx.y);g.stroke();
      if(isLine)arrow(g,ln,bx.x,bx.y,bx.x+bx.w,bx.y+bx.h,k)}
    g.restore();
    /* текст */
    var tx=kid(sp,'txBody');
    if(tx){
      var chain=[env.pres.defaultTextStyle];
      var kind=ph?(norm(ph.type)==='title'?'title':(norm(ph.type)==='body'?'body':'other')):'other';
      chain.push(env.txStyles&&env.txStyles[kind]);
      if(masS)chain.push(pth(masS,'txBody/lstStyle'));
      if(layS)chain.push(pth(layS,'txBody/lstStyle'));
      chain.push(pth(tx,'lstStyle'));
      var bpi=(layS&&pth(layS,'txBody/bodyPr'))||(masS&&pth(masS,'txBody/bodyPr'))||null;
      var defCol=null;
      /* цвет текста по умолчанию из style/fontRef или tx1 */
      var fr=style&&kid(style,'fontRef');if(fr)defCol=rc.colorIn(fr);
      if(!defCol)defCol=rc.colorOf({localName:'schemeClr',getAttribute:function(){return 'tx1'},firstElementChild:null,children:[]});
      drawText(g,rc,tx,{x:bx.x,y:bx.y,w:bx.w,h:bx.h},chain,k,{bodyPr:bpi},{defCol:defCol,phClr:fr?rc.colorIn(fr):null});
    }
  });
}
function drawPic(g,rc,pic,env,xf){
  var k=env.k,ph=phOf(pic),x=xfrmOf(pic);
  if(!x&&ph&&env.layout){var l=findPh(pth(env.layout,'cSld/spTree'),ph);if(l)x=xfrmOf(l)}
  if(!x)return;
  var b=mapBox(x,xf,k),bl=pth(pic,'blipFill/blip');
  var rid=embedId(bl);
  var r=rid&&env.rels[rid];if(!r||!r.path)return;
  var im=env.imgCache[r.path];if(!im)return;
  var pre=at(pth(pic,'spPr/prstGeom'),'prst','rect'),av={};
  kids(pth(pic,'spPr/prstGeom/avLst'),'gd').forEach(function(d){var m=/val\s+(-?\d+)/.exec(at(d,'fmla',''));if(m)av[at(d,'name')]=+m[1]});
  withXf(g,b,function(){
    var bx={x:-b.w/2,y:-b.h/2,w:b.w,h:b.h};
    g.save();if(b.fh||b.fv)g.scale(b.fh?-1:1,b.fv?-1:1);
    if(pre!=='rect'){shapePath(pre,b.w,b.h,av)(g,bx.x,bx.y);g.clip()}
    drawImgFill(g,im,pth(pic,'blipFill/srcRect'),bx);
    g.restore();
    var ln=lineOf(rc,kid(pic,'spPr'),null);
    if(ln&&ln.col){g.save();if(b.fh||b.fv)g.scale(b.fh?-1:1,b.fv?-1:1);strokeOf(g,ln,k);shapePath(pre,b.w,b.h,av)(g,bx.x,bx.y);g.stroke();g.restore()}
  });
}
function drawFrame(g,rc,fr,env,xf){
  var k=env.k,x=xfrmOf(fr,'xfrm');if(!x)return;
  var b=mapBox(x,xf,k),gd=pth(fr,'graphic/graphicData'),tbl=gd&&kid(gd,'tbl');
  if(!tbl){
    g.save();g.fillStyle='rgba(128,128,128,.12)';g.strokeStyle='rgba(128,128,128,.5)';g.lineWidth=1;
    g.fillRect(b.x,b.y,b.w,b.h);g.strokeRect(b.x,b.y,b.w,b.h);
    g.fillStyle='rgba(90,90,90,.9)';g.font='600 '+Math.max(12,Math.min(28,b.h/8)).toFixed(0)+'px Helvetica,Arial,sans-serif';g.textAlign='center';
    var uri=at(gd,'uri','');g.fillText(/chart/.test(uri)?'График':/diagram/.test(uri)?'Схема':'Объект',b.x+b.w/2,b.y+b.h/2);g.restore();return;
  }
  var cols=kids(pth(tbl,'tblGrid'),'gridCol').map(function(c){return nm(c,'w',0)});
  var tp=kid(tbl,'tblPr'),firstRow=at(tp,'firstRow')==='1',band=at(tp,'bandRow')==='1';
  var acc=rc.colorOf({localName:'schemeClr',getAttribute:function(){return 'accent1'},firstElementChild:null,children:[]});
  var y=b.y,heights=[];
  kids(tbl,'tr').forEach(function(tr,ri){
    var rh=nm(tr,'h',0)*xf.sy*k,ci=0;
    kids(tr,'tc').forEach(function(tc){
      var span=nm(tc,'gridSpan',1),cw=0;for(var s=0;s<span;s++)cw+=(cols[ci+s]||0);cw*=xf.sx*k;ci+=span;
      var tx=kid(tc,'txBody');if(!tx||at(tc,'hMerge')==='1')return;
      var need=drawText(g,rc,tx,{x:0,y:0,w:cw,h:1e6},[env.pres.defaultTextStyle,env.txStyles&&env.txStyles.other,pth(tx,'lstStyle')],k,null,{measure:true,ins:91440,forceBold:firstRow&&ri===0});
      if(need>rh)rh=need;
    });
    heights.push(rh);
  });
  kids(tbl,'tr').forEach(function(tr,ri){
    var rh=heights[ri],xx=b.x,ci=0;
    kids(tr,'tc').forEach(function(tc){
      var span=nm(tc,'gridSpan',1),cw=0;for(var s=0;s<span;s++)cw+=(cols[ci+s]||0);cw*=xf.sx*k;
      if(at(tc,'hMerge')==='1'){ci+=1;xx+=(cols[ci-1]||0)*xf.sx*k;return}
      var tcPr=kid(tc,'tcPr'),fl=null,hdr=firstRow&&ri===0;
      var sf=tcPr&&kid(tcPr,'solidFill');
      if(sf)fl=css(rc.colorIn(sf));
      else if(!tcPr||!kid(tcPr,'noFill')){
        if(hdr)fl=css(acc);else if(band)fl=ri%2?'rgba('+acc[0]+','+acc[1]+','+acc[2]+',.16)':'rgba('+acc[0]+','+acc[1]+','+acc[2]+',.30)';
      }
      if(fl){g.fillStyle=fl;g.fillRect(xx,y,cw,rh)}
      [['lnT',xx,y,xx+cw,y],['lnB',xx,y+rh,xx+cw,y+rh],['lnL',xx,y,xx,y+rh],['lnR',xx+cw,y,xx+cw,y+rh]].forEach(function(sd){
        var ln=tcPr&&kid(tcPr,sd[0]),col='rgba(255,255,255,.9)',w=1;
        if(ln){if(kid(ln,'noFill'))return;var sfl=kid(ln,'solidFill');if(sfl)col=css(rc.colorIn(sfl));w=Math.max(1,nm(ln,'w',12700)*k)}
        g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(sd[1],sd[2]);g.lineTo(sd[3],sd[4]);g.stroke()});
      var tx=kid(tc,'txBody');
      if(tx){var chain=[env.pres.defaultTextStyle,env.txStyles&&env.txStyles.other,pth(tx,'lstStyle')];
        drawText(g,rc,tx,{x:xx,y:y,w:cw,h:rh},chain,k,null,{defCol:hdr&&!sf?[255,255,255,1]:[0,0,0,1],ins:91440,forceBold:hdr});}
      xx+=cw;ci+=span;
    });
    y+=rh;
  });
}

/* ---------- слайд ---------- */
function bgOf(g,rc,cSld,rels,b,env){
  var bg=cSld&&kid(cSld,'bg');if(!bg)return null;
  var pr=kid(bg,'bgPr'),ref=kid(bg,'bgRef');
  if(pr){var f=fillOf(g,rc,pr,null,b,rels);return f}
  if(ref){var ph=rc.colorIn(ref),st=(rc.theme.bgStyles||[])[nm(ref,'idx',1001)-1001];
    if(st&&st.localName==='gradFill')return {style:gradOf(g,rc,st,b,ph)};
    return {style:css(ph)}}
  return null;
}
function collectImgs(deck,rels,docs){
  var set={};
  docs.forEach(function(d){if(!d)return;
    var all=d.getElementsByTagName('*');
    for(var i=0;i<all.length;i++){var e=all[i];
      if(e.localName==='blip'){var id=embedId(e);if(id&&rels[id]&&rels[id].path)set[rels[id].path]=1}}});
  return Promise.all(Object.keys(set).map(function(p){return deck.img(p).then(function(im){return [p,im]})}))
    .then(function(a){var m={};a.forEach(function(x){if(x[1])m[x[0]]=x[1]});return m});
}

function render(file,opt){
  opt=opt||{};
  if(!window.JSZip)return Promise.reject(new Error('lib'));
  return file.arrayBuffer().then(function(ab){return JSZip.loadAsync(ab)}).catch(function(){throw new Error('zip')}).then(function(zip){
    var deck=new Deck(zip);
    return deck.xml('ppt/presentation.xml').then(function(pres){
      if(!pres)throw new Error('notpptx');
      return deck.rels('ppt/presentation.xml').then(function(prels){
        var root=pres.documentElement,sz=kid(root,'sldSz'),cx=nm(sz,'cx',9144000),cy=nm(sz,'cy',5143500);
        var ids=kids(pth(root,'sldIdLst'),'sldId').map(function(s){var rid=s.getAttribute('r:id');return prels[rid]&&prels[rid].path}).filter(Boolean);
        var presInfo={defaultTextStyle:pth(root,'defaultTextStyle')};
        var longPx=opt.maxSide||1920,kk=longPx/Math.max(cx,cy),W=Math.round(cx*kk),H=Math.round(cy*kk);
        var themeCache={},mastCache={};
        var out=[],chain=Promise.resolve(),total=ids.length;
        ids.forEach(function(sp,idx){
          chain=chain.then(function(){
            if(opt.cancel&&opt.cancel())throw new Error('cancel');
            if(opt.progress)opt.progress(idx,total);
            return deck.xml(sp).then(function(sd){
              if(!sd)return;
              if(at(sd.documentElement,'show','1')==='0')return;
              return deck.rels(sp).then(function(srels){
                var lp=null;for(var id in srels)if(srels[id].type==='slideLayout')lp=srels[id].path;
                return Promise.all([lp?deck.xml(lp):null,lp?deck.rels(lp):{}]).then(function(lr){
                  var layout=lr[0]&&lr[0].documentElement,lrels=lr[1],mp=null;
                  for(var id in lrels)if(lrels[id].type==='slideMaster')mp=lrels[id].path;
                  return Promise.all([mp?deck.xml(mp):null,mp?deck.rels(mp):{}]).then(function(mr){
                    var master=mr[0]&&mr[0].documentElement,mrels=mr[1],tp=null;
                    for(var id in mrels)if(mrels[id].type==='theme')tp=mrels[id].path;
                    return themeOf(deck,tp).then(function(theme){
                      var cm={};if(master){var c=kid(master,'clrMap');if(c)for(var i=0;i<c.attributes.length;i++)cm[c.attributes[i].name]=c.attributes[i].value}
                      var rc=new Ctx(deck,theme,cm,srels);
                      var txs=master&&pth(master,'txStyles');
                      var txStyles={title:txs&&kid(txs,'titleStyle'),body:txs&&kid(txs,'bodyStyle'),other:txs&&kid(txs,'otherStyle')};
                      return collectImgs(deck,srels,[sd]).then(function(i1){return collectImgs(deck,lrels,[lr[0]]).then(function(i2){return collectImgs(deck,mrels,[mr[0]]).then(function(i3){
                        var imgCache={};[i1,i2,i3].forEach(function(m){for(var k in m)imgCache[k]=m[k]});
                        var cv=document.createElement('canvas');cv.width=W;cv.height=H;
                        var g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
                        var bb={x:0,y:0,w:W,h:H},bgd=null;
                        [sd.documentElement,layout,master].some(function(doc){
                          var cs=doc&&kid(doc,'cSld');var rel=doc===sd.documentElement?srels:doc===layout?lrels:mrels;
                          var f=bgOf(g,rc,cs,rel,bb);if(f){bgd=f;bgd.rels=rel;return true}return false});
                        if(bgd){if(bgd.style){g.fillStyle=bgd.style;g.fillRect(0,0,W,H)}
                          else if(bgd.imgPath&&imgCache[bgd.imgPath])drawImgFill(g,imgCache[bgd.imgPath],bgd.src,bb)}
                        var xf0={sx:1,sy:1,tx:0,ty:0},k=kk;
                        var showMaster=at(sd.documentElement,'showMasterSp','1')!=='0'&&at(layout,'showMasterSp','1')!=='0';
                        var envBase={k:k,pres:presInfo,txStyles:txStyles,layout:layout,master:master,imgCache:imgCache,pending:[]};
                        function env(isSlide,rels,tree){return {k:k,pres:presInfo,txStyles:txStyles,layout:layout,master:master,imgCache:imgCache,pending:[],isSlide:isSlide,rels:rels}}
                        if(showMaster&&master){var rm=new Ctx(deck,theme,cm,mrels);renderTree(g,rm,pth(master,'cSld/spTree'),dropPh(env(false,mrels)),xf0)}
                        if(layout){var rl=new Ctx(deck,theme,cm,lrels);renderTree(g,rl,pth(layout,'cSld/spTree'),dropPh(env(false,lrels)),xf0)}
                        renderTree(g,rc,pth(sd.documentElement,'cSld/spTree'),env(true,srels),xf0);
                        if(opt.onPage)return opt.onPage(cv,W,H,idx);
                        out.push({canvas:cv,w:W,h:H});
                      })})});
                    });
                  });
                });
              });
            });
          });
        });
        return chain.then(function(){if(opt.progress)opt.progress(total,total);return {pages:out,cx:cx,cy:cy,w:W,h:H}});
      });
    });
  });
}
/* в мастере/макете рисуем только не-плейсхолдеры */
function dropPh(env){env.skipPh=true;return env}
var _drawSp=drawSp;
drawSp=function(g,rc,sp,env,xf){if(env.skipPh&&phOf(sp))return;_drawSp(g,rc,sp,env,xf)};

window.TapPptx={render:render};
})();
