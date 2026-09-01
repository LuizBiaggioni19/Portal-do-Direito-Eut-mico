/* Portal do Direito Eutímico — Busca Jurídica V2
   Camada adicional: não substitui portal.js nem remove a pesquisa antiga.
*/
(() => {
  "use strict";

  const V2 = {
    ready: false,
    running: false,
    token: 0,
    scope: "todos",
    lastQuery: "",
    lastResults: [],
    detailFromSearch: false
  };

  const CONCEPTS = {
    "reeleicao": ["duas vezes consecutivas", "inelegibilidade", "inelegiveis"],
    "reeleger": ["duas vezes consecutivas", "inelegibilidade"],
    "divorcio": ["divórcio", "dissolução do vínculo"],
    "primeiro ministro": ["primeiro-ministro", "primeira-ministria"],
    "vice primeiro ministro": ["vice-primeiro-ministro", "vice-primeira-ministria"],
    "voto obrigatorio": ["voto obrigatório", "obrigatoriedade do voto"],
    "eleicao": ["eleição", "eleições", "pleito eleitoral"],
    "eleicoes": ["eleição", "eleições", "pleito eleitoral"]
  };

  const TYPE_ALIASES = [
    {re:/^(?:ds|decreto\s+sapiencial)\s*0*(\d{1,3}[a-c]?)(?:[./-](\d{2,4}))?$/i, type:"Decreto Sapiencial"},
    {re:/^(?:ai|ato\s+institucional)\s*0*(\d{1,3}[a-c]?)(?:[./-](\d{2,4}))?$/i, type:"Ato Institucional"},
    {re:/^(?:del|dd|decreto\s+delicial)\s*0*(\d{1,3}[a-c]?)(?:[./-](\d{2,4}))?$/i, type:"Decreto Delicial"},
    {re:/^(?:s[uú]mula)\s*(?:n[º°]?\s*)?0*(\d{1,3})$/i, type:"Súmula STE"},
    {re:/^(?:ste\s+)?(adin|ap|hc|aic)\s*0*(\d{1,3})(?:[./-](\d{2,4}))?$/i, type:"Processo/Julgado", tribunal:"STE"}
  ];

  function n(s){
    return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  }
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }
  function words(s){
    return n(s).split(/[^a-z0-9]+/).filter(x=>x.length>1);
  }
  function unique(a){ return [...new Set(a.filter(Boolean))]; }

  function parseReference(query){
    const q=query.trim();
    for(const a of TYPE_ALIASES){
      const m=q.match(a.re);
      if(!m) continue;
      if(a.type==="Processo/Julgado"){
        return {type:a.type, tribunal:a.tribunal, cls:n(m[1]), number:String(Number(m[2])), year:m[3]||""};
      }
      return {type:a.type, tribunal:a.tribunal||"", number:String(Number(m[1])), year:m[2]||""};
    }
    const generic=q.match(/^0*(\d{1,3})(?:[./-](20\d{2}|\d{2}))?$/);
    if(generic) return {number:String(Number(generic[1])),year:generic[2]||""};
    return null;
  }

  function normalizeYear(y){
    if(!y) return "";
    const x=String(y);
    return x.length===2 ? "20"+x : x;
  }

  function scopeItems(){
    const items = Array.isArray(APP?.items) ? APP.items : [];
    if(V2.scope==="legislacao") return items.filter(i=>COLLECTIONS.legislacao.match(i));
    if(V2.scope==="jurisprudencia") return items.filter(i=>COLLECTIONS.jurisprudencia.match(i));
    if(V2.scope==="sumulas") return items.filter(i=>COLLECTIONS.sumulas.match(i));
    return items;
  }

  function queryModel(query){
    const norm=n(query);
    const ref=parseReference(query);
    const baseWords=words(query);
    const expansions=[];
    for(const [key,vals] of Object.entries(CONCEPTS)){
      if(norm.includes(key)) expansions.push(...vals.map(n));
    }
    return {
      raw:query,
      norm,
      ref,
      words:unique(baseWords),
      expansions:unique(expansions)
    };
  }

  function metadataScore(item,q){
    const title=n(item.title);
    const path=n(item.path);
    const type=n(item.type);
    const tribunal=n(item.tribunal);
    const cats=n((item.virtualCategories||[]).join(" "));
    const num=n(item.number);
    const year=n(item.year);
    const all=[title,path,type,tribunal,cats,num,year].join(" ");
    let score=0, why=[];

    if(title===q.norm){ score+=1200; why.push("título exato"); }
    else if(title.includes(q.norm) && q.norm.length>2){ score+=650; why.push("título"); }

    if(q.ref){
      let refScore=0;
      if(q.ref.type && n(item.type)===n(q.ref.type)) refScore+=240;
      if(q.ref.tribunal && tribunal===n(q.ref.tribunal)) refScore+=120;
      if(q.ref.number && String(Number(item.number||-1))===String(Number(q.ref.number))) refScore+=520;
      const qy=normalizeYear(q.ref.year);
      if(qy && item.year===qy) refScore+=110;
      if(q.ref.cls && (title.includes(q.ref.cls)||path.includes(q.ref.cls))) refScore+=230;
      if(refScore>=500){ score+=refScore; why.push("referência jurídica"); }
    }

    if(q.norm.length>2 && path.includes(q.norm)){score+=240;why.push("arquivo");}
    if(q.norm.length>2 && type.includes(q.norm)){score+=180;why.push("espécie");}
    if(q.norm.length>2 && tribunal.includes(q.norm)){score+=120;why.push("tribunal");}

    let matched=0;
    for(const w of q.words){
      if(all.includes(w)){ matched++; score+=45; }
      if(title.includes(w)) score+=65;
    }
    if(q.words.length && matched===q.words.length){score+=120;why.push("termos da consulta");}

    if(item.kind==="sumula" && n(item.body||"").includes(q.norm)){score+=360;why.push("enunciado");}

    return {score,why:unique(why)};
  }

  function contentScore(item,text,q){
    const hay=n(text);
    if(!hay) return {score:0,snippet:"",why:[]};
    let score=0, why=[];

    if(q.norm.length>2 && hay.includes(q.norm)){
      score+=320;
      why.push("texto integral");
    }

    let hits=0;
    for(const w of q.words){
      if(hay.includes(w)){hits++;score+=38;}
    }
    if(q.words.length>1 && hits===q.words.length) score+=110;

    for(const ex of q.expansions){
      if(hay.includes(ex)){
        score+=150;
        why.push("conceito relacionado");
      }
    }

    if(score===0) return {score:0,snippet:"",why:[]};
    return {score,snippet:snippet(text,q),why:unique(why)};
  }

  function snippet(text,q){
    const plain=String(text||"").replace(/[#*_>`~|]/g," ").replace(/\s+/g," ").trim();
    if(!plain) return "";
    const nh=n(plain);
    const needles=[q.norm,...q.expansions,...q.words].filter(x=>x && x.length>2);
    let pos=-1, chosen="";
    for(const x of needles){
      const p=nh.indexOf(x);
      if(p>=0 && (pos<0 || p<pos)){pos=p;chosen=x;}
    }
    if(pos<0) return esc(plain.slice(0,230));
    const start=Math.max(0,pos-95),end=Math.min(plain.length,pos+185);
    let s=(start>0?"…":"")+plain.slice(start,end)+(end<plain.length?"…":"");
    let html=esc(s);
    if(chosen){
      const raw=s.slice(Math.max(0,pos-start), Math.max(0,pos-start)+chosen.length);
      if(raw){
        const re=new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"ig");
        html=html.replace(re,m=>`<mark>${m}</mark>`);
      }
    }
    return html;
  }

  function relationCount(item){
    const edges=APP?.relations?.edges||[];
    return edges.filter(e=>{
      const sides=[e.source,e.target];
      return sides.some(x=>x && (
        (x.path && x.path===item.path) ||
        (x.itemId && x.itemId===item.id)
      ));
    }).length;
  }

  async function getText(item){
    if(item.kind==="sumula") return item.body||"";
    if(item.ext!=="md") return "";
    if(APP.fullTextCache[item.path]!==undefined) return APP.fullTextCache[item.path];
    try{
      const r=await fetch(rawFile(item.path,APP.head));
      const t=r.ok ? await r.text() : "";
      APP.fullTextCache[item.path]=t;
      return t;
    }catch{
      APP.fullTextCache[item.path]="";
      return "";
    }
  }

  function rankSort(a,b){
    if(b.score!==a.score) return b.score-a.score;
    const ya=Number(a.item.year||0),yb=Number(b.item.year||0);
    if(ya!==yb) return yb-ya;
    return a.item.title.localeCompare(b.item.title,"pt-BR",{numeric:true});
  }

  function showSearchPage(query, results, progress=""){
    V2.lastQuery=query;
    V2.lastResults=results;
    hideViews("listView");
    document.getElementById("pageKicker").textContent="BUSCA JURÍDICA";
    document.getElementById("pageTitle").textContent=`Resultados para “${query}”`;
    document.getElementById("pageDescription").textContent=
      "Pesquisa em todo o acervo, com prioridade para número, título, espécie e correspondências no texto integral.";
    document.getElementById("breadcrumb").textContent="Início › Busca Jurídica";
    document.getElementById("resultCount").textContent=results.length;

    const chips=[
      `Escopo: ${scopeLabel(V2.scope)}`,
      progress || "Busca concluída"
    ];
    document.getElementById("activeFilters").innerHTML=chips.map(x=>`<span class="filter-chip">${esc(x)}</span>`).join("");

    renderV2Results(results);
  }

  function renderV2Results(results){
    const host=document.getElementById("results");
    host.innerHTML="";
    if(!results.length){
      host.innerHTML=`<div class="empty">
        <strong>Nenhum resultado encontrado.</strong><br>
        Tente o número do ato, a sigla (ex.: DS 128, STE ADIN 002, Súmula 56) ou uma expressão do texto.
      </div>`;
      return;
    }

    const top=results[0];
    if(top && top.score>=650){
      const head=document.createElement("div");
      head.className="v2-group-title";
      head.textContent="Resultado principal";
      host.appendChild(head);
      host.appendChild(resultCard(top,true));
      if(results.length>1){
        const other=document.createElement("div");
        other.className="v2-group-title v2-other";
        other.textContent="Outros resultados relacionados";
        host.appendChild(other);
      }
      results.slice(1).forEach(r=>host.appendChild(resultCard(r,false)));
    }else{
      results.forEach(r=>host.appendChild(resultCard(r,false)));
    }
  }

  function resultCard(r,principal){
    const i=r.item;
    const st=STATUS_INFO[i.status]||STATUS_INFO.VIGENTE;
    const rels=relationCount(i);
    const row=document.createElement("article");
    row.className="result-item search-v2-result"+(principal?" is-principal":"");
    row.innerHTML=`
      <div>
        <button class="result-title">${esc(i.title)}</button>
        <div class="v2-reason">${esc((r.why||[]).slice(0,3).join(" · ") || "correspondência")}</div>
        <div class="result-meta">
          <span class="type-chip">${esc(i.type)}</span>
          ${i.year?`<span class="type-chip">${esc(i.year)}</span>`:""}
          ${i.tribunal?`<span class="type-chip">${esc(i.tribunal)}</span>`:""}
          <span class="badge ${st.cls}">${esc(st.label)}</span>
          ${rels?`<span class="type-chip">${rels} relação${rels===1?"":"ões"}</span>`:""}
        </div>
        ${r.snippet?`<div class="match-snippet v2-snippet">${r.snippet}</div>`:""}
      </div>
      <div class="file-arrow">›</div>`;
    const open=()=>{
      V2.detailFromSearch=true;
      openDetail(i);
      document.getElementById("breadcrumb").textContent=`Início › Busca Jurídica › ${i.title}`;
    };
    row.querySelector(".result-title").addEventListener("click",open);
    row.addEventListener("dblclick",open);
    return row;
  }

  function scopeLabel(s){
    return ({
      todos:"Todo o acervo",
      legislacao:"Legislação",
      jurisprudencia:"Jurisprudência",
      sumulas:"Súmulas"
    })[s]||"Todo o acervo";
  }

  async function runSearch(){
    const input=document.getElementById("buscaV2");
    const query=input?.value.trim()||"";
    if(!query) return;

    const myToken=++V2.token;
    V2.running=true;
    const q=queryModel(query);
    const items=scopeItems();

    const map=new Map();
    for(const item of items){
      const m=metadataScore(item,q);
      if(m.score>0) map.set(item.id,{item,score:m.score,why:m.why,snippet:""});
    }

    let partial=[...map.values()].sort(rankSort).slice(0,60);
    showSearchPage(query,partial,`Pesquisando texto integral em ${items.filter(i=>i.ext==="md"||i.kind==="sumula").length} documentos…`);

    const searchable=items.filter(i=>i.kind==="sumula"||i.ext==="md");
    const batch=10;
    let done=0;
    for(let x=0;x<searchable.length;x+=batch){
      if(myToken!==V2.token) return;
      const chunk=searchable.slice(x,x+batch);
      const texts=await Promise.all(chunk.map(getText));
      chunk.forEach((item,idx)=>{
        const c=contentScore(item,texts[idx],q);
        if(c.score<=0) return;
        const old=map.get(item.id)||{item,score:0,why:[],snippet:""};
        old.score+=c.score;
        old.why=unique([...(old.why||[]),...(c.why||[])]);
        if(c.snippet) old.snippet=c.snippet;
        map.set(item.id,old);
      });
      done+=chunk.length;

      if(done===searchable.length || done%40===0){
        partial=[...map.values()]
          .filter(r=>r.score>=90)
          .sort(rankSort)
          .slice(0,80);
        showSearchPage(query,partial,`Texto integral: ${done}/${searchable.length}`);
      }
    }

    if(myToken!==V2.token) return;
    const final=[...map.values()]
      .filter(r=>r.score>=90)
      .sort(rankSort)
      .slice(0,100);

    V2.running=false;
    showSearchPage(query,final,`${final.length} resultado${final.length===1?"":"s"}`);
  }

  function inject(){
    if(document.getElementById("buscaV2")) return;
    const firstPanel=document.querySelector(".sidebar .side-panel");
    if(!firstPanel) return;

    const oldNodes=[];
    [...firstPanel.children].forEach(el=>{
      if(el.tagName==="H2") return;
      oldNodes.push(el);
    });

    const box=document.createElement("div");
    box.className="search-v2-box";
    box.innerHTML=`
      <div class="search-v2-heading">
        <strong>Busca Jurídica</strong>
        <span>número, norma, processo, súmula ou assunto</span>
      </div>
      <div class="search-v2-row">
        <input id="buscaV2" type="search"
          placeholder="Ex.: DS 128, STE ADIN 002, reeleição…"
          autocomplete="off" aria-label="Busca Jurídica">
        <button id="btnBuscaV2" type="button" aria-label="Pesquisar">Buscar</button>
      </div>
      <div class="search-v2-scopes" aria-label="Escopo da pesquisa">
        <button class="active" data-v2-scope="todos">Todo o acervo</button>
        <button data-v2-scope="legislacao">Legislação</button>
        <button data-v2-scope="jurisprudencia">Jurisprudência</button>
        <button data-v2-scope="sumulas">Súmulas</button>
      </div>
      <button id="toggleBuscaLegada" class="search-v2-advanced" type="button">Pesquisa avançada</button>
    `;

    const legacy=document.createElement("div");
    legacy.className="search-v2-legacy hidden";
    oldNodes.forEach(el=>legacy.appendChild(el));

    firstPanel.appendChild(box);
    firstPanel.appendChild(legacy);
    document.body.classList.add("search-v2-ready");

    const input=document.getElementById("buscaV2");
    document.getElementById("btnBuscaV2").addEventListener("click",runSearch);
    input.addEventListener("keydown",e=>{
      if(e.key==="Enter"){ e.preventDefault(); runSearch(); }
    });

    let debounce;
    input.addEventListener("input",()=>{
      clearTimeout(debounce);
      if(input.value.trim().length>=3){
        debounce=setTimeout(runSearch,420);
      }
    });

    document.querySelectorAll("[data-v2-scope]").forEach(b=>{
      b.addEventListener("click",()=>{
        V2.scope=b.dataset.v2Scope;
        document.querySelectorAll("[data-v2-scope]").forEach(x=>x.classList.toggle("active",x===b));
        if(input.value.trim()) runSearch();
      });
    });

    document.getElementById("toggleBuscaLegada").addEventListener("click",e=>{
      legacy.classList.toggle("hidden");
      e.currentTarget.textContent=legacy.classList.contains("hidden")?"Pesquisa avançada":"Ocultar pesquisa avançada";
    });

    document.getElementById("backButton")?.addEventListener("click",e=>{
      if(!V2.detailFromSearch) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      V2.detailFromSearch=false;
      showSearchPage(V2.lastQuery,V2.lastResults,`${V2.lastResults.length} resultado${V2.lastResults.length===1?"":"s"}`);
      window.scrollTo({top:0,behavior:"smooth"});
    },true);

    V2.ready=true;
  }

  function waitForPortal(){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(typeof APP!=="undefined" && typeof openDetail==="function" && typeof hideViews==="function"){
        clearInterval(timer);
        inject();
      }else if(attempts>100){
        clearInterval(timer);
      }
    },50);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",waitForPortal,{once:true});
  }else{
    waitForPortal();
  }
})();
