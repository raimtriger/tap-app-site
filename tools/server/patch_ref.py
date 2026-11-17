#!/usr/bin/env python3
# Патч рефералки для /opt/tapapp-pay/server.js: пригласивший +7 дней Pro, приглашённый +3 дня, до 3 друзей.
import sys, shutil, time
P = sys.argv[1] if len(sys.argv) > 1 else '/opt/tapapp-pay/server.js'
s = open(P, encoding='utf-8').read()
if 'creditRef' in s:
    sys.exit('Патч уже применён')

def rep(a, b):
    global s
    n = s.count(a)
    if n != 1:
        sys.exit('ОШИБКА: фрагмент найден %d раз(а), ожидался 1: %s' % (n, a[:90]))
    s = s.replace(a, b)

# 1. помощники рефералки
rep("// --- выдача доступа по успешному платежу", r"""// --- рефералка: пригласивший +7 дней Pro, приглашённый +3 дня, до 3 друзей
const REF_MAX=3,REF_DAYS=7,FRIEND_DAYS=3,REF_TG=E.REF_MINIAPP==='1';
const refLink=u=>REF_TG&&BOTU?'https://t.me/'+BOTU+'?startapp=ref_'+u.id:ORIGIN+'/?ref='+u.id;
const refInfo=u=>({link:refLink(u),count:(u.refs||[]).length,max:REF_MAX,days:REF_DAYS,friendDays:FRIEND_DAYS});
function addDays(u,d){if(u.life||u.gift)return;u.until=Math.max(now(),u.until||0)+d*DAY}
// вызывать ДО выдачи первого токена: награда только за самый первый вход аккаунта через Telegram
function creditRef(u,rid){
  rid=String(rid||'');
  if(!/^\d{1,15}$/.test(rid)||u.refDone||!u.created||u.tokens.length)return;
  u.refDone=1;
  const r=db.users[rid];
  if(!r||r.id===u.id)return;
  r.refs=r.refs||[];
  if(r.refs.length>=REF_MAX)return;
  r.refs.push(u.id);u.refBy=r.id;
  addDays(r,REF_DAYS);addDays(u,FRIEND_DAYS);
  say(r.id,'🎉 Друг присоединился к TAP APP: +'+REF_DAYS+' дн. Pro'+((r.life||r.gift)?' (у вас уже Pro навсегда, друг засчитан).':'. Pro до '+fmt(r.until)+'.')+'\nПриглашено друзей: '+r.refs.length+'/'+REF_MAX);
  say(u.id,'Добро пожаловать в TAP APP! Вам +'+FRIEND_DAYS+' дн. Pro'+(isPro(u)?' до '+fmt(u.until):'')+' 🎁');
}
// --- выдача доступа по успешному платежу""")

# 2. дата создания пользователя
rep("tokens:[],fails:0,last:0};", "tokens:[],fails:0,last:0,created:now()};")

# 3. вход из Mini App: start_param=ref_<id> (подписан Telegram) либо ref из тела запроса
rep("const u=user(String(tu.id),tu.first_name||''),t=newToken(u);u.un=tu.username||u.un||'';save();return send(res,200,{ok:true,token:t})",
    "const u=user(String(tu.id),tu.first_name||''),sp=String(p.get('start_param')||'').replace(/^ref_/,''),rf=/^\\d{1,15}$/.test(sp)?sp:String(b.ref||'');u.un=tu.username||u.un||'';creditRef(u,rf);const t=newToken(u);save();return send(res,200,{ok:true,token:t})")

# 4. вход на сайте: запоминаем ref в коде входа
rep("if(path==='/api/login'&&req.method==='POST'){if(Object.keys(db.logins).length>5000)return send(res,429,{error:'busy'});const c=rnd(8);db.logins[c]={ts:now(),tg:''};",
    "if(path==='/api/login'&&req.method==='POST'){const bq=await body(req);if(Object.keys(db.logins).length>5000)return send(res,429,{error:'busy'});const c=rnd(8);db.logins[c]={ts:now(),tg:'',ref:/^\\d{1,15}$/.test(String(bq.ref||''))?String(bq.ref):''};")
rep("const u=user(l.tg),t=newToken(u);delete db.logins[url.searchParams.get('code')];",
    "const u=user(l.tg);creditRef(u,l.ref);const t=newToken(u);delete db.logins[url.searchParams.get('code')];")

# 5. /me отдаёт данные рефералки
rep("until:u.until,auto:u.auto})}", "until:u.until,auto:u.auto,ref:refInfo(u)})}")

# 6. команда /ref в боте
rep("      else if(t==='/cancel'){if(u.auto)",
    "      else if(t==='/ref'){const r=refInfo(u);say(id,'Позови друга в TAP APP: ему +'+FRIEND_DAYS+' дн. Pro, тебе +'+REF_DAYS+' дн. за каждого (до '+REF_MAX+' друзей).\\nПриглашено: '+r.count+'/'+r.max+'\\nТвоя ссылка: '+r.link+'\\nДруг должен войти через Telegram.')}\n      else if(t==='/cancel'){if(u.auto)")
rep("{command:'idea',description:'Предложить аппку'},{command:'status',description:'Статус Pro'},",
    "{command:'idea',description:'Предложить аппку'},{command:'status',description:'Статус Pro'},{command:'ref',description:'Позвать друга: +7 дней Pro'},")
rep("{command:'status',description:'Мой статус'},", "{command:'status',description:'Мой статус'},{command:'ref',description:'Позвать друга: +7 дней Pro'},")
rep("/status — статус Pro\\n/idea", "/status — статус Pro\\n/ref — позвать друга: +7 дней Pro\\n/idea")

bak = P + '.bak.' + time.strftime('%Y%m%d%H%M%S')
shutil.copy(P, bak)
open(P, 'w', encoding='utf-8').write(s)
print('OK, бэкап:', bak)
