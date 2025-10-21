(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION & STATE
  // ============================================================================
  
  const NAMESPACE = 'lte-panel';
  const STORAGE_KEY = `${NAMESPACE}-position`;
  const STORAGE_MINIMIZED_KEY = `${NAMESPACE}-minimized`;
  
  let mainband = null;
  let _2ndrun = null;
  let suspend = 0;
  let status = "";
  let netmode = "";
  let signal = "";
  const version = "1.0";
  const gw = 500;
  const gh = 30;
  const gt = 3;
  const boxcarSize = Math.floor(gw / (gt + 1));
  
  // Graph data arrays
  const arsrp = [];
  const arsrq = [];
  const asinr = [];
  const anrrsrp = [];
  const anrrsrq = [];
  const anrsinr = [];

  // ============================================================================
  // UTILITY FUNCTIONS (Preserve Original Logic)
  // ============================================================================
  
  function extractXML(tag, data) {
    try {
      return data.split("</" + tag + ">")[0].split("<" + tag + ">")[1];
    } catch (err) {
      return err.message;
    }
  }

  function _4GType(data) {
    let data_out = "";
    for (let x = 0; x < 90; x++) {
      const tb = Math.pow(2, x);
      if (BigInt("0x" + data) & BigInt(tb)) {
        data_out += "B" + String(x + 1) + "+";
      }
    }
    return data_out.replace(/\++$/, "");
  }

  // ============================================================================
  // UI SCOPE & HELPERS
  // ============================================================================
  
  let uiRoot;
  let shadowRoot;
  
  const ui = {
    $: (id) => {
      if (shadowRoot) {
        return shadowRoot.getElementById(id);
      }
      return uiRoot.querySelector(`#${NAMESPACE}-${id}`);
    },
    setText: (id, text) => {
      const el = ui.$(id);
      if (el) el.textContent = text;
    },
    setHTML: (id, html) => {
      const el = ui.$(id);
      if (el) el.innerHTML = html;
    }
  };

  // ============================================================================
  // CHART RENDERING (Improved Styling)
  // ============================================================================
  
  function getColorForValue(val, min, max) {
    const pc = ((val - min) / (max - min)) * 100;
    if (pc < 25) return '#ef4444'; // red - poor
    if (pc < 50) return '#f97316'; // orange - fair
    if (pc < 75) return '#eab308'; // yellow - good
    return '#22c55e'; // green - excellent
  }

  function barGraph(param, val, decimals, min, max, dataArray) {
    val = parseFloat(val.slice(0, -decimals));
    
    if (val > max) val = max;
    if (val < min) val = min;
    
    dataArray.unshift(val);
    if (dataArray.length > boxcarSize) {
      dataArray.pop();
    }

    let html = `<svg version="1.1" viewBox="0 0 ${gw} ${gh}" width="${gw}" height="${gh}" preserveAspectRatio="xMaxYMax slice" style="width: ${gw}px; height: ${gh}px;">`;
    
    // Grid lines (subtle)
    html += `<line x1="0" y1="${gh/2}" x2="${gw}" y2="${gh/2}" stroke="#e5e7eb" stroke-width="0.5" opacity="0.5"/>`;
    html += `<line x1="0" y1="${gh-1}" x2="${gw}" y2="${gh-1}" stroke="#d1d5db" stroke-width="1"/>`;

    for (let x = 0; x < dataArray.length; x++) {
      const pax = (gt + 1) * (x + 1);
      const pay = gh - 1;
      let pby = gh - ((dataArray[x] - min) / (max - min)) * gh;
      
      if (isNaN(pby)) pby = pay;
      
      const color = getColorForValue(dataArray[x], min, max);
      const barHeight = pay - pby;
      
      // Gradient effect
      const gradientId = `grad-${param}-${x}`;
      html += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">`;
      html += `<stop offset="0%" style="stop-color:${color};stop-opacity:0.9" />`;
      html += `<stop offset="100%" style="stop-color:${color};stop-opacity:0.6" />`;
      html += `</linearGradient></defs>`;
      
      html += `<rect x="${pax - gt/2}" y="${pby}" width="${gt}" height="${barHeight}" fill="url(#${gradientId})" rx="1">`;
      html += `<animate attributeName="opacity" from="0.5" to="1" dur="0.3s" fill="freeze"/>`;
      html += `</rect>`;
    }

    html += "</svg>";
    ui.setHTML("b" + param, html);
  }

  // ============================================================================
  // API CALLS (Preserve Original Logic)
  // ============================================================================
  
  function getAntenna() {
    const xhra = new XMLHttpRequest();
    xhra.open("GET", "/api/device/antenna_type", true);
    xhra.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhra.send();
    xhra.onload = function() {
      if (xhra.status === 200) {
        const r = xhra.responseText;
        const antenna1type = extractXML("antenna1type", r);
        const antenna2type = extractXML("antenna2type", r);
        ui.setText("a1", antenna1type === "1" ? "EXT" : "INT");
        ui.setText("a2", antenna2type === "1" ? "EXT" : "INT");
      }
    };
  }

  function getNetmode() {
    const xhrn = new XMLHttpRequest();
    xhrn.open("GET", "/api/net/net-mode", true);
    xhrn.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhrn.send();
    xhrn.onload = function() {
      if (xhrn.status === 200) {
        netmode = xhrn.responseText;
        const lteband = extractXML("LTEBand", netmode);
        ui.setText("allowed", _4GType(lteband));
      }
    };
  }

  function getStatus() {
    const xhrs = new XMLHttpRequest();
    xhrs.open("GET", "/api/monitoring/status", true);
    xhrs.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhrs.send();
    xhrs.onload = function() {
      if (xhrs.status === 200) {
        const ms = xhrs.responseText;
        const is4gp = extractXML("CurrentNetworkTypeEx", ms) == 1011 ? 1 : 0;
        const modeEl = ui.$("mode");
        if (modeEl) {
          modeEl.style.color = is4gp ? "#ef4444" : "#9ca3af";
          ui.setText("mode", is4gp ? "4G+" : "--");
        }
      }
    };
  }

  function currentBand() {
    if (suspend === 1) return;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/device/signal", true);
    xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.send();
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        const data = xhr.responseText;
        signal = data;
        
        const vars = ["nrrsrq", "nrrsrp", "nrsinr", "rssi", "rsrp", "rsrq", "sinr", 
                      "dlbandwidth", "ulbandwidth", "band", "cell_id", "plmn"];
        
        const values = {};
        for (let i = 0; i < vars.length; i++) {
          values[vars[i]] = extractXML(vars[i], data);
          ui.setText(vars[i], values[vars[i]]);
        }

        const nrdefined = values.nrrsrp !== undefined && values.nrrsrp !== "undefined";
        const nrSection = ui.$("nr");
        
        if (nrdefined && nrSection) {
          nrSection.style.display = "block";
          barGraph("nrrsrp", values.nrrsrp, 3, -130, -60, anrrsrp);
          barGraph("nrrsrq", values.nrrsrq, 2, -16, -3, anrrsrq);
          barGraph("nrsinr", values.nrsinr, 2, 0, 24, anrsinr);
        } else if (nrSection) {
          nrSection.style.display = "none";
        }

        barGraph("rsrp", values.rsrp, 3, -130, -60, arsrp);
        barGraph("rsrq", values.rsrq, 2, -16, -3, arsrq);
        barGraph("sinr", values.sinr, 2, 0, 24, asinr);

        let enbid;
        const mp = values.cell_id.indexOf("-");
        if (mp > 0) {
          enbid = Number(values.cell_id.substr(0, mp));
        } else {
          const hex = Number(values.cell_id).toString(16);
          const hex2 = hex.substring(0, hex.length - 2);
          enbid = parseInt(hex2, 16).toString();
        }
        ui.setText("enbid", enbid);

        let plmn = values.plmn;
        if (plmn === "22201") plmn = "2221";
        if (plmn === "22299") plmn = "22288";
        if (plmn === "22250" && enbid.length === 6) plmn = "22288";

        const link_lte = `https://lteitaly.it/internal/map.php#bts=${plmn}.${enbid}`;
        const lteitaly = ui.$("lteitaly");
        if (lteitaly) lteitaly.setAttribute("href", link_lte);
      } else {
        showError("Signal fetch error: " + xhr.status);
      }
    };

    getNetmode();
    getStatus();
    getAntenna();
  }

  function ltebandselection(bs) {
    if (mainband) {
      mainband = null;
    }

    let band;
    if (arguments.length === 0) {
      openBandModal();
      return;
    } else {
      band = arguments[0];
    }

    const bsArray = band.split("+");
    let ltesum = 0;

    if (band.toUpperCase() === "AUTO") {
      ltesum = "7FFFFFFFFFFFFFFF";
    } else {
      for (let i = 0; i < bsArray.length; i++) {
        if (bsArray[i].toLowerCase().indexOf("m") !== -1) {
          bsArray[i] = bsArray[i].replace("m", "");
          mainband = bsArray[i];
        }
        if (bsArray[i].toUpperCase() === "AUTO") {
          ltesum = "7FFFFFFFFFFFFFFF";
          break;
        }
        ltesum += Math.pow(2, parseInt(bsArray[i]) - 1);
      }
      ltesum = ltesum.toString(16);
    }

    if (mainband) {
      _2ndrun = bsArray;
      ltebandselection(String(mainband));
      return;
    }

    suspend = 1;
    ui.setText("status-msg", "! PLEASE WAIT !");
    const statusEl = ui.$("status-msg");
    if (statusEl) statusEl.style.display = "block";

    const xhrh = new XMLHttpRequest();
    xhrh.open("GET", "/html/home.html", true);
    xhrh.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhrh.send();
    
    xhrh.onload = function() {
      if (xhrh.status === 200) {
        const datas = xhrh.responseText.split('name="csrf_token" content="');
        const token = datas[datas.length - 1].split('"')[0];
        
        let nw = "00";
        const force4g = ui.$("force4g");
        if (force4g && force4g.checked) {
          nw = "03";
        }

        setTimeout(() => {
          const xhrp = new XMLHttpRequest();
          xhrp.open("POST", "/api/net/net-mode", true);
          xhrp.setRequestHeader("Content-type", "application/json; charset=UTF-8");
          xhrp.setRequestHeader("__RequestVerificationToken", token);
          
          const cmd = `<request><NetworkMode>${nw}</NetworkMode><NetworkBand>3FFFFFFF</NetworkBand><LTEBand>${ltesum}</LTEBand></request>`;
          xhrp.send(cmd);
          
          xhrp.onload = function() {
            if (xhrp.status === 200) {
              ui.setHTML("band", '<span style="color:#22c55e;">OK</span>');
              if (_2ndrun) {
                window.setTimeout(() => {
                  ltebandselection(_2ndrun.join("+"));
                  _2ndrun = false;
                }, 2000);
              } else {
                suspend = 0;
                const statusEl = ui.$("status-msg");
                if (statusEl) statusEl.style.display = "none";
              }
            } else {
              showError("Band selection failed");
              suspend = 0;
              const statusEl = ui.$("status-msg");
              if (statusEl) statusEl.style.display = "none";
            }
          };
        }, 2000);
      }
    };
  }

  // ============================================================================
  // ERROR DISPLAY
  // ============================================================================
  
  function showError(message) {
    const errorEl = ui.$("error-chip");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
      setTimeout(() => {
        errorEl.style.display = "none";
      }, 5000);
    }
    console.error(message);
  }

  // ============================================================================
  // DRAG FUNCTIONALITY
  // ============================================================================
  
  function makeDraggable(element, handle, onDragEnd) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialX, initialY;

    handle.style.cursor = 'move';
    handle.style.touchAction = 'none';
    handle.style.userSelect = 'none';

    handle.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      
      isDragging = true;
      hasMoved = false;
      handle.setPointerCapture(e.pointerId);
      
      const rect = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialX = rect.left;
      initialY = rect.top;
      
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Only mark as moved if there's significant movement (more than 5px)
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
      }
      
      let newX = initialX + deltaX;
      let newY = initialY + deltaY;
      
      // Constrain to viewport
      const rect = element.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      element.style.left = newX + 'px';
      element.style.top = newY + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    const endDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        if (e.pointerId !== undefined) {
          handle.releasePointerCapture(e.pointerId);
        }
        if (onDragEnd) onDragEnd(hasMoved);
      }
    };

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    
    return () => hasMoved;
  }

  function savePosition(element) {
    const rect = element.getBoundingClientRect();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      left: rect.left,
      top: rect.top
    }));
  }

  function loadPosition(element) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        element.style.left = pos.left + 'px';
        element.style.top = pos.top + 'px';
        element.style.right = 'auto';
        return;
      }
    } catch (e) {
      console.error('Failed to load position:', e);
    }
    
    // Default position
    element.style.top = '20px';
    element.style.right = '20px';
  }

  // ============================================================================
  // MODAL FUNCTIONALITY
  // ============================================================================
  
  function openBandModal() {
    const modal = ui.$('band-modal');
    const input = ui.$('band-input');
    
    if (modal && input) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      input.value = '';
      input.focus();
      
      // Trap focus
      trapFocus(modal);
    }
  }

  function closeBandModal() {
    const modal = ui.$('band-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function confirmBandModal() {
    const input = ui.$('band-input');
    if (input) {
      const value = input.value.trim();
      if (value) {
        ltebandselection(value);
      }
    }
    closeBandModal();
  }

  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  // ============================================================================
  // MINIMIZE FUNCTIONALITY
  // ============================================================================
  
  function minimizeWindow() {
    const panel = ui.$('main-panel');
    const badge = ui.$('minimize-badge');
    
    if (panel && badge) {
      // Save current panel position
      savePosition(panel);
      
      // Get panel position before hiding
      const rect = panel.getBoundingClientRect();
      
      // Hide panel
      panel.style.display = 'none';
      
      // Position badge at the same location
      badge.style.left = rect.left + 'px';
      badge.style.top = rect.top + 'px';
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.style.display = 'flex';
      
      localStorage.setItem(STORAGE_MINIMIZED_KEY, 'true');
    }
  }

  function restoreWindow() {
    const panel = ui.$('main-panel');
    const badge = ui.$('minimize-badge');
    
    if (panel && badge) {
      // Get badge position
      const badgeRect = badge.getBoundingClientRect();
      
      // Hide badge
      badge.style.display = 'none';
      
      // Position panel at badge location
      panel.style.left = badgeRect.left + 'px';
      panel.style.top = badgeRect.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.display = 'block';
      
      // Save the new position
      savePosition(panel);
      
      localStorage.setItem(STORAGE_MINIMIZED_KEY, 'false');
    }
  }

  // ============================================================================
  // UI CREATION
  // ============================================================================
  
  function createUI() {
    // Create container
    const container = document.createElement('div');
    container.id = NAMESPACE + '-container';
    
    // Try to use Shadow DOM
    try {
      shadowRoot = container.attachShadow({ mode: 'open' });
      uiRoot = shadowRoot;
    } catch (e) {
      console.log('Shadow DOM not available, using regular DOM');
      uiRoot = container;
    }

    const styles = `
      :host, .${NAMESPACE}-root {
        --bg-primary: #ffffff;
        --bg-secondary: #f9fafb;
        --bg-tertiary: #f3f4f6;
        --text-primary: #111827;
        --text-secondary: #6b7280;
        --text-accent: #ef4444;
        --border-color: #e5e7eb;
        --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }
      
      @media (prefers-color-scheme: dark) {
        :host, .${NAMESPACE}-root {
          --bg-primary: #1f2937;
          --bg-secondary: #111827;
          --bg-tertiary: #374151;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --text-accent: #f87171;
          --border-color: #4b5563;
        }
      }
      
      * {
        box-sizing: border-box;
      }
      
      .panel {
        position: fixed;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        color: var(--text-primary);
        z-index: 999999;
        min-width: 560px;
        max-width: 600px;
      }
      
      .title-bar {
        background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
        padding: 10px 16px;
        border-radius: 12px 12px 0 0;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
      }
      
      .title {
        font-weight: 600;
        font-size: 14px;
        color: var(--text-primary);
      }
      
      .window-controls {
        display: flex;
        gap: 6px;
      }
      
      .window-controls button {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 6px;
        background: var(--bg-tertiary);
        color: #cecece;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        font-size: 24px;
        padding: 0;
        border: 1px solid var(--border-color);
      }
      
      .window-controls button:hover {
        background: var(--border-color);
        color: white;
      }
      
      .content {
        padding: 16px;
        max-height: 80vh;
        overflow-y: auto;
      }
      
      .section {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      
      .section-title {
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 8px;
        letter-spacing: 0.5px;
      }
      
      .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .metric-label {
        font-weight: 500;
        color: var(--text-secondary);
        font-size: 12px;
      }
      
      .metric-value {
        font-weight: 600;
        color: var(--text-accent);
        font-size: 13px;
      }
      
      .chart-container {
        margin-top: 6px;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .controls-section {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: #3b82f6;
        color: white;
      }
      
      .btn:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }
      
      .btn:active {
        transform: translateY(0);
      }
      
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
      }
      
      input[type="checkbox"] {
        cursor: pointer;
      }
      
      .info-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px 16px;
        font-size: 12px;
      }
      
      .info-label {
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .info-value {
        color: var(--text-primary);
        font-weight: 600;
      }
      
      .link {
        color: #3b82f6;
        text-decoration: none;
      }
      
      .link:hover {
        text-decoration: underline;
      }
      
      .status-msg {
        background: #6b7280;
        color: white;
        padding: 12px;
        border-radius: 8px;
        text-align: center;
        font-weight: 600;
        margin-bottom: 12px;
        display: none;
      }
      
      .error-chip {
        background: #fef2f2;
        color: #991b1b;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        font-size: 12px;
        display: none;
        border: 1px solid #fecaca;
      }
      
      .minimize-badge {
        position: fixed;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #3b82f6;
        color: white;
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 300;
        cursor: pointer;
        box-shadow: var(--shadow-lg);
        z-index: 999999;
        border: 2px solid white;
        user-select: none;
        touch-action: none;
        transition: transform 0.2s, background 0.2s;
      }
      
      .minimize-badge:hover {
        background: #2563eb;
        transform: scale(1.05);
      }
      
      /* Modal */
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
      }
      
      .modal {
        background: var(--bg-primary);
        border-radius: 12px;
        padding: 24px;
        min-width: 400px;
        box-shadow: var(--shadow-lg);
      }
      
      .modal-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--text-primary);
      }
      
      .modal-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 16px;
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      
      .modal-input:focus {
        outline: none;
        border-color: #3b82f6;
      }
      
      .modal-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      
      .modal-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        font-size: 13px;
      }
      
      .modal-btn-primary {
        background: #3b82f6;
        color: white;
      }
      
      .modal-btn-primary:hover {
        background: #2563eb;
      }
      
      .modal-btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      
      .modal-btn-secondary:hover {
        background: var(--border-color);
      }
      
      .motto {
        font-style: italic;
        color: var(--text-secondary);
        font-size: 11px;
      }
      
      a {
        color: #3b82f6;

      }

      a:visited {
        color: #3b82f6;
      }
    `;

    const html = `
      <style>${styles}</style>
      
      <div class="minimize-badge" id="minimize-badge" title="Restore panel">+</div>
      
      <div class="panel" id="main-panel">
        <div class="title-bar" id="title-bar">
          <div class="title">📶LTE Monitor + Band Locking v${version} By Suliman Sharadgah</div>
          <div class="window-controls">
            <button id="minimize-btn" title="Minimize" aria-label="Minimize">−</button>
          </div>
        </div>
        
        <div class="content">
          <div class="status-msg" id="status-msg"></div>
          <div class="error-chip" id="error-chip"></div>
          
          <div class="section">
            <div class="section-title">LTE Signal</div>
            <div class="metric-row">
              <span class="metric-label">RSRP:</span>
              <span class="metric-value" id="rsrp">--</span>
            </div>
            <div class="chart-container" id="brsrp"></div>
            
            <div class="metric-row">
              <span class="metric-label">RSRQ:</span>
              <span class="metric-value" id="rsrq">--</span>
            </div>
            <div class="chart-container" id="brsrq"></div>
            
            <div class="metric-row">
              <span class="metric-label">SINR:</span>
              <span class="metric-value" id="sinr">--</span>
            </div>
            <div class="chart-container" id="bsinr"></div>
          </div>
          
          <div class="section" id="nr" style="display: none;">
            <div class="section-title">NR (5G) Signal</div>
            <div class="metric-row">
              <span class="metric-label">NR RSRP:</span>
              <span class="metric-value" id="nrrsrp">--</span>
            </div>
            <div class="chart-container" id="bnrrsrp"></div>
            
            <div class="metric-row">
              <span class="metric-label">NR RSRQ:</span>
              <span class="metric-value" id="nrrsrq">--</span>
            </div>
            <div class="chart-container" id="bnrrsrq"></div>
            
            <div class="metric-row">
              <span class="metric-label">NR SINR:</span>
              <span class="metric-value" id="nrsinr">--</span>
            </div>
            <div class="chart-container" id="bnrsinr"></div>
          </div>
          
          <div class="section">
            <div class="controls-section">
              <button class="btn" id="select-band-btn">Select Band</button>
              <label class="checkbox-label">
                <input type="checkbox" id="force4g">
                <span>Force 4G</span>
              </label>
            </div>
          </div>
          
          <div class="section">
            <div class="info-grid">
              <span class="info-label">RSSI:</span>
              <span class="info-value" id="rssi">--</span>
              
              <span class="info-label">Antenna:</span>
              <span class="info-value"><span id="a1">--</span> / <span id="a2">--</span></span>
              
              <span class="info-label">Mode:</span>
              <span class="info-value" id="mode">--</span>
            </div>
          </div>
          
          <div class="section">
            <div class="info-grid">
              <span class="info-label">ENB ID:</span>
              <span class="info-value">
                <span id="enbid">#</span>
              </span>
              
              <span class="info-label">CELL ID:</span>
              <span class="info-value" id="cell_id">#</span>
              
              <span class="info-label">Main:</span>
              <span class="info-value">
                <span id="band">--</span> (<span>DL Bandwidth:</span><span id="dlbandwidth">--</span>/<span>Up Bandwidth:</span><span id="ulbandwidth">--</span>)
              </span>
              
              <span class="info-label">Allowed:</span>
              <span class="info-value" id="allowed">--</span>
            </div>
          </div>
          
          <div class="section">
            <div class="motto">Made By <a href="https://www.linkedin.com/in/sulimanmubarak2001/" target="_blank">Suliman Sharadgah</a> 👨‍💻</div>
          </div>
        </div>
      </div>
      
      <div class="modal-overlay" id="band-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-hidden="true">
        <div class="modal">
          <h2 class="modal-title" id="modal-title">Select Band</h2>
          <input 
            type="text" 
            class="modal-input" 
            id="band-input" 
            placeholder="AUTO or like 1+3+20, optional main like 3m+1+20"
            aria-label="Band selection input"
          >
          <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
            <button class="modal-btn modal-btn-primary" id="modal-ok">OK</button>
          </div>
        </div>
      </div>
    `;

    uiRoot.innerHTML = html;
    document.body.appendChild(container);

    // Setup event listeners
    const panel = ui.$('main-panel');
    const titleBar = ui.$('title-bar');
    const minimizeBtn = ui.$('minimize-btn');
    const minimizeBadge = ui.$('minimize-badge');
    const selectBandBtn = ui.$('select-band-btn');
    const modalOverlay = ui.$('band-modal');
    const modalOk = ui.$('modal-ok');
    const modalCancel = ui.$('modal-cancel');
    const bandInput = ui.$('band-input');

    // Load position
    loadPosition(panel);

    // Check if was minimized
    try {
      const wasMinimized = localStorage.getItem(STORAGE_MINIMIZED_KEY);
      if (wasMinimized === 'true') {
        // Need to wait for panel to be positioned first
        setTimeout(() => {
          minimizeWindow();
        }, 0);
      }
    } catch (e) {}

    // Draggable panel
    makeDraggable(panel, titleBar, (hasMoved) => {
      if (hasMoved) {
        savePosition(panel);
      }
    });

    // Draggable badge with click detection
    let badgeClickHandler;
    makeDraggable(minimizeBadge, minimizeBadge, (hasMoved) => {
      if (hasMoved) {
        // Save badge position
        const rect = minimizeBadge.getBoundingClientRect();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          left: rect.left,
          top: rect.top
        }));
      } else {
        // Only restore if not dragged (it was a click)
        restoreWindow();
      }
    });

    // Minimize/restore
    minimizeBtn.addEventListener('click', minimizeWindow);

    // Band selection modal
    selectBandBtn.addEventListener('click', openBandModal);
    modalOk.addEventListener('click', confirmBandModal);
    modalCancel.addEventListener('click', closeBandModal);
    
    // Modal backdrop click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeBandModal();
      }
    });

    // Modal keyboard support
    bandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBandModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeBandModal();
      }
    });

    modalOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeBandModal();
      }
    });

    // Prevent text selection during drag
    titleBar.addEventListener('selectstart', (e) => e.preventDefault());
    minimizeBadge.addEventListener('selectstart', (e) => e.preventDefault());

    // Button keyboard support
    [selectBandBtn, minimizeBtn, modalOk, modalCancel].forEach(btn => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });

    console.log("Code by Suliman Sharadgah - v" + version);
    console.log("type: netmode , signal , status");
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  createUI();
  
  // Start periodic updates
  currentBand();
  window.setInterval(currentBand, 2000);

})();