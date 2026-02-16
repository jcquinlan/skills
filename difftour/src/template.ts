export interface TemplateData {
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    explanation: string;
    files: string[];
    highlightedDiff: string;
  }>;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtml(data: TemplateData): string {
  const totalSlides = data.sections.length + 1; // +1 for title slide

  const sectionSlides = data.sections
    .map(
      (section, i) => `
    <div class="slide" data-index="${i + 1}">
      <div class="slide-content">
        <div class="prose-panel">
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.explanation)}</p>
          <div class="file-list">${section.files.map((f) => `<span class="file-badge">${escapeHtml(f)}</span>`).join(" ")}</div>
        </div>
        <div class="diff-panel">
          ${section.highlightedDiff}
        </div>
      </div>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.title)} — DiffTour</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;display:flex;flex-direction:column}
.slide{display:none;flex:1;flex-direction:column;justify-content:center;align-items:center;padding:2rem;min-height:calc(100vh - 60px)}
.slide.active{display:flex}
.slide-content{max-width:960px;width:100%}
.title-slide{text-align:center}
.title-slide h1{font-size:2rem;margin-bottom:1rem;color:#e6edf3}
.title-slide .summary{font-size:1.1rem;line-height:1.7;color:#8b949e;max-width:640px;margin:0 auto}
.prose-panel h2{font-size:1.4rem;margin-bottom:0.75rem;color:#e6edf3}
.prose-panel p{font-size:1rem;line-height:1.7;color:#8b949e;margin-bottom:1rem}
.file-list{margin-bottom:1rem}
.file-badge{display:inline-block;background:#161b22;border:1px solid #30363d;border-radius:4px;padding:2px 8px;font-family:"SF Mono",Consolas,"Liberation Mono",Menlo,monospace;font-size:0.8rem;color:#58a6ff;margin-right:0.5rem;margin-bottom:0.25rem}
.diff-panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem;overflow-x:auto;margin-top:0.5rem}
.diff-panel pre{margin:0;font-family:"SF Mono",Consolas,"Liberation Mono",Menlo,monospace;font-size:0.82rem;line-height:1.6;background:transparent!important}
.diff-panel code{background:transparent}
.diff-panel .line{display:block;padding:0 0.5rem}
.diff-panel .line-add{background:rgba(63,185,80,0.10);border-left:3px solid rgba(63,185,80,0.6)}
.diff-panel .line-del{background:rgba(248,81,73,0.10);border-left:3px solid rgba(248,81,73,0.6)}
.diff-panel .line-hdr{color:#6e7681;font-style:italic;padding-top:0.4rem;padding-bottom:0.2rem}
.diff-panel .diff-prefix{color:#484f58;user-select:none;margin-right:0.3rem}
nav{display:flex;align-items:center;justify-content:center;gap:1rem;padding:1rem;background:transparent;border-top:1px solid #21262d;position:fixed;bottom:0;left:0;right:0;height:60px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
nav button{background:rgba(33,38,45,0.6);color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:0.4rem 1.2rem;font-size:0.85rem;cursor:pointer;transition:background 0.15s}
nav button:hover{background:rgba(48,54,61,0.8)}
nav button:disabled{opacity:0.3;cursor:default}
.progress{font-size:0.85rem;color:#6e7681;min-width:60px;text-align:center}
@media(max-width:768px){.slide{padding:1rem}.prose-panel h2{font-size:1.2rem}.diff-panel pre{font-size:0.75rem}}
</style>
</head>
<body>
  <div class="slide title-slide active" data-index="0">
    <div class="slide-content">
      <h1>${escapeHtml(data.title)}</h1>
      <p class="summary">${escapeHtml(data.summary)}</p>
    </div>
  </div>
${sectionSlides}
  <nav>
    <button id="prev-btn" disabled>Prev</button>
    <span class="progress" id="progress">1 / ${totalSlides}</span>
    <button id="next-btn">Next</button>
  </nav>
<script>
(function(){
  var slides=document.querySelectorAll('.slide');
  var current=0;
  var total=slides.length;
  var prevBtn=document.getElementById('prev-btn');
  var nextBtn=document.getElementById('next-btn');
  var progress=document.getElementById('progress');
  function show(idx){
    slides[current].classList.remove('active');
    current=idx;
    slides[current].classList.add('active');
    prevBtn.disabled=current===0;
    nextBtn.disabled=current===total-1;
    progress.textContent=(current+1)+' / '+total;
  }
  prevBtn.addEventListener('click',function(){if(current>0)show(current-1)});
  nextBtn.addEventListener('click',function(){if(current<total-1)show(current+1)});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft'&&current>0)show(current-1);
    if(e.key==='ArrowRight'&&current<total-1)show(current+1);
  });
})();
</script>
</body>
</html>`;
}
