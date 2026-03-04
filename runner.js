(function () {
  'use strict';
      // ── Build sidebar nav from sections ──
      // so it is intentionally excluded from sidebar navigation.
      // Note: the roadmap section uses id="roadmap" but lacks the `.section` class,
      const sections = document.querySelectorAll('.section[id]');
      const sidebar = document.getElementById('sidebarNav');
      const links = [];

      sections.forEach(sec => {
        const num = sec.id.replace('s', '');
        const a = document.createElement('a');
        a.href = '#' + sec.id;
        a.textContent = num.padStart(2, '0');
        a.dataset.section = sec.id;
        sidebar.appendChild(a);
        links.push(a);
      });

      // ── Scroll-spy: highlight active section ──
      const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
          const link = sidebar.querySelector(`a[data-section="${e.target.id}"]`);
          if (link) link.classList.toggle('active', e.isIntersecting);
        });
      }, { rootMargin: '-10% 0px -80% 0px' });

      sections.forEach(s => observer.observe(s));
      window._sectionObserver = observer; // expose for cleanup

      // ── Back to top button ──
      const topBtn = document.getElementById('backToTop');
      window.addEventListener('scroll', () => {
        topBtn.classList.toggle('visible', window.scrollY > 500);
      }, { passive: true });
      topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

      // ── Theme toggle ──
      const themeBtn = document.getElementById('themeToggle');
      const saved = localStorage.getItem('theme');
      // Apply saved theme on load — validate before writing to DOM
      const VALID_THEMES = new Set(['light', 'dark', '']);
      if (saved !== null && VALID_THEMES.has(saved)) {
        document.documentElement.dataset.theme = saved;
      }
      themeBtn.setAttribute('aria-pressed', document.documentElement.dataset.theme !== 'light' ? 'true' : 'false');

      // Listen for clicks
      themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.dataset.theme === 'light';

        // Toggle the HTML attribute
        document.documentElement.dataset.theme = isLight ? '' : 'light';
        themeBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
        // Save to local storage
        localStorage.setItem('theme', isLight ? '' : 'light');
      });

      // ── Collapsible scenario cards ──
      document.querySelectorAll('.scenario-title').forEach(title => {
        title.addEventListener('click', () => {
          const scenario = title.closest('.scenario');
          scenario.classList.toggle('collapsed');
          title.setAttribute('aria-expanded', !scenario.classList.contains('collapsed') ? 'true' : 'false');
        });
        title.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); title.click(); }
        });
      });

      // ── Collapse/Expand all toggle per section ──
      document.querySelectorAll('.section-header').forEach(header => {
        const btn = document.createElement('button');
        btn.className = 'section-toggle';
        btn.textContent = 'collapse all';
        btn.addEventListener('click', () => {
          const section = header.closest('.section');
          const scenarios = section.querySelectorAll('.scenario');
          const allCollapsed = [...scenarios].every(s => s.classList.contains('collapsed'));
          scenarios.forEach(s => {
            if (allCollapsed) {
              s.classList.remove('collapsed');
              s.querySelector('.scenario-title')?.setAttribute('aria-expanded', 'true');
            } else {
              s.classList.add('collapsed');
              s.querySelector('.scenario-title')?.setAttribute('aria-expanded', 'false');
            }
          });
          btn.textContent = allCollapsed ? 'collapse all' : 'expand all';
        });
        header.appendChild(btn);
      });

      // ── Copy buttons on code blocks ──
      document.querySelectorAll('pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'copy';
        btn.setAttribute('aria-label', 'Copy code to clipboard');
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const clone = pre.cloneNode(true);
          const btnInClone = clone.querySelector('.copy-btn');
          if (btnInClone) btnInClone.remove();
          const text = clone.textContent.trim();
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✓';
            btn.classList.add('copied');
            setTimeout(() => {
              if (document.contains(btn)) {
                btn.textContent = 'copy';
                btn.classList.remove('copied');
              }
            }, 1500);
          }).catch(() => {
            btn.textContent = '✗ failed';
            setTimeout(() => {
              if (document.contains(btn)) btn.textContent = 'copy';
            }, 1500);
        });
        pre.appendChild(btn);
      });

    // Overlay show/hide via data-overlay-* attributes (replaces inline onclick)
    let lastFocusedElement = null;
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-overlay-show],[data-overlay-hide]');
      if (!btn) return;
      const toHide = btn.dataset.overlayHide;
      const toShow = btn.dataset.overlayShow;

      if (toShow && !toHide) {
        lastFocusedElement = document.activeElement;
      }

      if (toHide) {
        const el = document.getElementById(toHide);
        if (el) el.style.display = 'none';
      }
      if (toShow) {
        const el = document.getElementById(toShow);
        if (el) {
          el.style.display = 'flex';
          const focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }
      }

      if (toHide && !toShow && lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
      }
    });
}());
      // ═══════════════════════════════════════════════════════════════════
      // PYTHON RUNNER — Pyodide-powered in-browser execution
      // ═══════════════════════════════════════════════════════════════════
      (function () {
        'use strict';

        // ── Package load state ────────────────────────────────────────────
        let _pyodide = null;
        let _loadPromise = null;
        let _mplReady = false;
        let _pandasReady = false;
        let _scipyReady = false;

        // ── Toast helper ──────────────────────────────────────────────────
        const toast = document.createElement('div');
        toast.id = 'py-toast';
        toast.innerHTML = '<div class="py-spinner"></div><span id="py-toast-msg"></span>';
        document.body.appendChild(toast);

        function toastShow(msg) {
          document.getElementById('py-toast-msg').textContent = msg;
          toast.classList.add('on');
        }
        function toastHide() { toast.classList.remove('on'); }

        // ── Pyodide loader ────────────────────────────────────────────────
        async function getPy() {
          if (_pyodide) return _pyodide;
          if (!_loadPromise) {
            toastShow('Loading Python runtime…');
            _loadPromise = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' })
              .then(async py => {
                _pyodide = py;

                // Set up stdout/stderr capture + REPL-style code runner
                await py.runPythonAsync(`
import sys, io, ast, traceback as _tb

class _Buf(io.StringIO):
    def getvalue_reset(self):
        v = self.getvalue(); self.seek(0); self.truncate(0); return v

_cap_out = _Buf()
_cap_err = _Buf()
sys.stdout = _cap_out
sys.stderr = _cap_err

def _run(code):
    ns = {}
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return '', 'SyntaxError: ' + str(e), None

    last_repr = None
    try:
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            expr = tree.body.pop()
            last_tree = ast.Expression(body=expr.value)
            ast.fix_missing_locations(last_tree)
            if tree.body:
                exec(compile(tree, '<snippet>', 'exec'), ns)
            val = eval(compile(last_tree, '<snippet>', 'eval'), ns)
            if val is not None:
                last_repr = repr(val)
        else:
            exec(compile(tree, '<snippet>', 'exec'), ns)
    except Exception:
        out = _cap_out.getvalue_reset()
        err = _cap_err.getvalue_reset()
        raw = _tb.format_exc()
        # Trim noisy pyodide paths, keep the useful part
        lines = raw.splitlines()
        kept = [l for l in lines if not l.strip().startswith('File "<snippet>"')
                and 'in <module>' not in l and l.strip() != 'Traceback (most recent call last):']
        clean = chr(10).join(kept).strip() or raw.strip()
        return out, (err + clean).strip(), None

    return _cap_out.getvalue_reset(), _cap_err.getvalue_reset(), last_repr
`);

                // Write mock files so file-I/O snippets can open them
                const mocks = {
                  'my_text_file.txt': '4.0\n7.5\n2.1\n9.3\n1.2\n5.6\n8.8\n3.3\n6.7\n0.9\n',
                  'some_data.txt': 'name,address,house_number\nsanne,maastricht,62\nalice,amsterdam,14\nbob,rotterdam,7\ncarol,eindhoven,33\n',
                  'data.csv': 'name,age,grade\nAlice,21,8.5\nBob,25,7.0\nCarol,19,9.2\nDave,22,6.1\n',
                  'output.txt': '',
                };
                for (const [name, data] of Object.entries(mocks)) {
                  try { py.FS.writeFile('/home/pyodide/' + name, data); } catch { }
                  try { py.FS.writeFile(name, data); } catch { }
                }
                // Generate open.txt (8-channel EEG-like, 20 rows for demo)
                await py.runPythonAsync(`
import math, os
os.makedirs('/home/pyodide', exist_ok=True)
rows = [' '.join(f'{math.sin(r*0.2+c)*2.1:.4f}' for c in range(8)) for r in range(20)]
with open('open.txt','w') as f: f.write(chr(10).join(rows)+chr(10))
`);

                toastHide();
                return py;
              })
              .catch(e => { toastHide(); _loadPromise = null; throw e; });
          }
          return _loadPromise;
        }

        // ── Code text extraction ──────────────────────────────────────────
        function getCode(pre) {
          const clone = pre.cloneNode(true);
          clone.querySelectorAll('button').forEach(b => b.remove());
          return clone.textContent.trim();
        }

        // ── Pre-processing ────────────────────────────────────────────────
        function preprocessCode(code) {
          return code.split('\n').map(line => {
            // Lines starting with Unicode box-drawing chars (e.g. ── ) are visual comments
            if (/^[\u2500-\u257f\u2014\u2013\u2010─\-]{2}/.test(line.trim())) return '# ' + line;
            return line;
          }).join('\n');
        }

        function addContext(code) {
          const has = (name) =>
            new RegExp(`\\b${name}\\b`).test(code) &&
            !new RegExp(`\\b${name}\\s*=`).test(code);

          const defs = [];

          if (has('lst')) defs.push('lst = [1, 2, 3]');
          if (has('list_a')) defs.push('list_a = [1, 2, 3]');
          if (has('list_b')) defs.push('list_b = [7, 8, 9]');
          if (has('record')) defs.push("record = ['Alice', 'Maastricht', 62]");
          if (has('eeg') && !/\bimport\b/.test(code))
            defs.push('eeg = [[0.5*i*0.1 for i in range(10)] for _ in range(8)]');

          const needsSine = has('channel_a') || has('channel_b') ||
            (has('channel_1') && !/channel_1\s*=/.test(code)) ||
            (has('channel_2') && !/channel_2\s*=/.test(code));
          if (needsSine) defs.push('import math as _m');
          if (has('channel_a')) defs.push('channel_a = [_m.sin(i*0.12)*2+i*0.005 for i in range(50)]');
          if (has('channel_b')) defs.push('channel_b = [_m.cos(i*0.12)*1.6-i*0.003 for i in range(50)]');
          if (has('channel_1') && !/channel_1\s*=/.test(code))
            defs.push('channel_1 = [_m.sin(i*0.09)*2 for i in range(50)]');
          if (has('channel_2') && !/channel_2\s*=/.test(code))
            defs.push('channel_2 = [_m.cos(i*0.09)*1.5 for i in range(50)]');
          if (has('samples') && !/samples\s*=/.test(code))
            defs.push('samples = list(range(50))');
          if (has('numbers') && !/numbers\s*=/.test(code))
            defs.push('numbers = [4.0, 7.5, 2.1, 9.3, 1.2, 5.6, 8.8, 3.3, 6.7, 0.9]');

          // pandas df context
          const needsPd = /\bpd\./.test(code) && !/import\s+pandas/.test(code);
          const needsDf = has('df');
          const needsS = has('s') && /pd\.Series/.test(code);
          if (needsPd || needsDf || needsS) {
            if (!/import\s+pandas/.test(code)) defs.push('import pandas as pd');
            if (needsDf)
              defs.push("df = pd.DataFrame({'name':['Alice','Bob','Carol','Dave'],'age':[21,25,19,22],'grade':[8.5,7.0,9.2,6.1]})");
          }

          // scipy standalone context (not EEG full solution)
          if (/pearsonr/.test(code) && !has('channel_a') && !/eeg\[/.test(code)) {
            defs.push('import math as _m');
            defs.push('channel_a = [_m.sin(i*0.15) for i in range(30)]');
            defs.push('channel_b = [_m.cos(i*0.15)+0.1 for i in range(30)]');
          }

          // Expand [...] placeholders (e.g. [1.6, 0.8, ...])
          code = code.replace(/\[([0-9\-., ]+),\s*\.\.\.\s*\]/g, (_, vals) => {
            const arr = vals.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            while (arr.length < 30) arr.push(...arr.slice(0, Math.min(arr.length, 30 - arr.length)));
            return '[' + arr.slice(0, 30).join(', ') + ']';
          });

          return defs.length ? defs.join('\n') + '\n' + code : code;
        }

        // ── Code type detection ───────────────────────────────────────────
        function detectType(raw) {
          const lines = raw.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
          if (!lines.length) return 'empty';
          const first = lines[0].trim();
          if (/^python[\s3]|^pip[\s3]/.test(first)) return 'shell';
          if (/\bimport\s+turtle\b/.test(raw)) return 'turtle';
          if (/\bsys\.argv\b/.test(raw)) return 'argv';
          if (/\binput\s*\(/.test(raw)) return 'input_fn';
          if (/matplotlib|plt\./.test(raw)) return 'matplotlib';
          if (/from\s+scipy|import\s+scipy/.test(raw)) return 'scipy';
          if (/import\s+pandas|\bpd\./.test(raw)) return 'pandas';
          if (/open\s*\(\s*['"][^'"]+\.(txt|csv)['"]/.test(raw)) return 'fileio';
          return 'simple';
        }

        // ── DOM panel helpers ─────────────────────────────────────────────
        function esc(s) {
          return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function clearBelow(pre) {
          let next = pre.nextElementSibling;
          while (next && (next.classList.contains('py-output') || next.classList.contains('py-form'))) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
          }
          pre.classList.remove('py-open');
        }

        function showOutput(pre, kind, contentHTML) {
          clearBelow(pre);
          pre.classList.add('py-open');

          const dotCls = kind === 'err' ? 'err' : kind === 'info' ? 'info' : kind === 'warn' ? 'warn' : '';
          const label = kind === 'err' ? 'error' : kind === 'info' ? 'info' : 'output';

          const panel = document.createElement('div');
          panel.className = 'py-output';
          panel.setAttribute('role', 'status');
          panel.setAttribute('aria-live', 'polite');
          panel.innerHTML = `
          <div class="py-output-bar">
            <div class="py-output-label">
              <span class="py-dot ${dotCls}"></span>
              <span>${label}</span>
            </div>
            <button class="py-output-close" title="Close">✕</button>
          </div>
          <div class="py-output-body ${kind === 'err' ? 'err' : kind === 'info' ? 'info' : ''}">${contentHTML}</div>
        `;
          panel.querySelector('.py-output-close').addEventListener('click', () => {
            panel.remove();
            pre.classList.remove('py-open');
          });
          pre.insertAdjacentElement('afterend', panel);
        }

        function showForm(pre, hint, fieldsHTML, onRun) {
          clearBelow(pre);
          pre.classList.add('py-open');

          const form = document.createElement('div');
          form.className = 'py-form';
          form.innerHTML = `
          <div class="py-form-bar">
            <span>${hint}</span>
            <button class="py-output-close" title="Cancel">✕</button>
          </div>
          <div class="py-form-body">
            ${fieldsHTML}
            <div class="py-form-actions">
              <button class="py-btn-run" aria-label="Run Python code">▶ run</button>
              <button class="py-btn-cancel">cancel</button>
            </div>
          </div>
        `;
          const close = () => { form.remove(); pre.classList.remove('py-open'); };
          form.querySelector('.py-form-body .py-btn-run').addEventListener('click', () => onRun(form));
          form.querySelector('.py-form-body .py-btn-cancel').addEventListener('click', close);
          form.querySelector('.py-form-bar .py-output-close').addEventListener('click', close);
          pre.insertAdjacentElement('afterend', form);
          form.querySelector('input')?.focus();
        }

        // ── Core execution ────────────────────────────────────────────────
        async function execCode(pre, btn, code) {
          btn.textContent = '…';
          btn.classList.add('loading');
          btn.classList.remove('active');

          try {
            const py = await getPy();
            code = preprocessCode(code);
            code = addContext(code);

            // Load packages as needed
            if (/matplotlib|plt\./.test(code) && !_mplReady) {
              toastShow('Loading matplotlib…');
              await py.loadPackage('matplotlib');
              await py.runPythonAsync(`
import matplotlib, math
matplotlib.use('Agg')
import matplotlib.pyplot as plt
matplotlib.rcParams.update({
    'figure.facecolor':'#1a1d27','axes.facecolor':'#12141f',
    'axes.edgecolor':'#2e3250','text.color':'#e2e8f0',
    'axes.labelcolor':'#c8d0e7','xtick.color':'#8b95b3',
    'ytick.color':'#8b95b3','grid.color':'#2e3250',
    'lines.linewidth':1.8,
})
_show_imgs = []
def _cap_show(*a,**kw):
    import io, base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=110)
    buf.seek(0); _show_imgs.append(base64.b64encode(buf.read()).decode())
    plt.clf(); plt.close('all')
plt.show = _cap_show
`);
              _mplReady = true;
              toastHide();
            }
            if (/from\s+scipy|import\s+scipy/.test(code) && !_scipyReady) {
              toastShow('Loading scipy… (this may take a moment)');
              await py.loadPackage('scipy');
              _scipyReady = true;
              toastHide();
            }
            if (/import\s+pandas|\bpd\./.test(code) && !_pandasReady) {
              toastShow('Loading pandas… (this may take a moment)');
              await py.loadPackage('pandas');
              _pandasReady = true;
              toastHide();
            }

            if (_mplReady) await py.runPythonAsync('_show_imgs = []');

            // Run
            await py.runPythonAsync(`_r = _run(${JSON.stringify(code)})`);
            const stdout = await py.runPythonAsync('_r[0]') || '';
            const stderr = await py.runPythonAsync('_r[1]') || '';
            const lastRepr = await py.runPythonAsync('_r[2]');

            let html = '';

            // Matplotlib plots
            if (_mplReady && /plt\.show/.test(code)) {
              const imgCount = await py.runPythonAsync('len(_show_imgs)');
              for (let i = 0; i < imgCount; i++) {
                const b64 = await py.runPythonAsync(`_show_imgs[${i}]`);
                html += `<img src="data:image/png;base64,${b64}" alt="matplotlib plot" />`;
              }
            }

            // stdout
            if (stdout.trim()) html += (html ? '\n' : '') + esc(stdout.trim());

            // REPL-style last expression repr (e.g. int("42"), math.sqrt(16))
            if (lastRepr && lastRepr !== 'None' && !stdout.trim() && !html.includes('<img'))
              html += `<span class="py-repr">${esc(lastRepr)}</span>`;

            if (!html && !stderr.trim())
              html = '<span style="color:var(--muted);font-style:italic">✓ ran — no output</span>';

            // file write confirmation
            if (/open\s*\([^)]*["'][wa]["']/.test(code)) {
              try {
                const fname = code.match(/open\s*\(\s*['"]([^'"]+)['"]/)?.[1];
                const escapedFname = fname ? fname.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : fname;
                if (fname) {
                  const written = await py.runPythonAsync(`
try:
    with open('${escapedFname}','r') as _f: _fc = _f.read()
except: _fc = ''
_fc`);
                  if (written && written.trim())
                    html += (html ? '\n\n' : '') +
                      `<span style="color:var(--muted)">📄 ${esc(fname)} written:</span>\n${esc(written.trim())}`;
                }
              } catch { }
            }

            if (stderr.trim()) {
              showOutput(pre, 'err', esc(stderr.trim()));
            } else {
              showOutput(pre, 'ok', html);
            }

            btn.textContent = '▶ run';
            btn.classList.remove('loading');
            btn.classList.add('active');

          } catch (e) {
            toastHide();
            btn.textContent = '▶ run';
            btn.classList.remove('loading');
            showOutput(pre, 'err', esc(String(e.message || e)));
          }
        }

        // ── Per-type handlers ─────────────────────────────────────────────

        function handleShell(pre) {
          showOutput(pre, 'info',
            'This is a terminal command — run it in your command line, not the Python interpreter.');
        }

        function handleTurtle(pre) {
          showOutput(pre, 'info',
            'Turtle graphics require a local Python window.\n' +
            'This snippet shows the correct loop-based drawing logic — run it in your Python installation!');
        }

        function handleArgv(pre, btn, code) {
          const matches = [...code.matchAll(/sys\.argv\[(\d+)\]/g)];
          const indices = [...new Set(matches.map(m => +m[1]))].filter(i => i > 0).sort((a, b) => a - b);
          if (!indices.length) { execCode(pre, btn, code); return; }

          const hints = {};
          if (/speed/.test(code)) {
            hints[1] = 'speed1 e.g. 60';
            hints[2] = 'speed2 e.g. 80';
            hints[3] = 'distance e.g. 100';
            hints[4] = '"towards" or "pursue"';
          }

          const fields = indices.map(i => `
          <label>sys.argv[${i}]${hints[i] ? '  —  ' + hints[i] : ''}</label>
          <input type="text" name="a${i}" aria-label="sys.argv[${i}]" placeholder="${hints[i] || 'enter value…'}" />
        `).join('');

          showForm(pre, 'sys.argv — provide command-line arguments', fields, form => {
            let patched = code.replace(/^\s*import\s+sys\s*\n?/gm, '');
            indices.forEach(i => {
              const v = form.querySelector(`[name="a${i}"]`)?.value ?? '';
              patched = patched.replace(new RegExp(`sys\\.argv\\[${i}\\]`, 'g'), JSON.stringify(v));
            });
            form.remove();
            execCode(pre, btn, patched);
          });
        }

        function handleInputFn(pre, btn, code) {
          const rx = /input\s*\(\s*(?:f?["'`]([^"'`]*)["'`])?\s*\)/g;
          const prompts = [...code.matchAll(rx)].map((m, i) => (m[1] || `Input ${i + 1}`).trim());
          if (!prompts.length) { execCode(pre, btn, code); return; }

          const fields = prompts.map((p, i) => `
          <label>${esc(p)}</label>
          <input type="text" name="i${i}" aria-label="${esc(p)}" placeholder="type your answer…" />
        `).join('');

          showForm(pre, 'input() — provide the values below', fields, form => {
            const values = prompts.map((_, i) => form.querySelector(`[name="i${i}"]`)?.value ?? '');
            let idx = 0;
            const patched = code.replace(/input\s*\([^)]*\)/g, () => JSON.stringify(values[idx++] ?? ''));
            form.remove();
            execCode(pre, btn, patched);
          });
        }

        // ── Main click dispatcher ─────────────────────────────────────────
        function handleClick(pre, btn) {
          // Toggle: click again to close output
          if (pre.nextElementSibling?.classList.contains('py-output')) {
            clearBelow(pre);
            btn.classList.remove('active');
            return;
          }
          // If form is open, just close it
          if (pre.nextElementSibling?.classList.contains('py-form')) {
            clearBelow(pre);
            return;
          }

          const raw = getCode(pre);
          const type = detectType(raw);

          if (type === 'empty') return;
          if (type === 'shell') { handleShell(pre); return; }
          if (type === 'turtle') { handleTurtle(pre); return; }
          if (type === 'argv') { handleArgv(pre, btn, raw); return; }
          if (type === 'input_fn') { handleInputFn(pre, btn, raw); return; }

          execCode(pre, btn, raw);
        }

        // ── Inject run buttons ────────────────────────────────────────────
        document.querySelectorAll('pre').forEach(pre => {
          const btn = document.createElement('button');
          btn.className = 'run-btn';
          btn.textContent = '▶ run';
          btn.setAttribute('aria-label', 'Run Python code');
          btn.addEventListener('click', e => { e.stopPropagation(); handleClick(pre, btn); });
          pre.appendChild(btn);
        });

        // Optional: quietly warm up Pyodide in the background after load
        // window.addEventListener('load', () => setTimeout(() => getPy().catch(()=>{}), 2000));

      })();

// Register Service Worker for offline caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}
