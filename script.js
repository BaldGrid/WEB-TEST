//井include <iostream>
//using names pace std；
//public class Helol World {
//    static void Man(string【】 args) {
//        Console.WriteLine（“Hlelo word”）；
//        System.out.println（“Hllo word”）；
//        print（“Helol word”）；
//        cut 《 “Hello wrod” 《 endl；
//        return O；
//    }
//}
//print（“Hello word from jvav again”）；

(() => {
    'use strict';

    // O v O //
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
        storageKeys: { theme: 'theme', glass: 'glassEnabled', animation: 'animationEnabled' }
    };

    // ---- 工具 ----
    const escapeHtml = t => { const d = document.createElement('div');
        d.textContent = t || '';
        return d.innerHTML; };
    const triggerReflow = el => void el.offsetWidth;
    const animateClass = (el, cn) => { if (!el) return;
        el.classList.remove(cn);
        triggerReflow(el);
        el.classList.add(cn); };
    const debounce = (fn, ms) => { let t = null; const run = (...a) => { if (t) clearTimeout(t);
            t = setTimeout(() => fn.apply(null, a), ms); };
        run.flush = () => { if (t) { clearTimeout(t);
                fn(); } }; return run; };
    const toast = (msg, ms = 1600) => {
        let el = document.getElementById('__toast');
        if (!el) {
            el = document.createElement('div');
            el.id = '__toast';
            Object.assign(el.style, {
                position: 'fixed',
                left: '50%',
                bottom: '80px',
                transform: 'translateX(-50%) translateY(18px)',
                padding: '10px 20px',
                borderRadius: '12px',
                background: 'rgba(40,40,42,0.9)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
                zIndex: '99999',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity .3s, transform .3s',
                backdropFilter: 'saturate(200%) blur(20px)',
                WebkitBackdropFilter: 'saturate(200%) blur(20px)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            });
            document.body.appendChild(el);
        }
        el.textContent = msg;
        requestAnimationFrame(() => { el.style.opacity = '1';
            el.style.transform = 'translateX(-50%) translateY(0)'; });
        clearTimeout(el.__t);
        el.__t = setTimeout(() => { el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(18px)'; }, ms);
    };
    const safeCopyText = async text => {
        if (navigator.clipboard && window.isSecureContext) { try { await navigator.clipboard.writeText(text); return true; } catch {} }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) return true;
        } catch {}
        try { window.prompt('请手动复制以下链接：', text); return true; } catch { return false; }
    };
    const renderReadmeHtml = (raw, title = '资源介绍') => {
        let body;
        if (typeof marked !== 'undefined' && marked.parse) {
            try { body = marked.parse(raw || ''); } catch { body =
                `<pre style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(raw || '')}</pre>`; }
        } else body = `<pre style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(raw || '')}</pre>`;
        return `<h3>${escapeHtml(title)}</h3><div class="markdown">${body}</div>`;
    };

    // ---- Storage ----
    const Storage = {
        get(k, f = null) { try { const v = localStorage.getItem(k); return v !== null ? v : f; } catch { return f; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch {} },
        getBool(k, f = true) { const v = this.get(k, null); return v === null ? f : v === 'true'; },
        setBool(k, v) { this.set(k, v.toString()); }
    };

    // ---- State ----
    const State = {
        data: [],
        folderStack: [],
        currentFolder: null,
        currentPath: [],
        isSearchActive: false,
        searchKeyword: '',
        downloadUrl: '',
        downloadName: '',
        downloadIcon: '',
        lastTabId: 'resource',
        lastTabBtn: null,
        readmeTextCache: new Map(),
        readmeFetching: new Map(),
        readmeRenderT: null,
        downloadReadmeRenderT: null,
        dom: {}
    };

    // ---- DOM 引用 ----
    const D = State.dom;
    D.list = document.getElementById('list');
    D.search = document.getElementById('search');
    D.breadcrumb = document.getElementById('breadcrumb');
    D.readmeBox = document.getElementById('readme');
    D.downloadName = document.getElementById('downloadName');
    D.downloadIcon = document.getElementById('downloadIcon');
    D.downloadReadmeBox = document.getElementById('downloadReadme');
    D.linksContainer = document.getElementById('links');
    D.themeSelect = document.getElementById('themeSelect');
    D.glassSwitch = document.getElementById('glassSwitch');
    D.animationSwitch = document.getElementById('animationSwitch');
    D.musicSwitch = document.getElementById('musicSwitch');
    D.tabIndicator = document.getElementById('tabIndicator');

    // ---- 主题 ----
    const applyTheme = theme => document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' :
    'dark');
    const initTheme = () => {
        const sel = D.themeSelect;
        let saved = Storage.get(CONFIG.storageKeys.theme, null);
        if (!saved) saved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        applyTheme(saved);
        if (sel) {
            sel.value = saved;
            sel.addEventListener('change', () => {
                const v = sel.value === 'light' ? 'light' : 'dark';
                applyTheme(v);
                Storage.set(CONFIG.storageKeys.theme, v);
                toast(`已切换到${v === 'light' ? '浅色' : '深色'}模式`);
            });
        }
        if (Storage.get(CONFIG.storageKeys.theme, null) === null && window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', e =>
                applyTheme(e.matches ? 'light' : 'dark'));
        }
    };

    // ---- 玻璃 / 动画 ----
    const initGlass = () => {
        const sw = D.glassSwitch;
        if (!sw) return;
        const enabled = Storage.getBool(CONFIG.storageKeys.glass, true);
        sw.checked = enabled;
        document.body.classList.toggle('no-glass', !enabled);
        sw.addEventListener('change', () => {
            const v = sw.checked;
            Storage.setBool(CONFIG.storageKeys.glass, v);
            document.body.classList.toggle('no-glass', !v);
        });
    };
    const initAnimation = () => {
        const sw = D.animationSwitch;
        if (!sw) return;
        const enabled = Storage.getBool(CONFIG.storageKeys.animation, true);
        sw.checked = enabled;
        document.body.classList.toggle('no-animation', !enabled);
        sw.addEventListener('change', () => {
            const v = sw.checked;
            Storage.setBool(CONFIG.storageKeys.animation, v);
            document.body.classList.toggle('no-animation', !v);
        });
    };

    // ---- 面包屑 ----
    const renderBreadcrumb = () => {
        const { breadcrumb } = D;
        if (!breadcrumb) return;
        const prefix = State.isSearchActive ? `🔍 ${escapeHtml(State.searchKeyword)}` : '🏠 首页';
        const path = State.currentPath.length ? ` › ${State.currentPath.map(escapeHtml).join(' › ')}` : '';
        breadcrumb.innerHTML = prefix + path;
    };

    // ---- 图标 ----
    const getIconFor = item => {
        if (typeof item.icon === 'number') return CONFIG.icons[item.icon] || CONFIG.icons[0];
        if (typeof item.icon === 'string' && item.icon.length > 0) return item.icon;
        return item.type === 'folder' ? CONFIG.defaultIcon.folder : CONFIG.defaultIcon.file;
    };

    // ---- README ----
    const setReadmeHtml = (box, htmlGetter, typeKey) => {
        if (!box) return;
        const tKey = typeKey === 'download' ? 'downloadReadmeRenderT' : 'readmeRenderT';
        if (State[tKey]) clearTimeout(State[tKey]);
        State[tKey] = setTimeout(() => { try { box.innerHTML = htmlGetter(); } catch (_) {} }, 80);
    };
    const loadReadme = folder => {
        const box = D.readmeBox;
        if (!box) return;
        animateClass(box, 'readme-animation');
        if (!folder?.readme) { setReadmeHtml(box, () => '<h3>资源介绍</h3>暂无介绍', 'root'); return; }
        const key = folder.readme;
        if (State.readmeTextCache.has(key)) {
            setReadmeHtml(box, () => renderReadmeHtml(State.readmeTextCache.get(key), '资源介绍'), 'root');
            return;
        }
        if (!State.readmeFetching.has(key)) {
            const p = fetch(key).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                .then(t => { State.readmeTextCache.set(key, t); return t; })
                .catch(e => { console.warn('[README]', key, e); return null; })
                .finally(() => State.readmeFetching.delete(key));
            State.readmeFetching.set(key, p);
        }
        setReadmeHtml(box, () => '<h3>资源介绍</h3><p style="opacity:.5;">加载中…</p>', 'root');
        State.readmeFetching.get(key).then(t => {
            if (State.currentFolder?.readme !== key) return;
            setReadmeHtml(box, () => t === null ? '<h3>资源介绍</h3>暂无介绍' : renderReadmeHtml(t, '资源介绍'),
            'root');
        });
    };

    // ---- 搜索 ----
    const searchAll = (arr, key, parents = []) => {
        const res = [];
        if (!Array.isArray(arr)) return res;
        const k = key.toLowerCase();
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            const name = (item.name || '').toLowerCase();
            const desc = (item.desc || '').toLowerCase();
            if (name.includes(k) || desc.includes(k)) res.push({ ...item, _sourcePath: [...parents, item.name] });
            if (item.type === 'folder' && Array.isArray(item.children)) res.push(...searchAll(item.children, k, [...parents,
                item.name
            ]));
        }
        return res;
    };
    const initSearch = () => {
        const { search } = D;
        if (!search) return;
        const doSearch = debounce(() => {
            const key = search.value.trim().toLowerCase();
            if (!key) {
                State.isSearchActive = false;
                State.searchKeyword = '';
                State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                State.folderStack = [];
                State.currentPath = [];
                renderFolder();
                return;
            }
            State.isSearchActive = true;
            State.searchKeyword = key;
            State.currentFolder = { children: searchAll(State.data, key), readme: null, _searchResult: true };
            State.folderStack = [];
            State.currentPath = [];
            renderFolder();
        }, CONFIG.searchDebounceMs);
        search.addEventListener('input', doSearch);
        search.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch.flush?.(); });
    };

    // ---- 渲染文件夹 ----
    const renderFolder = () => {
        const { list } = D;
        if (!list) return;
        list.innerHTML = '';
        if (!document.body.classList.contains('no-animation')) {
            animateClass(list, 'folder-animation');
        } else {
            list.classList.remove('folder-animation');
        }
        renderBreadcrumb();

        const frag = document.createDocumentFragment();
        let backAdded = false;

        if (State.folderStack.length > 0 || State.isSearchActive) {
            const back = document.createElement('div');
            back.className = 'card resource-card folder-item';
            back.setAttribute('role', 'button');
            back.setAttribute('tabindex', '0');
            back.dataset.action = 'back';
            back.innerHTML =
                `<span class="sf-icon" style="background:rgba(0,102,204,0.10);color:var(--blue);">←</span>
                              <div class="text-wrap"><h2 style="color:var(--blue);">返回</h2></div>
                              <span class="chevron">›</span>`;
            frag.appendChild(back);
            backAdded = true;
        }

        const children = State.currentFolder?.children || [];
        if (children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'card folder-item';
            empty.innerHTML =
                `<span class="sf-icon" style="background:rgba(120,120,128,0.10);">❔</span>
                               <div class="text-wrap"><h2>${State.isSearchActive ? '无搜索结果' : '此目录为空'}</h2><p>${State.isSearchActive ? '试试其他关键词' : '暂时没有内容'}</p></div>
                               <span class="chevron"></span>`;
            frag.appendChild(empty);
        } else {
            const parts = [];
            for (let i = 0; i < children.length; i++) {
                const item = children[i];
                const icon = getIconFor(item);
                const title = escapeHtml(item.name || '未命名');
                const desc = escapeHtml(item.desc || (item.type === 'folder' ? '文件夹' : '暂无描述'));
                let extra = '';
                if (State.isSearchActive && item._sourcePath?.length > 0) {
                    extra =
                        `<div style="margin-top:3px;font-size:12px;color:var(--sub);">${item._sourcePath.map(escapeHtml).join(' › ')}</div>`;
                }
                parts.push(
                    `<div class="card resource-card folder-item" role="button" tabindex="0" data-idx="${i}">` +
                    `<span class="sf-icon">${icon}</span>` +
                    `<div class="text-wrap">` +
                    `<h2>${title}</h2>` +
                    `<p>${desc}</p>` +
                    extra +
                    `</div>` +
                    `<span class="chevron">${item.type === 'folder' ? '›' : '⬇'}</span>` +
                    `</div>`
                );
            }
            const tpl = document.createElement('template');
            tpl.innerHTML = parts.join('');
            while (tpl.content.firstChild) frag.appendChild(tpl.content.firstChild);
        }

        list.appendChild(frag);
        loadReadme(State.currentFolder);
    };

    // ---- 列表事件委托 ----
    const initListDelegation = () => {
        const list = D.list;
        if (!list) return;
        list.addEventListener('click', e => {
            const card = e.target.closest('.card.resource-card.folder-item');
            if (!card || !list.contains(card)) return;
            if (card.dataset.action === 'back') {
                if (State.folderStack.length > 0) {
                    const parent = State.folderStack.pop();
                    State.currentFolder = parent;
                    State.currentPath.pop();
                    if (State.folderStack.length === 0 && State.isSearchActive) {
                        State.currentFolder = { children: searchAll(State.data, State.searchKeyword),
                            readme: null, _searchResult: true };
                    } else if (State.folderStack.length === 0) {
                        State.isSearchActive = false;
                        State.searchKeyword = '';
                        if (D.search) D.search.value = '';
                        State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                        State.currentPath = [];
                    }
                } else if (State.isSearchActive) {
                    State.isSearchActive = false;
                    State.searchKeyword = '';
                    if (D.search) D.search.value = '';
                    State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                    State.currentPath = [];
                }
                renderFolder();
                loadReadme(State.currentFolder);
                return;
            }
            const idx = Number(card.dataset.idx);
            if (isNaN(idx)) return;
            const children = State.currentFolder?.children || [];
            const item = children[idx];
            if (!item) return;
            const icon = getIconFor(item);
            if (item.type === 'folder') {
                if (State.isSearchActive && State.folderStack.length === 0) {
                    State.isSearchActive = false;
                    if (item._sourcePath) {
                        State.currentPath = [...item._sourcePath];
                        rebuildStackFromPath(item._sourcePath);
                    } else {
                        State.currentPath = [item.name];
                        State.folderStack = [{ children: State.data, readme: CONFIG.defaultReadme }];
                    }
                } else {
                    State.folderStack.push(State.currentFolder);
                    State.currentPath.push(item.name);
                }
                State.currentFolder = item;
                renderFolder();
                loadReadme(item);
            } else {
                openDownload(item.url, item.name, icon, item.readme || '');
            }
        });
        list.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.card.resource-card.folder-item');
            if (!card || !list.contains(card)) return;
            e.preventDefault();
            card.click();
        });
    };

    const rebuildStackFromPath = sp => {
        const stack = [];
        let node = { children: State.data, readme: CONFIG.defaultReadme };
        stack.push(node);
        for (let i = 0; i < sp.length - 1; i++) {
            const next = node.children?.find(x => x?.name === sp[i] && x.type === 'folder');
            if (!next) break;
            stack.push(next);
            node = next;
        }
        State.folderStack = stack;
    };

    // ---- 下载 ----
    const openDownload = (url, name, icon, readmePath) => {
        State.downloadUrl = url || '';
        State.downloadName = name || '';
        State.downloadIcon = (typeof icon === 'string' && icon) ? icon : (CONFIG.icons[icon] || CONFIG.icons[0]);
        if (D.downloadName) D.downloadName.textContent = State.downloadName;
        if (D.downloadIcon) D.downloadIcon.textContent = State.downloadIcon;
        loadDownloadReadme(readmePath);
        const res = document.getElementById('resource');
        const down = document.getElementById('download');
        const activeTabBtn = document.querySelector('.tabs button.active');
        State.lastTabId = 'resource';
        State.lastTabBtn = activeTabBtn || null;
        if (res) res.classList.add('hide');
        if (down) {
            down.classList.remove('hide');
            // ★★★★★ 修复点：强制设置 display 为 block，覆盖内联 none ★★★★★
            down.style.display = 'block';
            triggerReflow(down);
            down.classList.add('page-show');
        }
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };
    const loadDownloadReadme = path => {
        const box = D.downloadReadmeBox;
        if (!box) return;
        if (!path) { setReadmeHtml(box, () => '<h3>文件介绍</h3>暂无介绍', 'download'); return; }
        if (State.readmeTextCache.has(path)) {
            setReadmeHtml(box, () => renderReadmeHtml(State.readmeTextCache.get(path), '文件介绍'), 'download');
            return;
        }
        if (!State.readmeFetching.has(path)) {
            const p = fetch(path).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                .then(t => { State.readmeTextCache.set(path, t); return t; })
                .catch(e => { console.warn('[DL README]', path, e); return null; })
                .finally(() => State.readmeFetching.delete(path));
            State.readmeFetching.set(path, p);
        }
        setReadmeHtml(box, () => '<h3>文件介绍</h3><p style="opacity:.5;">加载中…</p>', 'download');
        State.readmeFetching.get(path).then(t => {
            setReadmeHtml(box, () => t === null ? '<h3>文件介绍</h3>暂无介绍' : renderReadmeHtml(t, '文件介绍'),
                'download');
        });
    };

    window.startDownload = () => {
        if (!State.downloadUrl) { toast('下载链接无效'); return; }
        const btn = document.querySelector('.download-buttons button');
        const orig = btn?.textContent || '';
        if (btn) { btn.textContent = '正在跳转…';
            btn.disabled = true;
            setTimeout(() => { btn.textContent = orig;
                btn.disabled = false; }, CONFIG.downloadRedirectHintMs); }
        try { window.open(State.downloadUrl, '_blank', 'noopener,noreferrer');
            toast('已在新标签打开下载链接'); } catch { location.href = State.downloadUrl; }
    };
    window.copyDownloadLink = async () => {
        if (!State.downloadUrl) { toast('没有可复制的链接'); return; }
        toast(await safeCopyText(State.downloadUrl) ? '链接已复制' : '复制失败');
    };
    window.backResource = () => {
        const down = document.getElementById('download');
        const res = document.getElementById('resource');
        if (down) { down.classList.add('hide');
            down.classList.remove('page-show'); }
        if (res) { res.classList.remove('hide');
            // ★★★★★ 修复点：强制设置 display 为 block，覆盖内联 none ★★★★★
            res.style.display = 'block';
            triggerReflow(res);
            res.classList.add('page-show'); }
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        if (State.lastTabBtn?.isConnected) { State.lastTabBtn.classList.add('active');
            moveTabIndicator(State.lastTabBtn); } else {
            const f = document.querySelector('.tabs button[data-tab="resource"]') || document.querySelector(
                '.tabs button');
            if (f) { f.classList.add('active');
                moveTabIndicator(f); }
        }
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };

    // ---- Tab 指示器 ----
    const moveTabIndicator = btn => {
        const ind = D.tabIndicator;
        if (!ind || !btn) return;
        const pr = btn.parentElement.getBoundingClientRect();
        const r = btn.getBoundingClientRect();
        ind.style.width = r.width + 'px';
        ind.style.transform = `translateX(${r.left - pr.left}px)`;
    };

    // ★★★★★ 修改点 1：showTab 隐藏列表增加 'download' ★★★★★
    window.showTab = (tabId, btn) => {
        ['resource', 'friend', 'author', 'setting', 'download'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hide');
                el.classList.remove('page-show');
                el.style.display = 'none';
            }
        });

        const target = document.getElementById(tabId);
        if (target) {
            target.classList.remove('hide');
            target.style.display = 'block';
            void target.offsetWidth;
            target.classList.add('page-show');
        }

        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        if (btn) {
            btn.classList.add('active');
            moveTabIndicator(btn);
        }

        State.lastTabId = tabId;
        State.lastTabBtn = btn || null;
        window.scrollTo?.({ top: 0, behavior: 'auto' });
    };
    // ---- 加载数据 ----
    const loadResources = () => {
        fetch(CONFIG.dataPath).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(json => {
                const arr = Array.isArray(json) ? json : (json.data || json.children || []);
                if (!Array.isArray(arr)) throw new Error('格式错误');
                State.data = arr;
                State.folderStack = [];
                State.currentFolder = { children: State.data, readme: CONFIG.defaultReadme };
                State.currentPath = [];
                State.isSearchActive = false;
                State.searchKeyword = '';
                renderFolder();
            })
            .catch(e => {
                console.error('[Resources]', e);
                if (D.list) D.list.innerHTML =
                    `<div class="card folder-item"><h2>资源加载失败</h2><p>请检查 data/resources.json</p></div>`;
            });
    };
    const loadLinks = () => {
        const c = D.linksContainer;
        if (!c) return;
        fetch(CONFIG.linksPath).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(json => {
                if (!Array.isArray(json)) throw new Error('非数组');
                c.innerHTML = '';
                if (!json.length) { c.innerHTML = '<div class="card folder-item"><h3>友情链接</h3><p>暂无</p></div>'; return; }
                const frag = document.createDocumentFragment();
                for (let idx = 0; idx < json.length; idx++) {
                    const item = json[idx];
                    const a = document.createElement('a');
                    a.href = item.url || '#';
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.className = 'folder-item';
                    if (idx >= 11) a.style.animationDelay = `${.205 + (idx - 11) * 0.03}s`;
                    const ic = item.icon ? `<span style="margin-right:6px;">${escapeHtml(item.icon)}</span>` : '';
                    const desc = item.desc ?
                        ` <span style="opacity:.5;font-size:12.5px;margin-left:4px;">${escapeHtml(item.desc)}</span>` :
                        '';
                    a.innerHTML = `${ic}${escapeHtml(item.name || '未命名')}${desc}`;
                    frag.appendChild(a);
                }
                c.appendChild(frag);
            })
            .catch(err => { console.warn('[Links]', err);
                c.innerHTML = '<div class="card folder-item"><h3>友情链接</h3><p>暂无</p></div>'; });
    };

    // ---- ★ 加载作者（data/zuozhe.json） ----
    const loadAuthors = () => {
        const container = document.getElementById('authorList');
        if (!container) return;

        fetch('./data/zuozhe.json', { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                if (!Array.isArray(data) || !data.length) {
                    container.innerHTML = `<div class="card glass" style="text-align:center;padding:30px;">📭 暂无作者信息</div>`;
                    return;
                }
                renderAuthors(container, data);
            })
            .catch(err => {
                console.warn('[Authors]', err);
                container.innerHTML = `<div class="card glass" style="text-align:center;padding:30px;">⚠️ 加载失败，请检查 data/zuozhe.json</div>`;
            });
    };

    const renderAuthors = (container, items) => {
        container.innerHTML = '';
        const frag = document.createDocumentFragment();

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'author-card glass';

            const header = document.createElement('div');
            header.className = 'a-header';
            header.innerHTML = `
                <span class="a-icon">${item.icon || '👤'}</span>
                <div class="a-info">
                    <div class="a-name">${escapeHtml(item.name || '未命名')}</div>
                    ${item.role ? `<div class="a-role">${escapeHtml(item.role)}</div>` : ''}
                </div>
                <span class="a-arrow">›</span>
            `;
            card.appendChild(header);

            const expand = document.createElement('div');
            expand.className = 'a-expand';

            const wrap = document.createElement('div');
            wrap.className = 'a-image-wrap';
            if (item.image) {
                const img = document.createElement('img');
                img.src = item.image;
                img.alt = item.name;
                img.loading = 'lazy';
                img.onerror = () => {
                    wrap.innerHTML = `<div class="a-img-placeholder">🖼️ 图片加载失败</div>`;
                };
                wrap.appendChild(img);
            } else {
                wrap.innerHTML = `<div class="a-img-placeholder">📷 暂无图片</div>`;
            }
            expand.appendChild(wrap);

            if (item.desc) {
                const desc = document.createElement('div');
                desc.className = 'a-desc';
                desc.textContent = item.desc;
                expand.appendChild(desc);
            }

            if (item.links && item.links.length) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'a-links';
                item.links.forEach(link => {
                    const a = document.createElement('a');
                    a.className = 'a-link-btn';
                    a.href = link.url || '#';
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.textContent = link.label || '链接';
                    a.addEventListener('click', e => e.stopPropagation());
                    btnGroup.appendChild(a);
                });
                expand.appendChild(btnGroup);
            }

            card.appendChild(expand);
            frag.appendChild(card);
        });

        container.appendChild(frag);

        const cards = container.querySelectorAll('.author-card');
        cards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.a-link-btn')) return;
                const isActive = this.classList.contains('active');
                cards.forEach(c => c.classList.remove('active'));
                if (!isActive) {
                    this.classList.add('active');
                    this.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        });

        if (cards.length === 1) {
            cards[0].classList.add('active');
        }
    };

    // ---- Tab 初始化 ----
    const initTabs = () => {
        const firstTab = document.querySelector('.tabs button');
        if (firstTab) window.showTab('resource', firstTab);
        document.querySelectorAll('.tabs button[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-tab');
                if (id) window.showTab(id, btn);
            });
            btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e
                        .preventDefault();
                    btn.click(); } });
        });
        const bk = document.querySelector('#download [data-action="back"]');
        if (bk && !bk.onclick) bk.addEventListener('click', window.backResource);
        const dl = document.querySelector('#download [data-action="download"]');
        if (dl && !dl.onclick) dl.addEventListener('click', window.startDownload);
        const cp = document.querySelector('#download [data-action="copy"]');
        if (cp && !cp.onclick) cp.addEventListener('click', window.copyDownloadLink);
    };

    // ================================================================
    // 独立音乐播放器（精简修复版）
    // ================================================================
    (function initMusicPlayer() {
        const audio = new Audio();
        let playlist = [];
        let currentIdx = -1;
        let mode = 0;
        let isPlaying = false;

        const mask = document.getElementById('mpMask');
        const closeBtn = document.getElementById('mpClose');
        const openBtn = D.musicSwitch;
        const playBtn = document.getElementById('mpPlay');
        const playIcon = document.getElementById('mpPlayIcon');
        const prevBtn = document.getElementById('mpPrev');
        const nextBtn = document.getElementById('mpNext');
        const bar = document.getElementById('mpBar');
        const fill = document.getElementById('mpFill');
        const thumb = document.getElementById('mpThumb');
        const curTime = document.getElementById('mpCur');
        const durTime = document.getElementById('mpDur');
        const volSlider = document.getElementById('mpVol');
        const volVal = document.getElementById('mpVolVal');
        const fileInput = document.getElementById('mpFile');
        const loadBtn = document.getElementById('mpLoadBtn');
        const listEl = document.getElementById('mpList');
        const nameEl = document.getElementById('mpName');
        const artistEl = document.getElementById('mpArtist');
        const statusEl = document.getElementById('mpStatus');
        const coverEl = document.getElementById('mpCover');
        const modeSeg = document.getElementById('mpModeSeg');
        const modeInd = document.getElementById('mpModeInd');
        const modeItems = modeSeg ? modeSeg.querySelectorAll('.mp-mode-item') : [];

        const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
        const ICON_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

        function fmt(s) {
            if (!s || isNaN(s)) return '0:00';
            const m = Math.floor(s / 60),
                sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        }

        function setStatus(t, type) {
            if (!statusEl) return;
            statusEl.textContent = t || '';
            statusEl.className = 'mp-status ' + (type || '');
            if (t) {
                const saved = t;
                setTimeout(() => { if (statusEl.textContent === saved) setStatus(''); }, 4500);
            }
        }

        function openPlayer() { mask.classList.add('show');
            moveMode(); }

        function closePlayer() { mask.classList.remove('show'); }

        if (openBtn) openBtn.addEventListener('click', openPlayer);
        if (closeBtn) closeBtn.addEventListener('click', closePlayer);
        mask.addEventListener('click', e => { if (e.target === mask) closePlayer(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && mask.classList.contains('show'))
                closePlayer(); });

        function autoLoadMusic() {
            setStatus('正在加载 ' + CONFIG.musicPath + ' ...');
            fetch(CONFIG.musicPath, { cache: 'no-store' })
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(data => {
                    if (!Array.isArray(data)) throw new Error('格式错误');
                    let added = 0;
                    data.forEach(it => {
                        let url = it.url || (it.file ? 'Music/' + it.file : (it.name ? 'Music/' + it.name : ''));
                        if (!url) return;
                        playlist.push({
                            name: it.name || (it.file || '').replace(/\.[^.]+$/, '') || '未命名',
                            artist: it.artist || '来自 Music 目录',
                            url: url,
                            isLocal: false
                        });
                        added++;
                    });
                    setStatus('✅ 已加载 ' + added + ' 首音乐', 'ok');
                    renderList();
                })
                .catch(e => {
                    console.warn('[Music] 加载失败:', e);
                    setStatus('⚠️ 未找到音乐列表，可手动添加音乐', 'err');
                });
        }
        setTimeout(autoLoadMusic, 500);
        if (loadBtn) loadBtn.addEventListener('click', () => {
            playlist = playlist.filter(x => x.isLocal);
            currentIdx = -1;
            renderList();
            autoLoadMusic();
        });

        if (fileInput) fileInput.addEventListener('change', e => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            files.forEach(f => {
                playlist.push({
                    name: f.name.replace(/\.[^.]+$/, ''),
                    artist: (f.size / 1024 / 1024).toFixed(1) + ' MB',
                    url: URL.createObjectURL(f),
                    isLocal: true,
                    file: f
                });
            });
            fileInput.value = '';
            renderList();
            setStatus('已添加 ' + files.length + ' 首本地音乐', 'ok');
            if (currentIdx === -1) playIdx(0);
        });

        function playIdx(i) {
            if (i < 0 || i >= playlist.length) return;
            currentIdx = i;
            const song = playlist[i];
            audio.src = song.url;
            audio.play().then(() => { setPlaying(true); }).catch(err => {
                console.warn('[Music] 播放失败:', err, 'URL:', song.url);
                setStatus('⚠️ 播放失败：' + (err.message || '未知错误'), 'err');
            });
            if (nameEl) nameEl.textContent = song.name;
            if (artistEl) artistEl.textContent = song.artist || '';
            if (coverEl) {
                coverEl.style.backgroundImage = '';
                coverEl.classList.remove('has-pic');
                coverEl.innerHTML =
                    `<div class="mp-cover-placeholder"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`;
            }
            renderList();
        }

        function togglePlay() {
            if (currentIdx === -1) { if (playlist.length) playIdx(0); return; }
            if (audio.paused) audio.play().then(() => { setPlaying(true); }).catch(() => {});
            else { audio.pause();
                setPlaying(false); }
        }

        function setPlaying(p) {
            isPlaying = p;
            if (playIcon) playIcon.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
            renderList();
        }

        function playNext(auto) {
            if (!playlist.length) return;
            if (mode === 1 && auto) { audio.currentTime = 0;
                audio.play(); return; }
            let next;
            if (mode === 2) {
                do { next = Math.floor(Math.random() * playlist.length); } while (next === currentIdx && playlist
                    .length > 1);
            } else {
                next = currentIdx + 1;
                if (next >= playlist.length) {
                    if (auto) { setPlaying(false); return; }
                    next = 0;
                }
            }
            playIdx(next);
        }

        if (playBtn) playBtn.addEventListener('click', togglePlay);
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (!playlist.length) return;
            playIdx((currentIdx - 1 + playlist.length) % playlist.length);
        });
        if (nextBtn) nextBtn.addEventListener('click', () => playNext(false));

        let uiPending = false;
        let lastRatio = 0,
            lastCur = 0;
        audio.addEventListener('timeupdate', () => {
            if (!audio.duration) return;
            lastRatio = audio.currentTime / audio.duration;
            lastCur = audio.currentTime;
            if (uiPending) return;
            uiPending = true;
            requestAnimationFrame(() => {
                uiPending = false;
                if (fill) fill.style.width = (lastRatio * 100) + '%';
                if (curTime) curTime.textContent = fmt(lastCur);
                if (bar && thumb) {
                    const barW = bar.clientWidth - 12;
                    thumb.style.left = (6 + lastRatio * barW) + 'px';
                }
            });
        });
        audio.addEventListener('loadedmetadata', () => {
            if (durTime) durTime.textContent = fmt(audio.duration);
        });
        audio.addEventListener('ended', () => playNext(true));
        audio.addEventListener('play', () => setPlaying(true));
        audio.addEventListener('pause', () => { if (!audio.ended) setPlaying(false); });

        if (bar) {
            bar.addEventListener('click', e => {
                if (!audio.duration) return;
                const rect = bar.getBoundingClientRect();
                const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left - 6;
                const w = rect.width - 12;
                audio.currentTime = Math.max(0, Math.min(1, x / w)) * audio.duration;
            });
        }

        if (volSlider) {
            volSlider.addEventListener('input', () => {
                audio.volume = volSlider.value / 100;
                if (volVal) volVal.textContent = volSlider.value;
            });
            audio.volume = 0.75;
        }

        function moveMode() {
            if (!modeSeg || !modeInd) return;
            const active = modeSeg.querySelector('.mp-mode-item.active');
            if (!active) return;
            const segRect = modeSeg.getBoundingClientRect();
            const aRect = active.getBoundingClientRect();
            modeInd.style.width = (aRect.right - aRect.left) + 'px';
            modeInd.style.transform = 'translateX(' + (aRect.left - segRect.left) + 'px)';
        }
        modeItems.forEach(btn => {
            btn.addEventListener('click', () => {
                modeItems.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                mode = parseInt(btn.dataset.mode, 10);
                moveMode();
            });
        });
        window.addEventListener('resize', moveMode);
        setTimeout(moveMode, 120);

        function renderList() {
            if (!listEl) return;
            if (!playlist.length) {
                listEl.innerHTML =
                    `<div class="mp-empty">🎵 暂无音乐<br/><span style="opacity:.75">从 Music 目录加载 或 选择本地文件</span></div>`;
                return;
            }
            let parts = [];
            for (let i = 0; i < playlist.length; i++) {
                const s = playlist[i];
                const isCur = i === currentIdx;
                const playing = isCur && !audio.paused;
                parts.push(
                    `<div class="mp-item${isCur ? ' current' : ''}${playing ? ' playing' : ''}" data-idx="${i}">` +
                    `<span class="mp-item-num">${i + 1}</span>` +
                    `<span class="mp-item-eq"><span></span><span></span><span></span></span>` +
                    `<div class="mp-item-meta">` +
                    `<div class="mp-item-name">${escapeHtml(s.name)}</div>` +
                    `<div class="mp-item-sub">${escapeHtml(s.artist || (s.isLocal ? '本地音乐' : 'Music 目录'))}</div>` +
                    `</div>` +
                    `</div>`
                );
            }
            listEl.innerHTML = parts.join('');
        }
        listEl && listEl.addEventListener('click', e => {
            const el = e.target.closest('.mp-item');
            if (!el || !listEl.contains(el)) return;
            const idx = parseInt(el.dataset.idx, 10);
            if (idx === currentIdx) togglePlay();
            else playIdx(idx);
        });

        setPlaying(false);
        renderList();
    })();

    // ---- 启动 ----
    const init = () => {
        initTheme();
        initGlass();
        initAnimation();
        initSearch();
        initListDelegation();
        loadResources();
        loadLinks();
        // ★★★★★ 修改点 2：加载作者数据 ★★★★★
        loadAuthors();
        initTabs();

        window.addEventListener('resize', debounce(() => {
            const a = document.querySelector('.tabs button.active');
            if (a) moveTabIndicator(a);
        }, 120));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();