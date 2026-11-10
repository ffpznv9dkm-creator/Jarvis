(function () {
  "use strict";
  var K_CRED = "jarvis_cred", K_PROT = "jarvis_prot";
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function enabled() { return store.get(K_PROT, "on") === "on"; }

  var css = document.createElement("style");
  css.textContent =
    "#jlock{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;" +
    "background:radial-gradient(ellipse at 50% 30%,#0a2236 0%,#02070d 70%);color:#cdf3ff;font-family:-apple-system,Helvetica,sans-serif;touch-action:none}" +
    "#jlock .jl-ring{width:150px;height:150px;border-radius:50%;border:3px dashed var(--c,#3fd8ff);box-shadow:0 0 30px var(--c2,#0e6f93);animation:jlspin 12s linear infinite}" +
    "#jlock .jl-brand{letter-spacing:10px;font-size:26px;color:var(--c,#3fd8ff);text-shadow:0 0 16px var(--c,#3fd8ff)}" +
    "#jlock .jl-sub{opacity:.8;max-width:340px;line-height:1.4;min-height:20px}" +
    "#jlock .jl-msg{opacity:.85;max-width:340px;font-size:14px;color:#ffc95c;min-height:18px}" +
    "#jlock button{border:1px solid var(--c,#3fd8ff);background:rgba(10,34,51,.8);color:var(--c,#3fd8ff);border-radius:14px;padding:14px 22px;font-size:17px}" +
    "@keyframes jlspin{to{transform:rotate(360deg)}}";
  document.head.appendChild(css);

  var lock = document.createElement("div");
  lock.id = "jlock";
  lock.innerHTML = '<div class="jl-ring"></div><div class="jl-brand">JARVIS</div><div class="jl-sub" id="jlsub"></div><button id="jlbtn"></button><div class="jl-msg" id="jlmsg"></div>';
  document.body.appendChild(lock);

  function $(id) { return document.getElementById(id); }
  var lastHidden = 0;

  function b64(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function showLock() {
    var has = !!store.get(K_CRED, "");
    $("jlsub").textContent = has ? "Accesso protetto." : "Prima volta: registra Face ID o impronta di questo iPad.";
    $("jlbtn").textContent = has ? "🔓 Sblocca con Face ID / impronta" : "🔐 Attiva Face ID / impronta";
    $("jlmsg").textContent = "";
    $("jlbtn").disabled = false;
    lock.style.display = "flex";
  }
  function hideLock() { lock.style.display = "none"; }

  async function authenticate() {
    var btn = $("jlbtn"), msg = $("jlmsg");
    if (!window.PublicKeyCredential || !navigator.credentials) {
      msg.textContent = "Questo browser non supporta Face ID/impronta sul web. Protezione disattivata.";
      store.set(K_PROT, "off");
      setTimeout(hideLock, 1800);
      return;
    }
    btn.disabled = true; msg.textContent = "";
    try {
      var id = store.get(K_CRED, "");
      var challenge = crypto.getRandomValues(new Uint8Array(32));
      if (!id) {
        var cred = await navigator.credentials.create({
          publicKey: {
            challenge: challenge,
            rp: { name: "Jarvis" },
            user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "jarvis", displayName: "Jarvis" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
            timeout: 60000,
            attestation: "none"
          }
        });
        store.set(K_CRED, b64(cred.rawId));
      } else {
        await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            allowCredentials: [{ type: "public-key", id: unb64(id) }],
            userVerification: "required",
            timeout: 60000
          }
        });
      }
      hideLock();
    } catch (e) {
      msg.textContent = e && e.name === "NotAllowedError"
        ? "Autenticazione annullata o negata. Riprova."
        : "Errore: " + ((e && (e.message || e.name)) || "sconosciuto");
      btn.disabled = false;
    }
  }
  $("jlbtn").onclick = authenticate;

  if (enabled()) showLock(); else hideLock();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { lastHidden = Date.now(); }
    else if (enabled() && lastHidden && Date.now() - lastHidden > 60000) { showLock(); }
  });

  function injectToggle() {
    var s = document.getElementById("settings");
    if (!s || document.getElementById("jlToggle")) return;
    var wrap = document.createElement("div");
    wrap.style.marginTop = "10px";
    var b = document.createElement("button");
    b.id = "jlToggle"; b.style.marginRight = "8px";
    var r = document.createElement("button");
    r.textContent = "Registra di nuovo";
    function label() { b.textContent = "Face ID: " + (enabled() ? "ATTIVO" : "SPENTO"); }
    b.onclick = function () { store.set(K_PROT, enabled() ? "off" : "on"); label(); };
    r.onclick = function () { store.del(K_CRED); r.textContent = "Fatto: si registra al prossimo blocco"; };
    label();
    wrap.appendChild(b); wrap.appendChild(r);
    s.appendChild(wrap);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectToggle);
  else injectToggle();
})();
