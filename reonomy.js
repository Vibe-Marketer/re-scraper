// ==UserScript==
// @name         VibeCoderz Reonomy Titanium Scraper v3.3
// @namespace    http://tampermonkey.net/
// @version      3.3.0
// @description  PRODUCTION RELEASE: Complete contact extraction with unified card scan + drawer merge. Captures all phones, emails, names & addresses. Auto-stops at end of list.
// @author       VibeCoderz
// @match        https://*.reonomy.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // ╔══════════════════════════════════════════════════════════════════════════════╗
    // ║  VIBECODERZ REONOMY TITANIUM SCRAPER v3.3 - PRODUCTION RELEASE               ║
    // ║  Unified Contact Extraction with Card Scan + Drawer Merge Technology         ║
    // ║  © 2026 VibeCoderz - All Rights Reserved                                     ║
    // ╚══════════════════════════════════════════════════════════════════════════════╝

    // ========================= CONFIGURATION =========================
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10);
    const timeStr = now.toTimeString().slice(0,5).replace(':','-');
    const defaultName = `reonomy-D${dateStr}_T${timeStr}`;

    const STATE = {
        isRunning: false,
        processedCount: 0,
        batchLimit: 0,
        startPage: 1,
        startContact: 1,
        jobName: defaultName,
        searchUrl: '',
        dataStore: [],
        currentRowIndex: 0,
        currentPage: 1,
        totalRowsOnCurrentPage: 0,
        logs: [],
        consecutiveErrors: 0,
        maxErrors: 5,
        debugMode: false
    };

    function loadState() {
        STATE.dataStore = JSON.parse(GM_getValue('vc_data', '[]'));
        STATE.processedCount = STATE.dataStore.length;
        STATE.logs = JSON.parse(GM_getValue('vc_logs', '[]'));
        STATE.searchUrl = GM_getValue('vc_home_url', '');
        STATE.startPage = parseInt(GM_getValue('vc_start_page', '1')) || 1;
        STATE.startContact = parseInt(GM_getValue('vc_start_contact', '1')) || 1;
        STATE.currentPage = parseInt(GM_getValue('vc_current_page', '1')) || 1;
        STATE.currentRowIndex = parseInt(GM_getValue('vc_current_row_index', '0')) || 0;
        STATE.debugMode = GM_getValue('vc_debug_mode', false);

        const autoStart = GM_getValue('vc_auto_start', false);

        if (autoStart) {
            const savedName = GM_getValue('vc_job_name', '');
            if (savedName) {
                STATE.jobName = savedName;
            }
            GM_setValue('vc_auto_start', false);
            // Set running state NOW so UI builds with spinner already showing
            STATE.isRunning = true;
            log("🔄 TITANIUM 1.0 Auto-Resume triggered. Waiting for page to load...");
            setTimeout(startScraper, 4000);
        }
    }

    function saveState() {
        GM_setValue('vc_data', JSON.stringify(STATE.dataStore));
        GM_setValue('vc_logs', JSON.stringify(STATE.logs));
        GM_setValue('vc_home_url', STATE.searchUrl);
        GM_setValue('vc_job_name', STATE.jobName);
        GM_setValue('vc_start_page', STATE.startPage.toString());
        GM_setValue('vc_start_contact', STATE.startContact.toString());
        GM_setValue('vc_current_page', STATE.currentPage.toString());
        GM_setValue('vc_current_row_index', STATE.currentRowIndex.toString());
    }

    // ========================= PHONE VALIDATION =========================
    function isValidPhone(phoneStr) {
        if (!phoneStr || typeof phoneStr !== 'string') return false;
        const cleaned = phoneStr.trim();
        if (cleaned.length < 10) return false;
        if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(cleaned)) return false;
        if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(cleaned)) return false;
        if (/^20\d{2}[-.\s]/.test(cleaned)) return false;
        if (cleaned.length > 20) return false;
        if (/^\d{5}(-\d{4})?$/.test(cleaned)) return false;
        const digitCount = (cleaned.match(/\d/g) || []).length;
        if (digitCount < 10) return false;
        const digitsOnly = cleaned.replace(/\D/g, '');
        if (/^(\d)\1{9,}$/.test(digitsOnly)) return false;
        if (/^0123456789/.test(digitsOnly)) return false;
        return true;
    }

    // ========================= LLC DETECTION =========================
    function isLLCName(name) {
        if (!name) return false;
        const lower = name.toLowerCase();
        return lower.includes('llc') ||
               lower.includes('inc') ||
               lower.includes('corp') ||
               lower.includes('ltd') ||
               lower.includes('l.l.c') ||
               lower.includes('limited') ||
               lower.includes('partnership') ||
               lower.includes('trust') ||
               lower.includes('holdings') ||
               lower.includes('properties') ||
               lower.includes('investments') ||
               lower.includes('enterprises') ||
               lower.includes('company') ||
               lower.includes('co.');
    }

    // ========================= UI CONSTRUCTION =========================
    function createUI() {
        const existing = document.getElementById('vibecoderz-panel');
        if (existing) existing.remove();

        // PRODUCTION COLOR PALETTE
        const ELECTRIC_YELLOW = '#FFEB00';
        const VIBE_ORANGE = '#FF8800';
        const MAGMA_RED = '#FF3D00';
        const DARK_BG = '#0a0a0a';
        const CARD_BG = '#1a1a1a';
        const LAVA_START = '#FF0000';
        const LAVA_MID = '#FF4500';
        const LAVA_END = '#DC143C';
        const SUCCESS_GREEN = '#00E676';
        const BORDER_GLOW = 'rgba(255, 136, 0, 0.6)';

        // Add spinner animation CSS
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes vc-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .vc-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 3px solid rgba(0,0,0,0.3);
                border-top: 3px solid #000;
                border-radius: 50%;
                animation: vc-spin 1s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            #vc-start-btn.running {
                background: linear-gradient(135deg, #888, #666) !important;
                cursor: not-allowed !important;
                box-shadow: none !important;
            }
            #vc-start-btn.running:hover {
                transform: none !important;
            }
        `;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'vibecoderz-panel';
        panel.style.cssText = `
            position: fixed; top: 10px; left: 50%; transform: translateX(-50%); width: 380px;
            background: ${DARK_BG}; color: #fff;
            border: 3px solid ${VIBE_ORANGE};
            z-index: 999999; font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
            border-radius: 16px;
            box-shadow: 0 0 40px ${BORDER_GLOW}, 0 8px 32px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; overflow: hidden;
            backdrop-filter: blur(10px);
        `;

        const limitVal = STATE.batchLimit > 0 ? STATE.batchLimit : "";

        panel.innerHTML = `
            <div id="vc-header" style="background: linear-gradient(135deg, ${MAGMA_RED}, ${VIBE_ORANGE}, ${ELECTRIC_YELLOW}); padding: 16px 18px; cursor: move; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                    <span style="color: #fff; font-weight: 900; font-size: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); letter-spacing: 2px;">
                        VIBECODERZ TITANIUM
                    </span>
                    <span style="color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600; letter-spacing: 1px; margin-top: 2px;">
                        REONOMY SCRAPER v3.3
                    </span>
                </div>
                <span id="vc-min-btn" style="cursor: pointer; color: #fff; font-weight: bold; font-size: 18px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 8px; transition: 0.2s;">—</span>
            </div>

            <div id="vc-body" style="padding: 20px; display: none; flex-direction: column; gap: 16px;">

                <!-- PROGRESS BAR -->
                <div style="background: #333; height: 10px; width: 100%; border-radius: 5px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                    <div id="vc-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, ${VIBE_ORANGE}, ${ELECTRIC_YELLOW}, ${SUCCESS_GREEN}); transition: width 0.4s ease; box-shadow: 0 0 15px ${VIBE_ORANGE}; border-radius: 5px;"></div>
                </div>

                <!-- SEARCH URL -->
                <div style="background: ${CARD_BG}; padding: 14px; border-radius: 10px; border: 1px solid #333;">
                    <label style="font-size: 11px; color: ${VIBE_ORANGE}; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase;">Search URL (Home Base)</label>
                    <input type="text" id="vc-home-url" value="${STATE.searchUrl}" placeholder="Paste your Reonomy list URL here..."
                        style="width: 100%; background: #000; border: 2px solid #333; color: ${ELECTRIC_YELLOW}; padding: 12px; font-size: 13px; border-radius: 8px; margin-top: 8px; transition: border-color 0.2s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='${VIBE_ORANGE}'" onblur="this.style.borderColor='#333'">
                </div>

                <!-- JOB NAME ROW -->
                <div style="background: ${CARD_BG}; padding: 12px; border-radius: 10px; border: 1px solid #333;">
                    <label style="font-size: 10px; color: #888; letter-spacing: 1px; font-weight: 600; text-transform: uppercase;">Job Name</label>
                    <input type="text" id="vc-job-name" value="${STATE.jobName}"
                        style="width: 100%; background: #000; border: 2px solid #333; color: #fff; padding: 10px; font-size: 13px; border-radius: 6px; margin-top: 6px; box-sizing: border-box;">
                </div>

                <!-- PAGE / ROW / LIMIT ROW -->
                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1; background: ${CARD_BG}; padding: 10px; border-radius: 8px; border: 1px solid #333; text-align: center;">
                        <label style="font-size: 9px; color: #888; letter-spacing: 0.5px; font-weight: 600; text-transform: uppercase;">START PAGE</label>
                        <input type="number" id="vc-start-page" value="${STATE.startPage}" placeholder="1" min="1"
                            style="width: 100%; background: #000; border: 2px solid #333; color: ${VIBE_ORANGE}; padding: 8px; font-size: 13px; font-weight: bold; border-radius: 6px; margin-top: 4px; text-align: center; box-sizing: border-box;">
                    </div>
                    <div style="flex: 1; background: ${CARD_BG}; padding: 10px; border-radius: 8px; border: 1px solid #333; text-align: center;">
                        <label style="font-size: 9px; color: #888; letter-spacing: 0.5px; font-weight: 600; text-transform: uppercase;">START ROW</label>
                        <input type="number" id="vc-start-contact" value="${STATE.startContact}" placeholder="1" min="1"
                            style="width: 100%; background: #000; border: 2px solid #333; color: ${ELECTRIC_YELLOW}; padding: 8px; font-size: 13px; font-weight: bold; border-radius: 6px; margin-top: 4px; text-align: center; box-sizing: border-box;">
                    </div>
                    <div style="flex: 1; background: ${CARD_BG}; padding: 10px; border-radius: 8px; border: 1px solid #333; text-align: center;">
                        <label style="font-size: 9px; color: #888; letter-spacing: 0.5px; font-weight: 600; text-transform: uppercase;">LIMIT</label>
                        <input type="number" id="vc-limit" value="${limitVal}" placeholder="ALL"
                            style="width: 100%; background: #000; border: 2px solid #333; color: #fff; padding: 8px; font-size: 13px; font-weight: bold; border-radius: 6px; margin-top: 4px; text-align: center; box-sizing: border-box;">
                    </div>
                </div>

                <!-- ACTION BUTTONS -->
                <div style="display: flex; gap: 12px; margin-top: 4px;">
                    <button id="vc-start-btn" style="flex: 1; padding: 16px; background: linear-gradient(135deg, ${VIBE_ORANGE}, ${ELECTRIC_YELLOW}); color: #000; border: none; cursor: pointer; font-weight: 900; font-size: 15px; border-radius: 10px; letter-spacing: 2px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(255, 235, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.3);">
                        ▶ START
                    </button>
                    <button id="vc-stop-btn" style="flex: 1; padding: 16px; background: linear-gradient(135deg, ${LAVA_START}, ${LAVA_MID}, ${LAVA_END}); color: #fff; border: none; cursor: pointer; font-weight: 900; font-size: 15px; border-radius: 10px; letter-spacing: 2px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(255, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.2); text-shadow: 0 1px 3px rgba(0,0,0,0.5);">
                        ■ STOP
                    </button>
                </div>

                <!-- STATUS DISPLAY -->
                <div style="background: linear-gradient(180deg, ${CARD_BG}, #111); border: 2px solid #333; padding: 16px; border-radius: 12px;">
                    <div id="vc-status" style="font-size: 14px; color: #fff; font-weight: 700; letter-spacing: 0.5px;">⏸ READY TO START</div>
                    <div id="vc-last-captured" style="font-size: 12px; color: ${VIBE_ORANGE}; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                        Last Captured: None
                    </div>
                </div>

                <!-- DEBUG TOGGLE -->
                <div style="display:flex; align-items:center; gap: 10px; padding: 8px 4px;">
                    <input type="checkbox" id="vc-debug-toggle" style="cursor:pointer; width: 18px; height: 18px; accent-color: ${VIBE_ORANGE};">
                    <label for="vc-debug-toggle" style="font-size: 12px; color: #777; cursor:pointer; font-weight: 500;">Show Live Debug Logs</label>
                </div>

                <!-- LOG CONTAINER -->
                <div id="vc-log-container" style="display: none; position: relative; margin-top: 4px;">
                    <div id="vc-log" style="height: 150px; overflow-y: auto; background: #000; border: 2px solid #333; padding: 12px; font-size: 11px; color: ${SUCCESS_GREEN}; white-space: pre-wrap; line-height: 1.6; font-family: 'Consolas', 'Monaco', monospace; border-radius: 10px;"></div>
                    <button id="vc-copy-log" style="position: absolute; top: 10px; right: 10px; padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 6px; transition: 0.2s;">📋 COPY</button>
                </div>

                <!-- FOOTER ACTIONS -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #333;">
                    <button id="vc-clear-mem" style="background: none; border: none; color: #ff5555; font-size: 12px; cursor: pointer; font-weight: 700; padding: 8px 12px; border-radius: 6px; transition: 0.2s;">🗑 Wipe Memory</button>
                    <button id="vc-dl-btn" style="padding: 10px 18px; background: linear-gradient(135deg, #333, #222); color: ${VIBE_ORANGE}; border: 2px solid ${VIBE_ORANGE}; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 8px; transition: 0.2s; letter-spacing: 0.5px;">📥 EXPORT CSV</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Dragging
        const header = document.getElementById('vc-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', e => { isDragging = true; offsetX = e.clientX - panel.getBoundingClientRect().left; offsetY = e.clientY - panel.getBoundingClientRect().top; });
        document.addEventListener('mousemove', e => { if (isDragging) { panel.style.left = (e.clientX - offsetX) + 'px'; panel.style.top = (e.clientY - offsetY) + 'px'; panel.style.right = 'auto'; panel.style.transform = 'none'; }});
        document.addEventListener('mouseup', () => isDragging = false);

        // Button hover effects
        const startBtn = document.getElementById('vc-start-btn');
        const stopBtn = document.getElementById('vc-stop-btn');
        const dlBtn = document.getElementById('vc-dl-btn');

        startBtn.onmouseenter = () => { startBtn.style.transform = 'scale(1.02)'; startBtn.style.boxShadow = '0 6px 20px rgba(255, 235, 0, 0.6)'; };
        startBtn.onmouseleave = () => { startBtn.style.transform = 'scale(1)'; startBtn.style.boxShadow = '0 4px 15px rgba(255, 235, 0, 0.4)'; };
        stopBtn.onmouseenter = () => { stopBtn.style.transform = 'scale(1.02)'; stopBtn.style.boxShadow = '0 6px 20px rgba(255, 0, 0, 0.6)'; };
        stopBtn.onmouseleave = () => { stopBtn.style.transform = 'scale(1)'; stopBtn.style.boxShadow = '0 4px 15px rgba(255, 0, 0, 0.4)'; };
        dlBtn.onmouseenter = () => { dlBtn.style.background = 'linear-gradient(135deg, #444, #333)'; };
        dlBtn.onmouseleave = () => { dlBtn.style.background = 'linear-gradient(135deg, #333, #222)'; };

        // Function to update start button appearance and panel interactivity
        function updateStartButton() {
            const btn = document.getElementById('vc-start-btn');
            const panel = document.getElementById('vibecoderz-panel');
            if (!btn) {
                console.log('[TITANIUM] updateStartButton: button not found');
                return;
            }

            console.log('[TITANIUM] updateStartButton: isRunning =', STATE.isRunning);

            if (STATE.isRunning) {
                btn.innerHTML = '<span class="vc-spinner"></span>RUNNING...';
                btn.classList.add('running');
                btn.disabled = true;
                console.log('[TITANIUM] Button set to RUNNING state');
                // Make panel click-through while running (except stop button)
                if (panel) {
                    panel.style.pointerEvents = 'none';
                    const stopBtn = document.getElementById('vc-stop-btn');
                    if (stopBtn) stopBtn.style.pointerEvents = 'auto';
                }
            } else {
                btn.innerHTML = '▶ START';
                btn.classList.remove('running');
                btn.disabled = false;
                console.log('[TITANIUM] Button set to START state');
                // Restore panel interactivity when stopped
                if (panel) panel.style.pointerEvents = 'auto';
            }
        }

        // Event handlers
        startBtn.onclick = () => {
            if (STATE.isRunning) return; // Prevent double-clicks
            STATE.isRunning = true; // Set running state FIRST
            updateStartButton();    // Then update button to show spinner
            // Small delay to ensure browser repaints the button before starting
            setTimeout(initiateStart, 100);
        };
        stopBtn.onclick = () => {
            STATE.isRunning = false;
            updateStartButton();
            log("⏹ EXTRACTION HALTED BY USER");
            downloadCSV();
        };

        // Make updateStartButton available globally for other functions
        window.vcUpdateStartButton = updateStartButton;
        document.getElementById('vc-dl-btn').onclick = downloadCSV;
        document.getElementById('vc-min-btn').onclick = () => { const b = document.getElementById('vc-body'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; };
        document.getElementById('vc-start-page').onchange = (e) => { STATE.startPage = parseInt(e.target.value) || 1; saveState(); };
        document.getElementById('vc-start-contact').onchange = (e) => { STATE.startContact = parseInt(e.target.value) || 1; saveState(); };
        document.getElementById('vc-limit').onchange = (e) => { STATE.batchLimit = parseInt(e.target.value) || 0; };
        document.getElementById('vc-job-name').addEventListener('input', (e) => { STATE.jobName = e.target.value; saveState(); });
        document.getElementById('vc-home-url').addEventListener('input', (e) => { STATE.searchUrl = e.target.value; saveState(); });
        document.getElementById('vc-copy-log').onclick = () => { GM_setClipboard(STATE.logs.join('\n')); alert("Logs copied."); };
        document.getElementById('vc-clear-mem').onclick = () => { if(confirm("WIPE ALL DATA?")) { GM_deleteValue('vc_data'); GM_deleteValue('vc_logs'); GM_deleteValue('vc_current_page'); GM_deleteValue('vc_current_row_index'); GM_deleteValue('vc_debug_mode'); GM_deleteValue('vc_job_name'); GM_deleteValue('vc_home_url'); location.reload(); } };

        // Debug toggle
        const debugToggle = document.getElementById('vc-debug-toggle');
        const logContainer = document.getElementById('vc-log-container');
        debugToggle.checked = STATE.debugMode;
        logContainer.style.display = STATE.debugMode ? 'block' : 'none';
        debugToggle.onchange = (e) => {
            STATE.debugMode = e.target.checked;
            GM_setValue('vc_debug_mode', STATE.debugMode);
            logContainer.style.display = STATE.debugMode ? 'block' : 'none';
        };

        log(`🚀 TITANIUM 1.0 Ready. Restored ${STATE.dataStore.length} records. Page ${STATE.currentPage}, Row ${STATE.currentRowIndex + 1}.`);
        updateStatus();
        updateStartButton(); // Set correct button state (spinner if auto-resuming)
        document.getElementById('vc-log').innerText = STATE.logs.slice(-40).join('\n');
        document.getElementById('vc-home-url').value = STATE.searchUrl;
        document.getElementById('vc-job-name').value = STATE.jobName;
    }

    function log(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] ${msg}`;
        STATE.logs.push(entry);
        if (STATE.logs.length > 500) STATE.logs.shift();
        GM_setValue('vc_logs', JSON.stringify(STATE.logs));
        const box = document.getElementById('vc-log');
        if(box) {
            box.innerText += `\n${entry}`;
            box.scrollTop = box.scrollHeight;
        }
        console.log(`[TITANIUM] ${msg}`);
    }

    function updateStatus(msg) {
        const s = document.getElementById('vc-status');
        const pBar = document.getElementById('vc-progress-bar');
        const lastCap = document.getElementById('vc-last-captured');

        if(s) {
            if (STATE.batchLimit > 0) {
                const pct = Math.min(100, Math.round((STATE.processedCount / STATE.batchLimit) * 100));
                if (pBar) pBar.style.width = `${pct}%`;
                s.innerHTML = `🔄 Page <span style="color:#FF8800;font-weight:900">${STATE.currentPage}</span> &nbsp;|&nbsp; Captured: <span style="color:#FFEB00;font-weight:900">${STATE.processedCount}</span> / ${STATE.batchLimit} <span style="color:#888">(${pct}%)</span>`;
            } else if (STATE.totalRowsOnCurrentPage > 0) {
                const rowDisplay = Math.min(STATE.currentRowIndex + 1, STATE.totalRowsOnCurrentPage);
                const pagePct = Math.min(100, Math.round((rowDisplay / STATE.totalRowsOnCurrentPage) * 100));
                if (pBar) pBar.style.width = `${pagePct}%`;
                s.innerHTML = `🔄 Page <span style="color:#FF8800;font-weight:900">${STATE.currentPage}</span> &nbsp;|&nbsp; Row <span style="color:#FFEB00">${rowDisplay}</span>/${STATE.totalRowsOnCurrentPage} &nbsp;|&nbsp; Total: <span style="color:#00E676;font-weight:900">${STATE.processedCount}</span>`;
            } else {
                if (pBar) pBar.style.width = '0%';
                s.innerHTML = `⏳ Initializing... <span style="color:#FFEB00">${STATE.processedCount}</span> records loaded`;
            }

            const lastRecord = STATE.dataStore[STATE.dataStore.length - 1];
            if (lastRecord && lastRecord.contacts && lastRecord.contacts.length > 0) {
                lastCap.innerText = `Last Captured: ${lastRecord.contacts[0].name}`;
            } else if (lastRecord) {
                lastCap.innerText = `Last Captured: ${lastRecord.address_full.substring(0,25)}...`;
            }
        }
        if (msg) log(msg);
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    async function waitForElement(sel, timeout=5000) {
        let t=0;
        while(t<timeout){
            const el=document.querySelector(sel);
            if(el) return el;
            await wait(200);
            t+=200;
        }
        return null;
    }

    // Reliable click that scrolls element into view and dispatches proper mouse events
    async function reliableClick(el, description) {
        log(`   🖱️ Clicking: ${description}`);

        // Step 1: Scroll element to center of viewport
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await wait(150);

        // Step 2: Get fresh bounding rect after scroll
        const rect = el.getBoundingClientRect();
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        // Step 3: Dispatch mouse events in proper sequence
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: centerX,
            clientY: centerY,
            button: 0
        };

        el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        await wait(50);
        el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        await wait(50);
        el.dispatchEvent(new MouseEvent('click', eventOptions));

        return true;
    }

    // ========================= DRAWER HELPERS =========================
    async function waitForDrawerClose(maxAttempts = 15, intervalMs = 400) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const drawer = document.querySelector('[role="presentation"].MuiDrawer-root, .MuiDrawer-paper, [role="dialog"]');
            const nameInDrawer = document.querySelector('h6[data-testid="company-contact-name"]');
            if (!drawer && !nameInDrawer) {
                log(`   Drawer closed (attempt ${attempt})`);
                return true;
            }
            await wait(intervalMs);
        }
        log(`   Drawer may not have closed properly`);
        return false;
    }

    // ------------------- Wait for Drawer with Name -------------------
    async function waitForDrawerWithName(expectedName, maxAttempts = 15, intervalMs = 400) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const nameEl = document.querySelector('h6[data-testid="company-contact-name"]');
            if (nameEl) {
                const currentName = nameEl.innerText.trim();
                const nameMatches = expectedName && currentName.includes(expectedName.split(' ')[0]);
                log(`   Drawer shows: "${currentName}" ${nameMatches ? '(matches expected)' : ''} (attempt ${attempt})`);
                return { found: true, name: currentName, matchesExpected: nameMatches };
            }
            await wait(intervalMs);
        }
        log(`   Drawer did not open for expected: "${expectedName}"`);
        return { found: false, name: null, matchesExpected: false };
    }

    async function initiateStart() {
        const limitInput = document.getElementById('vc-limit');
        if (limitInput) {
            const val = parseInt(limitInput.value);
            STATE.batchLimit = isNaN(val) ? 0 : val;
            log(`Limit: ${STATE.batchLimit === 0 ? 'ALL' : STATE.batchLimit}`);
        }

        const startPageInput = document.getElementById('vc-start-page');
        if (startPageInput) {
            const val = parseInt(startPageInput.value);
            STATE.startPage = isNaN(val) || val < 1 ? 1 : val;
            STATE.currentPage = STATE.startPage;
            log(`Starting from page: ${STATE.startPage}`);
        }

        const startContactInput = document.getElementById('vc-start-contact');
        if (startContactInput) {
            const val = parseInt(startContactInput.value);
            STATE.startContact = isNaN(val) || val < 1 ? 1 : val;
            log(`Starting from row: ${STATE.startContact}`);
        }

        if (!STATE.searchUrl) {
            alert("Please enter SEARCH URL");
            STATE.isRunning = false;
            if (window.vcUpdateStartButton) window.vcUpdateStartButton();
            return;
        }

        let targetUrl = STATE.searchUrl;
        if (STATE.startPage > 1) {
            if (targetUrl.includes('page=')) {
                targetUrl = targetUrl.replace(/page=\d+/i, `page=${STATE.startPage}`);
            } else {
                const separator = targetUrl.includes('?') ? '&' : '?';
                targetUrl = `${targetUrl}${separator}page=${STATE.startPage}`;
            }
            log(`Modified URL with page ${STATE.startPage}`);
        }

        if (window.location.href !== targetUrl) {
            log(`Redirecting to page ${STATE.startPage}...`);
            saveState();
            GM_setValue('vc_auto_start', true);
            window.location.href = targetUrl;
            return;
        }
        startScraper();
    }

    // ========================= CORE ENGINE =========================

    async function startScraper() {
        // Set running state (may already be set by click handler, or called from auto-resume)
        STATE.isRunning = true;
        if (window.vcUpdateStartButton) window.vcUpdateStartButton();
        STATE.consecutiveErrors = 0;
        log("🔥 TITANIUM 1.0 ENGINE STARTED — Unified Contact Extraction Active");

        if (window.location.href.includes('/!/property/')) {
            log("On property page, redirecting to search URL...");
            saveState();
            GM_setValue('vc_auto_start', true);
            window.location.href = STATE.searchUrl;
            return;
        }

        // First, ensure we're on the Properties tab (not Market Info or Owners)
        const propertiesTab = document.querySelector('button[data-testid="properties-pivot-id"]');
        if (propertiesTab) {
            const isSelected = propertiesTab.classList.contains('Mui-selected') || propertiesTab.getAttribute('aria-selected') === 'true';
            if (!isSelected) {
                log("Clicking Properties tab...");
                propertiesTab.click();
                await wait(2000);
            } else {
                log("Properties tab already selected.");
            }
        }

        // Then click Table View
        log("Looking for Table View button...");
        await wait(1000);
        const tableBtn = document.querySelector('#summary-cards-table-view-btn');
        if (tableBtn) {
            log("Clicking Table View...");
            tableBtn.click();
            await wait(3000);
        } else {
            log("Table View already active (or button not found).");
        }

        const rows = await waitForElement('tbody tr.MuiTableRow-root', 8000);
        if (!rows) { log("No table rows found."); STATE.isRunning = false; if(window.vcUpdateStartButton) window.vcUpdateStartButton(); return; }

        const rowCount = document.querySelectorAll('tbody tr.MuiTableRow-root').length;
        STATE.totalRowsOnCurrentPage = rowCount;
        log(`Found ${rowCount} properties on page ${STATE.currentPage}.`);

        if (STATE.currentPage === STATE.startPage && STATE.startContact > 1) {
            if (STATE.startContact > rowCount) {
                log(`START ROW (${STATE.startContact}) exceeds available rows (${rowCount}). Starting from row 1.`);
                STATE.currentRowIndex = 0;
            } else {
                STATE.currentRowIndex = STATE.startContact - 1;
                log(`Skipping to row ${STATE.startContact} (index ${STATE.currentRowIndex})...`);
            }
        }

        saveState();
        processLoop();
    }

    async function processLoop() {
        if (!STATE.isRunning) return;

        if (STATE.batchLimit > 0 && STATE.processedCount >= STATE.batchLimit) {
            log(`Limit reached (${STATE.batchLimit}). Downloading...`);
            STATE.isRunning = false;
            if(window.vcUpdateStartButton) window.vcUpdateStartButton();
            downloadCSV();
            return;
        }

        const rows = document.querySelectorAll('tbody tr.MuiTableRow-root');

        // TITANIUM 1.0: ROBUST PAGINATION WITH DUAL-CONDITION LAST PAGE DETECTION
        if (STATE.currentRowIndex >= rows.length) {
            // Stop if: fewer than 50 rows (standard last page) OR fewer rows than expected (edge case protection)
            if (rows.length < 50 || rows.length < STATE.totalRowsOnCurrentPage) {
                log(`✅ LAST PAGE DETECTED: ${rows.length} rows found. Extraction complete!`);
                log(`📊 TOTAL RECORDS CAPTURED: ${STATE.processedCount}`);
                STATE.isRunning = false;
                if(window.vcUpdateStartButton) window.vcUpdateStartButton();
                downloadCSV();
                return;
            }

            log("End of page " + STATE.currentPage + ". Going to next page via URL...");
            STATE.currentPage++;
            STATE.currentRowIndex = 0;

            let nextUrl = STATE.searchUrl;
            if (nextUrl.includes('page=')) {
                nextUrl = nextUrl.replace(/page=\d+/i, `page=${STATE.currentPage}`);
            } else {
                const separator = nextUrl.includes('?') ? '&' : '?';
                nextUrl = `${nextUrl}${separator}page=${STATE.currentPage}`;
            }

            log(`Navigating to page ${STATE.currentPage}...`);
            saveState();
            GM_setValue('vc_auto_start', true);
            window.location.href = nextUrl;
            return;
        }

        const row = rows[STATE.currentRowIndex];
        const cells = row.querySelectorAll('td, th');

        // Get table data for reference
        const contactInfoCell = cells[8]?.innerText?.trim() || "N/A";
        const reportedOwnerCell = cells[9]?.innerText?.trim() || "";

        log(`[Row ${STATE.currentRowIndex + 1}] Processing property...`);

        const baseData = {
            address_full: row.querySelector('[data-testid="table-row-property-address"]')?.innerText?.trim() || "N/A",
            sale_recorded_date: cells[2]?.innerText || "",
            sale_amount: cells[3]?.innerText || "",
            year_built: cells[4]?.innerText || "",
            gross_building_area: cells[5]?.innerText || "",
            property_type: cells[7]?.innerText || "",
            reported_owner_table: contactInfoCell,
            reported_llc_table: reportedOwnerCell
        };

        const link = row.querySelector('a[data-testid="table-row-property-address"]');
        if (link) {
            link.click();
            await wait(3500);

            // V44: UNIFIED APPROACH - Always scan property page first, then check View Contacts
            await scrapePropertyUnified(baseData);
        } else {
            log("No link found. Skipping.");
            STATE.currentRowIndex++;
            processLoop();
        }
    }

    // ========================= UNIFIED PROPERTY SCRAPING =========================
    // Step 1: Scan property page for all person icon boxes
    // Step 2: Check for "View Contacts" and supplement missing data
    async function scrapePropertyUnified(baseData, retryAttempt = 0) {
        if (!STATE.isRunning) return;

        const MAX_PAGE_RETRIES = 3;

        let contacts = [];
        log(`PHASE 1: Scanning property page for person icon boxes...${retryAttempt > 0 ? ` (retry ${retryAttempt})` : ''}`);

        // Wait for page to load (longer on retries)
        const extraWait = retryAttempt * 1000;
        await waitForElement('div.MuiBox-root', 3000 + extraWait);

        // Scroll to trigger lazy loading
        log("   Scrolling to load all content...");
        window.scrollTo(0, 0);
        await wait(800 + extraWait);
        window.scrollTo(0, document.body.scrollHeight / 2);
        await wait(800 + extraWait);
        window.scrollTo(0, document.body.scrollHeight);
        await wait(1000 + extraWait);
        window.scrollTo(0, 0);
        await wait(1000 + extraWait);

        // Find ALL boxes containing the person icon SVG
        // Person icon identified by SVG path starting with "M12.0478 1.5"
        let allBoxes = document.querySelectorAll('div.MuiBox-root');
        log(`   Found ${allBoxes.length} MuiBox-root elements to scan...`);

        let personIconBoxCount = 0;

        // Helper function to scan boxes for contacts
        function scanBoxesForContacts(boxes) {
            let count = 0;
            boxes.forEach((box) => {
                const svgs = box.querySelectorAll('svg.MuiSvgIcon-root');
                let hasPersonIcon = false;

                svgs.forEach(svg => {
                    const paths = svg.querySelectorAll('path');
                    paths.forEach(path => {
                        const d = path.getAttribute('d') || '';
                        if (d.includes('M12.0478 1.5') || d.includes('12.0478')) {
                            hasPersonIcon = true;
                        }
                    });
                });

                const hasPhoneIcon = box.querySelector('svg[data-testid="icon-phone-filled"]');

                if (hasPersonIcon || hasPhoneIcon) {
                    count++;
                    log(`   Found contact box #${count}`);

                    const contactData = extractContactFromBox(box, baseData);

                    if (contactData && contactData.name !== "N/A" && contactData.name !== "View Profile") {
                        const isDuplicate = contacts.some(c => namesAreSimilar(c.name, contactData.name));
                        if (!isDuplicate) {
                            contacts.push(contactData);
                            log(`   ✅ PAGE CAPTURE: ${contactData.name}`);
                            if (contactData.phones.length > 0) {
                                log(`      📞 Phones: ${contactData.phones.join(', ')}`);
                            }
                            if (contactData.emails.length > 0) {
                                log(`      📧 Emails: ${contactData.emails.join(', ')}`);
                            }
                            if (contactData.address) {
                                log(`      🏠 Address: ${contactData.address}`);
                            }
                            if (contactData.phones.length === 0 && contactData.emails.length === 0 && !contactData.address) {
                                log(`      ⚠️ No contact details found`);
                            }
                        } else {
                            const existingIdx = contacts.findIndex(c => namesAreSimilar(c.name, contactData.name));
                            if (existingIdx >= 0) {
                                contacts[existingIdx] = mergeContactData(contacts[existingIdx], contactData);
                                log(`   🔄 Merged duplicate: ${contactData.name}`);
                            }
                        }
                    }
                }
            });
            return count;
        }

        personIconBoxCount = scanBoxesForContacts(allBoxes);

        // PAGE LOAD VALIDATION: Check for person icons (the primary contact indicator)
        // Person icon SVG has path starting with "M12.0478 1.5" or phone icon
        function countPersonIcons() {
            let count = 0;
            const allSvgs = document.querySelectorAll('svg.MuiSvgIcon-root');
            allSvgs.forEach(svg => {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                    const d = path.getAttribute('d') || '';
                    if (d.includes('M12.0478 1.5') || d.includes('12.0478')) {
                        count++;
                    }
                });
            });
            return count;
        }

        const personIconCount = countPersonIcons();
        const phoneIconCount = document.querySelectorAll('svg[data-testid="icon-phone-filled"]').length;
        const anyPhoneElements = document.querySelectorAll('[data-testid="people-contact-phone-id"]');
        const anyEmailIcons = document.querySelectorAll('svg[data-testid="icon-mail-filled"]');

        // Page has contact content if we found person icons, phone icons, phone numbers, or email icons
        const pageHasContactContent = personIconCount > 0 || phoneIconCount > 0 || anyPhoneElements.length > 0 || anyEmailIcons.length > 0 || personIconBoxCount > 0;

        log(`   📍 Page validation: ${personIconCount} person icons, ${phoneIconCount} phone icons, ${anyPhoneElements.length} phone elements, ${anyEmailIcons.length} email icons`);

        if (!pageHasContactContent) {
            if (retryAttempt === 0) {
                // First retry: just wait ~1 second and re-scan (no navigation)
                log(`   ⚠️ No contact info found - waiting and re-scanning...`);
                await wait(1200);

                // Quick re-scroll
                window.scrollTo(0, document.body.scrollHeight);
                await wait(600);
                window.scrollTo(0, 0);
                await wait(400);

                // Re-check for contact content using same indicators
                const personIconsRetry = countPersonIcons();
                const phoneIconsRetry = document.querySelectorAll('svg[data-testid="icon-phone-filled"]').length;
                const phonesRetry = document.querySelectorAll('[data-testid="people-contact-phone-id"]');
                const emailsRetry = document.querySelectorAll('svg[data-testid="icon-mail-filled"]');

                // Re-scan boxes
                allBoxes = document.querySelectorAll('div.MuiBox-root');
                personIconBoxCount = scanBoxesForContacts(allBoxes);

                const pageHasContactContentRetry = personIconsRetry > 0 || phoneIconsRetry > 0 || phonesRetry.length > 0 || emailsRetry.length > 0 || personIconBoxCount > 0;

                log(`   📍 Retry validation: ${personIconsRetry} person icons, ${phoneIconsRetry} phone icons, ${phonesRetry.length} phone elements, ${emailsRetry.length} email icons`);

                if (pageHasContactContentRetry) {
                    log(`   ✅ Contact content loaded after wait - found ${personIconBoxCount} contact boxes`);
                } else {
                    // Still nothing - do the full reload
                    return scrapePropertyUnified(baseData, 1);
                }
            } else if (retryAttempt < MAX_PAGE_RETRIES) {
                log(`   ⚠️ Page still not loaded (attempt ${retryAttempt})`);
                log(`   🔄 Navigating back and re-clicking property...`);

                // Navigate back and re-click the property link
                const backBtn = document.querySelector('button[aria-label="Back"]');
                if (backBtn) backBtn.click();
                else window.history.back();

                await wait(2000 + (retryAttempt * 1000));

                // Wait for table to reappear
                const rows = await waitForElement('tbody tr.MuiTableRow-root', 8000);
                if (rows) {
                    const allRows = document.querySelectorAll('tbody tr.MuiTableRow-root');
                    const targetRow = allRows[STATE.currentRowIndex];
                    if (targetRow) {
                        const link = targetRow.querySelector('a[data-testid="table-row-property-address"]');
                        if (link) {
                            log(`   🔗 Re-clicking property link...`);
                            link.click();
                            await wait(4000 + (retryAttempt * 1500));
                            return scrapePropertyUnified(baseData, retryAttempt + 1);
                        }
                    }
                }

                // If we couldn't navigate back properly, try a page refresh
                log(`   🔄 Attempting page refresh...`);
                window.location.reload();
                return;
            } else {
                log(`   ❌ Page failed to load after ${MAX_PAGE_RETRIES} attempts`);
            }
        }

        // Phase 1 Summary with totals
        const p1TotalPhones = contacts.reduce((sum, c) => sum + c.phones.length, 0);
        const p1TotalEmails = contacts.reduce((sum, c) => sum + c.emails.length, 0);
        const p1TotalAddresses = contacts.filter(c => c.address).length;
        log(`   ═══════════════════════════════════════════════════════`);
        log(`   📊 PHASE 1 COMPLETE: ${contacts.length} contacts from ${personIconBoxCount} person boxes`);
        log(`   📊 PHASE 1 TOTALS: ${p1TotalPhones} phones | ${p1TotalEmails} emails | ${p1TotalAddresses} addresses`);
        log(`   ═══════════════════════════════════════════════════════`);

        // PHASE 2: ALWAYS click View Contacts if it exists, then compare & fill gaps
        log("📋 PHASE 2: Searching for View Contacts button...");

        // Now search for View Contacts button (only used here, not for page validation)
        const viewContactsBtn = findViewContactsButton();

        if (viewContactsBtn) {
            log("👆 Clicking View Contacts to gather comparison data...");
            viewContactsBtn.click();
            await wait(4000);

            // Get contacts from View Contacts drawer
            const viewContactsData = await scrapeViewContactsTable();
            log(`   📋 View Contacts returned ${viewContactsData.length} contacts`);

            // Track totals for Phase 2
            let totalNewPhones = 0;
            let totalNewEmails = 0;
            let totalNewAddresses = 0;
            let totalSkippedPhones = 0;
            let totalSkippedEmails = 0;
            let newContactsAdded = 0;

            viewContactsData.forEach(vcContact => {
                const existingIdx = contacts.findIndex(c => namesAreSimilar(c.name, vcContact.name));

                if (existingIdx >= 0) {
                    // Contact exists - compare and merge
                    const existing = contacts[existingIdx];
                    const beforePhones = existing.phones.length;
                    const beforeEmails = existing.emails.length;
                    const hadAddress = existing.address ? true : false;

                    contacts[existingIdx] = mergeContactData(existing, vcContact);
                    const after = contacts[existingIdx];

                    // Calculate what was new vs skipped
                    const newPhones = after.phones.length - beforePhones;
                    const newEmails = after.emails.length - beforeEmails;
                    const newAddr = (!hadAddress && after.address) ? 1 : 0;
                    const skippedPhones = vcContact.phones.length - newPhones;
                    const skippedEmails = vcContact.emails.length - newEmails;

                    totalNewPhones += newPhones;
                    totalNewEmails += newEmails;
                    totalNewAddresses += newAddr;
                    totalSkippedPhones += skippedPhones;
                    totalSkippedEmails += skippedEmails;

                    log(`   🔍 VIEW CONTACTS: ${vcContact.name}`);
                    log(`      ➕ NEW: ${newPhones} phones | ${newEmails} emails | ${newAddr} address`);
                    log(`      ⏭️ SKIPPED (already had): ${skippedPhones} phones | ${skippedEmails} emails`);
                } else {
                    // New contact not found in Phase 1
                    contacts.push(vcContact);
                    newContactsAdded++;
                    log(`   ➕ NEW CONTACT FROM VIEW CONTACTS: ${vcContact.name}`);
                    if (vcContact.phones.length > 0) {
                        log(`      📞 Phones: ${vcContact.phones.join(', ')}`);
                    }
                    if (vcContact.emails.length > 0) {
                        log(`      📧 Emails: ${vcContact.emails.join(', ')}`);
                    }
                    if (vcContact.address) {
                        log(`      🏠 Address: ${vcContact.address}`);
                    }
                    if (vcContact.phones.length === 0 && vcContact.emails.length === 0 && !vcContact.address) {
                        log(`      ⚠️ No contact details found`);
                    }
                    totalNewPhones += vcContact.phones.length;
                    totalNewEmails += vcContact.emails.length;
                    totalNewAddresses += vcContact.address ? 1 : 0;
                }
            });

            // Phase 2 Summary
            const p2TotalPhones = contacts.reduce((sum, c) => sum + c.phones.length, 0);
            const p2TotalEmails = contacts.reduce((sum, c) => sum + c.emails.length, 0);
            const p2TotalAddresses = contacts.filter(c => c.address).length;
            log(`   ═══════════════════════════════════════════════════════`);
            log(`   📊 PHASE 2 COMPLETE: ${viewContactsData.length} contacts checked`);
            log(`   📊 ADDED: ${totalNewPhones} phones | ${totalNewEmails} emails | ${totalNewAddresses} addresses`);
            log(`   📊 SKIPPED: ${totalSkippedPhones} phones | ${totalSkippedEmails} emails (duplicates)`);
            log(`   📊 NEW CONTACTS: ${newContactsAdded}`);
            log(`   ═══════════════════════════════════════════════════════`);
            log(`   📊 FINAL TOTALS: ${contacts.length} contacts | ${p2TotalPhones} phones | ${p2TotalEmails} emails | ${p2TotalAddresses} addresses`);
            log(`   ═══════════════════════════════════════════════════════`);
        } else {
            log("   ℹ️ No View Contacts button found - using Phase 1 data only");
        }

        // If we still have no contacts, try fallback methods
        if (contacts.length === 0) {
            log("   No contacts found, trying fallback methods...");
            contacts = await tryFallbackExtraction(baseData);
        }

        // Final fallback: just save the table name
        if (contacts.length === 0) {
            contacts.push({
                name: baseData.reported_owner_table,
                phones: [],
                emails: [],
                address: "",
                note: "No contact data found on page"
            });
            log(`   ⚠️ Final fallback: Saved table name only: ${baseData.reported_owner_table}`);
        }

        log(`✅ EXTRACTION COMPLETE: ${contacts.length} contacts captured for this property`);
        finalizeRecord(baseData, contacts);
    }

    // ------------------- Extract Contact from Person Icon Box -------------------
    function extractContactFromBox(box, baseData) {
        // Get name
        let name = "N/A";

        // Try various name selectors
        const h6Name = box.querySelector('h6[data-testid="company-contact-name"]');
        const personLink = box.querySelector('a[href*="/!/person/"]');
        const h6Generic = box.querySelector('h6');
        const h5Generic = box.querySelector('h5');

        if (h6Name && h6Name.innerText.trim() && h6Name.innerText.trim() !== "View Profile") {
            name = h6Name.innerText.trim();
        } else if (personLink && personLink.innerText.trim() && personLink.innerText.trim() !== "View Profile") {
            name = personLink.innerText.trim();
        } else if (h6Generic && h6Generic.innerText.trim() && h6Generic.innerText.trim() !== "View Profile") {
            name = h6Generic.innerText.trim();
        } else if (h5Generic && h5Generic.innerText.trim() && h5Generic.innerText.trim() !== "View Profile") {
            name = h5Generic.innerText.trim();
        }

        // Skip if it's an LLC (we want persons)
        if (isLLCName(name)) {
            log(`   ⏭️ Skipping LLC: ${name}`);
            return null;
        }

        // Get phones
        const phones = [];
        box.querySelectorAll('[data-testid="people-contact-phone-id"]').forEach(p => {
            const txt = p.innerText.trim();
            if (txt && txt !== "Mobile" && txt !== "Landline" && !phones.includes(txt) && isValidPhone(txt)) {
                phones.push(txt);
            }
        });

        // Also scan box text for phone patterns
        const boxText = box.innerText || "";
        const phoneMatches = boxText.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
        phoneMatches.forEach(phone => {
            const cleaned = phone.trim();
            if (!phones.includes(cleaned) && isValidPhone(cleaned)) {
                phones.push(cleaned);
            }
        });

        // Get emails
        const emails = [];
        box.querySelectorAll('svg[data-testid="icon-mail-filled"]').forEach(icon => {
            const container = icon.closest('div')?.parentElement;
            if (container) {
                const txt = container.innerText.replace(/Email/gi, '').trim();
                if (txt.includes('@') && !emails.includes(txt) && !txt.includes('reonomy.com')) {
                    emails.push(txt);
                }
            }
        });

        // Also scan box text for email patterns
        const emailMatches = boxText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        emailMatches.forEach(email => {
            if (!emails.includes(email) && !email.includes('reonomy.com')) {
                emails.push(email);
            }
        });

        // Get address if available
        let address = "";
        const addressEl = box.querySelector('[class*="address"], [data-testid*="address"]');
        if (addressEl) {
            address = addressEl.innerText.trim();
        }

        // Only return if we have some contact info
        if (name === "N/A" && phones.length === 0 && emails.length === 0) {
            return null;
        }

        // If name is still N/A but we have contact info, use table name
        if (name === "N/A" || name === "View Profile") {
            name = baseData.reported_owner_table;
        }

        return {
            name,
            phones: phones.slice(0, 5),
            emails: emails.slice(0, 3),
            address
        };
    }

    // ------------------- Find View Contacts Button -------------------
    function findViewContactsButton() {
        // STRICT MATCHING: Only find the REAL "View Contacts (N)" button
        // Example: <a class="MuiButton-root" href="/!/company/.../contacts">View Contacts (7)</a>

        // Primary: Look for anchor with /contacts href AND "View Contacts (N)" text
        const contactLinks = document.querySelectorAll('a[href*="/contacts"]');
        for (const link of contactLinks) {
            const text = link.innerText?.trim() || '';
            // MUST match pattern "View Contacts (N)" where N is a number
            if (/^View\s+Contacts?\s*\(\d+\)$/i.test(text)) {
                log(`   ✅ Found View Contacts button: "${text}"`);
                return link;
            }
        }

        // Secondary: Look for MuiButton with exact text pattern
        const muiButtons = document.querySelectorAll('a.MuiButton-root, button.MuiButton-root');
        for (const btn of muiButtons) {
            const text = btn.innerText?.trim() || '';
            if (/^View\s+Contacts?\s*\(\d+\)$/i.test(text)) {
                log(`   ✅ Found View Contacts button (MUI): "${text}"`);
                return btn;
            }
        }

        // NO false positives - return null if no exact match
        log(`   ℹ️ No View Contacts button found on this property`);

        return null;
    }

    // ------------------- Scrape View Contacts Table -------------------
    async function scrapeViewContactsTable() {
        const contacts = [];

        // Find the contact table
        const contactTable = document.querySelector('table tbody');
        if (!contactTable) {
            log("   No contact table found in View Contacts");
            return contacts;
        }

        const contactRows = contactTable.querySelectorAll('tr');
        log(`   Found ${contactRows.length} contact rows in View Contacts table`);

        for (let i = 0; i < contactRows.length; i++) {
            if (!STATE.isRunning) {
                log(`   Stopped at contact ${i+1}`);
                break;
            }

            // Re-query table each iteration (DOM may change)
            const freshTable = document.querySelector('table tbody');
            if (!freshTable) {
                log(`   Table disappeared at contact ${i+1}`);
                break;
            }

            const freshRows = freshTable.querySelectorAll('tr');
            if (i >= freshRows.length) {
                log(`   Contact row ${i+1} no longer exists`);
                break;
            }

            const currentRow = freshRows[i];

            // Get expected name from row text
            const rowText = currentRow.innerText || "";
            const expectedName = rowText.split('\n')[0]?.trim() || `Contact ${i+1}`;
            log(`   Contact ${i+1}: "${expectedName.substring(0,25)}..."`);

            // Find clickable element - the contact info button is in td[data-testid="company-contact-icons"]
            const contactInfoBtn = currentRow.querySelector('td[data-testid="company-contact-icons"] button');
            const firstLink = currentRow.querySelector('a');
            const clickableEl = contactInfoBtn || firstLink || currentRow;

            if (clickableEl) {
                // First, ensure no drawer is already open
                const existingDrawer = document.querySelector('h6[data-testid="company-contact-name"]');
                if (existingDrawer) {
                    log(`   ⚠️ Previous drawer still open, closing first...`);
                    await closeDrawer();
                    await wait(1000);
                }

                // Determine click description
                const clickDesc = contactInfoBtn ? "contact info button" : (firstLink ? "contact link" : "row");

                // Use reliable click - scrolls into view and dispatches proper events
                await reliableClick(clickableEl, clickDesc);
                await wait(2000);

                // Wait for drawer to open
                const drawerResult = await waitForDrawerWithName(expectedName);

                if (drawerResult.found) {
                    // Extract data from drawer
                    const data = scrapeCurrentDrawer();

                    // Validate contact
                    if (data.name !== "N/A" &&
                        data.name !== "View Profile" &&
                        data.name !== "Mobile" &&
                        data.name !== "Landline" &&
                        data.name.length > 1) {

                        // Check for duplicates within this batch
                        const isDuplicate = contacts.some(c => namesAreSimilar(c.name, data.name));
                        if (!isDuplicate) {
                            contacts.push(data);
                            log(`   ✅ DRAWER CAPTURE: ${data.name}`);
                            if (data.phones.length > 0) {
                                log(`      📞 Phones: ${data.phones.join(', ')}`);
                            }
                            if (data.emails.length > 0) {
                                log(`      📧 Emails: ${data.emails.join(', ')}`);
                            }
                            if (data.address) {
                                log(`      🏠 Address: ${data.address}`);
                            }
                            if (data.phones.length === 0 && data.emails.length === 0 && !data.address) {
                                log(`      ⚠️ No contact details found`);
                            }
                        } else {
                            log(`   Duplicate in batch: "${data.name}", skipping`);
                        }
                    } else {
                        log(`   Invalid name "${data.name}", skipping`);
                    }
                } else {
                    log(`   Drawer did not open properly for contact ${i+1}`);
                }

                // Close the drawer
                await closeDrawer();
                await wait(1000);

                // Verify drawer is closed before proceeding
                const drawerStillOpen = document.querySelector('h6[data-testid="company-contact-name"]');
                if (drawerStillOpen) {
                    log(`   ⚠️ Drawer still open, forcing close...`);
                    // Force close with backdrop click and ESC
                    const backdrop = document.querySelector('.MuiBackdrop-root');
                    if (backdrop) backdrop.click();
                    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true}));
                    await wait(1500);
                }
            }
        }

        return contacts;
    }

    // ------------------- Close Drawer -------------------
    async function closeDrawer() {
        log(`   Closing drawer...`);

        // Method 1: ESC key (try twice)
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true}));
        await wait(300);
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true}));
        await wait(500);

        // Check if drawer is already closed
        const stillOpen = document.querySelector('h6[data-testid="company-contact-name"]');
        if (!stillOpen) {
            log(`   Drawer closed via ESC`);
            return;
        }

        // Method 2: Click close button (try multiple selectors)
        const closeSelectors = [
            'a > button span.MuiIconButton-label',
            '[aria-label="close"]',
            '[aria-label="Close"]',
            'button[class*="close"]',
            '.MuiDrawer-root button.MuiIconButton-root',
            '[role="presentation"] button.MuiIconButton-root'
        ];

        for (const sel of closeSelectors) {
            const closeBtn = document.querySelector(sel);
            if (closeBtn) {
                closeBtn.click();
                log(`   Clicked close: ${sel}`);
                await wait(500);

                // Check if closed
                const stillOpenAfterClick = document.querySelector('h6[data-testid="company-contact-name"]');
                if (!stillOpenAfterClick) {
                    log(`   Drawer closed after click`);
                    return;
                }
            }
        }

        // Method 3: Click backdrop/overlay to close
        const backdrop = document.querySelector('.MuiBackdrop-root');
        if (backdrop) {
            backdrop.click();
            log(`   Clicked backdrop to close`);
            await wait(500);
        }

        // Final wait for drawer to close
        await waitForDrawerClose();
    }

    // ------------------- Scrape Current Drawer -------------------
    function scrapeCurrentDrawer() {
        const drawer = document.querySelector('[role="presentation"].MuiDrawer-root, .MuiDrawer-paper, [role="dialog"]') || document.body;

        // Get name
        let name = "N/A";
        const h6 = drawer.querySelector('h6[data-testid="company-contact-name"]');
        const personLink = drawer.querySelector('a[href*="/!/person/"]');
        const header = drawer.querySelector('h6, h5, h4');

        if (h6 && h6.innerText.trim()) {
            name = h6.innerText.trim();
        } else if (personLink && !personLink.innerText.includes("View Profile")) {
            name = personLink.innerText.trim();
        } else if (header && header.innerText.trim() && !header.innerText.includes("View Profile")) {
            name = header.innerText.trim();
        }

        // Get phones
        const phones = [];
        drawer.querySelectorAll('[data-testid="people-contact-phone-id"]').forEach(p => {
            const txt = p.innerText.trim();
            if (txt && txt !== "Mobile" && txt !== "Landline" && !phones.includes(txt) && isValidPhone(txt)) {
                phones.push(txt);
            }
        });

        // Scan drawer for phone patterns
        const drawerText = drawer.innerText || "";
        const phoneMatches = drawerText.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
        phoneMatches.forEach(phone => {
            const cleaned = phone.trim();
            if (!phones.includes(cleaned) && isValidPhone(cleaned)) {
                phones.push(cleaned);
            }
        });

        // Get emails
        const emails = [];
        drawer.querySelectorAll('svg[data-testid="icon-mail-filled"]').forEach(icon => {
            const container = icon.closest('div')?.parentElement;
            if (container) {
                const txt = container.innerText.replace(/Email/gi, '').trim();
                if (txt.includes('@') && !emails.includes(txt)) {
                    emails.push(txt);
                }
            }
        });

        // Scan for emails in text
        const emailMatches = drawerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        emailMatches.forEach(email => {
            if (!emails.includes(email) && !email.includes('reonomy.com')) {
                emails.push(email);
            }
        });

        // Get address
        let address = "";
        const addressEl = drawer.querySelector('[class*="address"], [data-testid*="address"]');
        if (addressEl) {
            address = addressEl.innerText.trim();
        }

        return {
            name,
            phones: phones.slice(0, 5),
            emails: emails.slice(0, 3),
            address
        };
    }

    // ------------------- Merge Contact Data -------------------
    function mergeContactData(existing, newData) {
        // Merge phones
        const allPhones = [...existing.phones];
        newData.phones.forEach(phone => {
            if (!allPhones.includes(phone)) {
                allPhones.push(phone);
            }
        });

        // Merge emails
        const allEmails = [...existing.emails];
        newData.emails.forEach(email => {
            if (!allEmails.includes(email)) {
                allEmails.push(email);
            }
        });

        // Use the better name (longer or more complete)
        let bestName = existing.name;
        if (newData.name && newData.name !== "N/A" && newData.name !== "View Profile") {
            if (existing.name === "N/A" || existing.name === "View Profile") {
                bestName = newData.name;
            } else if (newData.name.length > existing.name.length) {
                bestName = newData.name;
            }
        }

        // Use address if we didn't have one
        const address = existing.address || newData.address || "";

        return {
            name: bestName,
            phones: allPhones.slice(0, 5),
            emails: allEmails.slice(0, 3),
            address
        };
    }

    // ========================= FALLBACK EXTRACTION =========================
    async function tryFallbackExtraction(baseData) {
        const contacts = [];

        // Try ownership section
        log("   Trying ownership section...");
        const ownershipSection = document.querySelector('#property-details-section-ownership');
        if (ownershipSection) {
            const phones = [];
            ownershipSection.querySelectorAll('[data-testid="people-contact-phone-id"]').forEach(p => {
                const txt = p.innerText.trim();
                if (txt && txt !== "Mobile" && txt !== "Landline" && !phones.includes(txt) && isValidPhone(txt)) {
                    phones.push(txt);
                }
            });

            const emails = [];
            ownershipSection.querySelectorAll('svg[data-testid="icon-mail-filled"]').forEach(icon => {
                const container = icon.closest('div')?.parentElement;
                if (container) {
                    const txt = container.innerText.replace(/Email/gi, '').trim();
                    if (txt.includes('@') && !emails.includes(txt)) {
                        emails.push(txt);
                    }
                }
            });

            if (phones.length > 0 || emails.length > 0) {
                let ownerName = baseData.reported_owner_table;
                const personLink = ownershipSection.querySelector('a[href*="/!/person/"]');
                if (personLink && personLink.innerText.trim() && personLink.innerText.trim() !== "View Profile") {
                    ownerName = personLink.innerText.trim();
                }

                contacts.push({
                    name: ownerName,
                    phones: phones.slice(0, 5),
                    emails: emails.slice(0, 3),
                    address: ""
                });
                log(`   ✅ Ownership section capture: ${ownerName}`);
            }
        }

        // Page-wide regex scan
        if (contacts.length === 0) {
            log("   Trying page-wide scan...");

            const allText = document.body.innerText;

            const phones = [];
            const phoneMatches = allText.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
            phoneMatches.forEach(phone => {
                const cleaned = phone.trim();
                if (!phones.includes(cleaned) && isValidPhone(cleaned)) {
                    phones.push(cleaned);
                }
            });

            const emails = [];
            const emailMatches = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            emailMatches.forEach(email => {
                if (!emails.includes(email) && !email.includes('reonomy.com')) {
                    emails.push(email);
                }
            });

            if (phones.length > 0 || emails.length > 0) {
                contacts.push({
                    name: baseData.reported_owner_table,
                    phones: phones.slice(0, 5),
                    emails: emails.slice(0, 3),
                    address: ""
                });
                log(`   ✅ Page scan capture: ${baseData.reported_owner_table}`);
            }
        }

        return contacts;
    }

    function finalizeRecord(baseData, contacts) {
        const record = { ...baseData, contacts };
        STATE.dataStore.push(record);
        STATE.consecutiveErrors = 0;
        GM_setValue('vc_data', JSON.stringify(STATE.dataStore));
        STATE.processedCount++;
        updateStatus();
        navigateHome();
    }

    async function navigateHome() {
        log("Returning to list...");
        saveState();

        const backBtn = document.querySelector('button[aria-label="Back"]');
        if (backBtn) backBtn.click();
        else window.history.back();

        const maxAttempts = 5;
        const waitBetweenAttempts = 1500;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await wait(waitBetweenAttempts);

            // First check if we need to click the Properties tab
            const propertiesTab = document.querySelector('button[data-testid="properties-pivot-id"]');
            if (propertiesTab) {
                const isSelected = propertiesTab.classList.contains('Mui-selected') || propertiesTab.getAttribute('aria-selected') === 'true';
                if (!isSelected) {
                    log("Clicking Properties tab...");
                    propertiesTab.click();
                    await wait(1500);

                    // Also click Table View if needed
                    const tableBtn = document.querySelector('#summary-cards-table-view-btn');
                    if (tableBtn) {
                        log("Clicking Table View...");
                        tableBtn.click();
                        await wait(2000);
                    }
                }
            }

            const rows = document.querySelectorAll('tbody tr.MuiTableRow-root');
            if (rows.length > 0) {
                log(`Back to list (attempt ${attempt}, found ${rows.length} rows)`);
                STATE.totalRowsOnCurrentPage = rows.length;
                STATE.currentRowIndex++;
                saveState();
                processLoop();
                return;
            }

            if (attempt < maxAttempts) {
                log(`Waiting for list page... (attempt ${attempt}/${maxAttempts})`);
                if (backBtn) backBtn.click();
                else window.history.back();
            }
        }

        // Build correct page URL
        let correctPageUrl = STATE.searchUrl;
        if (STATE.currentPage > 1) {
            if (correctPageUrl.includes('page=')) {
                correctPageUrl = correctPageUrl.replace(/page=\d+/i, `page=${STATE.currentPage}`);
            } else {
                const separator = correctPageUrl.includes('?') ? '&' : '?';
                correctPageUrl = `${correctPageUrl}${separator}page=${STATE.currentPage}`;
            }
        }

        if (!document.querySelector('tbody tr.MuiTableRow-root') && STATE.searchUrl) {
            log(`Resetting to page ${STATE.currentPage} URL...`);
            STATE.currentRowIndex++;
            saveState();
            GM_setValue('vc_auto_start', true);
            window.location.href = correctPageUrl;
            return;
        }

        if (!document.querySelector('tbody tr.MuiTableRow-root')) {
            STATE.consecutiveErrors++;
            log(`Stuck (error ${STATE.consecutiveErrors})`);
            if (STATE.consecutiveErrors >= STATE.maxErrors) {
                log("Too many errors. Stopping.");
                STATE.isRunning = false;
                if(window.vcUpdateStartButton) window.vcUpdateStartButton();
                downloadCSV();
                return;
            }
        }

        STATE.currentRowIndex++;
        saveState();
        processLoop();
    }

    // ========================= CSV EXPORT =========================

    function normalizeName(name) {
        if (!name) return "";
        let normalized = name
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const titlePatterns = [
            /\s+(Chief Executive Officer|CEO|President|Manager|Director|VP|Vice President|Owner|Partner)$/i
        ];

        for (const pattern of titlePatterns) {
            normalized = normalized.replace(pattern, '');
        }
        return normalized.trim();
    }

    function namesAreSimilar(name1, name2) {
        const n1 = normalizeName(name1);
        const n2 = normalizeName(name2);

        if (n1 === n2) return true;
        if (n1.includes(n2) || n2.includes(n1)) return true;

        const words1 = n1.split(' ');
        const words2 = n2.split(' ');

        if (words1.length === 2 && words2.length === 3) {
            if (words1[0] === words2[0] && words1[1] === words2[2]) return true;
        } else if (words1.length === 3 && words2.length === 2) {
            if (words1[0] === words2[0] && words1[2] === words2[1]) return true;
        }

        return false;
    }

    function cleanContacts(record) {
        let unique = [];
        record.contacts.forEach(c => {
            if (c.name === "View Profile" || c.name === "N/A" || c.name === "Mobile" || c.name === "Landline") return;

            let existingIndex = unique.findIndex(ex => namesAreSimilar(ex.name, c.name));

            if (existingIndex > -1) {
                const currentScore = c.phones.length + c.emails.length;
                const existingScore = unique[existingIndex].phones.length + unique[existingIndex].emails.length;
                if (currentScore > existingScore) {
                    unique[existingIndex] = c;
                }
            } else {
                unique.push(c);
            }
        });
        return unique;
    }

    function downloadCSV() {
        if (STATE.dataStore.length === 0) { alert("No data."); return; }
        log("📊 Generating CSV export...");

        let maxContacts = 0;
        const processed = STATE.dataStore.map(item => {
            const cleaned = cleanContacts(item);
            maxContacts = Math.max(maxContacts, cleaned.length);
            return { ...item, cleanedContacts: cleaned };
        });
        if (maxContacts < 1) maxContacts = 1;

        const headers = [
            "address_full", "gross_building_area", "property_type", "year_built",
            "sale_amount", "sale_recorded_date", "reported_owner_table", "reported_llc_table"
        ];

        for (let i = 0; i < maxContacts; i++) {
            const p = i === 0 ? "contact" : `contact_${i+1}`;
            headers.push(`${p}_name`, `${p}_phone_1`, `${p}_phone_2`, `${p}_phone_3`, `${p}_phone_4`, `${p}_phone_5`, `${p}_email_1`, `${p}_email_2`, `${p}_email_3`, `${p}_address`);
        }

        const rows = [headers.join(',')];
        processed.forEach(item => {
            const vals = headers.map(h => {
                let val = "";
                if (item[h] !== undefined) val = item[h];
                else if (h.startsWith('contact')) {
                    const parts = h.match(/contact_?(\d+)?_(.+)/);
                    if (parts) {
                        const idx = (parts[1] || 1) - 1;
                        const type = parts[2];
                        const c = item.cleanedContacts[idx];
                        if (c) {
                            if (type === 'name') val = c.name;
                            else if (type === 'address') val = c.address || "";
                            else if (type.startsWith('phone')) val = c.phones[parseInt(type.split('_')[1]) - 1] || "";
                            else if (type.startsWith('email')) val = c.emails[parseInt(type.split('_')[1]) - 1] || "";
                        }
                    }
                }
                return `"${(val || "").toString().replace(/"/g, '""')}"`;
            });
            rows.push(vals.join(','));
        });

        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${STATE.jobName}.csv`;
        document.body.appendChild(link);
        link.click();
        log(`📁 EXPORT COMPLETE: ${STATE.jobName}.csv (${STATE.dataStore.length} records)`);
    }

    loadState();
    setTimeout(createUI, 1500);
})();
