/*
  AI Web Development Assistant (Front-End Only Mock)
  - Maintains in-browser session memory (optional)
  - Provides modes: explain, generate, debug, optimize
  - Uses a simple rule-based + template system to produce helpful answers without external APIs
  - Easily replace the mock respond() with real API integration later.
*/

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const memoryToggle = document.getElementById('memoryToggle');
const modeSelect = document.getElementById('modeSelect');
const themeSelect = document.getElementById('themeSelect');
const modelSelect = document.getElementById('modelSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const snippetButtonsContainer = document.getElementById('snippetButtons');
const micBtn = document.getElementById('micBtn');
const speakToggle = document.getElementById('speakToggle');
// Full site / preview additions
const sitePreview = document.getElementById('sitePreview');
const generatedFilesContainer = document.getElementById('generatedFiles');
const downloadSiteBtn = document.getElementById('downloadSiteBtn');
const beginnerModeToggle = document.getElementById('beginnerMode');
const tailwindPrefToggle = document.getElementById('tailwindPref');
// Image reference elements
const imageInput = document.getElementById('imageInput');
const addImagesBtn = document.getElementById('addImagesBtn');
const clearImagesBtn = document.getElementById('clearImagesBtn');
const imageGallery = document.getElementById('imageGallery');

const messageTemplate = document.getElementById('messageTemplate');

// Basic snippet library
const SNIPPETS = [
  { label: 'HTML Boiler', text: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Title</title>\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>' },
  { label: 'Flex Center', text: '.parent { display:flex; justify-content:center; align-items:center; }' },
  { label: 'Fetch GET', text: 'fetch("/api")\n .then(r=>r.json())\n .then(data=>console.log(data))\n .catch(console.error);' },
  { label: 'Async Fn', text: 'async function run(){\n  try {\n    const res = await fetch(url);\n    if(!res.ok) throw new Error(res.status);\n    const data = await res.json();\n    console.log(data);\n  } catch(err){\n    console.error(err);\n  }\n}' },
  { label: 'Debounce', text: 'function debounce(fn, delay=300){\n  let t;\n  return (...args)=>{\n    clearTimeout(t);\n    t=setTimeout(()=>fn(...args),delay);\n  };\n}' },
  { label: 'Throttle', text: 'function throttle(fn, limit=200){\n  let inThrottle=false;\n  let lastArgs;\n  return function(...args){\n    lastArgs=args;\n    if(!inThrottle){\n      fn.apply(this,lastArgs);\n      inThrottle=true;\n      setTimeout(()=>{\n        inThrottle=false;\n        if(lastArgs!==args) fn.apply(this,lastArgs);\n      },limit);\n    }\n  };\n}' },
  // PowerApps / Power Fx snippets
  { label: 'Fx Filter', text: 'Filter(Assets, StartsWith(Title, txtSearch.Text))' },
  { label: 'Fx Patch', text: 'Patch(Assets, Defaults(Assets), { Title: txtTitle.Text, Status: drpStatus.Selected.Value })' },
  { label: 'Fx Gallery Items', text: 'SortByColumns( Filter(Products, Category = drpCategory.Selected.Value ), "Title" )' },
  { label: 'Fx Navigate', text: 'Navigate(scrDetails, ScreenTransition.Fade, { record: galProducts.Selected })' }
];

// Session memory
let conversation = [];

function createMessage(role, content, extra={}) {
  const frag = messageTemplate.content.cloneNode(true);
  const root = frag.querySelector('.message');
  root.classList.add(role);
  const roleEl = frag.querySelector('.role');
  const timeEl = frag.querySelector('.timestamp');
  const contentEl = frag.querySelector('.content');
  const copyBtn = frag.querySelector('.copy-btn');
  roleEl.textContent = role;
  timeEl.textContent = new Date().toLocaleTimeString();
  if (extra.error) root.classList.add('error');
  // Basic markdown-ish formatting for code blocks
  const rendered = renderMarkdownLite(content);
  contentEl.innerHTML = rendered;
  // highlight code blocks after insertion (if highlighter present)
  if(typeof highlightWithin === 'function') requestAnimationFrame(()=> highlightWithin(contentEl));
  copyBtn.addEventListener('click', () => copyContent(contentEl));
  chatLog.appendChild(frag);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function copyContent(container){
  let text = '';
  const codeBlocks = container.querySelectorAll('pre');
  if(codeBlocks.length){
    text = Array.from(codeBlocks).map(b=>b.innerText).join('\n\n');
  } else {
    text = container.innerText.trim();
  }
  navigator.clipboard.writeText(text).then(()=>{
    showToast('Copied');
  }).catch(()=> showToast('Copy failed'));
}

function showToast(msg){
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.position='fixed';
  div.style.bottom='1rem';
  div.style.right='1rem';
  div.style.background='var(--accent)';
  div.style.color='#fff';
  div.style.padding='.5rem .75rem';
  div.style.borderRadius='6px';
  div.style.fontSize='.75rem';
  div.style.boxShadow='var(--shadow)';
  div.style.zIndex='999';
  document.body.appendChild(div);
  setTimeout(()=> div.remove(), 1400);
}

// Extremely lightweight markdown: code fences, inline code, bold
function renderMarkdownLite(text){
  // escape HTML
  let safe = text.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  // code fences ```
  safe = safe.replace(/```(\w+)?\n([\s\S]*?)```/g, (m,lang,code)=>`<pre data-lang="${lang||''}"><code>${code.replace(/\n$/,'')}</code></pre>`);
  // inline code
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold **text**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return safe;
}

// ---------------- Syntax Highlighting (restored minimal) ----------------
function highlightWithin(container){
  container.querySelectorAll('pre code:not([data-highlighted])').forEach(codeEl => {
    let lang = (codeEl.parentElement.getAttribute('data-lang')||'').toLowerCase();
    if(!lang){
      const s = codeEl.textContent.trim();
      if(s.startsWith('<')) lang='html'; else if(/function|=>|const|let|var|\bclass\b/.test(s)) lang='js'; else if(/:\s*[^;]+;/.test(s)) lang='css'; else lang='text';
    }
    const t = codeEl.textContent;
    let html;
  try { html = (lang==='html')? highlightHTML(t) : (lang==='css'? highlightCSS(t) : (lang==='js'||lang==='javascript'? highlightJS(t) : (lang==='powerfx'||lang==='fx'? highlightPowerFx(t) : escapeHTML(t)))); } catch(e){ html = escapeHTML(t); }
    codeEl.innerHTML = html; codeEl.dataset.highlighted='true';
  });
}
function escapeHTML(str){ return str.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function restorePlaceholders(s,b){ return s.replace(/___TOK(\d+)___/g,(_,i)=> b[i]); }
function highlightJS(code){ const bucket=[]; const store=(c,x)=>{const i=bucket.push(`<span class="token-${c}">${escapeHTML(x)}</span>`)-1; return `___TOK${i}___`;}; let src=code; src=src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,m=>store('comment',m)); src=src.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g,m=>store('string',m)); src=src.replace(/\b\d+(?:\.\d+)?\b/g,m=>store('number',m)); src=src.replace(/\b(?:true|false|null|undefined)\b/g,m=>store('boolean',m)); src=src.replace(/\b(?:break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|async|await|of)\b/g,m=>store('keyword',m)); src=escapeHTML(src).replace(/([{}()\[\];,.<>])/g,'<span class="token-punctuation">$1</span>'); return restorePlaceholders(src,bucket);} 
function highlightCSS(code){ const bucket=[]; const store=(c,x)=>{const i=bucket.push(`<span class="token-${c}">${escapeHTML(x)}</span>`)-1; return `___TOK${i}___`;}; let src=code; src=src.replace(/\/\*[\s\S]*?\*\//g,m=>store('comment',m)); src=src.replace(/(['"])(?:\\.|(?!\1).)*\1/g,m=>store('string',m)); src=src.replace(/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?/g,m=>store('number',m)); src=src.replace(/([a-zA-Z_-][a-zA-Z0-9_-]*)(?=\s*:)/g,m=>store('property',m)); src=escapeHTML(src).replace(/([{}()\[\];,.<>])/g,'<span class="token-punctuation">$1</span>'); return restorePlaceholders(src,bucket);} 
// HTML highlighting disabled per user preference (return escaped only)
function highlightHTML(code){
  return escapeHTML(code);
}
function highlightPowerFx(code){ const bucket=[]; const store=(c,x)=>{const i=bucket.push(`<span class=\"token-${c}\">${escapeHTML(x)}</span>`)-1; return `___TOK${i}___`;}; let src=code; src=src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,m=>store('comment',m)); src=src.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,m=>store('string',m)); src=src.replace(/\b\d+(?:\.\d+)?\b/g,m=>store('number',m)); const kw=/\b(?:Filter|Patch|Navigate|With|Set|UpdateContext|ClearCollect|Collect|Remove|RemoveIf|ForAll|If|Switch|StartsWith|SortByColumns|FirstN|Last|LookUp|Notify|Distinct|ShowColumns|AddColumns|Concurrent|IsBlank|IsError|Len|Trim|Upper|Lower|And|Or|Not|As)\b/g; src=src.replace(kw,m=>store('keyword',m)); src=escapeHTML(src).replace(/([{}()\[\];,.<>])/g,'<span class=\"token-punctuation\">$1</span>'); return restorePlaceholders(src,bucket);} 

function addUserMessage(content){
  createMessage('user', content);
  if(memoryToggle.checked){
    conversation.push({role:'user', content});
  }
}

function addAssistantMessage(content){
  createMessage('assistant', content);
  if(memoryToggle.checked){
    conversation.push({role:'assistant', content});
  }
  speakAssistant(content);
}

function mockRespond(prompt, mode){
  // Deterministic pseudo AI for demonstration
  const lower = prompt.toLowerCase();
  const suggestions = [];

  if(/flex/.test(lower)) suggestions.push('Consider using gap for spacing instead of margins if supported.');
  if(/responsive|mobile/.test(lower)) suggestions.push('Use clamp() for fluid typography and CSS grid for adaptable layouts.');
  if(/accessibility|a11y/.test(lower)) suggestions.push('Remember semantic landmarks (header, main, nav, footer) and aria-labels only when necessary.');
  if(/performance|optimi[sz]e/.test(lower)) suggestions.push('Defer non-critical scripts and use Lighthouse to audit performance regressions.');
  if(/seo/.test(lower)) suggestions.push('Ensure logical heading hierarchy and descriptive title & meta description tags.');

  const modeHeaders = {
    explain: 'Explanation',
    generate: 'Generated Code',
    debug: 'Debug Analysis',
    optimize: 'Optimization Suggestions',
    powerapps: 'PowerApps Guidance',
    site: 'Full Site'
  };

  let body = '';
  switch(mode){
    case 'explain':
      body = explainPrompt(prompt);
      break;
    case 'generate':
      body = generateCode(prompt);
      break;
    case 'debug':
      body = debugCode(prompt);
      break;
    case 'optimize':
      body = optimizePrompt(prompt);
      break;
    case 'powerapps':
      body = powerAppsRespond(prompt);
      break;
    case 'site':
      body = fullSiteRespond(prompt);
      break;
    default:
      body = 'Mode not recognized.';
  }

  if(suggestions.length){
    body += '\n\nAdditional contextual tips:\n- ' + suggestions.join('\n- ');
  }

  return `### ${modeHeaders[mode] || 'Response'}\n\n${body}`;
}

function explainPrompt(prompt){
  return `You asked about: ${prompt}\n\nKey considerations:\n- Purpose / intent clarification\n- Underlying browser / spec concept\n- Edge cases & accessibility\n\nExample snippet:\n\n\`\`\`html\n<div role="status" aria-live="polite">Loading...</div>\n\`\`\`\n`;
}

function generateCode(prompt){
  // Simple heuristics
  if(/navbar|navigation/i.test(prompt)){
    return `Responsive navigation skeleton with three parts (HTML structure, CSS styling, and JavaScript behavior).\n\nHTML structure (this is the code for HTML):\n\n\`\`\`html\n<header class="site-nav">\n  <button class="nav-toggle" aria-expanded="false" aria-controls="navMenu">☰</button>\n  <nav id="navMenu" hidden>\n    <ul>\n      <li><a href="#home">Home</a></li>\n      <li><a href="#features">Features</a></li>\n      <li><a href="#contact">Contact</a></li>\n    </ul>\n  </nav>\n</header>\n\`\`\`\n\nCSS styles (this is the CSS code):\n\n\`\`\`css\n.site-nav { display:flex; align-items:center; gap:1rem; }\n.nav-toggle { font-size:1.25rem; }\n@media (min-width: 700px){\n  #navMenu[hidden] { display:block !important; }\n  .nav-toggle { display:none; }\n  #navMenu ul { display:flex; gap:1.5rem; list-style:none; margin:0; padding:0; }\n}\n\`\`\`\n\nJavaScript behavior (this is the JavaScript code):\n\n\`\`\`js\nconst btn = document.querySelector('.nav-toggle');\nconst menu = document.getElementById('navMenu');\nbtn.addEventListener('click', ()=>{\n  const expanded = btn.getAttribute('aria-expanded')==='true';\n  btn.setAttribute('aria-expanded', !expanded);\n  if(expanded){ menu.setAttribute('hidden',''); } else { menu.removeAttribute('hidden'); }\n});\n\`\`\`\n`;
  }
  if(/modal/i.test(prompt)){
    return `Accessible modal pattern split into HTML, CSS, and JavaScript layers.\n\nHTML markup (this is the code for HTML):\n\n\`\`\`html\n<button id="openModal">Open Modal</button>\n<div class="modal" id="modal1" role="dialog" aria-modal="true" aria-labelledby="modalTitle" hidden>\n  <div class="modal-inner">\n    <h2 id="modalTitle">Dialog Title</h2>\n    <p>Modal content.</p>\n    <button id="closeModal">Close</button>\n  </div>\n</div>\n\`\`\`\n\nCSS styles (this is the CSS code):\n\n\`\`\`css\n.modal { position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.55); }\n.modal-inner { background:#fff; padding:1.25rem 1.5rem; border-radius:10px; max-width:480px; width:90%; }\n\`\`\`\n\nJavaScript logic (this is the JavaScript code):\n\n\`\`\`js\nconst openBtn = document.getElementById('openModal');\nconst closeBtn = document.getElementById('closeModal');\nconst modal = document.getElementById('modal1');\nopenBtn.addEventListener('click', ()=>{ modal.removeAttribute('hidden'); openBtn.disabled=true; closeBtn.focus(); });\ncloseBtn.addEventListener('click', ()=>{ modal.setAttribute('hidden',''); openBtn.disabled=false; openBtn.focus(); });\nwindow.addEventListener('keydown', e=>{ if(e.key==='Escape' && !modal.hasAttribute('hidden')) closeBtn.click(); });\n\`\`\`\n`;
  }
  // default template
  return `General purpose JavaScript snippet (this is the JavaScript code):\n\n\`\`\`js\nfunction component(root){\n  // initialization code\n  return { update(data){ /* ... */ } };\n}\n\`\`\`\n`;
}

function debugCode(prompt){
  return `Debug strategy:\n1. Reproduce reliably\n2. Isolate minimal failing case\n3. Inspect console/network\n4. Validate assumptions (data shape, element presence)\n5. Add temporary logging\n\nPotential fix illustration:\n\n\`\`\`js\nif(!Array.isArray(items)) throw new TypeError('items must be array');\n\`\`\`\n`;
}

function optimizePrompt(prompt){
  return `Optimization angles:\n- Reduce layout thrash (batch DOM reads/writes)\n- Use CSS containment (contain: layout paint)\n- Lazy load offscreen images/components\n- Cache heavy pure computations\n- Eliminate unused CSS (critical CSS extraction)\n\nSample micro-optimization:\n\n\`\`\`js\n// Batch DOM writes
requestAnimationFrame(()=>{ elements.forEach(el=> el.classList.add('active')); });\n\`\`\`\n`;
}

// ================= Full Site Generation =================
function fullSiteRespond(rawPrompt){
  const wantsTailwind = tailwindPrefToggle?.checked;
  const beginner = beginnerModeToggle?.checked;
  const lower = rawPrompt.toLowerCase();
  const pagesRequested = extractPages(lower);
  const features = detectFeatures(lower);
  const siteName = deriveSiteName(lower);
  const files = buildSiteFiles({ siteName, pagesRequested, features, wantsTailwind, beginner, originalPrompt: rawPrompt });
  renderGeneratedFiles(files);
  injectPreview(files['index.html']);
  enableZip(files);
  const explanation = beginner ? siteBeginnerExplanation({ pagesRequested, features, wantsTailwind }) : siteExpertNotes({ pagesRequested, features, wantsTailwind });
  const gamify = gamifiedHint(features);
  return `${explanation}\n\nGenerated files: ${Object.keys(files).join(', ')}${gamify ? '\n\n' + gamify : ''}`;
}

function extractPages(lower){
  const preset = ['home','about','contact','blog','features','pricing'];
  const found = preset.filter(p=> lower.includes(p));
  return found.length? Array.from(new Set(found)) : ['home','about','contact'];
}
function detectFeatures(lower){
  return {
    darkMode: /dark mode|dark-mode|theme toggle/.test(lower),
    form: /contact|form/.test(lower),
    gallery: /gallery|portfolio|images/.test(lower),
    blog: /blog|posts|articles/.test(lower),
    pricing: /pricing|plans/.test(lower),
    animations: /animate|animation|fade|slide/.test(lower),
    appLayout: /dashboard|approval|workflow|requests|new request|admin/.test(lower)
  };
}
function deriveSiteName(lower){
  const m = lower.match(/(?:called|named|site name is)\s+([a-z0-9\- ]{3,40})/);
  return m? capitalizeWords(m[1].trim()) : 'My Site';
}
function capitalizeWords(str){ return str.split(/\s+/).map(s=> s.charAt(0).toUpperCase()+s.slice(1)).join(' '); }

function buildSiteFiles(ctx){
  const { siteName, pagesRequested, features, wantsTailwind } = ctx;
  if(features.appLayout){
    return buildAppWorkflowFiles(ctx);
  }
  const cssFramework = wantsTailwind ? tailwindCDN() : basicCSSReset();
  const navLinks = pagesRequested.map(p=> `<a href="${p==='home'?'index':p}.html">${capitalizeWords(p)}</a>`).join('\n          ');
  const sharedHead = (title)=>`<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>${title}</title>${wantsTailwind?'\n'+cssFramework: ''}\n<link rel=\"stylesheet\" href=\"styles.css\">`;
  const darkToggle = features.darkMode ? `<button id="themeToggle" class="theme-toggle" aria-label="Toggle theme">🌓</button>` : '';
  const header = (active)=>`<header class="site-header"><div class="container flex-between"><h1 class="logo">${siteName}</h1><nav class="nav">${navLinks}</nav>${darkToggle}</div></header>`;
  const footer = `\n<footer class="site-footer"><div class="container">© ${new Date().getFullYear()} ${siteName}. Built with the AI Assistant.</div></footer>`;
  const scripts = siteScripts(features);
  const pages = {};
  pagesRequested.forEach(p=>{
    const body = pageBody(p, features, siteName);
    const fileName = p==='home'? 'index.html': `${p}.html`;
    pages[fileName] = `<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n${sharedHead(`${siteName} – ${capitalizeWords(p)}`)}\n</head>\n<body>\n${header(p)}\n<main class="main">${body}</main>${footer}\n<script src=\"site.js\"></script>\n</body>\n</html>`;
  });
  pages['styles.css'] = wantsTailwind ? tailwindLayerCSS(features) : baseStylesCSS(features);
  pages['site.js'] = scripts;
  return filesSort(pages);
}

function filesSort(obj){ return Object.fromEntries(Object.entries(obj).sort(([a],[b])=> a.localeCompare(b))); }
function tailwindCDN(){ return `<script src=\"https://cdn.tailwindcss.com?plugins=forms,typography\"></script>`; }
function basicCSSReset(){ return ''; }

function baseStylesCSS(features){
  return `/* Base site styles (no framework) */\n:root { --bg:#ffffff; --fg:#1f2937; --accent:#2563eb; --radius:10px; --transition:.3s; }\nbody { margin:0; font-family: system-ui, 'Inter', Arial, sans-serif; background:var(--bg); color:var(--fg); line-height:1.5; }\na { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }\n.container { width:100%; max-width:1080px; margin:0 auto; padding:0 1rem; }\n.flex-between { display:flex; align-items:center; justify-content:space-between; gap:1rem; }\n.site-header { position:sticky; top:0; background:rgba(255,255,255,0.9); backdrop-filter:blur(8px); border-bottom:1px solid #e2e8f0; }\n.nav a { padding:1rem .75rem; display:inline-block; font-weight:500; }\n.nav a:hover, .nav a:focus { background:#eff6ff; border-radius:6px; }\n.logo { font-size:1.15rem; letter-spacing:.5px; }\n.main { padding:2.5rem 0 3.5rem; min-height:60vh; }\n.hero { text-align:center; padding:3rem 0 3.5rem; }\n.hero h2 { font-size: clamp(1.85rem, 4vw, 3rem); margin:.5rem 0 1rem; }\n.grid { display:grid; gap:1.5rem; }\n@media(min-width:760px){ .grid.cols-3 { grid-template-columns:repeat(3,1fr);} .grid.cols-2 { grid-template-columns:repeat(2,1fr);} }\n.card { border:1px solid #e2e8f0; padding:1.1rem 1.15rem; border-radius:var(--radius); background:#fff; box-shadow:0 2px 4px rgba(0,0,0,.04); transition:box-shadow var(--transition), transform var(--transition); }\n.card:hover { box-shadow:0 6px 18px -4px rgba(0,0,0,.18); transform:translateY(-2px); }\n.site-footer { background:#111827; color:#f1f5f9; font-size:.8rem; padding:2rem 0; margin-top:2rem; }\n.site-footer a { color:#93c5fd; }\nform.contact-form { display:grid; gap:.85rem; max-width:540px; }\nform.contact-form label { font-size:.75rem; font-weight:600; letter-spacing:.5px; text-transform:uppercase; }\nform.contact-form input, form.contact-form textarea { width:100%; padding:.75rem .85rem; border:1px solid #d1d5db; font:inherit; border-radius:8px; background:#fff; }\nform.contact-form input:focus, form.contact-form textarea:focus { outline:3px solid #bfdbfe; outline-offset:1px; }\nbutton.btn { background:var(--accent); color:#fff; border:0; padding:.85rem 1.25rem; font-weight:600; border-radius:8px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,.18); }\nbutton.btn:hover { filter:brightness(.95);}\n.theme-toggle { margin-left:1rem; background:#1f2937; color:#f8fafc; border:0; padding:.65rem .85rem; border-radius:8px; cursor:pointer; }\n.dark body, body.dark { --bg:#0f172a; --fg:#f1f5f9; }\nbody.dark .site-header { background:rgba(15,23,42,0.85); border-color:#1e293b; }\nbody.dark .card { background:#1e293b; border-color:#334155; }\nbody.dark .card:hover { box-shadow:0 6px 18px -4px rgba(0,0,0,.6); }\nbody.dark form.contact-form input, body.dark form.contact-form textarea { background:#0f172a; color:#f1f5f9; border-color:#334155; }\n${features.animations? animationCSS():''}`;
}
function tailwindLayerCSS(features){ return `/* Tailwind layer overrides */\n@layer utilities { .hero-gradient{ @apply bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900; } }\n${features.animations? animationCSS():''}`; }
function animationCSS(){ return `@keyframes fade-up { from{ opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }\n.fade-up { animation:fade-up .75s ease both; }`; }

function pageBody(name, features, siteName){
  switch(name){
    case 'home': return `<section class="hero ${features.animations?'fade-up':''}"><p class="eyebrow">Welcome</p><h2>${siteName}</h2><p class="lead">A modern starter generated for you. Customize components, styling, and structure.</p><div class="grid cols-3" style="margin-top:2.25rem;">${[1,2,3].map(i=> `<div class=card><h3>Feature ${i}</h3><p>Describe an advantage or capability here to help visitors understand value.</p></div>`).join('')}</div></section>`;
    case 'about': return `<article class="prose"><h2>About Us</h2><p>This page outlines mission, story, and differentiators. Generated automatically—edit content to reflect your authentic brand voice.</p></article>`;
    case 'contact': return features.form ? contactFormHTML() : `<div><h2>Contact</h2><p>Email us at <a href=\"mailto:hello@example.com\">hello@example.com</a>.</p></div>`;
    case 'blog': return features.blog ? blogListingHTML() : `<div><h2>Blog</h2><p>Blog feature not requested; enable by mentioning 'blog posts'.</p></div>`;
    case 'pricing': return features.pricing ? pricingHTML() : `<div><h2>Pricing</h2><p>No pricing tiers requested. Add 'pricing plans' in your prompt.</p></div>`;
    case 'features': return `<section><h2>Platform Features</h2><div class="grid cols-3" style="margin-top:1.5rem;">${[1,2,3,4,5,6].map(i=> `<div class=card><h3>Capability ${i}</h3><p>A quick benefit statement helps reinforce value.</p></div>`).join('')}</div></section>`;
    default: return `<div><h2>${capitalizeWords(name)}</h2><p>Basic page placeholder.</p></div>`;
  }
}
function contactFormHTML(){ return `<section><h2>Contact Us</h2><form class="contact-form" id="contactForm" novalidate><div><label for="cName">Name</label><input id="cName" name="name" required placeholder="Jane Doe"></div><div><label for="cEmail">Email</label><input id="cEmail" type="email" name="email" required placeholder="you@example.com"></div><div><label for="cMsg">Message</label><textarea id="cMsg" name="message" rows="5" required placeholder="How can we help?"></textarea></div><button class="btn" type="submit">Send</button><p class="form-status" aria-live="polite"></p></form></section>`; }
function blogListingHTML(){ return `<section><h2>Latest Articles</h2><div class="grid cols-2" style="margin-top:1.5rem;">${[1,2,3,4].map(i=> `<article class=card><h3>Post Title ${i}</h3><p>Short teaser content to entice a click. Summarize core insight.</p><a href=\"#\" aria-label=\"Read Post Title ${i}\">Read more →</a></article>`).join('')}</div></section>`; }
function pricingHTML(){ return `<section><h2>Pricing Plans</h2><div class="grid cols-3" style="margin-top:1.5rem;">${['Starter','Pro','Enterprise'].map((tier,i)=> `<div class=card><h3>${tier}</h3><p><strong>${i===0?'Free': i===1?'$19/mo':'Custom'}</strong></p><ul><li>Feature A</li><li>Feature B</li><li>Priority ${i>0?'✔':'–'}</li></ul><button class="btn" type="button">Choose</button></div>`).join('')}</div></section>`; }

function siteScripts(features){ return `// Site interactivity\n(function(){\n  const darkEnabled = ${features.darkMode};\n  if(darkEnabled){\n    const toggle = document.getElementById('themeToggle');\n    const apply = (mode)=>{ document.documentElement.classList.toggle('dark', mode==='dark'); };\n    const stored = localStorage.getItem('site-theme');\n    if(stored) apply(stored);\n    toggle?.addEventListener('click', ()=>{\n      const next = document.documentElement.classList.contains('dark')? 'light' : 'dark';\n      apply(next); localStorage.setItem('site-theme', next);\n    });\n  }\n  const form = document.getElementById('contactForm');\n  form?.addEventListener('submit', e=>{\n    e.preventDefault();\n    const status = form.querySelector('.form-status');\n    status.textContent='Sending…';\n    setTimeout(()=>{ status.textContent='Message sent (mock)!'; form.reset(); }, 600);\n  });\n})();`; }

function siteBeginnerExplanation({ pagesRequested, features, wantsTailwind }){ return `We'll build a simple multi-page site with navigation linking: ${pagesRequested.join(', ')}. ${wantsTailwind? 'Tailwind utilities are loaded from a CDN for rapid styling.' : 'A handcrafted CSS baseline provides layout, cards, and responsive grid.'}\nKey features included:${Object.entries(features).filter(([k,v])=>v).map(([k])=> `\n- ${capitalizeWords(k)} support`).join('') || '\n- Basic static content'}\nYou can open each generated file, copy it, or download as a bundle.`; }
function siteExpertNotes({ pagesRequested, features, wantsTailwind }){ return `Pages: ${pagesRequested.join(', ')} | Framework: ${wantsTailwind? 'Tailwind CDN':'Vanilla CSS'} | Features: ${Object.entries(features).filter(([k,v])=>v).map(([k])=>k).join(', ') || 'none'}\nArchitecture: static multi-page with shared header/footer + progressive enhancement (theme toggle, mock form). Accessibility: semantic headings, focusable links, aria-live feedback for form.`; }
function gamifiedHint(features){ const unlocked = Object.values(features).filter(Boolean).length; if(unlocked >= 3) return `<span class=\"level-up-badge\">Level Up: Multi-Feature Site!</span>`; if(features.animations) return `<span class=\"level-up-badge\">Animation Boost!</span>`; return ''; }

function renderGeneratedFiles(files){ if(!generatedFilesContainer) return; const frag = document.createDocumentFragment(); Object.entries(files).forEach(([name, content])=>{ const div = document.createElement('div'); div.className='gen-file'; const title = document.createElement('h4'); title.textContent = name; const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = content.slice(0, 4000); pre.appendChild(code); const actions = document.createElement('div'); actions.className='actions'; const copyBtn = document.createElement('button'); copyBtn.type='button'; copyBtn.textContent='Copy'; copyBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(content).then(()=> showToast('Copied '+name)); }); actions.appendChild(copyBtn); div.appendChild(title); div.appendChild(pre); div.appendChild(actions); frag.appendChild(div); }); generatedFilesContainer.innerHTML=''; generatedFilesContainer.appendChild(frag); }
function injectPreview(indexHtml){ if(!sitePreview) return; const doc = sitePreview.contentDocument || sitePreview.contentWindow.document; doc.open(); doc.write(indexHtml); doc.close(); }
function enableZip(files){ if(!downloadSiteBtn) return; downloadSiteBtn.disabled = false; downloadSiteBtn.onclick = ()=> downloadZipClient(files); }
async function downloadZipClient(files){ if(window.JSZip){ const zip = new window.JSZip(); Object.entries(files).forEach(([n,c])=> zip.file(n,c)); const blob = await zip.generateAsync({type:'blob'}); triggerDownload(blob, 'site.zip'); } else { const blob = new Blob([JSON.stringify(files, null, 2)], {type:'application/json'}); triggerDownload(blob, 'site-files.json'); showToast('JSZip not loaded – delivered JSON instead'); } }
function triggerDownload(blob, filename){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(()=> URL.revokeObjectURL(a.href), 2000); }

// ================= App Workflow Layout (Sidebar + Header) =================
function buildAppWorkflowFiles(ctx){
  const { siteName } = ctx;
  const pages = {
    'index.html': appShellPage({ siteName, pageId:'requests', title:'Requests', body: appRequestsTable() }),
    'new-request.html': appShellPage({ siteName, pageId:'new-request', title:'New Request', body: appNewRequestForm() }),
    'dashboard.html': appShellPage({ siteName, pageId:'dashboard', title:'Dashboard', body: appDashboard() }),
    'admin.html': appShellPage({ siteName, pageId:'admin', title:'Admin', body: appAdmin() }),
    'settings.html': appShellPage({ siteName, pageId:'settings', title:'Settings', body: appSettings() })
  };
  pages['app.css'] = appStyles();
  pages['app.js'] = appClientScript();
  return filesSort(pages);
}

function appShellPage({ siteName, pageId, title, body }){
  return `<!DOCTYPE html>\n<html lang=\"en\" data-page=\"${pageId}\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>${siteName} – ${title}</title>\n<link rel=\"stylesheet\" href=\"app.css\">\n</head>\n<body class=\"app-root\">\n<aside class=\"sidebar\">\n  <div class=\"brand-mini\">${siteName}</div>\n  <nav class=\"nav-vertical\">\n    <a href=\"index.html\" data-nav=\"requests\">Requests</a>\n    <a href=\"new-request.html\" data-nav=\"new-request\">New Request</a>\n    <a href=\"dashboard.html\" data-nav=\"dashboard\">Dashboard</a>\n    <a href=\"admin.html\" data-nav=\"admin\">Admin</a>\n    <a href=\"settings.html\" data-nav=\"settings\">Settings</a>\n    <a href=\"#logout\" data-nav=\"logout\" class=\"logout-link\">Logout</a>\n  </nav>\n</aside>\n<header class=\"app-header-bar\">\n  <h1 class=\"page-title\">${title}</h1>\n  <div class=\"header-actions\"><button id=\"themeSwitch\" class=\"btn-xs\">🌓</button></div>\n</header>\n<main class=\"app-main\">${body}</main>\n<script src=\"app.js\"></script>\n</body>\n</html>`;
}

function appStyles(){
  return `/* App Workflow Layout */\n:root { --bg:#0f172a; --bg-alt:#1e293b; --panel:#162132; --border:#243044; --text:#e2e8f0; --text-dim:#94a3b8; --accent:#3b82f6; --danger:#ef4444; --radius:8px; --shadow:0 2px 4px -1px rgba(0,0,0,.5); }\n*{box-sizing:border-box;} body,html{margin:0;padding:0;font-family:system-ui, 'Inter', sans-serif;background:var(--bg);color:var(--text);} a{text-decoration:none;color:inherit;}\n.app-root{display:grid;grid-template-columns:220px 1fr;grid-template-rows:56px 1fr;min-height:100vh;}\n.sidebar{grid-row:1 / span 2;background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;gap:.75rem;padding:.75rem .75rem 1.25rem;}\n.brand-mini{font-weight:600;font-size:1rem;padding:.5rem .65rem;border:1px solid var(--border);border-radius:var(--radius);text-align:center;background:linear-gradient(135deg,#1e293b,#0f172a);}\n.nav-vertical{display:flex;flex-direction:column;gap:.35rem;margin-top:.5rem;}\n.nav-vertical a{padding:.6rem .65rem;border-radius:6px;font-size:.75rem;letter-spacing:.5px;color:var(--text-dim);display:flex;align-items:center;gap:.5rem;}\n.nav-vertical a:hover{background:#243044;color:var(--text);}\n.nav-vertical a.active{background:var(--accent);color:#fff;font-weight:600;box-shadow:var(--shadow);}\n.logout-link{margin-top:auto;color:#fca5a5;}\n.app-header-bar{grid-column:2;display:flex;align-items:center;justify-content:space-between;padding:0 1rem;background:var(--panel);border-bottom:1px solid var(--border);}\n.page-title{font-size:1rem;font-weight:600;margin:0;}\n.app-main{grid-column:2;padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1.25rem;overflow:auto;}\n.card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;box-shadow:var(--shadow);}\n.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius);} table{border-collapse:collapse;width:100%;font-size:.7rem;} th,td{padding:.6rem .75rem;text-align:left;white-space:nowrap;} thead{background:#182437;} tbody tr:nth-child(even){background:#152031;} tbody tr:hover{background:#1d2a3b;} th{font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;font-size:.6rem;}\n.badge{display:inline-block;padding:2px 6px;font-size:.55rem;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:500;letter-spacing:.5px;}\n.badge.alt{background:#334155;}\n.lvl{background:#334155;font-size:.5rem;padding:2px 5px;border-radius:10px;letter-spacing:.5px;margin-right:4px;}\n.btn, .btn-xs{background:var(--accent);color:#fff;border:0;cursor:pointer;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:.35rem;} .btn{padding:.65rem .9rem;font-size:.7rem;} .btn-xs{padding:.4rem .55rem;font-size:.6rem;} .btn.secondary{background:#334155;} .btn:hover{filter:brightness(.95);}\n.form-grid{display:grid;gap:1rem;max-width:680px;} label span{display:block;font-size:.55rem;letter-spacing:.5px;font-weight:600;color:var(--text-dim);margin-bottom:4px;text-transform:uppercase;} input[type=text], select, textarea{width:100%;background:#152032;border:1px solid var(--border);color:var(--text);font:inherit;padding:.65rem .75rem;border-radius:6px;} textarea{resize:vertical;min-height:140px;} input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:2px;}\n.level-badges{display:flex;gap:.35rem;}\n.stats-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));} .stat{background:var(--panel);border:1px solid var(--border);padding:.85rem .9rem;border-radius:var(--radius);display:flex;flex-direction:column;gap:.4rem;font-size:.65rem;} .stat h3{margin:0;font-size:.6rem;text-transform:uppercase;letter-spacing:.5px;font-weight:600;color:var(--text-dim);} .stat .num{font-size:1.4rem;font-weight:600;}\n.chart-area{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));} .chart-placeholder{height:220px;display:flex;align-items:center;justify-content:center;background:#152032;border:1px dashed #334155;border-radius:var(--radius);font-size:.6rem;color:var(--text-dim);}\n@media(max-width:1000px){ .app-root{grid-template-columns:70px 1fr;} .brand-mini{font-size:.55rem;padding:.4rem;} .nav-vertical a{font-size:.55rem;padding:.55rem .5rem;} .nav-vertical a span.txt{display:none;} }`;
}
function appRequestsTable(){ return `<section class=card><div class=\"table-wrap\"><table><thead><tr><th>Title</th><th>Requester</th><th>Office</th><th>Created</th><th>Status</th><th>Levels</th><th>Current Level</th><th>Actions</th></tr></thead><tbody id=\"reqRows\"></tbody></table></div></section>`; }
function appNewRequestForm(){ return `<form class=\"form-grid card\" id=\"newReqForm\"><h2 style=\"margin:0 0 .5rem;font-size:.85rem;\">New Request</h2><label><span>Name</span><input type=text name=name required placeholder=\"Your name\"></label><label><span>Title</span><input type=text name=title required></label><label><span>Office</span><select name=office required><option value=\"\">Select...</option><option>Office 1</option><option>Office 2</option></select></label><label style=\"grid-column:1/-1\"><span>Description</span><textarea name=desc required></textarea></label><div style=\"grid-column:1/-1\"><button class=btn type=submit>Create Request</button> <button class=\"btn secondary\" type=reset>Reset</button></div></form>`; }
function appDashboard(){ return `<div class=\"stats-grid\"><div class=stat><h3>Total Submitted</h3><div class=num id=statTotal>0</div></div><div class=stat><h3>Pending</h3><div class=num id=statPending>0</div></div><div class=stat><h3>Approved</h3><div class=num id=statApproved>0</div></div><div class=stat><h3>Disapproved</h3><div class=num id=statRejected>0</div></div></div><div class=\"chart-area\"><div class=chart-placeholder id=chartStatus>Status Breakdown</div><div class=chart-placeholder id=chartWorkload>Per Approver Workload</div></div>`; }
function appAdmin(){ return `<section class=card><h2 style=\"margin-top:0;font-size:.85rem;\">Admin</h2><p style=\"font-size:.65rem;\">Placeholder for user / role management configuration.</p></section>`; }
function appSettings(){ return `<section class=card><h2 style=\"margin-top:0;font-size:.85rem;\">Settings</h2><p style=\"font-size:.65rem;\">Toggle preferences, notification settings, theme, etc.</p></section>`; }
function appClientScript(){ return `// App workflow interactivity\n(function(){\n  const page = document.documentElement.getAttribute('data-page');\n  document.querySelectorAll('[data-nav]').forEach(a=>{ if(a.dataset.nav===page) a.classList.add('active'); });\n  document.getElementById('themeSwitch')?.addEventListener('click', ()=>{ document.body.classList.toggle('alt-theme'); });\n  const storeKey = 'app-requests-v1'; let requests = []; try { requests = JSON.parse(localStorage.getItem(storeKey))||[]; } catch{}\n  function persist(){ localStorage.setItem(storeKey, JSON.stringify(requests)); }\n  function fmtDate(d){ return new Date(d).toLocaleString(); }\n  function renderTable(){ const tbody=document.getElementById('reqRows'); if(!tbody) return; tbody.innerHTML=''; requests.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=\`<td>\${r.title}</td><td>\${r.name}</td><td>\${r.office}</td><td>\${fmtDate(r.created)}</td><td><span class=\\"badge\\">\${r.status}</span></td><td><span class=\\"lvl\\">L1 ANY</span><span class=\\"lvl\\">L2 ALL</span></td><td>L1</td><td><button class=\\"btn-xs secondary\\" data-open=\\"\${r.id}\\">Open</button></td>\`; tbody.appendChild(tr); }); updateStats(); }\n  function updateStats(){ const total=requests.length; const pending=requests.filter(r=>r.status==='Pending').length; const approved=requests.filter(r=>r.status==='Approved').length; const rejected=requests.filter(r=>r.status==='Disapproved').length; const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; }; set('statTotal', total); set('statPending', pending); set('statApproved', approved); set('statRejected', rejected); }\n  const form=document.getElementById('newReqForm'); form?.addEventListener('submit', e=>{ e.preventDefault(); const fd=new FormData(form); const rec={ id:crypto.randomUUID(), name:fd.get('name')||'Anon', title:fd.get('title')||'Untitled', office:fd.get('office')||'', desc:fd.get('desc')||'', created:Date.now(), status:'Pending' }; requests.unshift(rec); persist(); form.reset(); if(confirm('Request created. Go to Requests list?')) window.location.href='index.html'; });\n  if(!requests.length){ requests.push({ id:crypto.randomUUID(), name:'Alice Johnson', title:'Purchase Laptop', office:'Office 1', desc:'Need a new dev laptop', created:Date.now(), status:'Pending' }); persist(); }\n  renderTable();\n})();`; }

// ---------------- PowerApps (Power Fx) Support ----------------
function powerAppsRespond(prompt){
  const lower = prompt.toLowerCase();
  const parts = [];
  if(/patch/.test(lower)) parts.push(powerFxPatchGuide());
  if(/filter|search/.test(lower)) parts.push(powerFxFilterGuide());
  if(/navigate|screen transition/.test(lower)) parts.push(powerFxNavigateGuide());
  if(/dataverse|table|column|choice|lookup/.test(lower)) parts.push(dataverseGuide());
  if(/component|reusable/.test(lower)) parts.push(componentGuide());
  if(parts.length === 0) parts.push(generalPowerAppsIntro());
  return parts.join('\n---\n');
}

function generalPowerAppsIntro(){
  return `General PowerApps overview (Canvas + Power Fx):\n\nKey domains:\n- Data layer (Dataverse, SharePoint, Excel, SQL, connectors)\n- UI layer (screens, controls, components)\n- Behavior (Power Fx formulas on events: OnSelect, OnVisible, OnChange)\n- State (global: Set, context: UpdateContext / Navigate params, collections: ClearCollect)\n- ALM (solutions, environments, environment variables)\n\nStarter patterns:\n\n\`\`\`powerfx\n// Global variable\nSet(gvUser, User());\n// Context variable on screen OnVisible\nUpdateContext({ isLoading: true });\n// Collection from source\nClearCollect(colProducts, Filter(Products, Active = true));\n// Use of With to simplify formula\nWith( { q: Trim(txtSearch.Text) }, Filter(colProducts, StartsWith(Title, q)))\n\`\`\`\n`;
}

function powerFxFilterGuide(){
  return `Filtering / Searching data:\n\n\`\`\`powerfx\n// Basic Filter by equality\nFilter(Assets, Status = drpStatus.Selected.Value)\n\n// StartsWith for delegation friendly search (Dataverse)\nFilter(Assets, StartsWith(Title, txtSearch.Text))\n\n// Multiple conditions\nFilter(Assets, Status = drpStatus.Selected.Value && Quantity > Value(txtMinQty.Text))\n\n// Sort & paginate (client side example)\nFirstN( Skip( SortByColumns(Filter(Assets, Active = true), "Title"), varPageIndex * 25 ), 25 )\n\`\`\`\nTips:\n- Prefer StartsWith over In for delegable search in Dataverse.\n- Chain Filter before SortByColumns.\n- Use variables for repeated expressions to keep formulas readable.`;
}

function powerFxPatchGuide(){
  return `Creating / Updating records with Patch:\n\n\`\`\`powerfx\n// Create new record\nPatch(Assets, Defaults(Assets), {\n    Title: txtTitle.Text,\n    Status: drpStatus.Selected.Value,\n    Quantity: Value(txtQty.Text),\n    Owner: LookUp(Users, 'Primary Email' = User().Email)\n});\n\n// Update selected gallery item\nPatch(Assets, galAssets.Selected, { Status: "Archived" });\n\n// Upsert by alternate key\nPatch(Assets, { AssetId: Value(txtAssetId.Text) }, { Title: txtTitle.Text });\n\`\`\`\nBest practices:\n- Validate inputs before Patch (IsBlank, IsError).\n- Use Notify() for user feedback.\n- For bulk operations combine ForAll + Patch cautiously (beware of non-delegation).`;
}

function powerFxNavigateGuide(){
  return `Screen navigation & parameters:\n\n\`\`\`powerfx\n// Navigate with transition & context\nNavigate(scrDetails, ScreenTransition.Fade, { record: galAssets.Selected });\n\n// Access passed context variable on destination screen\n// e.g., OnVisible of scrDetails:\nUpdateContext({ current: Param("record") });\n\`\`\`\nNotes:\n- Prefer Navigate parameters instead of global Set for transient context.\n- Use Back() for modal-like return; consider variables to preserve scroll position.`;
}

function dataverseGuide(){
  return `Dataverse considerations:\n- Use Choice.Value for choice columns; .Label for multi-language.\n- Use LookUp(Table, Id = GUID) for single record fetch; prefer Filter for delegation.\n- Avoid non-delegable functions early in formula; they truncate results.\n- Monitor delegation warnings (blue underline).\n- Limit columns with ShowColumns() when patching large tables.`;
}

function componentGuide(){
  return `Reusable components:\n\nPattern:\n\n\`\`\`powerfx\n// Inside component: expose custom property Items (input) & OnSelect (behavior)\n// Use Self for component-scope references\nIf(!IsEmpty(Items), First(Items).Title)\n\`\`\`\nGuidelines:\n- Use clearly named input/output custom properties.\n- Avoid global Set inside components; pass state via properties.\n- Document the expected data shape with comments.`;
}

async function handleSubmit(e){
  e.preventDefault();
  const value = userInput.value.trim();
  if(!value) return;
  // Build extended prompt with image context (not shown to user) if references present
  const imageRefs = extractImageRefs(value);
  let fullPrompt = value;
  if(imageRefs.length){
    const contextLines = imageRefs.map(r=>`- ${r.label} (${r.width||'?'}x${r.height||'?'}, ${r.sizeKB||'?'} KB)`);
    fullPrompt += `\n\n[Image context]\n${contextLines.join('\n')}`;
  }
  addUserMessage(value); // show only original text
  userInput.value='';
  setLoading(true);
  await sleep(randomInt(250, 650));
  const response = mockRespond(fullPrompt, modeSelect.value);
  addAssistantMessage(response);
  setLoading(false);
}

function setLoading(state){
  if(state){
    sendBtn.disabled=true; sendBtn.textContent='...';
  } else { sendBtn.disabled=false; sendBtn.textContent='Send'; }
}

function sleep(ms){ return new Promise(r=> setTimeout(r, ms)); }
function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

clearBtn.addEventListener('click', ()=>{
  chatLog.innerHTML='';
  if(memoryToggle.checked) conversation = [];
});

chatForm.addEventListener('submit', handleSubmit);

memoryToggle.addEventListener('change', ()=>{
  if(!memoryToggle.checked){
    conversation = [];
    showToast('Memory off');
  } else showToast('Memory on');
});

themeSelect.addEventListener('change', ()=>{
  document.body.classList.remove('light','dark','matrix');
  document.body.classList.add(themeSelect.value);
  localStorage.setItem('assistant-theme', themeSelect.value);
});

modelSelect.addEventListener('change', ()=>{
  showToast(`Model set: ${modelSelect.value}`);
});

// Export / Import
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(conversation, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chat-session.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  file.text().then(text=>{
    try {
      const data = JSON.parse(text);
      if(Array.isArray(data)){
        conversation = data.slice(-200); // limit
        chatLog.innerHTML='';
        for(const msg of conversation){
          createMessage(msg.role, msg.content);
        }
        showToast('Imported');
      } else throw new Error('Invalid format');
    } catch(err){
      showToast('Import failed');
    }
  });
});

// Snippet buttons
function initSnippets(){
  SNIPPETS.forEach(snippet => {
    const btn = document.createElement('button');
    btn.type='button';
    btn.textContent = snippet.label;
    btn.addEventListener('click', ()=>{
      userInput.value += (userInput.value ? '\n' : '') + snippet.text;
      userInput.focus();
    });
    snippetButtonsContainer.appendChild(btn);
  });
}

function restoreTheme(){
  const stored = localStorage.getItem('assistant-theme');
  if(stored){
    themeSelect.value = stored;
    document.body.classList.add(stored);
  } else { document.body.classList.add('light'); }
}

initSnippets();
restoreTheme();

// Keyboard: Enter to send, Shift+Enter for newline
userInput.addEventListener('keydown', e => {
  if(e.key === 'Enter') {
    if(!e.shiftKey) { // send
      e.preventDefault();
      chatForm.requestSubmit();
    } // else allow newline
  }
});

// Focus first input
userInput.focus();

// Provide an initial greeting
addAssistantMessage('Hi! I\'m your local AI web dev helper. Ask me about HTML semantics, CSS layouts, JS patterns, accessibility, performance, debugging, or request code snippets.');

// ================= Voice Input & Speech Synthesis =================
let recognition;
let recognizing = false;
const AUTO_SEND_ON_FINAL = true;

function initVoice(){
  if(!micBtn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition not supported in this browser.';
    return;
  }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = false; // capture one utterance
  recognition.interimResults = true;

  recognition.onstart = () => {
    recognizing = true;
    micBtn.classList.add('mic-active');
    micBtn.setAttribute('aria-label','Stop voice input');
  };
  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    showToast('Mic error');
  };
  recognition.onend = () => {
    recognizing = false;
    micBtn.classList.remove('mic-active');
    micBtn.setAttribute('aria-label','Start voice input');
  };
  recognition.onresult = (e) => {
    let interim = '';
    let final = '';
    for(let i=0;i<e.results.length;i++){
      const res = e.results[i];
      if(res.isFinal) final += res[0].transcript; else interim += res[0].transcript;
    }
    // Show interim appended lightly (not styling for simplicity)
    if(interim){
      userInput.value = (final ? final : userInput.value.split('\n')[0]) + ' ' + interim;
    }
    if(final){
      userInput.value = (userInput.value.trim() + ' ' + final).trim();
      userInput.focus();
      if(AUTO_SEND_ON_FINAL && userInput.value.trim()){
        chatForm.requestSubmit();
      }
      recognition.stop();
    }
  };

  micBtn.addEventListener('click', () => {
    if(!recognition) return;
    if(recognizing){
      recognition.stop();
    } else {
      try { recognition.start(); } catch(err){ /* start called too soon */ }
    }
  });
}

function speakAssistant(markdownContent){
  if(!speakToggle || !speakToggle.checked) return;
  if(!('speechSynthesis' in window)) return;
  const plain = markdownToPlain(markdownContent).slice(0, 5000); // safety limit
  const utter = new SpeechSynthesisUtterance(plain);
  utter.rate = 1; utter.pitch = 1; utter.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function markdownToPlain(md){
  return md
    .replace(/```[\s\S]*?```/g, ' code block ') // remove fenced code
    .replace(/`[^`]+`/g, ' code ') // inline
    .replace(/[#>*_\-]+/g,' ') // markdown tokens
    .replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1')
    .replace(/\s+/g,' ') // collapse
    .trim();
}

if(micBtn) initVoice();

if(speakToggle){
  speakToggle.addEventListener('change', () => {
    if(speakToggle.checked){
      showToast('Speak replies: on');
      // Optionally speak last assistant message
      for(let i=conversation.length-1;i>=0;i--){
        if(conversation[i].role === 'assistant'){ speakAssistant(conversation[i].content); break; }
      }
    } else {
      window.speechSynthesis?.cancel();
      showToast('Speak replies: off');
    }
  });
}

// ================= Image Reference Support =================
const images = []; // {id, name, slug, dataUrl, width, height, sizeKB}
let imageAutoId = 1;

function slugify(name){ return name.toLowerCase().replace(/\.[^.]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

addImagesBtn?.addEventListener('click', ()=> imageInput?.click());
imageInput?.addEventListener('change', (e)=>{
  const files = Array.from(e.target.files||[]).slice(0,20);
  if(!files.length) return;
  files.forEach(file => {
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        images.push({
          id: imageAutoId++,
            name: file.name,
            slug: uniqueSlug(slugify(file.name)),
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeKB: Math.round(file.size/1024)
        });
        renderImageGallery();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  imageInput.value='';
});

function uniqueSlug(base){
  let s = base || 'image';
  let i = 2;
  while(images.some(im=>im.slug===s)) s = base + '-' + i++;
  return s;
}

clearImagesBtn?.addEventListener('click', ()=>{
  if(!images.length) return;
  images.splice(0, images.length);
  renderImageGallery();
});

function renderImageGallery(){
  if(!imageGallery) return;
  if(!images.length){ imageGallery.innerHTML = '<div class="empty-note">No images</div>'; return; }
  const frag = document.createDocumentFragment();
  images.slice().reverse().forEach(img => {
    const div = document.createElement('button');
    div.type='button';
    div.className='image-thumb';
    div.title = `Insert reference [image:${img.slug}]`;
    div.dataset.slug = img.slug;
    const tagImg = document.createElement('img'); tagImg.src = img.dataUrl; tagImg.alt = img.name;
    const label = document.createElement('span'); label.className='label'; label.textContent = img.slug;
    const rm = document.createElement('span'); rm.className='remove-btn'; rm.textContent='✕'; rm.title='Remove image';
    div.appendChild(tagImg); div.appendChild(label); div.appendChild(rm);
    frag.appendChild(div);
  });
  imageGallery.innerHTML='';
  imageGallery.appendChild(frag);
}

imageGallery?.addEventListener('click', e=>{
  const thumb = e.target.closest('.image-thumb');
  if(!thumb) return;
  const slug = thumb.dataset.slug;
  if(e.target.classList.contains('remove-btn')){
    const idx = images.findIndex(i=>i.slug===slug);
    if(idx>-1){ images.splice(idx,1); renderImageGallery(); }
    return;
  }
  // insert reference token
  const token = `[image:${slug}]`;
  userInput.value += (userInput.value ? ' ' : '') + token;
  userInput.focus();
});

function extractImageRefs(text){
  const ids = [];
  text.replace(/\[image:([a-z0-9\-]+)\]/gi, (m,slug)=>{
    const im = images.find(i=>i.slug===slug);
    if(im) ids.push(im);
  });
  return ids;
}
