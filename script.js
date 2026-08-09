(() => {
    const CONFIG = {
        dataPath: './data/resources.json',
        linksPath: './data/links.json',
        musicPath: './data/music.json',
        defaultReadme: 'data/rm/root.md',
        icons: ['🌐', '📦', '📁', '📄', '🎵', '🎬', '🖼️', '📱', '⚙️', '🚀', '🔥'],
        defaultIcon: { folder: '📁', file: '📄' },
        maxConsecutiveMusicFailures: 5,
        searchDebounceMs: 200,
        downloadRedirectHintMs: 1400,
        enablePressRipple: true,
        enableShineOnClick: true,
        enableHoverSpotlight: true,
        enableHeaderParallax: true,
        storageKeys: { theme: 'theme', glass: 'glassEnabled', animation: 'animationEnabled', music: 'musicEnabled', musicIndex: 'musicIndex' }
    };
    const Storage = {
        get(k, f = null) { try { const v = localStorage.getItem(k); return v !== null ? v : f; } catch { return f; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch {} },
        getBool(k, f = true) { const v = this.get(k, null); return v === null ? f : v === 'true'; },
        setBool(k, v) { this.set(k, v.toString()); }
    };
    const State = {
        data: [], folderStack: [], currentFolder: null, currentPath: [],
        isSearchActive: false, searchKeyword: '',
        downloadUrl: '', downloadName: '', downloadIcon: '',
        lastTabId: 'resource', lastTabBtn: null,
        audio: new Audio(), musicList: [], currentMusicIndex: 0,
        musicEnabled: false, consecutiveMusicFailures: 0,
        readmeTextCache: new Map(), readmeFetching: new Map(),
        tabIndicator: null, dom: {}
    };
    const escapeHtml = t => { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; };
    const triggerReflow = el => void el.offsetWidth;
    const animateClass = (el, cn) => { if (!el) return; el.classList.remove(cn); triggerReflow(el); el.classList.add(cn); };
    const debounce = (fn, ms) => {
        let t = null; const run = (...a) => { if (t) clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
        run.flush = () => { if (t) { clearTimeout(t); fn(); } }; return run;
    };
    const safeCopyText = async text => {
        if (navigator.clipboard && window.isSecureContext) { try { await navigator.clipboard.writeText(text); return true; } catch {} }
        try {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta);
            if (ok) return true;
        } catch {}
        try { window.prompt('请手动复制以下链接：', text); return true; } catch { return false; }
    };
    const toast = (msg, ms = 1600) => {
        let el = document.getElementById('__guiwowxx_toast');
        if (!el) {
            el = document.createElement('div'); el.id = '__guiwowxx_toast'; el.setAttribute('aria-live', 'polite');
            Object.assign(el.style, {
                position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%) translateY(18px)',
                padding: '10px 20px', borderRadius: '14px', background: 'rgba(40,40,42,0.9)', color: '#fff',
                fontSize: '15px', fontWeight: '500', zIndex: '99999', pointerEvents: 'none', opacity: '0',
                transition: 'opacity .3s cubic-bezier(.25,.1,.25,1), transform .3s cubic-bezier(.25,.1,.25,1)',
                backdropFilter: 'saturate(220%) blur(20px)', WebkitBackdropFilter: 'saturate(220%) blur(20px)',
                border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            });
            document.body.appendChild(el);
        }
        el.textContent = msg;
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
        clearTimeout(el.__t);
        el.__t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(18px)'; }, ms);
    };
    const renderReadmeHtml = (raw, title = '资源介绍') => {
        let body;
        if (typeof marked !== 'undefined' && marked.parse) {
            try { body = marked.parse(raw || ''); }
            catch { body = `<pre style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(raw || '')}</pre>`; }
        } else body = `<pre style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(raw || '')}</pre>`;
        return `<h3>${escapeHtml(title)}</h3><div class="markdown">${body}</div>`;
    };

    const SHINE_SELECTOR = '.card, .notice, .tabs, .tabs button, .download-buttons button, #links a, #search, #themeSelect, #breadcrumb, #readme, .download-readme, .download-window, #list';
    const ensureEnhanceLayers = el => {
        if (!el || el.nodeType !== 1) return;
        if (!el.querySelector(':scope > .__shine-layer')) {
            const s = document.createElement('span'); s.className = '__shine-layer'; s.setAttribute('aria-hidden', 'true'); el.appendChild(s);
        }
        if (CONFIG.enableHoverSpotlight && el.classList.contains('resource-card') && !el.querySelector(':scope > .__spotlight')) {
            const sp = document.createElement('span'); sp.className = '__spotlight'; sp.setAttribute('aria-hidden', 'true'); el.appendChild(sp);
        }
    };
    const fireShineAndRipple = (el, cx, cy) => {
        if (!el) return;
        if (CONFIG.enableShineOnClick) {
            ensureEnhanceLayers(el); el.classList.remove('is-shining'); void el.offsetWidth; el.classList.add('is-shining');
            setTimeout(() => el.classList.remove('is-shining'), 3600);
        }
        if (CONFIG.enablePressRipple) {
            const r = el.getBoundingClientRect();
            const x = (cx ?? r.left + r.width / 2) - r.left;
            const y = (cy ?? r.top + r.height / 2) - r.top;
            const rp = document.createElement('span'); rp.className = '__press-ripple';
            rp.style.left = x + 'px'; rp.style.top = y + 'px'; rp.setAttribute('aria-hidden', 'true');
            el.appendChild(rp);
            rp.addEventListener('animationend', () => rp.remove(), { once: true });
            setTimeout(() => rp.remove(), 1200);
        }
    };

    const applyTheme = theme => document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    const initTheme = () => {
        const sel = State.dom.themeSelect;
        let saved = Storage.get(CONFIG.storageKeys.theme, null);
        if (!saved) saved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        applyTheme(saved);
        if (sel) {
            sel.value = saved;
            sel.addEventListener('change', () => {
                const v = sel.value === 'light' ? 'light' : 'dark'; applyTheme(v); Storage.set(CONFIG.storageKeys.theme, v);
                toast(`已切换到${v === 'light' ? '浅色' : '深色'}模式`);
            });
        }
        if (Storage.get(CONFIG.storageKeys.theme, null) === null && window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', e => applyTheme(e.matches ? 'light' : 'dark'));
        }
    };

    const renderBreadcrumb = () => {
        const { breadcrumb } = State.dom; if (!breadcrumb) return;
        const prefix = State.isSearchActive ? `🔍 ${escapeHtml(State.searchKeyword)}` : '🏠 首页';
        const path = State.currentPath.length ? ` › ${State.currentPath.map(escapeHtml).join(' › ')}` : '';
        breadcrumb.innerHTML = prefix + path;
        ensureEnhanceLayers(breadcrumb);
    };
    const getIconFor = item => {
        if (typeof item.icon === 'number') return CONFIG.icons[item.icon] || CONFIG.icons[0];
        if (typeof item.icon === 'string' && item.icon.length > 0) return item.icon;
        return item.type === 'folder' ? CONFIG.defaultIcon.folder : CONFIG.defaultIcon.file;
    };
    const rebuildStackFromPath = sp => {
        const stack = []; let node = { children: State.data, readme: CONFIG.defaultReadme }; stack.push(node);
        for (let i = 0; i < sp.length - 1; i++) {
            const next = node.children?.find(x => x?.name === sp[i] && x.type === 'folder');
            if (!next) break;
            stack.push(next); node = next;
        }
        State.folderStack = stack;
    };

    const renderFolder = () => {
        const { list } = State.dom; if (!list) return;
        list.innerHTML = ''; animateClass(list, 'folder-animation'); renderBreadcrumb();

        if (State.folderStack.length > 0 || State.isSearchActive) {
            const back = document.createElement('div');
            back.className = 'card resource-card folder-item';
            back.setAttribute('role', 'button'); back.setAttribute('tabindex', '0');
            back.innerHTML = `<span class="sf-icon" style="background:rgba(10,132,255,0.15);color:var(--blue);">←</span>
                              <div class="text-wrap"><h2 style="color:var(--blue);">返回</h2></div>
                              <span class="chevron">›</span>`;
            const goBack = () => {
                if (State.folderStack.length > 0) {
                    const parent = State.folderStack.pop(); State.currentFolder = parent; State.currentPath.pop();
                    if (State.folderStack.length === 0 && State.isSearchActive) {
                        State.currentFolder = { children: searchAll(State.data, State.searchKeyword), readme: null, _searchResult: true };
                    } else if (State.folderStack.length === 0) {
                        State.isSearchActive = false; State.searchKeyword = '';
                        if (State.dom.search) State.dom.search.value = '';
                        State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme }; State.currentPath = [];
                    }
                } else if (State.isSearchActive) {
                    State.isSearchActive = false; State.searchKeyword = '';
                    if (State.dom.search) State.dom.search.value = '';
                    State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme }; State.currentPath = [];
                }
                renderFolder(); loadReadme(State.currentFolder);
            };
            back.addEventListener('click', goBack);
            back.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goBack(); } });
            ensureEnhanceLayers(back); list.appendChild(back);
        }

        const children = State.currentFolder?.children || [];
        if (children.length === 0) {
            const empty = document.createElement('div'); empty.className = 'card folder-item';
            empty.innerHTML = `<span class="sf-icon" style="background:rgba(120,120,128,0.15);">❔</span>
                               <div class="text-wrap"><h2>${State.isSearchActive ? '无搜索结果' : '此目录为空'}</h2><p>${State.isSearchActive ? '试试其他关键词' : '暂时没有内容'}</p></div>
                               <span class="chevron"></span>`;
            list.appendChild(empty); return;
        }

        children.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card resource-card folder-item';
            card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
            const icon = getIconFor(item);
            const title = escapeHtml(item.name || '未命名');
            const desc = escapeHtml(item.desc || (item.type === 'folder' ? '文件夹' : '暂无描述'));
            let extra = '';
            if (State.isSearchActive && item._sourcePath?.length > 0) {
                extra = `<div style="margin-top:3px;font-size:12px;color:var(--sub);">${item._sourcePath.map(escapeHtml).join(' › ')}</div>`;
            }
            card.innerHTML = `<span class="sf-icon">${icon}</span>
                              <div class="text-wrap">
                                  <h2>${title}</h2>
                                  <p>${desc}</p>
                                  ${extra}
                              </div>
                              <span class="chevron">${item.type === 'folder' ? '›' : '⬇'}</span>`;
            ensureEnhanceLayers(card);
            const activate = () => {
                if (item.type === 'folder') {
                    if (State.isSearchActive && State.folderStack.length === 0) {
                        State.isSearchActive = false;
                        if (item._sourcePath) { State.currentPath = [...item._sourcePath]; rebuildStackFromPath(item._sourcePath); }
                        else { State.currentPath = [item.name]; State.folderStack = [{ children: State.data, readme: CONFIG.defaultReadme }]; }
                    } else { State.folderStack.push(State.currentFolder); State.currentPath.push(item.name); }
                    State.currentFolder = item; renderFolder(); loadReadme(item);
                } else openDownload(item.url, item.name, icon, item.readme || '');
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
            list.appendChild(card);
        });
        loadReadme(State.currentFolder);
    };

    const loadReadme = folder => {
        const box = State.dom.readmeBox; if (!box) return;
        animateClass(box, 'readme-animation'); ensureEnhanceLayers(box);
        if (!folder?.readme) { box.innerHTML = '<h3>资源介绍</h3>暂无介绍'; return; }
        const key = folder.readme;
        if (State.readmeTextCache.has(key)) { box.innerHTML = renderReadmeHtml(State.readmeTextCache.get(key), '资源介绍'); return; }
        if (!State.readmeFetching.has(key)) {
            const p = fetch(key).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                .then(t => { State.readmeTextCache.set(key, t); return t; })
                .catch(e => { console.warn('[README]', key, e); return null; })
                .finally(() => State.readmeFetching.delete(key));
            State.readmeFetching.set(key, p);
        }
        box.innerHTML = '<h3>资源介绍</h3><p style="opacity:.5;">加载中…</p>';
        State.readmeFetching.get(key).then(t => {
            if (State.currentFolder?.readme !== key) return;
            box.innerHTML = t === null ? '<h3>资源介绍</h3>暂无介绍' : renderReadmeHtml(t, '资源介绍');
        });
    };

    const searchAll = (arr, key, parents = []) => {
        const res = []; if (!Array.isArray(arr)) return res;
        arr.forEach(item => {
            const name = (item.name || '').toLowerCase(); const desc = (item.desc || '').toLowerCase();
            if (name.includes(key) || desc.includes(key)) res.push({ ...item, _sourcePath: [...parents, item.name] });
            if (item.type === 'folder' && Array.isArray(item.children)) res.push(...searchAll(item.children, key, [...parents, item.name]));
        });
        return res;
    };
    const initSearch = () => {
        const { search } = State.dom; if (!search) return;
        const doSearch = debounce(() => {
            const key = search.value.trim().toLowerCase();
            if (!key) {
                State.isSearchActive = false; State.searchKeyword = '';
                State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                State.folderStack = []; State.currentPath = []; renderFolder(); return;
            }
            State.isSearchActive = true; State.searchKeyword = key;
            State.currentFolder = { children: searchAll(State.data, key), readme: null, _searchResult: true };
            State.folderStack = []; State.currentPath = []; renderFolder();
        }, CONFIG.searchDebounceMs);
        search.addEventListener('input', doSearch);
        search.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch.flush?.(); });
    };

    const openDownload = (url, name, icon, readmePath) => {
        State.downloadUrl = url || ''; State.downloadName = name || '';
        State.downloadIcon = (typeof icon === 'string' && icon) ? icon : (CONFIG.icons[icon] || CONFIG.icons[0]);
        if (State.dom.downloadName) State.dom.downloadName.textContent = State.downloadName;
        if (State.dom.downloadIcon) State.dom.downloadIcon.textContent = State.downloadIcon;
        loadDownloadReadme(readmePath);
        const res = document.getElementById('resource'); const down = document.getElementById('download');
        const activeTabBtn = document.querySelector('.tabs button.active');
        State.lastTabId = 'resource'; State.lastTabBtn = activeTabBtn || null;
        if (res) res.classList.add('hide');
        if (down) {
            down.classList.remove('hide'); triggerReflow(down); down.classList.add('page-show');
            const win = down.querySelector('.download-window'); if (win) ensureEnhanceLayers(win);
            const rm = down.querySelector('.download-readme'); if (rm) ensureEnhanceLayers(rm);
        }
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };
    const loadDownloadReadme = path => {
        const box = State.dom.downloadReadmeBox; if (!box) return; ensureEnhanceLayers(box);
        if (!path) { box.innerHTML = '<h3>文件介绍</h3>暂无介绍'; return; }
        if (State.readmeTextCache.has(path)) { box.innerHTML = renderReadmeHtml(State.readmeTextCache.get(path), '文件介绍'); return; }
        if (!State.readmeFetching.has(path)) {
            const p = fetch(path).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                .then(t => { State.readmeTextCache.set(path, t); return t; })
                .catch(e => { console.warn('[DL README]', path, e); return null; })
                .finally(() => State.readmeFetching.delete(path));
            State.readmeFetching.set(path, p);
        }
        box.innerHTML = '<h3>文件介绍</h3><p style="opacity:.5;">加载中…</p>';
        State.readmeFetching.get(path).then(t => {
            box.innerHTML = t === null ? '<h3>文件介绍</h3>暂无介绍' : renderReadmeHtml(t, '文件介绍');
        });
    };

    window.startDownload = () => {
        if (!State.downloadUrl) { toast('下载链接无效'); return; }
        const btn = document.querySelector('.download-buttons button'); const orig = btn?.textContent || '';
        if (btn) { btn.textContent = '正在跳转…'; btn.disabled = true; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, CONFIG.downloadRedirectHintMs); }
        try { window.open(State.downloadUrl, '_blank', 'noopener,noreferrer'); toast('已在新标签打开下载链接'); }
        catch { location.href = State.downloadUrl; }
    };
    window.copyDownloadLink = async () => {
        if (!State.downloadUrl) { toast('没有可复制的链接'); return; }
        toast(await safeCopyText(State.downloadUrl) ? '链接已复制' : '复制失败');
    };
    window.backResource = () => {
        const down = document.getElementById('download'); const res = document.getElementById('resource');
        if (down) { down.classList.add('hide'); down.classList.remove('page-show'); }
        if (res) { res.classList.remove('hide'); triggerReflow(res); res.classList.add('page-show'); }
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        if (State.lastTabBtn?.isConnected) { State.lastTabBtn.classList.add('active'); moveTabIndicator(State.lastTabBtn); }
        else { const f = document.querySelector('.tabs button[data-tab="resource"]') || document.querySelector('.tabs button'); if (f) { f.classList.add('active'); moveTabIndicator(f); } }
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };

    const initGlass = () => {
        const sw = State.dom.glassSwitch; if (!sw) return;
        const enabled = Storage.getBool(CONFIG.storageKeys.glass, true);
        sw.checked = enabled; document.body.classList.toggle('no-glass', !enabled);
        sw.addEventListener('change', () => {
            const v = sw.checked; Storage.setBool(CONFIG.storageKeys.glass, v);
            document.body.classList.toggle('no-glass', !v);
        });
    };
    const initAnimation = () => {
        const sw = State.dom.animationSwitch; if (!sw) return;
        const enabled = Storage.getBool(CONFIG.storageKeys.animation, true);
        sw.checked = enabled; document.body.classList.toggle('no-animation', !enabled);
        sw.addEventListener('change', () => {
            const v = sw.checked; Storage.setBool(CONFIG.storageKeys.animation, v);
            document.body.classList.toggle('no-animation', !v);
        });
    };

    const nextMusic = () => { if (State.musicEnabled && State.musicList.length) playMusic((State.currentMusicIndex + 1) % State.musicList.length); };
    const playMusic = index => {
        if (!State.musicList.length) return;
        const safeIdx = ((index % State.musicList.length) + State.musicList.length) % State.musicList.length;
        const song = State.musicList[safeIdx];
        if (!song?.url) { nextMusic(); return; }
        State.currentMusicIndex = safeIdx; Storage.set(CONFIG.storageKeys.musicIndex, safeIdx.toString());
        State.audio.src = song.url;
        State.audio.play().then(() => { State.consecutiveMusicFailures = 0; })
            .catch(err => {
                console.warn('[Music]', song.name, err); State.consecutiveMusicFailures++;
                if (State.consecutiveMusicFailures >= CONFIG.maxConsecutiveMusicFailures) {
                    State.musicEnabled = false; if (State.dom.musicSwitch) State.dom.musicSwitch.checked = false;
                    Storage.setBool(CONFIG.storageKeys.music, false); State.audio.pause(); State.audio.removeAttribute?.('src');
                    toast('音乐播放失败，已自动关闭'); return;
                }
                setTimeout(nextMusic, 280);
            });
    };
    const initMusic = () => {
        const sw = State.dom.musicSwitch;
        State.musicEnabled = Storage.getBool(CONFIG.storageKeys.music, false);
        if (sw) sw.checked = State.musicEnabled;
        try { State.audio.volume = 0.75; } catch {}
        const tryAutoplay = () => {
            if (State.musicEnabled && State.musicList.length) playMusic(State.currentMusicIndex);
            ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, tryAutoplay));
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, tryAutoplay, { once: true }));
        fetch(CONFIG.musicPath).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(json => {
                if (!Array.isArray(json) || !json.length) throw new Error('空列表');
                State.musicList = json;
                const savedIdx = Number(Storage.get(CONFIG.storageKeys.musicIndex, 0));
                State.currentMusicIndex = (Number.isFinite(savedIdx) && savedIdx >= 0 ? savedIdx : 0) % State.musicList.length;
                if (State.musicEnabled) playMusic(State.currentMusicIndex);
            })
            .catch(err => { console.warn('[Music]', err); State.musicList = []; if (State.musicEnabled) toast('音乐列表加载失败'); });
        if (sw) {
            sw.addEventListener('change', () => {
                State.musicEnabled = sw.checked; Storage.setBool(CONFIG.storageKeys.music, State.musicEnabled);
                if (State.musicEnabled) playMusic(State.currentMusicIndex);
                else { State.audio.pause(); State.consecutiveMusicFailures = 0; }
            });
        }
        State.audio.addEventListener('ended', () => { State.consecutiveMusicFailures = 0; nextMusic(); });
        State.audio.addEventListener('error', () => {
            State.consecutiveMusicFailures++;
            if (State.consecutiveMusicFailures >= CONFIG.maxConsecutiveMusicFailures) {
                State.musicEnabled = false; if (sw) sw.checked = false;
                Storage.setBool(CONFIG.storageKeys.music, false); State.audio.pause(); State.audio.removeAttribute?.('src');
                toast('音乐无法播放，已自动关闭'); return;
            }
            setTimeout(nextMusic, 280);
        });
    };

    const loadLinks = () => {
        const c = State.dom.linksContainer; if (!c) return;
        fetch(CONFIG.linksPath).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(json => {
                if (!Array.isArray(json)) throw new Error('非数组'); c.innerHTML = '';
                if (!json.length) { c.innerHTML = '<div class="card folder-item"><h3>友情链接</h3><p>暂无</p></div>'; return; }
                json.forEach((item, idx) => {
                    const a = document.createElement('a');
                    a.href = item.url || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'folder-item';
                    if (idx >= 11) a.style.animationDelay = `${.205 + (idx - 11) * 0.03}s`;
                    const ic = item.icon ? `<span style="margin-right:6px;">${escapeHtml(item.icon)}</span>` : '';
                    const desc = item.desc ? ` <span style="opacity:.5;font-size:12.5px;margin-left:4px;">${escapeHtml(item.desc)}</span>` : '';
                    a.innerHTML = `${ic}${escapeHtml(item.name || '未命名')}${desc}`;
                    ensureEnhanceLayers(a); c.appendChild(a);
                });
            })
            .catch(err => { console.warn('[Links]', err); c.innerHTML = '<div class="card folder-item"><h3>友情链接</h3><p>暂无</p></div>'; });
    };
    const loadResources = () => {
        fetch(CONFIG.dataPath).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(json => {
                const arr = Array.isArray(json) ? json : (json.data || json.children || []);
                if (!Array.isArray(arr)) throw new Error('格式错误');
                State.data = arr; State.folderStack = [];
                State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                State.currentPath = []; State.isSearchActive = false; State.searchKeyword = '';
                renderFolder();
            })
            .catch(e => {
                console.error('[Resources]', e);
                if (State.dom.list) State.dom.list.innerHTML = `<div class="card folder-item"><h2>资源加载失败</h2><p>请检查 data/resources.json</p></div>`;
            });
    };

    window.showDonate = () => { State.dom.wechatImg?.classList.toggle('show'); State.dom.telegramImg?.classList.remove('show'); };
    window.showTelegram = () => { State.dom.telegramImg?.classList.toggle('show'); State.dom.wechatImg?.classList.remove('show'); };
    const moveTabIndicator = btn => {
        const ind = State.tabIndicator; if (!ind || !btn) return;
        const pr = btn.parentElement.getBoundingClientRect();
        const r = btn.getBoundingClientRect();
        ind.style.width = r.width + 'px';
        ind.style.transform = `translateX(${r.left - pr.left}px)`;
    };
    const ensureTabIndicator = () => {
        const tabs = document.querySelector('.tabs'); if (!tabs) return;
        let ind = tabs.querySelector(':scope > .tab-indicator');
        if (!ind) { ind = document.createElement('span'); ind.className = 'tab-indicator'; ind.setAttribute('aria-hidden', 'true'); tabs.insertBefore(ind, tabs.firstChild); }
        State.tabIndicator = ind;
    };
    window.showTab = (tabId, btn) => {
        ['resource', 'friend', 'author', 'setting', 'download'].forEach(id => {
            const el = document.getElementById(id); if (el) { el.classList.add('hide'); el.classList.remove('page-show'); }
        });
        const target = document.getElementById(tabId);
        if (target) { target.classList.remove('hide'); triggerReflow(target); target.classList.add('page-show'); }
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        if (btn) { btn.classList.add('active'); moveTabIndicator(btn); }
        State.lastTabId = tabId; State.lastTabBtn = btn || null;
        window.scrollTo?.({ top: 0, behavior: 'auto' });
    };

    const initInteractionEffects = () => {
        document.addEventListener('pointerdown', e => {
            if (e.button !== undefined && e.button !== 0) return;
            const t = e.target.closest(SHINE_SELECTOR); if (!t) return;
            ensureEnhanceLayers(t); fireShineAndRipple(t, e.clientX, e.clientY);
        }, { passive: true });
        if (!CONFIG.enableHoverSpotlight) return;
        try { if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return; } catch { return; }
        document.addEventListener('pointermove', e => {
            const card = e.target.closest('.card.resource-card'); if (!card) return;
            const spot = card.querySelector(':scope > .__spotlight'); if (!spot) return;
            const r = card.getBoundingClientRect();
            spot.style.setProperty('--mx', (e.clientX - r.left - 130) + 'px');
            spot.style.setProperty('--my', (e.clientY - r.top - 130) + 'px');
        }, { passive: true });
    };
    const initHeaderParallax = () => {
        if (!CONFIG.enableHeaderParallax) return;
        const header = document.querySelector('header'); if (!header) return;
        let ticking = false;
        const update = () => {
            const y = Math.min(500, window.scrollY || 0);
            header.style.setProperty('--scroll', y + '');
            header.style.setProperty('--hdr-dx', (-y * 0.004).toFixed(3) + '%');
            header.style.setProperty('--hdr-dy', (-y * 0.008).toFixed(3) + '%');
            ticking = false;
        };
        window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
        update();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const d = State.dom;
        d.list = document.getElementById('list'); d.search = document.getElementById('search'); d.breadcrumb = document.getElementById('breadcrumb');
        d.readmeBox = document.getElementById('readme'); d.downloadName = document.getElementById('downloadName');
        d.downloadIcon = document.getElementById('downloadIcon'); d.downloadReadmeBox = document.getElementById('downloadReadme');
        d.linksContainer = document.getElementById('links'); d.themeSelect = document.getElementById('themeSelect');
        d.glassSwitch = document.getElementById('glassSwitch'); d.animationSwitch = document.getElementById('animationSwitch');
        d.musicSwitch = document.getElementById('musicSwitch'); d.wechatImg = document.getElementById('wechat'); d.telegramImg = document.getElementById('telegram');
        ensureTabIndicator(); document.querySelectorAll(SHINE_SELECTOR).forEach(ensureEnhanceLayers);
        initInteractionEffects(); initTheme(); initGlass(); initAnimation(); initMusic();
        initSearch(); loadResources(); loadLinks();
        const firstTab = document.querySelector('.tabs button'); if (firstTab) showTab('resource', firstTab);
        document.querySelectorAll('.tabs button[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => { const id = btn.getAttribute('data-tab'); if (id) showTab(id, btn); });
            btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
        });
        const bk = document.querySelector('#download [data-action="back"]'); if (bk && !bk.onclick) bk.addEventListener('click', window.backResource);
        const dl = document.querySelector('#download [data-action="download"]'); if (dl && !dl.onclick) dl.addEventListener('click', window.startDownload);
        const cp = document.querySelector('#download [data-action="copy"]'); if (cp && !cp.onclick) cp.addEventListener('click', window.copyDownloadLink);
        initHeaderParallax();
        window.addEventListener('resize', debounce(() => { const a = document.querySelector('.tabs button.active'); if (a) moveTabIndicator(a); }, 120));
    });
})();
