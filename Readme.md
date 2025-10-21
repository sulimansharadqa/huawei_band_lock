# LTE Monitor - Enhanced Floating Control Panel

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/sulimanmubarak2001/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A sophisticated browser console script that transforms basic LTE modem monitoring interfaces into a modern, draggable floating control panel with real-time signal metrics visualization and band locking.

![LTE Monitor Demo](https://via.placeholder.com/800x450/1f2937/ffffff?text=LTE+Monitor+Demo)

## ✨ Features

### 🎯 Modern User Interface
- **Floating Panel**: Sleek, compact overlay with automatic dark/light theme support
- **Smooth Dragging**: Touch and mouse-friendly drag system using Pointer Events API
- **Minimize/Restore**: Collapses to a draggable "+" badge that remembers its position
- **Position Memory**: Automatically saves window position and state across browser sessions
- **Responsive Design**: Adapts to viewport size with proper boundary constraints

### 📊 Real-Time Signal Monitoring
- **LTE Metrics**: RSRP, RSRQ, SINR with live updates every 2 seconds
- **5G NR Support**: Automatically displays NR metrics when available
- **Color-Coded Quality**: Visual indicators (red/orange/yellow/green) for signal strength
- **Live Charts**: Gradient-filled bar graphs with smooth animations showing signal history
- **Historical Data**: Tracks signal trends over time with visual graphs

### ⚙️ Advanced Band Selection
- **Modal Dialog**: Professional, accessible modal interface (no more browser prompts)
- **Keyboard Navigation**: Full keyboard support with focus trap and ESC to close
- **Flexible Input Formats**:
  - `AUTO` - Use all supported bands
  - `1+3+20` - Specific bands
  - `3m+1+20` - Mainband selection (m flag)
- **Force 4G Mode**: Toggle to force 4G-only connectivity

### 📡 Device Information
- **Antenna Status**: Real-time internal/external antenna detection
- **Network Mode**: 4G/4G+ status indication
- **Cell Information**: ENB ID and Cell ID with direct lteitaly.it integration
- **Bandwidth Details**: Download/Upload bandwidth display
- **Allowed Bands**: Shows currently configured band list

## 🚀 Installation

### Method 1: Direct Console Paste
1. Open your LTE modem's web interface in your browser
2. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac) to open Developer Tools
3. Navigate to the **Console** tab
4. Copy the entire script from [`huawei_bandlock.js`](huawei_bandlock.js)
5. Paste it into the console and press `Enter`

### Method 2: Browser Bookmark (Bookmarklet)
1. Create a new bookmark in your browser
2. Set the URL to: `javascript:(function(){/* paste minified script here */})();`
3. Click the bookmark when on the modem interface

## 💻 Usage

Once the script is running:

1. **Move the Panel**: Click and drag from the title bar to reposition
2. **Minimize**: Click the `−` button to collapse to a "+" badge
3. **Restore**: Click the "+" badge to restore the panel
4. **Select Band**: Click "Select Band" button to configure LTE bands
5. **Force 4G**: Check the "Force 4G" checkbox to disable 5G

### Band Selection Examples
```
AUTO                 # Use all supported bands
3                    # Band 3 only
1+3+7+20            # Multiple bands
3m+1+7+20           # Band 3 as mainband with aggregation
```

## 🎨 Technical Highlights

### Architecture
- **Shadow DOM Encapsulation**: Isolated styles prevent conflicts with page CSS
- **Zero Dependencies**: Pure vanilla JavaScript (ES6+), no libraries required
- **Memory Efficient**: Proper cleanup of event listeners and minimal DOM manipulation
- **Non-Blocking**: Asynchronous API calls don't freeze the UI

### Key Technologies
- **Pointer Events API**: Unified touch and mouse handling with `setPointerCapture`
- **localStorage**: Persistent position and state storage
- **XMLHttpRequest**: Device API communication (preserves original implementation)
- **CSS Variables**: Easy theming with automatic dark/light mode detection
- **SVG Graphics**: Smooth, scalable chart rendering

### Accessibility
- **ARIA Labels**: Proper semantic markup for screen readers
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space, ESC)
- **Focus Management**: Focus trap in modal dialogs
- **Contrast Ratios**: WCAG-compliant color schemes

## 🔧 Compatibility

### Tested Browsers
- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Opera 74+

### Device Support
- ✅ Desktop (Windows, macOS, Linux)

### Known Compatible Modems
- Huawei LTE modems with web interface
- Other modems using similar API endpoints (may require modifications)

## 📝 Configuration

The script uses these localStorage keys:
```javascript
lte-panel-position      // Window position {left, top}
lte-panel-minimized     // Minimized state (true/false)
```

Clear stored data:
```javascript
localStorage.removeItem('lte-panel-position');
localStorage.removeItem('lte-panel-minimized');
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

Suliman Mubarak - [![LinkedIn](https://img.shields.io/badge/-Connect-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/sulimanmubarak2001/)


## ⚠️ Disclaimer

This script is provided as-is for educational and monitoring purposes. Always ensure you have permission to modify network settings on your device. Incorrect band configuration may affect connectivity.

---

**Made with ❤️ for the networking community**
