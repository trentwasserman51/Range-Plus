/* Range Plus backend: sign-in + cloud storage on Supabase (plain fetch, no libraries).
   Gives the app the same claude.use("user") / claude.use("db") it already uses. */
(function(){
var C=window.RP_CONFIG||{};
if(!C.url||!C.key||/YOUR/.test(C.url+C.key))return; /* not set up: app runs on this device only */
var AK="rp_auth",RK="rp_role",sess=null,role=null;
try{sess=JSON.parse(localStorage.getItem(AK)||"null");role=localStorage.getItem(RK)}catch(e){}
var H=function(tok,x){var h={apikey:C.key,"Content-Type":"application/json"};if(tok)h.Authorization="Bearer "+tok;if(x)for(var k in x)h[k]=x[k];return h};
function keep(s){sess=s;try{if(s)localStorage.setItem(AK,JSON.stringify(s));else{localStorage.removeItem(AK);localStorage.removeItem(RK)}}catch(e){}}
function mk(j){if(!j||!j.access_token)return null;return{access_token:j.access_token,refresh_token:j.refresh_token,exp:Date.now()+((j.expires_in||3600)*1000)-60000,email:(j.user&&j.user.email)||""}}
async function auth(path,body){var r=await fetch(C.url+"/auth/v1/"+path,{method:"POST",headers:H(null),body:JSON.stringify(body)});var j={};try{j=await r.json()}catch(e){}
if(!r.ok){var m=j.error_description||j.msg||j.message||"Sign-in failed";if(/invalid login/i.test(m))m="Wrong email or password.";throw new Error(m)}return j}
async function tok(){if(!sess)throw{code:"signed-out"};if(Date.now()>sess.exp){try{var j=await auth("token?grant_type=refresh_token",{refresh_token:sess.refresh_token});var n=mk(j);if(!n.email)n.email=sess.email;keep(n)}catch(e){if(navigator.onLine===false)return sess.access_token;keep(null);throw{code:"signed-out"}}}return sess.access_token}
async function rest(method,path,body,x){var t=await tok();var r=await fetch(C.url+"/rest/v1/"+path,{method:method,headers:H(t,x),body:body==null?undefined:JSON.stringify(body)});
if(!r.ok){var e={code:"http-"+r.status};throw e}var tx=await r.text();return tx?JSON.parse(tx):null}
async function getRole(){try{var a=await rest("GET","members?select=role");role=a&&a[0]?a[0].role:"none";try{localStorage.setItem(RK,role)}catch(e){}}catch(e){if(!role)role="none"}return role}

/* ---- sign-in screen ---- */
var ov=null,wait=null;
function ui(msg,mode){
if(!ov){ov=document.createElement("div");ov.id="rp-gate";ov.style.cssText="position:fixed;inset:0;z-index:99999;background:#050b18;color:#eef2fb;display:flex;align-items:center;justify-content:center;padding:20px;font:16px/1.4 system-ui,-apple-system,sans-serif;overflow:auto";document.body.appendChild(ov)}
var up=mode==="up";
ov.innerHTML='<form style="width:100%;max-width:360px"><div style="text-align:center;margin-bottom:18px"><svg width="64" height="64" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#0a2e75"/><g fill="none" stroke="#fdb913" stroke-width="6" stroke-linecap="round"><path d="M28.8 48.0 A24 24 0 0 1 52.0 71.2"/><path d="M29.4 32.0 A40 40 0 0 1 68.0 70.6"/><path d="M30.0 16.0 A56 56 0 0 1 84.0 70.0"/></g><path d="M28 64 V80 M20 72 H36" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/></svg><div style="font-weight:800;letter-spacing:.06em;margin-top:8px">RANGE <span style="color:#fdb913">PLUS</span></div></div>'
+'<div style="color:#8b9bbd;font-size:14px;margin-bottom:10px;text-align:center">'+(up?"Create your account":"Sign in")+'. Use the email your coach added.</div>'
+'<input id="rp-e" type="email" autocomplete="email" placeholder="Email" style="width:100%;padding:12px;border-radius:10px;border:1px solid #1a2b52;background:#0b1630;color:#eef2fb;font-size:16px;margin-bottom:8px">'
+'<input id="rp-p" type="password" autocomplete="'+(up?"new-password":"current-password")+'" placeholder="Password'+(up?" (6+ characters)":"")+'" style="width:100%;padding:12px;border-radius:10px;border:1px solid #1a2b52;background:#0b1630;color:#eef2fb;font-size:16px;margin-bottom:10px">'
+(msg?'<div style="color:#f87171;font-size:14px;margin-bottom:10px">'+msg+'</div>':'')
+'<button type="submit" style="width:100%;padding:13px;border:0;border-radius:10px;background:#fdb913;color:#0a1730;font-weight:800;font-size:16px">'+(up?"Create account":"Sign in")+'</button>'
+'<div id="rp-sw" style="text-align:center;color:#7aa6ff;font-size:14px;margin-top:14px;cursor:pointer">'+(up?"I already have an account":"First time? Create an account")+'</div></form>';
var f=ov.querySelector("form");
ov.querySelector("#rp-sw").onclick=function(){ui("",up?"in":"up")};
f.onsubmit=async function(ev){ev.preventDefault();var em=ov.querySelector("#rp-e").value.trim(),pw=ov.querySelector("#rp-p").value;if(!em||!pw){ui("Enter your email and password.",mode);return}
var b=f.querySelector("button");b.disabled=true;b.textContent="One moment…";
try{var j=up?await auth("signup",{email:em,password:pw}):await auth("token?grant_type=password",{email:em,password:pw});
if(!j.access_token){ui("Check your email to confirm your account, then sign in.","in");return}
var n=mk(j);if(!n.email)n.email=em;keep(n);await after()}catch(e){ui(e.message||"Couldn’t sign in.",mode)}};
}
function denied(){
if(!ov){ui("", "in")}
ov.innerHTML='<div style="width:100%;max-width:360px;text-align:center"><div style="font-weight:800;margin-bottom:8px">You’re signed in as '+(sess&&sess.email||"")+'</div><div style="color:#8b9bbd;margin-bottom:16px">That email isn’t on the team list yet. Ask your coach to add it, then open the app again.</div><button id="rp-so" style="padding:12px 18px;border:0;border-radius:10px;background:#1a2b52;color:#eef2fb;font-size:16px">Sign out</button></div>';
ov.querySelector("#rp-so").onclick=function(){keep(null);location.reload()}}
var done;
async function after(){var r=await getRole();if(r==="none"){denied();return}if(ov){ov.remove();ov=null}done&&done()}
function ready(){if(wait)return wait;wait=new Promise(function(res){done=res;
(async function(){if(sess){try{await tok();await after();return}catch(e){}}
if(document.body)ui("","in");else document.addEventListener("DOMContentLoaded",function(){ui("","in")})})()});return wait}

/* ---- db (same shape the app already uses) ---- */
var subs=[];
function poll(fn,ms){var on=true,t;var go=async function(){if(!on)return;try{await fn()}catch(e){}t=setTimeout(go,ms)};go();var x={f:fn,stop:function(){on=false;clearTimeout(t)}};subs.push(x);return function(){x.stop()}}
function refresh(){subs.forEach(function(s){try{s.f()}catch(e){}})}
var db={doc:function(p){return{
get:async function(){var a=await rest("GET","docs?select=data&path=eq."+encodeURIComponent(p));return{exists:!!(a&&a[0]),data:function(){return a&&a[0]?a[0].data:undefined}}},
set:async function(d){await rest("POST","docs?on_conflict=path",{path:p,data:d,updated_at:new Date().toISOString()},{Prefer:"resolution=merge-duplicates,return=minimal"});setTimeout(refresh,300)},
delete:async function(){await rest("DELETE","docs?path=eq."+encodeURIComponent(p),null,{Prefer:"return=minimal"});setTimeout(refresh,300)},
onSnapshot:function(cb,er){return poll(async function(){var a;try{a=await rest("GET","docs?select=data&path=eq."+encodeURIComponent(p))}catch(e){er&&er(e);return}cb({exists:!!(a&&a[0]),data:function(){return a&&a[0]?a[0].data:undefined}})},15000)}}},
collection:function(c){return{onSnapshot:function(cb,er){return poll(async function(){var a;try{a=await rest("GET","docs?select=path,data&path=like."+encodeURIComponent(c+"/")+"*")}catch(e){er&&er(e);return}
cb({size:a.length,docs:a.map(function(r){return{id:r.path,data:function(){return r.data}}})})},15000)}}}};
document.addEventListener("visibilitychange",function(){if(!document.hidden)refresh()});

window.RP_BACKEND={email:function(){return sess&&sess.email||""},role:function(){return role},signOut:function(){keep(null);location.reload()}};
window.claude={use:async function(n){
if(n==="user"){await ready();return{canEdit:async function(){return role==="coach"},isOwner:async function(){return role==="coach"}}}
if(n==="db"){await ready();return db}
return null}};
})();
