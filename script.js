// --- 🔐 SHARED SECRET KEY for Data Decryption ---
const SHARED_SECRET_KEY = "MY_STRONG_XOR_KEY_2024!SecureItWell";

// --- 🔐 Hardcoded Access Codes Map (Date -> Code) ---
// 注意：这里的日期格式必须是 YYYY-MM-DD
// 请定期更新此列表，添加未来的日期和对应的访问码
const ACCESS_CODES = {
  "2025-12-20": "a1b2", // 示例：今天的访问码
  "2025-12-21": "c3d4",
  "2025-12-22": "e5f6",
  "2025-12-23": "g7h8",
  "2025-12-24": "i9j0",
  // --- 添加更多日期和访问码 ---
  "2024-06-10": "k1l2",
  "2024-06-11": "m3n4",
  "2024-06-15": "o5p6",
  // ... 继续添加直到未来30天 ...
  // 示例：假设今天是 2024-05-21
  // 你需要添加从 2024-05-21 到 2024-06-19 的所有日期及对应码
  // 这里只是示意，请替换为你实际规划的码
  "2024-06-19": "q7r8"
};

// --- 📦 全局变量 ---
let decryptedDataCache = null;
let lastFetchTime = null; // 新增：记录上次获取数据的时间戳

// --- 🕒 北京时间获取 ---
function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = beijingTime.getUTCFullYear();
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- 🔓 XOR 解密函数 ---
function xorDecrypt(data, key) {
  const keyBytes = new TextEncoder().encode(key);
  const keyLen = keyBytes.length;

  const result = JSON.parse(JSON.stringify(data));

  function processItem(item) {
    for (let prop in item) {
      if (typeof item[prop] === 'string') {
        let str = atob(item[prop]);
        let decoded = '';
        for (let i = 0; i < str.length; i++) {
          decoded += String.fromCharCode(str.charCodeAt(i) ^ keyBytes[i % keyLen]);
        }
        item[prop] = decoded;
      }
    }
  }

  if (Array.isArray(result)) {
    result.forEach(processItem);
  } else if (typeof result === 'object' && result !== null) {
    Object.values(result).forEach(val => {
      if (Array.isArray(val)) val.forEach(processItem);
    });
  }

  return result;
}

// --- 🔐 授权验证 ---
function isAuthorizationStillValid() {
    const today = getBeijingDate();
    const storedAuthDate = localStorage.getItem('yali_auth_date');
    return storedAuthDate === today;
}

// --- 🚀 应用初始化 ---
async function initializeApp() {
  const authErrorEl = document.getElementById('auth-error');
  const verifyButton = document.getElementById('verify-btn');
  const accessCodeInput = document.getElementById('access-code');
  const modal = document.getElementById('auth-modal');

  try {
    const today = getBeijingDate();
    const EXPECTED_ACCESS_CODE = ACCESS_CODES[today];

    if (!EXPECTED_ACCESS_CODE) {
         console.error(`[Error] No access code configured for today: ${today}`);
         authErrorEl.textContent = `系统错误：未配置 ${today} 的访问码。`;
         verifyButton.disabled = true;
         modal.style.display = 'flex';
         return;
    }

    console.log(`[Info] Today (${today}) Expected Access Code:`, EXPECTED_ACCESS_CODE);

    verifyButton.addEventListener('click', async () => {
      const userCode = accessCodeInput.value.trim().toLowerCase();
      if (userCode === EXPECTED_ACCESS_CODE) {
        localStorage.setItem('yali_authorized', 'true');
        localStorage.setItem('yali_auth_date', today);
        modal.style.display = 'none';
        authErrorEl.textContent = '';
        await preloadDecryptedData();
        // --- 新增：授权成功后启动定时检查 ---
        startPeriodicDataCheck();
        // -----------------------------------
      } else {
        authErrorEl.textContent = '访问码错误，请检查后重试。';
        accessCodeInput.value = '';
        accessCodeInput.focus();
      }
    });

    if (localStorage.getItem('yali_authorized') === 'true' && isAuthorizationStillValid()) {
      modal.style.display = 'none';
      await preloadDecryptedData();
      // --- 新增：已授权状态下启动定时检查 ---
      startPeriodicDataCheck();
      // -----------------------------------
    } else {
      modal.style.display = 'flex';
      localStorage.removeItem('yali_authorized');
      localStorage.removeItem('yali_auth_date');
    }

  } catch (error) {
    console.error("[Error] App initialization failed:", error);
    authErrorEl.textContent = `初始化失败: ${error.message}`;
    verifyButton.disabled = true;
  }
}

// --- 📥 预加载并解密数据 ---
async function preloadDecryptedData() {
const resultsEl = document.getElementById('results');
if (decryptedDataCache) return;

try {
  resultsEl.innerHTML = '<p>🔒 正在加载资源数据...</p>';

  const response = await fetch('./data_encrypted.json');
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
  }

  const encryptedText = await response.text();
  const encryptedBytes = atob(encryptedText);

  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(SHARED_SECRET_KEY);
  const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
  const keyBytes = new Uint8Array(keyHash).slice(0, 16);

  const encryptedUint8 = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    encryptedUint8[i] = encryptedBytes.charCodeAt(i);
  }

  const decryptedUint8 = new Uint8Array(encryptedUint8.length);
  for (let i = 0; i < encryptedUint8.length; i++) {
    decryptedUint8[i] = encryptedUint8[i] ^ keyBytes[i % keyBytes.length];
  }

  const decoder = new TextDecoder('utf-8');
  const decryptedJsonStr = decoder.decode(decryptedUint8);

  decryptedDataCache = JSON.parse(decryptedJsonStr);
  lastFetchTime = Date.now(); // 记录加载时间
  console.log("[Debug] Data preloaded and decrypted.");
  
  // --- 新增：数据加载成功后，生成并显示分类按钮 ---
  generateAndDisplayCategoryButtons(decryptedDataCache);
  // --------------------------------------------------
  
  resultsEl.innerHTML = '<p>✅ 数据加载成功，请开始搜索或浏览分类。</p>';
} catch (err) {
  console.error("[Error] Failed to preload/decrypt data:", err);
  resultsEl.innerHTML = `<p style="color:red;">数据加载失败：${err.message}</p>`;
}
}

// --- 🔍 搜索功能 ---
async function search() {
  const keyword = document.getElementById('keyword').value.trim();
  const resultsEl = document.getElementById('results');

  if (!keyword) {
    resultsEl.innerHTML = '<p>请输入关键词</p>';
    return;
  }

  if (localStorage.getItem('yali_authorized') !== 'true' || !isAuthorizationStillValid()) {
    alert('请先通过访问码验证！');
    document.getElementById('auth-modal').style.display = 'flex';
    return;
  }

  if (!decryptedDataCache) {
      resultsEl.innerHTML = '<p>🔒 数据尚未加载完成，请稍后再试...</p>';
      await preloadDecryptedData();
      if (!decryptedDataCache) {
           resultsEl.innerHTML = '<p style="color:red;">❌ 数据加载失败，无法进行搜索。</p>';
           return;
      }
  }

  try {
    const filteredResults = decryptedDataCache.filter(item =>
      item.name && item.name.toLowerCase().includes(keyword.toLowerCase())
    );

    displayResults(filteredResults, `🔍 关键词 "${keyword}" 的搜索结果`);
    
  } catch (err) {
    console.error("[Error] Search processing failed:", err);
    resultsEl.innerHTML = `<p style="color:red;">搜索处理失败：${err.message}</p>`;
  }
}

// --- ⌨️ 键盘事件监听 ---
document.getElementById('keyword').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    search();
  }
});

// --- 🧩 DOM 加载完成后初始化 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}


// =============================================================================
// ===                        新增代码区 (开始)                              ===
// ===              前端分类筛选 & 自动检查数据更新功能                     ===
// =============================================================================

// --- ⚙️ 配置 ---
/** 数据文件的相对路径 */
const DATA_FILE_PATH = './data_encrypted.json';
/** 检查间隔 (毫秒)。例如：60 * 60 * 1000 = 1小时 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 核心函数：检查数据文件是否有更新
 * 利用浏览器的 HTTP 缓存协商机制 (ETag, Cache-Control)
 */
async function checkForDataUpdate() {
  console.log('[Auto-Update] 定时器触发，开始检查数据更新...');
  
  // 仅在用户已授权的情况下进行检查
  if (localStorage.getItem('yali_authorized') !== 'true' || !isAuthorizationStillValid()) {
    console.log('[Auto-Update] 用户未授权或授权已过期，跳过本次检查。');
    return;
  }

  try {
    // 1. 发起 fetch 请求
    // 浏览器会根据其缓存策略自动处理：
    // - 如果缓存有效：可能直接返回缓存 (304) 或发送条件请求
    // - 如果缓存过期：发送条件请求或直接请求新资源
    const response = await fetch(DATA_FILE_PATH);

    if (response.ok) {
      if (response.status === 200) {
        // 2a. 状态码 200 OK: 服务器返回了新数据
        console.log('[Auto-Update] 检测到数据更新，正在下载并处理...');
        
        // 3. 获取并解密新数据
        const encryptedText = await response.text();
        const encryptedBytes = atob(encryptedText);

        const encoder = new TextEncoder();
        const keyMaterial = encoder.encode(SHARED_SECRET_KEY);
        const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
        const keyBytes = new Uint8Array(keyHash).slice(0, 16);

        const encryptedUint8 = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
          encryptedUint8[i] = encryptedBytes.charCodeAt(i);
        }

        const decryptedUint8 = new Uint8Array(encryptedUint8.length);
        for (let i = 0; i < encryptedUint8.length; i++) {
          decryptedUint8[i] = encryptedUint8[i] ^ keyBytes[i % keyBytes.length];
        }

        const decoder = new TextDecoder('utf-8');
        const decryptedJsonStr = decoder.decode(decryptedUint8);
        const newData = JSON.parse(decryptedJsonStr);

        // 4. 更新全局缓存
        decryptedDataCache = newData;
        lastFetchTime = Date.now(); // 更新加载时间
        console.log('[Auto-Update] 数据已更新至最新版本。');

        // 5. 【关键】更新页面UI
        // 如果当前搜索框有内容，重新执行搜索以反映新数据
        const currentKeyword = document.getElementById('keyword')?.value.trim();
        if (currentKeyword) {
            console.log('[Auto-Update] 检测到正在进行的搜索，自动刷新搜索结果...');
            await search(); // 调用现有 search 函数更新结果
        } else {
            // 如果没有在搜索，至少更新一下提示信息
            const resultsEl = document.getElementById('results');
            if (resultsEl && resultsEl.innerHTML.includes('数据加载成功')) {
                 resultsEl.innerHTML = '<p>✅ 数据已自动更新，请开始搜索或浏览分类。</p>';
            }
            
            // --- 新增：数据更新后，重新生成分类按钮 ---
            generateAndDisplayCategoryButtons(decryptedDataCache);
            // --------------------------------------------
        }
        
        // 可选：给用户一个轻微的通知（不打扰）
        // 例如，在搜索框旁边显示一个短暂的 "数据已更新" 提示
        // showTransientNotification("数据已自动更新");

      } else if (response.status === 304) {
        // 2b. 状态码 304 Not Modified: 服务器确认缓存仍然有效
        console.log('[Auto-Update] 数据未发生变化 (304 Not Modified)。');
      }
    } else {
      console.error(`[Auto-Update] 检查更新失败: HTTP ${response.status} ${response.statusText}`);
    }

  } catch (error) {
    console.error('[Auto-Update] 检查数据更新时发生错误:', error);
    // 可以在这里添加错误处理，例如重试逻辑或用户提示
  }
}

/**
 * 启动周期性的数据检查
 */
function startPeriodicDataCheck() {
  console.log(`[Auto-Update] 启动定时数据检查，间隔: ${CHECK_INTERVAL_MS / 1000 / 60} 分钟`);
  // 使用 setInterval 设置定时器
  setInterval(checkForDataUpdate, CHECK_INTERVAL_MS);
}

// --- 新增函数：生成并显示动态分类按钮 ---
function generateAndDisplayCategoryButtons(data) {
  const containerId = 'dynamic-category-buttons-container';
  let container = document.getElementById(containerId);

  // 如果容器不存在，则创建它并插入到指定位置
  if (!container) {
    const referenceElement = document.querySelector('.categories'); // 找到现有分类区域
    const newDiv = document.createElement('div');
    newDiv.id = containerId;
    newDiv.className = 'dynamic-categories';
    newDiv.style.maxWidth = '800px';
    newDiv.style.margin = '0 auto 25px';
    newDiv.style.textAlign = 'center';
    newDiv.innerHTML = `
  <h3>🔍 按类型筛选</h3>
  <div id="category-buttons-wrapper"></div>
    `;
    // 插入到现有 categories div 之后
    referenceElement.parentNode.insertBefore(newDiv, referenceElement.nextSibling);
    container = document.getElementById(containerId);
  }

  const wrapper = container.querySelector('#category-buttons-wrapper');
  wrapper.innerHTML = ''; // 清空前一次的内容

  if (!data || !Array.isArray(data)) {
    console.warn("generateAndDisplayCategoryButtons received invalid data");
    return;
  }

  // 提取唯一的 type
  const typeSet = new Set();
  data.forEach(item => {
    if (item.type && typeof item.type === 'string') {
      typeSet.add(item.type.trim());
    }
  });

  const sortedTypes = Array.from(typeSet).sort();

  // 为每个 type 创建按钮
  sortedTypes.forEach(type => {
    const button = document.createElement('button');
    button.className = 'dynamic-category-btn';
    button.textContent = type;
    button.setAttribute('data-filter-type', type);
    button.addEventListener('click', handleCategoryButtonClick);
    wrapper.appendChild(button);
  });

  // 显示容器
  container.style.display = 'block';
}

// --- 新增函数：处理分类按钮点击 ---
function handleCategoryButtonClick(event) {
  const button = event.currentTarget;
  const selectedType = button.getAttribute('data-filter-type');

  if (!selectedType || !decryptedDataCache) {
    console.warn("Missing type or data cache for filtering");
    return;
  }

  // 更新按钮激活状态 (可选)
  document.querySelectorAll('.dynamic-category-btn').forEach(btn => {
    if (btn === button) {
       btn.classList.add('active');
    } else {
       btn.classList.remove('active');
    }
  });

  // 执行筛选
  const filteredItems = decryptedDataCache.filter(item => item.type === selectedType);

  // 显示结果
  displayResults(filteredItems, `📁 类型 "${selectedType}" 下的资源`);
}

// --- 新增/修改函数：通用显示结果函数 ---
function displayResults(items, title = "搜索结果") {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  if (items.length === 0) {
    resultsEl.innerHTML = `<p>未找到匹配的资源。</p>`;
    return;
  }

  // 添加标题
  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.color = '#333';
  titleEl.style.marginBottom = '15px';
  titleEl.style.fontSize = '18px';
  resultsEl.appendChild(titleEl);

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';

    const mainCandidates = [];
    if (item.baidu_link && item.baidu_link.trim()) mainCandidates.push(item.baidu_link);
    if (item.yd_link && item.yd_link.trim()) mainCandidates.push(item.yd_link);
    if (item.xl_link && item.xl_link.trim()) mainCandidates.push(item.xl_link);

    let mainLink = '';
    if (mainCandidates.length > 0) {
      mainLink = mainCandidates[Math.floor(Math.random() * mainCandidates.length)];
    }

    const pwdCandidates = [];
    if (item.wkm_link && item.wkm_link.trim()) pwdCandidates.push(item.wkm_link);
    if (item.quarkm_link && item.quarkm_link.trim()) pwdCandidates.push(item.quarkm_link);
    if (item.ktm_link && item.ktm_link.trim()) pwdCandidates.push(item.ktm_link);

    let backupPasswordLink = '';
    if (pwdCandidates.length > 0) {
      backupPasswordLink = pwdCandidates[Math.floor(Math.random() * pwdCandidates.length)];
    }

    let html = `<strong>${item.name}</strong><br/>`;

    if (mainLink) {
      html += `<div><a href="${mainLink}" target="_blank" class="link main-link">🔗 主链接</a></div>`;
    }
    if (item.backup_link && item.backup_link.trim()) {
      html += `<div><a href="${item.backup_link}" target="_blank" class="link backup-link">🔗 备用链接</a></div>`;
    }
    if (backupPasswordLink) {
      html += `<div><a href="${backupPasswordLink}" target="_blank" class="link pwd-link">🔑 提取码</a></div>`;
    }

    if (!mainLink && !item.backup_link?.trim() && !backupPasswordLink) {
      html += '<div>❌ 无有效链接</div>';
    }

    div.innerHTML = html;
    resultsEl.appendChild(div);
  });
}

// =============================================================================
// ===                         新增代码区 (结束)                              ===
// =============================================================================

