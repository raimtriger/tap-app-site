#!/usr/bin/env python3
# Патч №2 рефералки: бот как основная воронка (приглашение в боте, готовая карточка для пересылки, прогресс, /refs для админа)
import sys, shutil, time
P = sys.argv[1] if len(sys.argv) > 1 else '/opt/tapapp-pay/server.js'
s = open(P, encoding='utf-8').read()
if 'creditRef' not in s:
    sys.exit('Сначала нужен патч №1 (patch_ref.py)')
if 'nmOf' in s:
    sys.exit('Патч №2 уже применён')

def rep(a, b):
    global s
    n = s.count(a)
    if n != 1:
        sys.exit('ОШИБКА: фрагмент найден %d раз(а), ожидался 1: %s' % (n, a[:90]))
    s = s.replace(a, b)

def rep_line(prefix, new):
    """заменяет целую строку, начинающуюся с prefix (строка должна быть единственной)"""
    global s
    L = s.split('\n')
    idx = [i for i, l in enumerate(L) if l.startswith(prefix)]
    if len(idx) != 1:
        sys.exit('ОШИБКА: строка с началом %r найдена %d раз(а)' % (prefix[:60], len(idx)))
    L[idx[0]] = new
    s = '\n'.join(L)

# 1. ссылка: по умолчанию deep-link на бота (REF_MODE=site вернёт ссылку на сайт); хелперы
rep("const refLink=u=>REF_TG&&BOTU?'https://t.me/'+BOTU+'?startapp=ref_'+u.id:ORIGIN+'/?ref='+u.id;",
    r"""const refLink=u=>E.REF_MODE==='site'||!BOTU?ORIGIN+'/?ref='+u.id:'https://t.me/'+BOTU+'?start=ref_'+u.id;
const nmOf=u=>u.name||(u.un?'@'+u.un:'друг');
const refCard=u=>'👋 '+nmOf(u)+' зовёт тебя в TAP APP — 30+ мини-инструментов в одном приложении: подпись PDF, сжатие фото, конвертеры, тюнер, метроном, песочные часы и другое.\n\n🎁 Зайди по моей ссылке — тебе +'+FRIEND_DAYS+' дня Pro бесплатно, без лимитов.';
const shareBtn=u=>({text:'📤 Переслать другу',url:'https://t.me/share/url?url='+encodeURIComponent(refLink(u))+'&text='+encodeURIComponent(refCard(u))});""")

# 2. приглашённый может прийти через бота: запомненный u.pref используется при первом входе
rep("rid=String(rid||'');", "rid=String(rid||u.pref||'');")

# 3. красивые уведомления в creditRef
L = s.split('\n')
a = next(i for i, l in enumerate(L) if l.startswith("  say(r.id,'🎉 Друг присоединился"))
b = next(i for i, l in enumerate(L) if l.startswith("  say(u.id,'Добро пожаловать в TAP APP!"))
assert b == a + 1, 'неожиданная структура creditRef'
new_lines = r"""  const left=REF_MAX-r.refs.length;
  tg('sendMessage',{chat_id:r.id,text:'🎉 По твоему приглашению в TAP APP пришёл друг: '+nmOf(u)+'!\n\n+'+REF_DAYS+' дн. Pro'+((r.life||r.gift)?' (у тебя Pro навсегда, друг засчитан)':' — Pro до '+fmt(r.until))+'\nПриглашено: '+r.refs.length+'/'+REF_MAX+(left>0?' · ещё '+left+' '+(left===1?'друг':'друга')+' = +'+left*REF_DAYS+' дн. Pro':' · максимум, ты собрал '+REF_MAX*REF_DAYS+' дн. Pro 🏆'),...(left>0?{reply_markup:{inline_keyboard:[[shareBtn(r)]]}}:{})});
  tg('sendMessage',{chat_id:u.id,text:'🎁 Добро пожаловать в TAP APP! Тебе +'+FRIEND_DAYS+' дня Pro'+(isPro(u)?' (до '+fmt(u.until)+')':'')+' по приглашению от '+nmOf(r)+'.\n\nПопробуй песочные часы, метроном или тюнер. А если позовёшь друзей — получишь ещё Pro: команда /ref',reply_markup:{inline_keyboard:[[{text:'Открыть TAP APP',web_app:{url:ORIGIN+'/'}}]]}});"""
L[a:b + 1] = new_lines.split('\n')
s = '\n'.join(L)

# 4. вход друга через бота: /start ref_<id>
rep("      else if(t.startsWith('/start login_')",
    r"""      else if(t.startsWith('/start ref_')){const rid=t.slice(11).trim(),r=/^\d{1,15}$/.test(rid)&&rid!==id?db.users[rid]:null,fresh=u.created&&!u.tokens.length&&!u.refDone;
        if(!r)welcome(id);
        else if(!fresh){say(id,'Ты уже пользовался TAP APP, поэтому бонус за приглашение недоступен. Зато приложение по-прежнему бесплатное 🙂');welcome(id)}
        else if((r.refs||[]).length>=REF_MAX){say(id,'У '+nmOf(r)+' уже набралось максимум друзей, бонус по этой ссылке недоступен. Но TAP APP бесплатный, заходи!');welcome(id)}
        else{u.pref=u.pref||rid;save();tg('sendMessage',{chat_id:id,text:'👋 '+nmOf(r)+' зовёт тебя в TAP APP — 30+ мини-инструментов: подпись PDF, сжатие фото, конвертеры, тюнер, метроном, песочные часы.\n\n🎁 Открой приложение кнопкой ниже и войди через Telegram — тебе +'+FRIEND_DAYS+' дня Pro без лимитов. Бонус начислится сам.',reply_markup:{inline_keyboard:[[{text:'🎁 Открыть и получить '+FRIEND_DAYS+' дня Pro',web_app:{url:ORIGIN+'/'}}],[{text:'Тарифы Pro',url:ORIGIN+'/pro/'}]]}})}}
      else if(t.startsWith('/start login_')""")

# 5. /ref: инструкция + отдельная карточка для пересылки
rep_line("      else if(t==='/ref'){",
    r"""      else if(t==='/ref'){const r=refInfo(u),left=r.max-r.count;
        tg('sendMessage',{chat_id:id,text:'🎁 Зови друзей в TAP APP\n\nТебе +'+REF_DAYS+' дн. Pro за каждого, другу +'+FRIEND_DAYS+' дня Pro. Всего до '+REF_MAX+' друзей.\nПриглашено: '+r.count+'/'+r.max+(r.count?' · получено '+r.count*REF_DAYS+' дн.':'')+'\n\n'+(left>0?'Нажми «Переслать другу» или перешли сообщение ниже — друг откроет ссылку в боте, нажмёт кнопку и войдёт, бонус придёт обоим автоматически.':'Максимум друзей достигнут — ты собрал '+REF_MAX*REF_DAYS+' дн. Pro 🏆'),...(left>0?{reply_markup:{inline_keyboard:[[shareBtn(u)]]}}:{})});
        if(left>0)tg('sendMessage',{chat_id:id,text:refCard(u),reply_markup:{inline_keyboard:[[{text:'🎁 Получить '+FRIEND_DAYS+' дня Pro',url:refLink(u)}]]}})}""")

# 6. админ: /refs
rep("  if(c==='/gifts'){", r"""  if(c==='/refs'){const US=Object.values(db.users),tot=US.reduce((n,x)=>n+(x.refs||[]).length,0),top=US.filter(x=>(x.refs||[]).length).sort((a,b)=>b.refs.length-a.refs.length).slice(0,10).map(x=>nmOf(x)+(x.un?' (@'+x.un+')':'')+' — '+x.refs.length+'/'+REF_MAX);return say(id,'Рефералы: засчитано '+tot+', пригласивших '+US.filter(x=>(x.refs||[]).length).length+'\n\n'+(top.join('\n')||'пока никого'))}
  if(c==='/gifts'){""")
rep("/^\\/(grant|revoke|gifts|users|ideas)(\\s|$)/", "/^\\/(grant|revoke|gifts|users|ideas|refs)(\\s|$)/")
rep("{command:'gifts',description:'Список подарочного Pro'},", "{command:'refs',description:'Статистика рефералов'},{command:'gifts',description:'Список подарочного Pro'},")

bak = P + '.bak.' + time.strftime('%Y%m%d%H%M%S')
shutil.copy(P, bak)
open(P, 'w', encoding='utf-8').write(s)
print('OK, бэкап:', bak)
