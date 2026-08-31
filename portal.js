
const CONFIG = {
  owner: "dragaodotradicionalismo",
  repo: "Direito-Eutimico",
  branch: "main",
  root: "Direito Eutímico",
  cacheKey: "portal-eutimico-tree-v15",
  buildHead: "e9d8096292643a5fd46829bfc1accb8fc33b0665",
  lastIndexedKey: "portal-eutimico-last-indexed-head"
};

const COLLECTIONS = {
  inicio: {
    label: "Início",
    title: "Início",
    description: "Visão geral do acervo.",
    match: () => true
  },
  legislacao: {
    label: "Legislação",
    title: "Legislação",
    description: "Decretos Sapienciais, Atos Institucionais, Decretos Deliciais, Códigos e demais fontes normativas.",
    match: i => ["Decreto Sapiencial","Ato Institucional","Decreto Delicial","Código","Norma fundamental","Norma interna"].includes(i.type)
  },
  jurisprudencia: {
    label: "Jurisprudência",
    title: "Jurisprudência",
    description: "Autos e decisões do STE, TRFC, TRF-1, TRF-3 e órgãos históricos.",
    match: i => i.collection === "jurisprudencia"
  },
  sumulas: {
    label: "Súmulas",
    title: "Súmulas do STE",
    description: "Enunciados individualizados da jurisprudência do Sapiencial Tribunal Eutímico.",
    match: i => i.type === "Súmula STE"
  },
  estatutos: {
    label: "Estatutos",
    title: "Estatutos",
    description: "Atos classificados materialmente como Estatutos, sem duplicação do documento-fonte.",
    match: i => i.virtualCategories?.includes("Estatuto")
  },
  ministerio: {
    label: "Ministério da Justiça",
    title: "Ministério da Justiça",
    description: "Ordens, normas internas e acervo institucional do Ministério da Justiça.",
    match: i => i.collection === "ministerio"
  },
  arquivo: {
    label: "Arquivo Histórico",
    title: "Arquivo Histórico e Inativos",
    description: "Versões anteriores, atos revogados e documentos mantidos para memória jurídica.",
    match: i => ["HISTORICO","REVOGADO"].includes(i.status) || i.path.includes("/Revogados/")
  },
  publicacoes: {
    label: "Publicações",
    title: "Publicações e Acervo Institucional",
    description: "Jornal do Quequé e documentos de natureza institucional ou informativa.",
    match: i => i.collection === "publicacoes"
  },
  auditoria: {
    label: "Consolidação",
    title: "Consolidação e Auditoria",
    description: "Livro de Alterações e pendências jurídicas.",
    match: () => false
  }
};

const STATUS_INFO = {
  VIGENTE: {label:"Vigente", cls:"vigente"},
  VIGENTE_COM_ALTERACOES:{label:"Vigente com alterações", cls:"alterado"},
  VIGENTE_PARCIALMENTE:{label:"Vigente parcialmente", cls:"parcial"},
  VIGENTE_COM_EXCECAO:{label:"Vigente com exceção", cls:"alterado"},
  REVOGADO:{label:"Revogado", cls:"revogado"},
  HISTORICO:{label:"Histórico", cls:"historico"},
  INCONSTITUCIONAL:{label:"Inconstitucional", cls:"inconstitucional"},
  EXAURIDO:{label:"Exaurido", cls:"historico"},
  SUPERADO:{label:"Superado", cls:"historico"},
  SITUACAO_A_REVISAR:{label:"Situação a revisar", cls:"revisar"}
};

const STATUS_OVERRIDES = [
  [/\/Decretos Sapienciais\/Revogados\//, "REVOGADO"],
  [/\/Arquivo - Inativos\//, "HISTORICO"],
  [/\/DS 85\.26\.md$/, "REVOGADO"],
  [/\/DS 101\.26\.md$/, "VIGENTE_PARCIALMENTE"],
  [/\/DS 86\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/DS 87C\.26\.md$/, "VIGENTE_PARCIALMENTE"],
  [/\/DS 110\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/DS 120\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/AI 012\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/AI 013\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/AI 015\.26\.md$/, "VIGENTE_COM_ALTERACOES"],
  [/\/DEL 001\.26\.md$/, "VIGENTE_PARCIALMENTE"],
  [/\/DEL 002\.26\.md$/, "REVOGADO"],
  [/\/DEL 003\.26\.md$/, "REVOGADO"],
  [/\/DEL 007\.26\.md$/, "INCONSTITUCIONAL"],
  [/\/DEL 010\.26\.md$/, "REVOGADO"],
  [/\/Código Eleitoral 1ed\.md$/, "REVOGADO"]
];

const APP = {
  items: [],
  filtered: [],
  collection: "inicio",
  previousCollection: "inicio",
  head: null,
  book: {entradas:[],pendencias:[]},
  rules: {regras:[]},
  consolidations: {documentos:{}},
  delta: {},
  relations: {edges:[],codes:{}},
  lastIndexation: {},
  manifest: {},
  fullTextCache: {},
  updateInfo: null,
  reader: {
    item:null,
    raw:"",
    view:"original",
    history:null,
    citations:[]
  }
};

function ghApi(path){ return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`; }
function ghFile(path){
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${CONFIG.owner}/${CONFIG.repo}/blob/${CONFIG.branch}/${encoded}`;
}
function rawFile(path, sha){
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${sha || CONFIG.branch}/${encoded}`;
}

function inferYear(name){
  const m = name.match(/(?:\.|\/)(\d{2})(?:\.md)?$/i) || name.match(/\/(20\d{2})/);
  if(m){
    const n = Number(m[1]);
    return String(n < 100 ? 2000+n : n);
  }
  return "";
}
function inferNumber(name){
  const m = name.match(/\b(\d{1,3}[A-C]?)(?:\.|\/)(\d{2,4})\b/i);
  return m ? m[1] : "";
}
function prettyTitle(name){
  return name.replace(/\.md$/i,"").replace(/\.pdf$/i,"");
}

function classify(path){
  const name = path.split("/").pop();
  let type = "Documento";
  let collection = "legislacao";
  let virtualCategories = [];
  let tribunal = "";

  if(path.includes("/Decretos Sapienciais/")) type = "Decreto Sapiencial";
  else if(path.includes("/Atos Institucionais/")) type = "Ato Institucional";
  else if(path.includes("/Decretos Deliciais/")) type = "Decreto Delicial";
  else if(path.includes("/Códigos/") || /Arquivo - Inativos\/Código/.test(path)) type = "Código";
  else if(path.includes("/Ministério da Justiça/Ordens/")) {type="Ordem";collection="ministerio";}
  else if(path.includes("/Ministério da Justiça/") && path.includes("/Autos/")) {type="Processo/Julgado";collection="jurisprudencia";}
  else if(path.includes("/Ministério da Justiça/STE/Súmula")) {type="Arquivo de Súmulas";collection="jurisprudencia";}
  else if(path.includes("/Ministério da Justiça/TRFC/")) {type="Norma/Documento TRFC";collection=path.includes("REGIMENTO")?"ministerio":"jurisprudencia";}
  else if(path.includes("/Ministério da Justiça/TSE/")) {type="Processo/Julgado";collection="jurisprudencia";}
  else if(path.includes("/Ministério da Justiça/TRF-1/Normas/")) {type="Norma interna";collection="ministerio";}
  else if(path.includes("/Jornal do Quequé/")) {type="Publicação";collection="publicacoes";}
  else if(path.includes("/Arquivo - Inativos/Constituição/")) {type="Norma fundamental";collection="legislacao";}

  if(path.includes("/STE/")) tribunal="STE";
  if(path.includes("/TRFC/")) tribunal="TRFC";
  if(path.includes("/TRF-1/")) tribunal="TRF-1";
  if(path.includes("/TRF-3/")) tribunal="TRF-3";
  if(path.includes("/TSE/")) tribunal="TSE";

  if(/DS 124\.26\.md$/.test(path) || /AI 009\.26\.md$/.test(path) || /AI 013\.26\.md$/.test(path)){
    virtualCategories.push("Estatuto");
  }
  if(/DS 124\.26\.md$/.test(path)) virtualCategories.push("Estatuto da Nobreza");
  if(/AI 009\.26\.md$/.test(path)) virtualCategories.push("Estatuto das Vítimas");
  if(/AI 013\.26\.md$/.test(path)) virtualCategories.push("Estatuto da Magistratura");

  let status = "VIGENTE";
  for(const [re,s] of STATUS_OVERRIDES){
    if(re.test(path)){ status=s; break; }
  }

  return {
    id: `file:${path}`,
    kind:"file",
    path,
    name,
    title: prettyTitle(name),
    type,
    collection,
    virtualCategories,
    tribunal,
    status,
    year: inferYear(name),
    number: inferNumber(name),
    ext: name.split(".").pop().toLowerCase(),
    source: ghFile(path)
  };
}

async function fetchJSON(url){
  const r = await fetch(url, {headers:{"Accept":"application/vnd.github+json"}});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function loadControls(){
  const safe = async (url, fallback) => {
    try{
      const r = await fetch(url);
      if(!r.ok) return fallback;
      return await r.json();
    }catch{return fallback;}
  };
  APP.book = await safe("dados/livro_alteracoes.json",{entradas:[],pendencias:[]});
  APP.rules = await safe("dados/regras_consolidacao.json",{regras:[]});
  APP.consolidations = await safe("dados/consolidacoes_leitor.json",{documentos:{}});
  APP.delta = await safe("dados/delta_passo_13.json",{});
  APP.relations = await safe("dados/relacoes_normativas.json",{edges:[],codes:{}});
  APP.lastIndexation = await safe("dados/ultima_indexacao.json",{});
  APP.manifest = await safe("dados/portal_manifest.json",{});
}

async function loadRepository(){
  const cached = sessionStorage.getItem(CONFIG.cacheKey);
  if(cached){
    try{
      const data=JSON.parse(cached);
      if(data && data.head && data.tree){
        APP.head=data.head;
        return data.tree;
      }
    }catch{}
  }

  const branch = await fetchJSON(ghApi(`/branches/${CONFIG.branch}`));
  APP.head = branch.commit.sha;
  const tree = await fetchJSON(ghApi(`/git/trees/${APP.head}?recursive=1`));
  sessionStorage.setItem(CONFIG.cacheKey, JSON.stringify({head:APP.head,tree:tree.tree}));
  return tree.tree;
}

async function loadSumulas(){
  const path = `${CONFIG.root}/Ministério da Justiça/STE/Súmula da Jurisprudência.md`;
  try{
    const r = await fetch(rawFile(path, APP.head));
    if(!r.ok) return [];
    const text = await r.text();
    const lines = text.split(/\r?\n/);
    const sumulas=[];
    let current=null;
    const finish=()=>{
      if(!current) return;
      let body=current.lines.join(" ").trim();
      let status=current.cancelled?"HISTORICO":"VIGENTE";
      if(/^\(CANCELADA\)/i.test(body)){
        status="HISTORICO";
        body=body.replace(/^\(CANCELADA\)\s*/i,"");
      }
      sumulas.push({
        id:`sumula:${current.n}`,
        kind:"sumula",
        path,
        name:`Súmula ${current.n}`,
        title:`Súmula ${current.n}`,
        type:"Súmula STE",
        collection:"jurisprudencia",
        virtualCategories:["Súmula"],
        tribunal:"STE",
        status,
        year:"",
        number:String(current.n),
        ext:"md",
        body,
        source:ghFile(path)
      });
      current=null;
    };
    for(const raw of lines){
      const line=raw.trim();
      const m=line.match(/^Súmula\s+(?:N[º°]\s*)?(\d+)(?:\s*\((CANCELADA)\))?$/i);
      if(m){
        finish();
        current={n:Number(m[1]),cancelled:Boolean(m[2]),lines:[]};
      }else if(current && line){
        current.lines.push(line);
      }
    }
    finish();
    return sumulas;
  }catch{
    return [];
  }
}

function collectionsForCards(){
  return ["legislacao","jurisprudencia","sumulas","estatutos","ministerio","arquivo"];
}

function countCollection(key){
  if(key==="sumulas") return APP.items.filter(COLLECTIONS.sumulas.match).length;
  return APP.items.filter(COLLECTIONS[key].match).length;
}

function renderNav(){
  const nav=document.getElementById("navPrincipal");
  nav.innerHTML="";
  Object.entries(COLLECTIONS).forEach(([key,c])=>{
    const b=document.createElement("button");
    b.textContent=c.label;
    b.dataset.collection=key;
    b.className=APP.collection===key?"active":"";
    b.addEventListener("click",()=>setCollection(key));
    nav.appendChild(b);
  });
}

function renderShortcuts(){
  const el=document.getElementById("atalhos");
  const shortcuts=[
    ["Decretos Sapienciais","type:Decreto Sapiencial"],
    ["Atos Institucionais","type:Ato Institucional"],
    ["Códigos","type:Código"],
    ["Súmulas do STE","collection:sumulas"],
    ["Estatuto da Nobreza","q:DS 124"],
    ["Livro de Alterações","collection:auditoria"]
  ];
  el.innerHTML="";
  shortcuts.forEach(([label,action])=>{
    const b=document.createElement("button");
    b.textContent=label;
    b.addEventListener("click",()=>{
      if(action.startsWith("collection:")) return setCollection(action.split(":")[1]);
      if(action.startsWith("type:")){
        setCollection("legislacao");
        document.getElementById("filtroTipo").value=action.slice(5);
        applyFilters();
      }else if(action.startsWith("q:")){
        document.getElementById("busca").value=action.slice(2);
        setCollection("legislacao");
        applyFilters();
      }
    });
    el.appendChild(b);
  });
}

function renderHome(){
  hideViews("home");
  document.getElementById("breadcrumb").textContent="Início";
  renderControlWarning();
  renderUpdatePanel();
  const cards=document.getElementById("collectionCards");
  cards.innerHTML="";
  const descriptions={
    legislacao:"Normas por espécie, ano e status.",
    jurisprudencia:"Decisões e autos por tribunal.",
    sumulas:"Enunciados individualizados do STE.",
    estatutos:"Classificação material por Estatuto.",
    ministerio:"Ordens e normas institucionais.",
    arquivo:"Versões anteriores e atos sem vigência."
  };
  collectionsForCards().forEach(key=>{
    const c=COLLECTIONS[key];
    const b=document.createElement("button");
    b.className="collection-card";
    b.innerHTML=`<span class="count">${countCollection(key)} itens</span><h3>${c.label}</h3><p>${descriptions[key]}</p>`;
    b.addEventListener("click",()=>setCollection(key));
    cards.appendChild(b);
  });

  const recent = APP.items
    .filter(i=>["Decreto Sapiencial","Ato Institucional","Decreto Delicial"].includes(i.type))
    .sort(sortLegalDesc).slice(0,7);
  document.getElementById("recentes").innerHTML=recent.map(i=>`
    <div class="mini-item">
      <strong>${escapeHTML(i.title)}</strong>
      <span>${escapeHTML(i.type)}</span>
    </div>`).join("");

  const alerts=[
    ["DS 101/2026","Vigente parcialmente: arts. 1º–5º revogados; regime de partido único superado."],
    ["DS 85/2026","Arquivo fora da pasta de revogados, mas status jurídico consolidado: revogado."],
    ["Código Eleitoral","Revogado integralmente pelo AI 011/2026."],
    ["DS 118/2026","Referência órfã ao “Novo Código Eleitoral” — revisão necessária."]
  ];
  document.getElementById("alertasJuridicos").innerHTML=alerts.map(([t,d])=>
    `<div class="alert"><strong>${t}</strong>${d}</div>`).join("");
}

function sortLegalDesc(a,b){
  const ya=Number(a.year||0), yb=Number(b.year||0);
  if(ya!==yb) return yb-ya;
  const na=parseInt(a.number)||0, nb=parseInt(b.number)||0;
  if(na!==nb) return nb-na;
  return b.title.localeCompare(a.title,"pt-BR",{numeric:true});
}

function setCollection(key){
  if(!COLLECTIONS[key]) key="inicio";
  APP.previousCollection=APP.collection;
  APP.collection=key;
  renderNav();
  clearDetail();
  if(key==="inicio"){
    renderHome();
  }else if(key==="auditoria"){
    renderAudit();
  }else{
    renderList();
  }
  window.scrollTo({top:0,behavior:"smooth"});
}

function hideViews(show){
  ["home","listView","auditView","detailView"].forEach(id=>{
    document.getElementById(id).classList.toggle("hidden", id!==show);
  });
}

function renderList(){
  hideViews("listView");
  const c=COLLECTIONS[APP.collection];
  document.getElementById("pageKicker").textContent="ACERVO";
  document.getElementById("pageTitle").textContent=c.title;
  document.getElementById("pageDescription").textContent=c.description;
  document.getElementById("breadcrumb").textContent=`Início › ${c.label}`;
  applyFilters();
}

async function applyFilters(){
  if(APP.collection==="inicio"||APP.collection==="auditoria") return;
  const parsed=parseSearchQuery(document.getElementById("busca").value.trim());
  const ui={
    type:document.getElementById("filtroTipo").value,
    status:document.getElementById("filtroStatus").value,
    year:document.getElementById("filtroAno").value,
    tribunal:document.getElementById("filtroTribunal")?.value||"",
    categoria:document.getElementById("filtroCategoria")?.value||"",
    onlyCurrent:document.getElementById("somenteVigentes")?.checked||false,
    deep:document.getElementById("buscaProfunda")?.checked||false,
    sort:document.getElementById("ordenacao")?.value||"legal_desc"
  };
  const matcher=COLLECTIONS[APP.collection].match;
  let items=APP.items.filter(matcher);

  const type=parsed.fields.tipo||ui.type;
  const status=normalizeStatusQuery(parsed.fields.status)||ui.status;
  const year=parsed.fields.ano||ui.year;
  const tribunal=parsed.fields.tribunal||ui.tribunal;
  const categoria=parsed.fields.categoria||ui.categoria;
  const numero=parsed.fields.numero||"";

  if(type) items=items.filter(i=>normal(i.type).includes(normal(type)));
  if(status) items=items.filter(i=>i.status===status);
  if(year) items=items.filter(i=>i.year===String(year));
  if(tribunal) items=items.filter(i=>normal(i.tribunal).includes(normal(tribunal)));
  if(categoria) items=items.filter(i=>(i.virtualCategories||[]).some(c=>normal(c).includes(normal(categoria))));
  if(numero) items=items.filter(i=>normal(i.number)===normal(numero)||normal(i.title).includes(normal(numero)));
  if(ui.onlyCurrent) items=items.filter(i=>!["REVOGADO","HISTORICO","INCONSTITUCIONAL","EXAURIDO","SUPERADO"].includes(i.status));

  const terms=[...parsed.terms,...parsed.phrases].filter(Boolean);
  if(terms.length && !ui.deep){
    items=items.filter(i=>{
      const hay=normal([i.title,i.type,i.path,i.tribunal,i.body||"",...(i.virtualCategories||[])].join(" "));
      return terms.every(t=>hay.includes(normal(t)));
    });
  }

  if(ui.deep && (terms.length||numero)){
    items=await deepSearch(items,terms.length?terms:[numero]);
  }else{
    items.forEach(i=>delete i._snippet);
    setSearchProgress("");
  }

  items=sortResults(items,ui.sort);
  APP.filtered=items;
  renderResults(items);
  renderActiveFilters({q:parsed.raw,type,status,year,tribunal,categoria,deep:ui.deep,onlyCurrent:ui.onlyCurrent});
}

function renderResults(items){
  document.getElementById("resultCount").textContent=items.length;
  const el=document.getElementById("results");
  if(!items.length){
    el.innerHTML='<div class="empty">Nenhum item encontrado com os filtros atuais.</div>';
    return;
  }
  el.innerHTML="";
  items.forEach(i=>{
    const row=document.createElement("article");
    row.className="result-item";
    const st=STATUS_INFO[i.status]||STATUS_INFO.VIGENTE;
    row.innerHTML=`
      <div>
        <button class="result-title">${escapeHTML(i.title)}</button>
        <div class="result-path">${escapeHTML(i.path)}</div>
        <div class="result-meta">
          <span class="type-chip">${escapeHTML(i.type)}</span>
          ${i.year?`<span class="type-chip">${i.year}</span>`:""}
          ${i.tribunal?`<span class="type-chip">${escapeHTML(i.tribunal)}</span>`:""}
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${i._snippet?`<div class="match-snippet">${i._snippet}</div>`:""}
      </div>
      <div class="file-arrow">›</div>`;
    row.querySelector(".result-title").addEventListener("click",()=>openDetail(i));
    row.addEventListener("dblclick",()=>openDetail(i));
    el.appendChild(row);
  });
}

function renderActiveFilters(f){
  const el=document.getElementById("activeFilters");
  const chips=[];
  if(f.q) chips.push(`Busca: ${f.q}`);
  if(f.type) chips.push(`Espécie: ${f.type}`);
  if(f.status) chips.push(`Status: ${(STATUS_INFO[f.status]||{}).label||f.status}`);
  if(f.year) chips.push(`Ano: ${f.year}`);
  if(f.tribunal) chips.push(`Tribunal: ${f.tribunal}`);
  if(f.categoria) chips.push(`Categoria: ${f.categoria}`);
  if(f.deep) chips.push("Texto integral");
  if(f.onlyCurrent) chips.push("Somente eficácia atual");
  el.innerHTML=chips.map(x=>`<span class="filter-chip">${escapeHTML(x)}</span>`).join("");
}

function parseSearchQuery(raw){
  const fields={}, phrases=[];
  let work=raw||"";
  work=work.replace(/"([^"]+)"/g,(_,p)=>{phrases.push(p);return " ";});
  work=work.replace(/\b(tipo|status|ano|tribunal|categoria|numero):(?:"([^"]+)"|([^\s]+))/gi,(_,k,q,v)=>{
    fields[normal(k)]=q||v||"";return " ";
  });
  return {raw,fields,phrases,terms:work.trim().split(/\s+/).filter(Boolean)};
}
function normalizeStatusQuery(v){
  if(!v)return "";
  const n=normal(v).replace(/\s+/g,"_");
  return Object.keys(STATUS_INFO).find(k=>normal(k)===n||normal(STATUS_INFO[k].label).replace(/\s+/g,"_")===n)||"";
}
function sortResults(items,mode){
  const c=[...items];
  if(mode==="titulo")return c.sort((a,b)=>a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  if(mode==="ano_asc")return c.sort((a,b)=>(Number(a.year||9999)-Number(b.year||9999))||a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  if(mode==="ano_desc")return c.sort((a,b)=>(Number(b.year||0)-Number(a.year||0))||a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  return c.sort(sortLegalDesc);
}
function setSearchProgress(msg){const el=document.getElementById("searchProgress");if(el)el.textContent=msg||"";}
async function deepSearch(items,terms){
  const md=items.filter(i=>i.kind==="sumula"||i.ext==="md"), rest=items.filter(i=>i.ext!=="md"&&i.kind!=="sumula"), output=[];
  const nt=terms.map(normal).filter(Boolean);let done=0;
  setSearchProgress(`Pesquisando texto integral em ${md.length} documento(s)...`);
  const worker=async i=>{
    let text="";
    if(i.kind==="sumula")text=i.body||"";
    else if(APP.fullTextCache[i.path]!==undefined)text=APP.fullTextCache[i.path];
    else{
      try{const r=await fetch(rawFile(i.path,APP.head));text=r.ok?await r.text():"";}catch{text="";}
      APP.fullTextCache[i.path]=text;
    }
    done++;if(done%10===0||done===md.length)setSearchProgress(`Texto integral: ${done}/${md.length}`);
    const hay=normal(text);
    if(nt.every(t=>hay.includes(t))){i._snippet=makeSnippet(text,terms);output.push(i);}
  };
  for(let n=0;n<md.length;n+=10)await Promise.all(md.slice(n,n+10).map(worker));
  for(const i of rest){const hay=normal([i.title,i.path,i.type].join(" "));if(nt.every(t=>hay.includes(t)))output.push(i);}
  setSearchProgress(`Pesquisa concluída: ${output.length} resultado(s).`);return output;
}
function makeSnippet(text,terms){
  const plain=String(text||"").replace(/[#*_>`~|]/g," ").replace(/\s+/g," ").trim();if(!plain)return "";
  let pos=-1,chosen="";for(const t of terms){const p=normal(plain).indexOf(normal(t));if(p>=0&&(pos<0||p<pos)){pos=p;chosen=t;}}
  if(pos<0)return escapeHTML(plain.slice(0,220));
  const start=Math.max(0,pos-90),end=Math.min(plain.length,pos+170);let html=escapeHTML((start>0?"…":"")+plain.slice(start,end)+(end<plain.length?"…":""));
  if(chosen){const safe=escapeHTML(chosen).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");html=html.replace(new RegExp(`(${safe})`,"ig"),"<mark>$1</mark>");}
  return html;
}
function exportResults(kind){
  const rows=(APP.filtered||[]).map(i=>({titulo:i.title,especie:i.type,numero:i.number||"",ano:i.year||"",status:(STATUS_INFO[i.status]||{}).label||i.status,tribunal:i.tribunal||"",caminho:i.path,fonte:i.source}));
  if(!rows.length)return;
  let blob,name;
  if(kind==="json"){blob=new Blob([JSON.stringify(rows,null,2)],{type:"application/json;charset=utf-8"});name="resultado_portal_direito_eutimico.json";}
  else{const h=Object.keys(rows[0]);const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;const csv=[h.join(","),...rows.map(r=>h.map(k=>esc(r[k])).join(","))].join("\n");blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});name="resultado_portal_direito_eutimico.csv";}
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

async function openDetail(i){
  APP.previousCollection=APP.collection;
  APP.reader.item=i;
  APP.reader.raw="";
  APP.reader.view="original";
  APP.reader.history=null;
  APP.reader.citations=[];

  hideViews("detailView");
  document.getElementById("breadcrumb").textContent=`Início › ${COLLECTIONS[APP.collection]?.label||"Acervo"} › ${i.title}`;
  document.getElementById("detailType").textContent=i.type;
  document.getElementById("detailTitle").textContent=i.title;
  const st=STATUS_INFO[i.status]||STATUS_INFO.VIGENTE;
  document.getElementById("detailBadges").innerHTML=`
    <span class="badge ${st.cls}">${st.label}</span>
    ${i.tribunal?`<span class="type-chip">${i.tribunal}</span>`:""}
    ${(i.virtualCategories||[]).map(x=>`<span class="type-chip">${escapeHTML(x)}</span>`).join("")}
  `;
  const meta=[
    ["Espécie",i.type],
    ["Número",i.number||"—"],
    ["Ano",i.year||"—"],
    ["Status",st.label],
    ["Tribunal/órgão",i.tribunal||"—"],
    ["Arquivo",i.path],
    ["Commit carregado",APP.head||"—"]
  ];
  document.getElementById("detailMeta").innerHTML=meta.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHTML(v)}</dd></div>`).join("");
  document.getElementById("detailSource").href=i.source;
  document.getElementById("detailSummary").textContent="Carregando conteúdo do repositório oficial...";
  activateReaderTab("original");
  setReaderLoading(true);

  try{
    if(i.kind==="sumula"){
      APP.reader.raw=`### ${i.title}\n\n${i.body||""}`;
      document.getElementById("detailSummary").textContent=(i.body||"").slice(0,260) || "Enunciado jurisprudencial do STE.";
    }else if(i.ext==="pdf"){
      APP.reader.raw="";
      document.getElementById("detailSummary").textContent="Documento PDF do acervo oficial. O conteúdo será exibido no leitor interno.";
    }else{
      const r=await fetch(rawFile(i.path,APP.head));
      if(!r.ok) throw new Error(`Falha ao carregar fonte: ${r.status}`);
      APP.reader.raw=await r.text();
      document.getElementById("detailSummary").textContent=extractMaterialSummary(APP.reader.raw,i);
    }
    APP.reader.citations=extractCitations(APP.reader.raw);
    await renderReaderView("original");
  }catch(err){
    document.getElementById("detailSummary").textContent="Não foi possível carregar o conteúdo interno.";
    document.getElementById("readerContent").innerHTML=`<div class="reader-empty">${escapeHTML(err.message)}<br><br>Use o botão “Abrir fonte no GitHub”.</div>`;
  }finally{
    setReaderLoading(false);
  }
}
function clearDetail(){}

function clearDetail(){
  APP.reader.item=null;
  APP.reader.raw="";
  APP.reader.view="original";
  APP.reader.history=null;
  document.getElementById("readerContent").innerHTML="";
  document.getElementById("readerNotice").classList.add("hidden");
}

function setReaderLoading(on){
  document.getElementById("readerLoading").classList.toggle("hidden",!on);
}

function activateReaderTab(view){
  APP.reader.view=view;
  document.querySelectorAll("#readerTabs button").forEach(b=>{
    const active=b.dataset.view===view;
    b.classList.toggle("active",active);
    b.setAttribute("aria-selected",active?"true":"false");
  });
}

async function renderReaderView(view){
  if(!APP.reader.item) return;
  activateReaderTab(view);
  const item=APP.reader.item;
  const content=document.getElementById("readerContent");
  const notice=document.getElementById("readerNotice");
  notice.classList.add("hidden");
  notice.innerHTML="";

  if(item.ext==="pdf"){
    if(view==="relacional"){
      content.innerHTML=renderRelations(item);
      bindRelationButtons();
      return;
    }
    if(view==="historico"){
      await renderHistory(item);
      return;
    }
    const url=rawFile(item.path,APP.head);
    content.innerHTML=`<iframe class="pdf-reader" title="${escapeHTML(item.title)}" src="${url}"></iframe>`;
    return;
  }

  if(view==="original"){
    content.innerHTML=markdownToHtml(APP.reader.raw);
    bindWikiLinks();
    return;
  }

  if(view==="vigente"){
    const result=buildConsolidatedText(item,"vigente");
    if(result.notice){
      notice.innerHTML=result.notice;
      notice.classList.remove("hidden");
    }
    content.innerHTML=markdownToHtml(result.text);
    bindWikiLinks();
    return;
  }

  if(view==="multivigente"){
    const result=buildConsolidatedText(item,"multivigente");
    if(result.notice){
      notice.innerHTML=result.notice;
      notice.classList.remove("hidden");
    }
    content.innerHTML=renderMultivigente(result);
    bindWikiLinks();
    return;
  }

  if(view==="relacional"){
    content.innerHTML=renderRelations(item);
    bindRelationButtons();
    return;
  }

  if(view==="historico"){
    await renderHistory(item);
  }
}

function buildConsolidatedText(item,mode){
  const st=item.status;
  if(["REVOGADO","INCONSTITUCIONAL","HISTORICO"].includes(st) && mode==="vigente"){
    const lab=(STATUS_INFO[st]||{}).label||st;
    return {
      text:`### Sem conteúdo vigente\n\nEste ato está classificado como **${lab}**. Consulte as visões **Original**, **Multivigente** ou **Histórico** para examinar seu texto e sua trajetória jurídica.`,
      notice:`<strong>${lab}.</strong> A visão Vigente não reproduz como norma atual o texto de ato sem eficácia presente.`
    };
  }

  const config=APP.consolidations.documentos?.[item.path];
  if(!config?.operacoes?.length){
    let notice="";
    if(item.status==="VIGENTE_COM_ALTERACOES" || item.status==="VIGENTE_PARCIALMENTE"){
      notice="<strong>Atenção.</strong> O ato possui alteração ou vigência parcial registrada, mas nem toda transformação pode ser convertida automaticamente em texto substitutivo. O Original permanece preservado.";
    }
    return {text:APP.reader.raw,notice,blocks:[]};
  }

  const lines=APP.reader.raw.split(/\r?\n/);
  const blocks=parseArticleBlocks(lines);
  const effects=[];
  for(const op of config.operacoes){
    for(const art of op.artigos||[]){
      effects.push({...op,artigo:String(art)});
    }
  }

  if(mode==="vigente"){
    const output=[];
    let cursor=0;
    for(const b of blocks){
      if(b.start>cursor) output.push(...lines.slice(cursor,b.start));
      const fx=effects.filter(e=>sameArticle(e.artigo,b.article));
      const fullRemoval=fx.find(e=>["REVOGADO","SUPERADO","EXAURIDO"].includes(e.tipo));
      if(fullRemoval){
        output.push(`\n> **[${fullRemoval.tipo}] Art. ${b.article}.** ${fullRemoval.nota} Fundamento: ${fullRemoval.fundamento}.\n`);
      }else{
        if(fx.length){
          for(const e of fx) output.push(`\n> **[${e.tipo}] Art. ${b.article}.** ${e.nota} Fundamento: ${e.fundamento}.\n`);
        }
        output.push(...lines.slice(b.start,b.end));
      }
      cursor=b.end;
    }
    if(cursor<lines.length) output.push(...lines.slice(cursor));
    return {
      text:output.join("\n"),
      notice:"<strong>Texto vigente consolidado.</strong> O Portal omite blocos sem eficácia atual quando o efeito pode ser identificado com segurança e insere notas quando a consolidação exige preservação parcial."
    };
  }

  return {
    text:APP.reader.raw,
    notice:"<strong>Visão multivigente.</strong> O texto original é preservado e os dispositivos atingidos recebem marcação visual e fundamento.",
    blocks:effects
  };
}

function sameArticle(a,b){
  return normal(String(a)).replace(/[^0-9a-z]/g,"")===normal(String(b)).replace(/[^0-9a-z]/g,"");
}

function parseArticleBlocks(lines){
  const starts=[];
  const re=/^\s*(?:\*\*)?Art(?:\.|igo)?\s*(\d+(?:-[A-Z])?)(?:º|°)?(?:\.|\b)/i;
  lines.forEach((line,idx)=>{
    const m=line.match(re);
    if(m) starts.push({start:idx,article:m[1]});
  });
  return starts.map((s,i)=>({...s,end:i+1<starts.length?starts[i+1].start:lines.length}));
}

function renderMultivigente(result){
  const lines=result.text.split(/\r?\n/);
  const blocks=parseArticleBlocks(lines);
  if(!result.blocks?.length) return markdownToHtml(result.text);

  let html="";
  let cursor=0;
  for(const b of blocks){
    if(b.start>cursor) html+=markdownToHtml(lines.slice(cursor,b.start).join("\n"));
    const fx=result.blocks.filter(e=>sameArticle(e.artigo,b.article));
    if(!fx.length){
      html+=markdownToHtml(lines.slice(b.start,b.end).join("\n"));
    }else{
      const primary=fx[0];
      const cls=primary.tipo==="REVOGADO"?"revoked-block":primary.tipo==="EXAURIDO"?"exaurido-block":"superado-block";
      const rendered=markdownToHtml(lines.slice(b.start,b.end).join("\n"));
      html+=`<section class="${cls}">
        <span class="effect-tag">${escapeHTML(primary.tipo)}</span>
        <div class="md-content">${rendered}</div>
        ${fx.map(e=>`<div class="legal-effect"><strong>${escapeHTML(e.tipo)}</strong> — ${escapeHTML(e.nota)} <br>Fundamento: ${escapeHTML(e.fundamento)}</div>`).join("")}
      </section>`;
    }
    cursor=b.end;
  }
  if(cursor<lines.length) html+=markdownToHtml(lines.slice(cursor).join("\n"));
  return html;
}

function markdownToHtml(md){
  if(!md) return '<div class="reader-empty">Documento sem conteúdo textual disponível.</div>';
  const lines=String(md).replace(/\r/g,"").split("\n");
  let html="", inCode=false, code=[], inUl=false, inOl=false, inTable=false;
  const closeLists=()=>{
    if(inUl){html+="</ul>";inUl=false;}
    if(inOl){html+="</ol>";inOl=false;}
  };
  const closeTable=()=>{if(inTable){html+="</tbody></table>";inTable=false;}};

  const inline=(s)=>{
    let x=escapeHTML(s);
    x=x.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,(_,ref,label)=>`<button class="wiki-link" data-wiki="${escapeHTML(ref)}">${escapeHTML(label)}</button>`);
    x=x.replace(/\[\[([^\]]+)\]\]/g,(_,ref)=>`<button class="wiki-link" data-wiki="${escapeHTML(ref)}">${escapeHTML(ref)}</button>`);
    x=x.replace(/`([^`]+)`/g,"<code>$1</code>");
    x=x.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
    x=x.replace(/__([^_]+)__/g,"<strong>$1</strong>");
    x=x.replace(/\*([^*]+)\*/g,"<em>$1</em>");
    x=x.replace(/~~([^~]+)~~/g,"<del>$1</del>");
    x=x.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
    return x;
  };

  for(let i=0;i<lines.length;i++){
    const line=lines[i];

    if(/^```/.test(line.trim())){
      closeLists();closeTable();
      if(!inCode){inCode=true;code=[];}
      else{
        html+=`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`;
        inCode=false;code=[];
      }
      continue;
    }
    if(inCode){code.push(line);continue;}

    const tableSep = i+1<lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(lines[i+1]);
    if(line.includes("|") && tableSep){
      closeLists();
      const heads=line.replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
      html+="<table><thead><tr>"+heads.map(h=>`<th>${inline(h)}</th>`).join("")+"</tr></thead><tbody>";
      inTable=true;i++;continue;
    }
    if(inTable && line.includes("|")){
      const cells=line.replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
      html+="<tr>"+cells.map(c=>`<td>${inline(c)}</td>`).join("")+"</tr>";
      continue;
    }else if(inTable){closeTable();}

    const h=line.match(/^(#{1,6})\s+(.+)$/);
    if(h){closeLists();html+=`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;continue;}
    if(/^\s*---+\s*$/.test(line)){closeLists();html+="<hr>";continue;}
    const bq=line.match(/^\s*>\s?(.*)$/);
    if(bq){closeLists();html+=`<blockquote>${inline(bq[1])}</blockquote>`;continue;}
    const ul=line.match(/^\s*[-*+]\s+(.+)$/);
    if(ul){
      if(inOl){html+="</ol>";inOl=false;}
      if(!inUl){html+="<ul>";inUl=true;}
      html+=`<li>${inline(ul[1])}</li>`;continue;
    }
    const ol=line.match(/^\s*\d+[.)]\s+(.+)$/);
    if(ol){
      if(inUl){html+="</ul>";inUl=false;}
      if(!inOl){html+="<ol>";inOl=true;}
      html+=`<li>${inline(ol[1])}</li>`;continue;
    }
    if(!line.trim()){closeLists();html+="";continue;}
    closeLists();
    html+=`<p>${inline(line)}</p>`;
  }
  closeLists();closeTable();
  if(inCode) html+=`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`;
  return html;
}

function extractMaterialSummary(raw,item){
  const lines=String(raw||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const ignore=/^(ATO INSTITUCIONAL|DECRETO SAPIENCIAL|DECRETO DELICIAL|PROVÍNCIAS|REINO|O ILUSTRÍSSIMO|O SUPREMO|EU,|CONSIDERANDO|RESOLVE|DECRETA|Cidade da Eutimia|Capital Real|EUTIMIA PERPETUA)/i;
  const candidate=lines.find((x,i)=>i<25 && x.length>12 && !ignore.test(x) && !/^Art\./i.test(x) && !/^#+\s*CAPÍTULO/i.test(x));
  return candidate ? candidate.replace(/^#+\s*/,"").slice(0,360) : `${item.type} integrante do acervo oficial.`;
}

function extractCitations(raw){
  const refs=[];
  const add=(type,target,label)=>{if(!refs.some(r=>r.type===type&&r.target===target)) refs.push({type,target,label:label||target});};
  let m;
  const patterns=[
    ["DS",/(?:Decreto(?:s)?\s+Sapiencial(?:is)?(?:\s+n[º°.]?|\s+n\.|\s+Nº|\s+N\.)?\s*)(\d+[A-Z]?(?:\/\d{2,4})?)/gi],
    ["AI",/(?:Ato(?:s)?\s+Institucional(?:is)?(?:\s+n[º°.]?|\s+n\.|\s+Nº|\s+N\.)?\s*)(\d+(?:\/\d{2,4})?)/gi],
    ["DEL",/(?:Decreto(?:s)?\s+Delicial(?:is)?(?:\s+n[º°.]?|\s+n\.|\s+Nº|\s+N\.)?\s*)(\d+(?:\/\d{2,4})?)/gi],
    ["SÚMULA",/(?:Súmula(?:s)?(?:\s+n[º°.]?|\s+n\.|\s+Nº|\s+N\.)?\s*)(\d+)/gi]
  ];
  for(const [type,re] of patterns){
    while((m=re.exec(raw||""))) add(type,m[1],`${type} ${m[1]}`);
  }
  const wiki=/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  while((m=wiki.exec(raw||""))) add("WIKI",m[1],m[2]||m[1]);
  for(const name of ["Código Penal","Código Civil","Código Eleitoral","Código de Processo Eutímico","Código da Edição do Professor"]){
    if(normal(raw).includes(normal(name))) add("DOC",name,name);
  }
  return refs.slice(0,80);
}

function renderRelations(item){
  const data=collectRelations(item);
  APP.reader._incoming=data.incoming;
  APP.reader._outgoing=data.outgoing;

  const all=[...data.incoming,...data.outgoing];
  const years=[...new Set(all.map(r=>r.year).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  const codes=[...new Set(all.map(r=>r.code).filter(Boolean))].sort();
  const reviewCount=all.filter(r=>r.code==="REV?"||r.confidence==="baixa"||r.confidence==="media").length;

  const legend=Object.entries(APP.relations.codes||{}).map(([code,info])=>
    `<span class="rel-legend-item"><span class="rel-code ${escapeHTML(info.class||"")}">${escapeHTML(code)}</span>${escapeHTML(info.label||code)}</span>`
  ).join("");

  const toolbar=`<section class="rel-toolbar">
      <div class="rel-filter">
        <label>Relação</label>
        <select id="relFilterCode"><option value="">Todas</option>${codes.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)} — ${escapeHTML((APP.relations.codes?.[c]||{}).label||c)}</option>`).join("")}</select>
      </div>
      <div class="rel-filter">
        <label>Ano</label>
        <select id="relFilterYear"><option value="">Todos</option>${years.map(y=>`<option value="${escapeHTML(y)}">${escapeHTML(y)}</option>`).join("")}</select>
      </div>
      <label class="rel-check"><input id="relIncludeCitations" type="checkbox" checked> incluir citações</label>
      <button id="relClearFilters" class="ghost-btn small-btn">Limpar</button>
    </section>`;

  const summary=`<section class="rel-summary">
      <div><strong>${data.incoming.length}</strong><span>atos modificadores / incidentes</span></div>
      <div><strong>${data.outgoing.length}</strong><span>atos modificados / referenciados</span></div>
      <div><strong>${reviewCount}</strong><span>relações a revisar</span></div>
    </section>`;

  const centerStatus=STATUS_INFO[item.status]||STATUS_INFO.VIGENTE;
  const center=`<section class="rel-central-card">
      <span class="eyebrow">${escapeHTML(item.type)}</span>
      <h2>${escapeHTML(item.title)}</h2>
      <div class="badges">
        <span class="badge ${centerStatus.cls}">${centerStatus.label}</span>
        ${item.year?`<span class="type-chip">${escapeHTML(item.year)}</span>`:""}
      </div>
      <div class="rel-central-meta">
        <span>${escapeHTML(item.path)}</span>
      </div>
    </section>`;

  return `<div class="relational-advanced">
    <div class="rel-titlebar">
      <div>
        <span class="eyebrow">CONSULTA RELACIONAL</span>
        <h2>Relações normativas do ato</h2>
        <p>Atos modificadores à esquerda, ato consultado ao centro e atos modificados ou referenciados à direita.</p>
      </div>
    </div>
    ${summary}
    ${toolbar}
    <div class="rel-canvas">
      <section class="rel-side">
        <div class="rel-side-head"><span>←</span><div><strong>Atos modificadores</strong><small>atos que afetam o documento consultado</small></div></div>
        <div id="relIncoming">${renderRelationGroups(data.incoming,"incoming")}</div>
      </section>
      ${center}
      <section class="rel-side">
        <div class="rel-side-head right"><div><strong>Atos modificados / relacionados</strong><small>efeitos e referências produzidos pelo ato consultado</small></div><span>→</span></div>
        <div id="relOutgoing">${renderRelationGroups(data.outgoing,"outgoing")}</div>
      </section>
    </div>
    <section class="rel-legend"><strong>Legenda</strong>${legend}</section>
  </div>`;
}

function collectRelations(item){
  const incoming=[], outgoing=[];
  const pre=APP.relations.edges||[];

  for(const e of pre){
    const sourceItem=resolveRelationNode(e.source);
    const targetItem=resolveRelationNode(e.target);
    const rec={...e,sourceItem,targetItem,isCitation:e.code==="CIT"};
    if(itemMatchesRelationNode(item,e.target)) incoming.push(rec);
    if(itemMatchesRelationNode(item,e.source)) outgoing.push(rec);
  }

  // Relações provenientes do Livro de Alterações: entram como incidência sobre o alvo,
  // sem duplicar uma relação precomputada equivalente.
  for(const e of APP.book.entradas||[]){
    const aliases=itemAliases(item);
    const hay=normal([e.alvo,e.dispositivo,e.resultado].join(" "));
    if(!aliases.some(a=>hay.includes(a))) continue;
    const sourcePath=(e.fontes||[]).find(p=>p!==item.path && APP.items.some(i=>i.path===p));
    const sourceItem=sourcePath?APP.items.find(i=>i.path===sourcePath):null;
    const code=operationToRelationCode(e.operacao);
    const rec={
      id:`BOOK-${e.id}`,year:(APP.book.data_consolidacao||"2026").slice(0,4),code,
      source:sourceItem?{label:sourceItem.title,path:sourceItem.path}:{label:e.fundamento||e.id},
      target:{label:item.title,path:item.path},
      sourceItem,targetItem:item,scope:e.dispositivo,basis:e.fundamento,
      summary:e.resultado,confidence:e.certeza||"alta",fromBook:true,isCitation:false
    };
    if(!incoming.some(x=>relationEquivalent(x,rec))) incoming.push(rec);
  }

  // Citações textuais do próprio documento.
  for(const c of APP.reader.citations||[]){
    const related=resolveCitation(c);
    const rec={
      id:`CIT-${c.type}-${c.target}`,year:item.year||"",code:c.type==="SÚMULA"?"JUD":"CIT",
      source:{label:item.title,path:item.path},
      target:related?{label:related.title,path:related.path,itemId:related.id}:{label:c.label},
      sourceItem:item,targetItem:related||null,scope:"referência textual",basis:"texto do documento",
      summary:related?`Referência ao documento ${related.title}.`:`Referência textual ainda não resolvida para documento do acervo.`,
      confidence:related?"alta":"media",dynamic:true,isCitation:true
    };
    if(!outgoing.some(x=>relationEquivalent(x,rec))) outgoing.push(rec);
  }

  const sorter=(a,b)=>(Number(b.year||0)-Number(a.year||0)) || String(a.code).localeCompare(String(b.code)) || relationDisplayTitle(a).localeCompare(relationDisplayTitle(b),"pt-BR");
  incoming.sort(sorter);outgoing.sort(sorter);
  return {incoming,outgoing};
}

function itemMatchesRelationNode(item,node){
  if(!node||!item) return false;
  if(node.itemId && node.itemId===item.id) return true;
  if(node.path && node.path===item.path) return true;
  if(item.kind==="sumula" && node.itemId===`sumula:${item.number}`) return true;
  return false;
}

function resolveRelationNode(node){
  if(!node) return null;
  if(node.itemId) return APP.items.find(i=>i.id===node.itemId)||null;
  if(node.path) return APP.items.find(i=>i.path===node.path)||null;
  return null;
}

function relationEquivalent(a,b){
  const sa=a.source?.path||a.source?.itemId||a.source?.label||"";
  const sb=b.source?.path||b.source?.itemId||b.source?.label||"";
  const ta=a.target?.path||a.target?.itemId||a.target?.label||"";
  const tb=b.target?.path||b.target?.itemId||b.target?.label||"";
  return normal(sa)===normal(sb)&&normal(ta)===normal(tb)&&String(a.code)===String(b.code)&&normal(a.scope||"")===normal(b.scope||"");
}

function operationToRelationCode(op){
  const s=normal(op||"");
  if(s.includes("inconstit")) return "JUD";
  if(s.includes("repristin")) return "REP";
  if(s.includes("revog")) return "REV";
  if(s.includes("derrog")) return "DER";
  if(s.includes("exaur")) return "EXA";
  if(s.includes("exce")) return "EXC";
  if(s.includes("renome")||s.includes("substituicao termin")) return "REN";
  if(s.includes("supera")||s.includes("nao recep")||s.includes("perda de objeto")) return "SUP";
  if(s.includes("alter")||s.includes("reforma")) return "ALT";
  return "INT";
}

function relationDisplayTitle(r,side){
  if(side==="incoming") return r.sourceItem?.title||r.source?.label||"Relação";
  if(side==="outgoing") return r.targetItem?.title||r.target?.label||"Relação";
  return r.source?.label||r.target?.label||"Relação";
}

function renderRelationGroups(arr,side){
  if(!arr.length) return '<div class="rel-empty">Nenhuma relação mapeada nesta camada.</div>';
  const groups={};
  for(const r of arr){
    const y=r.year||"Sem data";
    (groups[y] ||= []).push(r);
  }
  return Object.entries(groups).sort((a,b)=>Number(b[0]||0)-Number(a[0]||0)).map(([year,items])=>
    `<div class="rel-year-group" data-rel-year="${escapeHTML(year)}">
      <div class="rel-year-label">${escapeHTML(year)}</div>
      ${items.map(r=>renderRelationCard(r,side)).join("")}
    </div>`
  ).join("");
}

function renderRelationCard(r,side){
  const info=APP.relations.codes?.[r.code]||{label:r.code,class:"rel-cit"};
  const title=relationDisplayTitle(r,side);
  const clickable=side==="incoming"?Boolean(r.sourceItem):Boolean(r.targetItem);
  const direction=side==="incoming"?"→":"→";
  return `<article class="rel-card ${escapeHTML(info.class||"")} ${r.isCitation?"rel-is-citation":""}"
      data-rel-code="${escapeHTML(r.code||"")}"
      data-rel-year="${escapeHTML(r.year||"")}"
      data-rel-citation="${r.isCitation?"1":"0"}">
    <div class="rel-card-top">
      <span class="rel-code ${escapeHTML(info.class||"")}">${escapeHTML(r.code||"")}</span>
      <span class="rel-confidence ${escapeHTML(r.confidence||"")}">${escapeHTML((r.confidence||"").toUpperCase())}</span>
    </div>
    <button class="rel-card-title ${clickable?"clickable":""}" ${clickable?`data-open-rel="${escapeHTML(r.id)}" data-rel-side="${side}"`:"disabled"}>
      ${escapeHTML(title)}
    </button>
    <div class="rel-card-summary">${escapeHTML(r.summary||"")}</div>
    ${r.scope?`<div class="rel-card-meta"><strong>Alcance:</strong> ${escapeHTML(r.scope)}</div>`:""}
    ${r.basis?`<div class="rel-card-meta"><strong>Fundamento:</strong> ${escapeHTML(r.basis)}</div>`:""}
    <div class="rel-arrow">${side==="incoming"?"afeta o ato →":"→ produz relação"}</div>
  </article>`;
}

function bindRelationButtons(){
  document.querySelectorAll("[data-open-rel]").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.openRel;
    const side=b.dataset.relSide;
    const arr=side==="incoming"?APP.reader._incoming:APP.reader._outgoing;
    const r=(arr||[]).find(x=>x.id===id);
    const item=side==="incoming"?r?.sourceItem:r?.targetItem;
    if(item) openDetail(item);
  }));

  const apply=()=>{
    const code=document.getElementById("relFilterCode")?.value||"";
    const year=document.getElementById("relFilterYear")?.value||"";
    const citations=document.getElementById("relIncludeCitations")?.checked??true;
    document.querySelectorAll(".rel-card").forEach(card=>{
      const okCode=!code||card.dataset.relCode===code;
      const okYear=!year||card.dataset.relYear===year;
      const okCitation=citations||card.dataset.relCitation!=="1";
      card.classList.toggle("hidden",!(okCode&&okYear&&okCitation));
    });
    document.querySelectorAll(".rel-year-group").forEach(g=>{
      const any=[...g.querySelectorAll(".rel-card")].some(c=>!c.classList.contains("hidden"));
      g.classList.toggle("hidden",!any);
    });
  };
  document.getElementById("relFilterCode")?.addEventListener("change",apply);
  document.getElementById("relFilterYear")?.addEventListener("change",apply);
  document.getElementById("relIncludeCitations")?.addEventListener("change",apply);
  document.getElementById("relClearFilters")?.addEventListener("click",()=>{
    const c=document.getElementById("relFilterCode"), y=document.getElementById("relFilterYear"), q=document.getElementById("relIncludeCitations");
    if(c)c.value="";if(y)y.value="";if(q)q.checked=true;apply();
  });
}
function itemAliases(item){
  const arr=[item.title,item.name,item.path,item.number?`${item.type} ${item.number}/${item.year}`:""];
  if(item.type==="Decreto Sapiencial"&&item.number) arr.push(`ds ${item.number}`,`decreto sapiencial ${item.number}`);
  if(item.type==="Ato Institucional"&&item.number) arr.push(`ai ${item.number}`,`ato institucional ${item.number}`);
  if(item.type==="Decreto Delicial"&&item.number) arr.push(`del ${item.number}`,`decreto delicial ${item.number}`);
  return arr.filter(Boolean).map(normal);
}

function resolveCitation(c){
  const n=normal(c.target);
  if(c.type==="SÚMULA") return APP.items.find(i=>i.type==="Súmula STE"&&i.number===String(c.target));
  if(c.type==="DS"){
    const num=String(c.target).replace(/\/.*/,"");
    return APP.items.find(i=>i.type==="Decreto Sapiencial"&&i.number===num);
  }
  if(c.type==="AI"){
    const num=String(c.target).replace(/\/.*/,"").replace(/^0+/,"");
    return APP.items.find(i=>i.type==="Ato Institucional"&&String(Number(i.number||-1))===String(Number(num)));
  }
  if(c.type==="DEL"){
    const num=String(c.target).replace(/\/.*/,"").replace(/^0+/,"");
    return APP.items.find(i=>i.type==="Decreto Delicial"&&String(Number(i.number||-1))===String(Number(num)));
  }
  return APP.items.find(i=>normal(i.title).includes(n)||normal(i.path).includes(n));
}

function bindRelationButtons(){
  document.querySelectorAll(".relation-item").forEach(b=>b.addEventListener("click",()=>{
    const side=b.dataset.relSide, idx=Number(b.dataset.relIndex);
    const r=side==="out"?APP.reader._outgoing?.[idx]:APP.reader._incoming?.[idx];
    if(r?.item) openDetail(r.item);
  }));
}

function bindWikiLinks(){
  document.querySelectorAll("#readerContent .wiki-link").forEach(b=>{
    b.addEventListener("click",()=>{
      const ref=b.dataset.wiki||"";
      const c={type:"WIKI",target:ref,label:ref};
      const item=resolveCitation(c);
      if(item) openDetail(item);
      else{
        const notice=document.getElementById("readerNotice");
        notice.innerHTML=`<strong>Referência não resolvida automaticamente:</strong> ${escapeHTML(ref)}.`;
        notice.classList.remove("hidden");
      }
    });
  });
}

async function renderHistory(item){
  const content=document.getElementById("readerContent");
  setReaderLoading(true);
  try{
    let commits=[];
    if(item.kind!=="sumula"){
      const url=ghApi(`/commits?path=${encodeURIComponent(item.path)}&sha=${CONFIG.branch}&per_page=20`);
      commits=await fetchJSON(url);
    }
    const related=(APP.book.entradas||[]).filter(e=>{
      const aliases=itemAliases(item);
      const hay=normal([e.alvo,e.dispositivo,e.fundamento,e.resultado,...(e.fontes||[])].join(" "));
      return aliases.some(a=>hay.includes(a));
    });
    const events=[];
    for(const c of commits||[]){
      events.push({
        date:(c.commit?.committer?.date||c.commit?.author?.date||"").slice(0,10),
        title:c.commit?.message||"Alteração no repositório",
        meta:`Commit ${String(c.sha||"").slice(0,10)}`,
        url:c.html_url||""
      });
    }
    for(const e of related){
      events.push({
        date:(APP.book.data_consolidacao||"").slice(0,10),
        title:`${e.id} — ${e.operacao}`,
        meta:`${e.resultado} · Fundamento: ${e.fundamento}`,
        url:""
      });
    }
    events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    content.innerHTML=events.length?`<div class="timeline">${events.map(ev=>`
      <div class="timeline-item">
        <div class="timeline-date">${escapeHTML(ev.date||"data não indicada")}</div>
        <div class="timeline-title">${escapeHTML(ev.title)}</div>
        <div class="timeline-meta">${escapeHTML(ev.meta||"")}${ev.url?` · <a href="${ev.url}" target="_blank" rel="noopener">ver commit</a>`:""}</div>
      </div>`).join("")}</div>`:'<div class="reader-empty">Histórico não localizado.</div>';
  }catch(err){
    content.innerHTML=`<div class="reader-empty">Não foi possível carregar o histórico: ${escapeHTML(err.message)}</div>`;
  }finally{
    setReaderLoading(false);
  }
}

function findInReader(){
  const term=document.getElementById("readerFind").value.trim();
  if(!term) return;
  const el=document.getElementById("readerContent");
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const idx=normal(node.nodeValue).indexOf(normal(term));
    if(idx>=0){
      const parent=node.parentElement;
      parent.scrollIntoView({behavior:"smooth",block:"center"});
      parent.classList.add("find-hit");
      setTimeout(()=>parent.classList.remove("find-hit"),1800);
      return;
    }
  }
  const notice=document.getElementById("readerNotice");
  notice.textContent=`O termo “${term}” não foi localizado nesta visão.`;
  notice.classList.remove("hidden");
}

function renderControlWarning(){
  const el=document.getElementById("controlWarning");
  if(!el) return;
  const base=APP.book.commit_base||APP.book.commitBase||"";
  if(base && APP.head && base!==APP.head){
    const deltaCount=APP.delta.alteracoes_detectadas?.length||0;
    el.innerHTML=`<strong>Acervo atualizado após a última consolidação.</strong> O Livro de Alterações tem base <code>${escapeHTML(String(base).slice(0,10))}</code>, enquanto o repositório carregado está em <code>${escapeHTML(APP.head.slice(0,10))}</code>. ${deltaCount?`Foram registradas ${deltaCount} mudanças no delta do Passo 13.`:""} O leitor mostra o arquivo oficial atual e mantém a consolidação com sua data-base própria.`;
    el.classList.remove("hidden");
  }else{
    el.classList.add("hidden");
  }
}

function renderAudit(){
  hideViews("auditView");
  document.getElementById("breadcrumb").textContent="Início › Consolidação e Auditoria";
  const entries=APP.book.entradas||[];
  const pending=APP.book.pendencias||[];
  document.getElementById("auditSummary").innerHTML=`
    <div class="stat"><strong>${entries.length}</strong><span>alterações consolidadas</span></div>
    <div class="stat"><strong>${pending.length}</strong><span>pendências jurídicas</span></div>
    <div class="stat"><strong>${APP.rules.regras?.length||0}</strong><span>regras de consolidação</span></div>`;
  document.getElementById("auditEntries").innerHTML=entries.map(e=>`
    <div class="audit-entry">
      <strong>${escapeHTML(e.id)} — ${escapeHTML(e.alvo)}</strong>
      <p>${escapeHTML(e.operacao)} · ${escapeHTML(e.resultado)}</p>
    </div>`).join("") || '<div class="empty">Livro de Alterações não carregado.</div>';
  document.getElementById("auditPending").innerHTML=pending.map(p=>`
    <div class="audit-entry">
      <strong>${escapeHTML(p.id)} — ${escapeHTML(p.tema)}</strong>
      <p>${escapeHTML(p.motivo)}</p>
    </div>`).join("") || '<div class="empty">Sem pendências carregadas.</div>';
  runPortalAudit();
}

function populateFilters(){
  const types=[...new Set(APP.items.map(i=>i.type))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const years=[...new Set(APP.items.map(i=>i.year).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  const status=[...new Set(APP.items.map(i=>i.status))];
  const tribunals=[...new Set(APP.items.map(i=>i.tribunal).filter(Boolean))].sort();
  const categories=[...new Set(APP.items.flatMap(i=>i.virtualCategories||[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const add=(id,vals,label=x=>x)=>{const s=document.getElementById(id);if(!s)return;vals.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=label(v);s.appendChild(o);});};
  add("filtroTipo",types);add("filtroAno",years);add("filtroStatus",status,v=>(STATUS_INFO[v]||{}).label||v);add("filtroTribunal",tribunals);add("filtroCategoria",categories);
}

function normal(s){
  return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function escapeHTML(s){
  return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function bindUI(){
  document.getElementById("busca").addEventListener("input",()=>{
    if(APP.collection==="inicio") setCollection("legislacao");
    else applyFilters();
  });
  document.getElementById("btnBuscar").addEventListener("click",()=>{
    if(APP.collection==="inicio") setCollection("legislacao"); else applyFilters();
  });
  ["filtroTipo","filtroStatus","filtroAno","filtroTribunal","filtroCategoria","ordenacao"].forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{
    if(APP.collection==="inicio") setCollection("legislacao"); else applyFilters();
  }));
  document.getElementById("limparFiltros").addEventListener("click",()=>{
    document.getElementById("busca").value="";
    document.getElementById("filtroTipo").value="";
    document.getElementById("filtroStatus").value="";
    document.getElementById("filtroAno").value="";
    document.getElementById("filtroTribunal").value="";
    document.getElementById("filtroCategoria").value="";
    document.getElementById("ordenacao").value="legal_desc";
    document.getElementById("somenteVigentes").checked=false;
    document.getElementById("buscaProfunda").checked=false;
    if(APP.collection!=="inicio"&&APP.collection!=="auditoria") applyFilters();
  });
  document.getElementById("backButton").addEventListener("click",()=>setCollection(APP.previousCollection||"legislacao"));
  document.getElementById("toggleAdvanced")?.addEventListener("click",()=>document.getElementById("advancedSearch")?.classList.toggle("hidden"));
  document.getElementById("somenteVigentes")?.addEventListener("change",()=>{if(APP.collection!=="inicio"&&APP.collection!=="auditoria")applyFilters();});
  document.getElementById("buscaProfunda")?.addEventListener("change",()=>{if(APP.collection!=="inicio"&&APP.collection!=="auditoria")applyFilters();});
  document.getElementById("exportJson")?.addEventListener("click",()=>exportResults("json"));
  document.getElementById("exportCsv")?.addEventListener("click",()=>exportResults("csv"));
  document.getElementById("runAudit")?.addEventListener("click",runPortalAudit);
  document.querySelectorAll("#readerTabs button").forEach(b=>b.addEventListener("click",()=>renderReaderView(b.dataset.view)));
  document.getElementById("readerFindBtn").addEventListener("click",findInReader);
  document.getElementById("readerFind").addEventListener("keydown",e=>{if(e.key==="Enter") findInReader();});
  document.body.addEventListener("click",e=>{
    const b=e.target.closest("[data-action='colecao']");
    if(b) setCollection(b.dataset.value);
  });
}

async function checkIncrementalUpdates(){
  const baseline=localStorage.getItem(CONFIG.lastIndexedKey)||APP.lastIndexation.commit||CONFIG.buildHead||"";
  if(!baseline||!APP.head||baseline===APP.head){APP.updateInfo={baseline,current:APP.head,changed:[]};renderUpdatePanel();return;}
  try{
    const cmp=await fetchJSON(ghApi(`/compare/${baseline}...${APP.head}`));
    APP.updateInfo={baseline,current:APP.head,aheadBy:cmp.ahead_by||0,changed:(cmp.files||[]).map(f=>({path:f.filename,status:f.status,changes:f.changes||0}))};
  }catch(err){APP.updateInfo={baseline,current:APP.head,error:err.message,changed:[]};}
  renderUpdatePanel();
}
function renderUpdatePanel(){
  const el=document.getElementById("updatePanel");if(!el)return;const info=APP.updateInfo;
  if(!info||!info.baseline||info.baseline===info.current){el.classList.add("hidden");return;}
  const files=(info.changed||[]).slice(0,30);
  el.innerHTML=`<h3>Atualização incremental detectada</h3><div>Marco anterior: <code>${escapeHTML(String(info.baseline).slice(0,10))}</code> · HEAD atual: <code>${escapeHTML(String(info.current).slice(0,10))}</code>${info.aheadBy?` · ${info.aheadBy} commit(s) à frente`:""}.</div>
  ${files.length?`<ul class="update-files">${files.map(f=>`<li><strong>${escapeHTML(f.status)}</strong> — ${escapeHTML(f.path)}</li>`).join("")}</ul>`:""}
  ${info.error?`<div class="audit-warning">${escapeHTML(info.error)}</div>`:""}
  <div class="update-actions"><button class="refresh" id="forceReindex">Reindexar agora</button><button class="ack" id="ackIndex">Marcar HEAD como revisado localmente</button></div>`;
  el.classList.remove("hidden");
  document.getElementById("forceReindex")?.addEventListener("click",()=>{sessionStorage.removeItem(CONFIG.cacheKey);location.reload();});
  document.getElementById("ackIndex")?.addEventListener("click",()=>{localStorage.setItem(CONFIG.lastIndexedKey,APP.head);el.classList.add("hidden");});
}
function runPortalAudit(){
  const host=document.getElementById("technicalAudit");if(!host)return;
  const paths=new Set(APP.items.filter(i=>i.path).map(i=>i.path)),issues=[],warnings=[];let broken=0,unresolved=0;
  for(const e of APP.relations.edges||[]){
    for(const side of ["source","target"]){
      const n=e[side];
      if(n?.path&&!paths.has(n.path)){broken++;issues.push(`${e.id}: ${side} aponta para path não localizado — ${n.path}`);}
      if(n?.itemId&&!APP.items.some(i=>i.id===n.itemId)){unresolved++;warnings.push(`${e.id}: itemId não localizado — ${n.itemId}`);}
    }
  }
  const bookBase=APP.book.commit_base||"";
  if(bookBase&&bookBase!==APP.head)warnings.push(`Livro de Alterações: ${bookBase.slice(0,10)}; HEAD: ${APP.head.slice(0,10)}.`);
  const seen=new Set(),dups=[];for(const i of APP.items){if(seen.has(i.id))dups.push(i.id);else seen.add(i.id);}
  if(dups.length)issues.push(`IDs duplicados: ${dups.join(", ")}`);
  host.innerHTML=`<div class="audit-tech-grid">
    <div class="audit-tech-stat"><strong>${APP.items.length}</strong><span>registros carregados</span></div>
    <div class="audit-tech-stat"><strong>${APP.relations.edges?.length||0}</strong><span>relações pré-mapeadas</span></div>
    <div class="audit-tech-stat"><strong>${broken}</strong><span>paths quebrados</span></div>
    <div class="audit-tech-stat"><strong>${APP.book.pendencias?.length||0}</strong><span>pendências jurídicas</span></div>
  </div><div class="audit-errors">
    ${issues.length?issues.map(x=>`<div class="audit-error">${escapeHTML(x)}</div>`).join(""):'<div class="audit-ok">Nenhum erro estrutural crítico detectado.</div>'}
    ${warnings.map(x=>`<div class="audit-warning">${escapeHTML(x)}</div>`).join("")}
  </div>`;
}

async function init(){
  bindUI();
  renderNav();
  renderShortcuts();
  await loadControls();
  try{
    const tree=await loadRepository();
    const files=(tree||[])
      .filter(x=>x.type==="blob" && x.path.startsWith(CONFIG.root+"/"))
      .map(x=>classify(x.path));

    const sumulas=await loadSumulas();
    APP.items=[...files.filter(i=>i.type!=="Arquivo de Súmulas"),...sumulas];

    document.getElementById("estadoRepositorio").textContent=`Acervo sincronizado · ${APP.head.slice(0,7)}`;
    document.getElementById("commitAtual").textContent=APP.head.slice(0,12);
    document.getElementById("totalArquivos").textContent=files.length;
    populateFilters();
    await checkIncrementalUpdates();
    renderHome();
  }catch(err){
    document.getElementById("estadoRepositorio").textContent="Não foi possível sincronizar o GitHub";
    document.getElementById("home").innerHTML=`
      <div class="empty">
        <strong>Falha ao carregar o acervo.</strong><br>
        Abra este arquivo com acesso à internet ou publique-o em um servidor estático.
        <div style="margin-top:8px;font-size:11px">${escapeHTML(err.message)}</div>
      </div>`;
  }
}
init();
