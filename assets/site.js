/* 访问密码门 —— 输入 2003 才能阅读。
   注意：这是纯前端校验，只能挡住普通访客，无法做到真正加密。 */
(function(){
  var KEY="ppm_unlocked", PW="2003";
  try{ if(localStorage.getItem(KEY)==="1") return; }catch(e){}
  document.documentElement.style.visibility="hidden";
  while(true){
    var v=window.prompt("请输入访问密码：");
    if(v===PW){
      try{ localStorage.setItem(KEY,"1"); }catch(e){}
      document.documentElement.style.visibility="";
      break;
    }
    window.alert("密码错误，请重试。");
  }
})();

(function(){
  var root=document.documentElement, LS=window.localStorage;
  function get(k,d){var v=LS.getItem(k);return v===null?d:v;}
  var sizes=[15,16,17,18,19,20,22,24,27];
  var fi=parseInt(get("ppm_fsize","3"),10); if(isNaN(fi))fi=3;
  root.setAttribute("data-theme", get("ppm_theme","white"));
  root.setAttribute("data-font",  get("ppm_font","serif"));
  var mq=function(){return window.matchMedia("(max-width:880px)").matches;};
  if(mq()){ root.classList.add("sidebar-closed"); }            /* 手机端默认收起,先看正文 */
  else if(get("ppm_sidebar","open")==="closed"){ root.classList.add("sidebar-closed"); }
  function applySize(){
    var els=document.getElementsByClassName("page-inner");
    for(var i=0;i<els.length;i++){ els[i].style.fontSize=sizes[fi]+"px"; }
  }
  // 是否在章节页(决定相对路径前缀)。脚本在 <head> 中运行,此时 body 尚不存在,
  // 故延后到 DOMContentLoaded 时再计算,避免读取 document.body 报错。
  var BASE="";

  window.PPM={
    toggleSidebar:function(){ root.classList.toggle("sidebar-closed");
      if(!mq()){ LS.setItem("ppm_sidebar", root.classList.contains("sidebar-closed")?"closed":"open"); } },
    closeSidebar:function(){ root.classList.add("sidebar-closed"); },
    setTheme:function(t){ root.setAttribute("data-theme",t); LS.setItem("ppm_theme",t); },
    setFont:function(f){ root.setAttribute("data-font",f); LS.setItem("ppm_font",f); },
    incFont:function(d){ fi=Math.max(0,Math.min(sizes.length-1,fi+d)); LS.setItem("ppm_fsize",fi); applySize(); },
    togglePanel:function(e){ if(e){e.stopPropagation();}
      document.getElementById("fontPanel").classList.toggle("open"); },
    openSearch:function(e){ if(e){e.stopPropagation();}
      root.classList.remove("sidebar-closed");
      var inner=document.querySelector(".sb-inner"); if(inner){ inner.scrollTop=0; }
      var i=document.getElementById("ssInput"); if(i){ i.focus(); } }
  };

  /* ============== 全局搜索 ============== */
  function escHtml(s){ return s.replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function escReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

  function buildSearchBtn(){
    var tb=document.querySelector(".toolbar");
    if(!tb||document.getElementById("ssBtn")) return;
    var btn=document.createElement("button");
    btn.className="tb-btn"; btn.id="ssBtn"; btn.title="搜索";
    btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" '
      +'stroke="currentColor" stroke-width="2" stroke-linecap="round">'
      +'<circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>';
    btn.addEventListener("click",function(e){ PPM.openSearch(e); });
    var first=tb.querySelector(".tb-btn"); // 紧跟在 ☰ 后面
    if(first&&first.nextSibling){ tb.insertBefore(btn, first.nextSibling); }
    else{ tb.appendChild(btn); }
  }

  function buildSearch(){
    var inner=document.querySelector(".sb-inner");
    var list=document.querySelector(".sb-list");
    if(!inner||!list) return;
    var box=document.createElement("div");
    box.className="sb-search";
    box.innerHTML=
      '<div class="ss-field">'
      +'<input type="search" id="ssInput" autocomplete="off" placeholder="搜索全文…"/>'
      +'<button class="ss-clear" id="ssClear" title="清空" aria-label="清空">&times;</button>'
      +'</div>'
      +'<div class="ss-results" id="ssResults"></div>';
    inner.insertBefore(box, list);

    var input=document.getElementById("ssInput");
    var clear=document.getElementById("ssClear");
    var results=document.getElementById("ssResults");
    var INDEX=null, loading=false, timer=null;

    function loadIndex(cb){
      if(INDEX){ cb(); return; }
      if(loading) return;
      loading=true;
      results.innerHTML='<div class="ss-msg">索引加载中…</div>';
      var xhr=new XMLHttpRequest();
      xhr.open("GET", BASE+"assets/search-index.json", true);
      xhr.onreadystatechange=function(){
        if(xhr.readyState!==4) return;
        loading=false;
        if(xhr.status>=200&&xhr.status<300){
          try{ INDEX=JSON.parse(xhr.responseText); cb(); }
          catch(e){ results.innerHTML='<div class="ss-msg">索引解析失败</div>'; }
        }else{ results.innerHTML='<div class="ss-msg">索引加载失败</div>'; }
      };
      xhr.send();
    }

    function snippet(text, q, lc){
      var i=lc.indexOf(q.toLowerCase());
      var start=Math.max(0, i-28), end=Math.min(text.length, i+q.length+50);
      var s=(start>0?"…":"")+text.slice(start,end)+(end<text.length?"…":"");
      return escHtml(s).replace(new RegExp(escReg(escHtml(q)),"gi"),
        function(m){ return '<mark>'+m+'</mark>'; });
    }

    function run(){
      var q=input.value.trim();
      clear.style.display=q?"block":"none";
      if(!q){ results.innerHTML=""; results.classList.remove("open"); return; }
      loadIndex(function(){
        var ql=q.toLowerCase(), out=[], MAX=80, hitCh=0;
        for(var e=0;e<INDEX.length&&out.length<MAX;e++){
          var ch=INDEX[e], paras=ch.p, first=true;
          for(var p=0;p<paras.length&&out.length<MAX;p++){
            var lc=paras[p].toLowerCase();
            if(lc.indexOf(ql)>=0){
              out.push({f:ch.f,t:ch.t,pi:p,html:snippet(paras[p],q,lc),first:first});
              if(first){ hitCh++; first=false; }
            }
          }
        }
        if(!out.length){
          results.innerHTML='<div class="ss-msg">未找到「'+escHtml(q)+'」</div>';
          results.classList.add("open"); return;
        }
        var html='<div class="ss-count">命中 '+out.length+' 段 · '+hitCh+' 章</div>';
        for(var k=0;k<out.length;k++){
          var r=out[k];
          var href=BASE+"chapters/"+r.f+"?p="+r.pi+"&q="+encodeURIComponent(q);
          html+='<a class="ss-card'+(r.first?" ss-newch":"")+'" href="'+href+'">'
            +'<div class="ss-ttl">'+escHtml(r.t)+'</div>'
            +'<div class="ss-snip">'+r.html+'</div></a>';
        }
        results.innerHTML=html;
        results.classList.add("open");
      });
    }

    input.addEventListener("input",function(){
      if(timer)clearTimeout(timer); timer=setTimeout(run,180); });
    input.addEventListener("focus",function(){ loadIndex(function(){}); });
    clear.addEventListener("click",function(){
      input.value=""; clear.style.display="none";
      results.innerHTML=""; results.classList.remove("open"); input.focus(); });
    input.addEventListener("keydown",function(ev){
      if(ev.key==="Escape"){ input.value=""; results.innerHTML="";
        results.classList.remove("open"); clear.style.display="none"; } });
  }

  /* 到达目标章节后:滚动到对应段落并高亮关键字 */
  function highlightTarget(){
    var qs=new URLSearchParams(location.search);
    var pi=qs.get("p"), q=qs.get("q");
    if(pi===null) return;
    var ps=document.querySelectorAll(".page-inner p");
    var el=ps[parseInt(pi,10)];
    if(!el) return;
    el.classList.add("ss-hit");
    if(q){
      var re=new RegExp(escReg(q),"gi");
      var walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var nodes=[], n;
      while((n=walker.nextNode())) nodes.push(n);
      nodes.forEach(function(node){
        var t=node.nodeValue;
        if(!re.test(t)) return; re.lastIndex=0;
        var frag=document.createDocumentFragment(), last=0, m;
        while((m=re.exec(t))){
          if(m.index>last) frag.appendChild(document.createTextNode(t.slice(last,m.index)));
          var mk=document.createElement("mark"); mk.textContent=m[0];
          frag.appendChild(mk); last=m.index+m[0].length;
          if(m.index===re.lastIndex) re.lastIndex++;
        }
        if(last<t.length) frag.appendChild(document.createTextNode(t.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    }
    setTimeout(function(){ el.scrollIntoView({block:"center"}); }, 60);
  }

  document.addEventListener("DOMContentLoaded",function(){
    BASE=/(^|\s)chapter(\s|$)/.test(document.body.className)?"../":"";
    applySize();
    buildSearch();
    buildSearchBtn();
    highlightTarget();
    var act=document.querySelector(".sb-ch.active,.sb-part-link.active");
    if(act){ act.scrollIntoView({block:"center"}); }
    document.addEventListener("click",function(ev){
      var p=document.getElementById("fontPanel");
      if(p&&p.classList.contains("open")&&!ev.target.closest(".tb-font")){ p.classList.remove("open"); }
      // 点搜索区以外:收起结果面板
      var res=document.getElementById("ssResults");
      if(res&&res.classList.contains("open")&&!ev.target.closest(".sb-search")){ res.classList.remove("open"); }
      // 手机端:目录展开时,点侧栏以外区域(且不是工具栏)即收起
      if(mq()&&!root.classList.contains("sidebar-closed")&&!ev.target.closest(".sidebar")&&!ev.target.closest(".toolbar")){
        PPM.closeSidebar();
      }
    });
    document.addEventListener("keydown",function(ev){
      if(ev.target&&/^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      if(ev.key==="ArrowLeft"){var a=document.querySelector(".nav-arrow.prev:not(.disabled)"); if(a)location.href=a.href;}
      if(ev.key==="ArrowRight"){var b=document.querySelector(".nav-arrow.next:not(.disabled)"); if(b)location.href=b.href;}
    });
  });
})();
