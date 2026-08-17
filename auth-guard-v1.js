(() => {
  "use strict";

  const FIREBASE_SDK_VERSION = "12.17.1";
  const CENTRAL_URL = "https://kaua212106.github.io/Central-de-apps/";
  const DEVICE_KEY = "central-device-id-v1";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA8zLyzYwRv3qDIw-8H4_Tesy8iiH1haaA",
    authDomain: "central-de-apps.firebaseapp.com",
    projectId: "central-de-apps",
    storageBucket: "central-de-apps.firebasestorage.app",
    messagingSenderId: "222066712643",
    appId: "1:222066712643:web:130c3d5ebc5c4b935d74f6",
    measurementId: "G-44P6G2ZSE3"
  };

  let auth = null;
  let db = null;
  let api = null;
  let verificando = false;

  function deviceId(){
    let id = "";
    try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch {}

    if(!id){
      id = (crypto.randomUUID?.() ||
        ("dev-" + Date.now() + "-" + Math.random().toString(36).slice(2)))
        .replace(/[^a-zA-Z0-9_-]/g,"");

      try { localStorage.setItem(DEVICE_KEY,id); } catch {}
    }

    return id;
  }

  function escapeHtml(v){
    return String(v ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m]));
  }

  function showBlocked(title, message){
    document.documentElement.classList.remove("central-auth-lock");

    document.body.innerHTML = `
      <div id="centralGuardScreen" style="
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:linear-gradient(145deg,#667eea,#764ba2);
        font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;
      ">
        <div style="
          width:min(430px,100%);
          background:#fff;
          border-radius:26px;
          padding:24px 20px;
          text-align:center;
          box-shadow:0 25px 70px rgba(0,0,0,.25);
        ">
          <div style="font-size:42px;margin-bottom:8px">🔐</div>

          <h2 style="
            margin:0 0 8px;
            color:#20283a;
            font-size:23px;
          ">${escapeHtml(title)}</h2>

          <p style="
            margin:0;
            color:#687187;
            font-size:12px;
            line-height:1.55;
          ">${escapeHtml(message)}</p>

          <button id="centralGuardOpenCentral" style="
            width:100%;
            min-height:50px;
            margin-top:16px;
            border:0;
            border-radius:14px;
            background:linear-gradient(135deg,#667eea,#5363dc);
            color:#fff;
            font-size:13px;
            font-weight:850;
          ">Abrir Central</button>

          <small style="
            display:block;
            margin-top:10px;
            color:#a0a6b4;
            font-size:9px;
          ">Proteção da Central • V1</small>
        </div>
      </div>
    `;

    document.getElementById("centralGuardOpenCentral").onclick = () => {
      location.href = CENTRAL_URL;
    };
  }

  function allowApp(){
    document.documentElement.classList.remove("central-auth-lock");
  }

  async function checkAccess(user){
    if(verificando) return;
    verificando = true;

    try{
      if(!user){
        showBlocked(
          "Acesso pela Central",
          "Entre na Central com uma conta autorizada antes de abrir este aplicativo."
        );
        return;
      }

      await user.getIdToken(true);

      const userRef = api.doc(db,"usuarios",user.uid);
      const userSnap = await api.getDoc(userRef);

      if(
        !userSnap.exists() ||
        userSnap.data().ativo !== true ||
        userSnap.data().bloqueado === true
      ){
        showBlocked(
          "Acesso não autorizado",
          "Sua conta não possui autorização ativa para acessar este aplicativo."
        );
        return;
      }

      const tokenResult = await user.getIdTokenResult(true);
      const isAdmin = tokenResult.claims?.admin === true;

      if(isAdmin){
        allowApp();
        return;
      }

      const deviceRef = api.doc(
        db,
        "usuarios",
        user.uid,
        "dispositivos",
        deviceId()
      );

      const deviceSnap = await api.getDoc(deviceRef);

      if(
        !deviceSnap.exists() ||
        deviceSnap.data().ativo !== true ||
        deviceSnap.data().bloqueado === true
      ){
        showBlocked(
          "Dispositivo não autorizado",
          "Este celular ou navegador ainda não possui autorização para acessar os aplicativos."
        );
        return;
      }

      allowApp();

    }catch(err){
      console.error("Central Auth Guard:", err);

      showBlocked(
        "Não foi possível verificar o acesso",
        navigator.onLine
          ? "Abra a Central novamente, confirme seu login e tente acessar o aplicativo por ela."
          : "É necessária conexão com a internet para verificar sua autorização."
      );
    }finally{
      verificando = false;
    }
  }

  async function initGuard(){
    try{
      const v = FIREBASE_SDK_VERSION;

      const [appM,authM,fsM] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)
      ]);

      let app;

      try{
        app = appM.getApp();
        if(app.options?.projectId !== FIREBASE_CONFIG.projectId){
          throw new Error("Este app já possui outro Firebase inicializado.");
        }
      }catch(err){
        if(String(err?.message || "").includes("outro Firebase")){
          throw err;
        }
        app = appM.initializeApp(FIREBASE_CONFIG);
      }

      auth = authM.getAuth(app);
      db = fsM.getFirestore(app);
      api = {...authM,...fsM};

      authM.onAuthStateChanged(auth, user => {
        checkAccess(user);
      });

      const recheck = () => {
        if(
          auth?.currentUser &&
          document.visibilityState === "visible" &&
          navigator.onLine
        ){
          checkAccess(auth.currentUser);
        }
      };

      window.addEventListener("focus",recheck);
      document.addEventListener("visibilitychange",() => {
        if(document.visibilityState === "visible") recheck();
      });

      setInterval(recheck,60000);

    }catch(err){
      console.error("Central Auth Guard init:",err);

      showBlocked(
        "Proteção não iniciada",
        "Não foi possível iniciar a verificação de segurança deste aplicativo."
      );
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",initGuard,{once:true});
  }else{
    initGuard();
  }
})();
