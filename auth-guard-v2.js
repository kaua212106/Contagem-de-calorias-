(() => {
  "use strict";

  const FIREBASE_SDK_VERSION = "12.17.1";
  const CENTRAL_URL = "https://kaua212106.github.io/Central-de-apps/";
  const DEVICE_KEY = "central-device-id-v1";
  const CENTRAL_GUARD_SESSION_KEY = "central-verified-session-v2";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA8zLyzYwRv3qDIw-8H4_Tesy8iiH1haaA",
    authDomain: "central-de-apps.firebaseapp.com",
    projectId: "central-de-apps",
    storageBucket: "central-de-apps.firebasestorage.app",
    messagingSenderId: "222066712643",
    appId: "1:222066712643:web:130c3d5ebc5c4b935d74f6",
    measurementId: "G-44P6G2ZSE3"
  };

  let auth=null;
  let db=null;
  let api=null;
  let checking=false;

  function deviceId(){
    let id="";
    try{id=localStorage.getItem(DEVICE_KEY)||""}catch{}
    if(!id){
      id=(crypto.randomUUID?.()||("dev-"+Date.now()+"-"+Math.random().toString(36).slice(2)))
        .replace(/[^a-zA-Z0-9_-]/g,"");
      try{localStorage.setItem(DEVICE_KEY,id)}catch{}
    }
    return id
  }

  function getCentralSession(){
    try{
      const raw=localStorage.getItem(CENTRAL_GUARD_SESSION_KEY);
      if(!raw)return null;
      const data=JSON.parse(raw);
      if(!data||typeof data!=="object")return null;
      return data
    }catch{
      return null
    }
  }

  function showLoading(text="Verificando acesso..."){
    document.documentElement.classList.add("central-guard-lock");
    let el=document.getElementById("centralGuardLoading");
    if(!el){
      el=document.createElement("div");
      el.id="centralGuardLoading";
      el.innerHTML=`
        <div class="central-guard-loading-box">
          <div class="central-guard-spinner"></div>
          <b>${text}</b>
          <small>Confirmando sua autorização na Central.</small>
        </div>`;
      document.documentElement.appendChild(el)
    }
  }

  function hideLoading(){
    document.getElementById("centralGuardLoading")?.remove()
  }

  function allowApp(){
    hideLoading();
    document.documentElement.classList.remove("central-guard-lock")
  }

  function blockApp(title,message){
    hideLoading();
    document.documentElement.classList.remove("central-guard-lock");

    document.body.innerHTML=`
      <div id="centralGuardBlocked">
        <div class="central-guard-block-box">
          <div class="central-guard-lock-icon">🔐</div>
          <h2>${title}</h2>
          <p>${message}</p>
          <button id="centralGuardOpenCentral">Abrir Central</button>
          <small>Proteção da Central • V2</small>
        </div>
      </div>`;

    document.getElementById("centralGuardOpenCentral").onclick=()=>{
      location.href=CENTRAL_URL
    }
  }

  function sessionMatches(user){
    const session=getCentralSession();
    if(!session)return false;
    if(session.uid!==user.uid)return false;
    if(session.deviceId!==deviceId())return false;
    return true
  }

  async function verify(user){
    if(checking)return;
    checking=true;

    try{
      showLoading();

      // A Central precisa ter concedido acesso explicitamente.
      if(!user){
        blockApp(
          "Acesso pela Central",
          "Você não está conectado. Abra a Central, entre na sua conta e tente novamente."
        );
        return
      }

      if(!sessionMatches(user)){
        blockApp(
          "Acesso pela Central",
          "Abra a Central e entre novamente antes de acessar este aplicativo."
        );
        return
      }

      await user.getIdToken(true);

      const userSnap=await api.getDoc(api.doc(db,"usuarios",user.uid));

      if(
        !userSnap.exists() ||
        userSnap.data().ativo!==true ||
        userSnap.data().bloqueado===true
      ){
        blockApp(
          "Acesso não autorizado",
          "Sua conta não possui autorização ativa para acessar os aplicativos."
        );
        return
      }

      const token=await user.getIdTokenResult(true);
      const isAdmin=token.claims?.admin===true;

      if(isAdmin){
        allowApp();
        return
      }

      const deviceSnap=await api.getDoc(
        api.doc(db,"usuarios",user.uid,"dispositivos",deviceId())
      );

      if(
        !deviceSnap.exists() ||
        deviceSnap.data().ativo!==true ||
        deviceSnap.data().bloqueado===true
      ){
        blockApp(
          "Dispositivo não autorizado",
          "Este celular ou navegador ainda não está autorizado pela Central."
        );
        return
      }

      allowApp()

    }catch(err){
      console.error("Central Auth Guard V2:",err);
      blockApp(
        "Não foi possível verificar o acesso",
        navigator.onLine
          ?"Abra a Central novamente e tente acessar este aplicativo por ela."
          :"É necessária conexão com a internet para confirmar sua autorização."
      )
    }finally{
      checking=false
    }
  }

  async function init(){
    try{
      showLoading();

      const v=FIREBASE_SDK_VERSION;
      const [appM,authM,fsM]=await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)
      ]);

      let app;
      try{
        app=appM.getApp();
        if(app.options?.projectId!==FIREBASE_CONFIG.projectId){
          throw new Error("firebase-project-conflict")
        }
      }catch(err){
        if(String(err?.message||"").includes("firebase-project-conflict"))throw err;
        app=appM.initializeApp(FIREBASE_CONFIG)
      }

      auth=authM.getAuth(app);
      db=fsM.getFirestore(app);
      api={...authM,...fsM};

      authM.onAuthStateChanged(auth,user=>verify(user));

      const recheck=()=>{
        if(document.visibilityState!=="visible")return;
        verify(auth?.currentUser||null)
      };

      addEventListener("focus",recheck);
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible")recheck()
      });
      setInterval(recheck,60000)

    }catch(err){
      console.error("Central Auth Guard V2 init:",err);
      blockApp(
        "Proteção não iniciada",
        "Não foi possível iniciar a segurança deste aplicativo."
      )
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true})
  }else{
    init()
  }
})();
