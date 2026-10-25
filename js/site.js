(function(){
 const categories=window.FAITH_CATEGORIES||[], slots=window.FAITH_SLOTS||[];
 const cfg=window.FAITH_CONFIG||{};
 const grid=document.getElementById('topicGrid'), articles=document.getElementById('articleGrid');
 const filter=document.getElementById('categoryFilter'), search=document.getElementById('searchInput');
 const empty=document.getElementById('emptyState'), more=document.getElementById('showMore');
 document.getElementById('year').textContent=new Date().getFullYear();
 const icons={bible:'📖',growth:'🌱',prayer:'🕊️',living:'♡',hope:'☀️',community:'🤝'};
 let published=[], shown=6;
 function readLocal(){try{return JSON.parse(localStorage.getItem('faithlight.posts')||'[]')}catch(e){return []}}
 function readPublished(){published=readLocal().filter(p=>p.status==='published');}
 function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function renderTopics(){grid.innerHTML=categories.map(c=>{const count=published.filter(p=>p.categoryId===c.id).length;return `<a class="topic-card ${c.color}" href="#latest" data-topic="${c.id}"><span class="topic-icon">${icons[c.id]||c.icon}</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.desc)}</p><div class="topic-bottom"><span>${count} ${count===1?'article':'articles'} published</span><span class="topic-arrow">↗</span></div></a>`}).join('');grid.querySelectorAll('[data-topic]').forEach(el=>el.addEventListener('click',()=>{filter.value=el.dataset.topic;renderArticles()}))}
 function renderFilter(){filter.innerHTML='<option value="all">All topics</option>'+categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
 function renderArticles(){const q=search.value.trim().toLowerCase(), cat=filter.value;const list=published.filter(p=>(cat==='all'||p.categoryId===cat)&&(!q||[p.title,p.excerpt,p.body,p.category,p.subcategory,p.scripture].join(' ').toLowerCase().includes(q)));articles.innerHTML=list.slice(0,shown).map(p=>`<a class="article-card" href="article.html?id=${encodeURIComponent(p.id)}"><div class="article-art ${p.color||'lavender'}"><span class="article-category">${escapeHtml(p.category)}</span><span class="art-symbol">${icons[p.categoryId]||'✦'}</span></div><div class="article-card-body"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt||'A thoughtful reflection to encourage your walk with Christ.')}</p><div class="article-meta"><span>${escapeHtml(p.scripture||'A moment to reflect')}</span><span class="read-link">Read article ↗</span></div></div></a>`).join('');empty.hidden=list.length>0;more.hidden=list.length<=shown}
 function init(){renderFilter();readPublished();renderTopics();renderArticles();search.addEventListener('input',()=>{shown=6;renderArticles()});filter.addEventListener('change',()=>{shown=6;renderArticles()});more.addEventListener('click',()=>{shown+=6;renderArticles()});document.querySelectorAll('.menu-toggle').forEach(btn=>btn.addEventListener('click',()=>{const nav=document.querySelector('.main-nav');const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open))}));window.addEventListener('storage',e=>{if(e.key==='faithlight.posts'){readPublished();renderTopics();renderArticles()}})}
 init();
})();