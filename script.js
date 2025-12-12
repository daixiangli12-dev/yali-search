// --- 🔐 SHARED SECRET KEY for Data Decryption ---
const SHARED_SECRET_KEY = "MY_STRONG_XOR_KEY_2024!SecureItWell";

// --- 🔐 Hardcoded Access Codes Map (Date -> Code) ---
// 注意：这里的日期格式必须是 YYYY-MM-DD
// 请定期更新此列表，添加未来的日期和对应的访问码
const ACCESS_CODES = {
  "2025-12-12": "a1b2", // 示例：今天的访问码
  "2024-05-21": "c3d4",
  "2024-05-22": "e5f6",
  "2024-05-23": "g7h8",
  "2024-05-24": "i9j0",
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


let decryptedDataCache = null;

function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = beijingTime.getUTCFullYear();
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


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

// 新增函数：检查本地存储的授权是否仍然有效（即日期是否匹配）
function isAuthorizationStillValid() {
    const today = getBeijingDate();
    const storedAuthDate = localStorage.getItem('yali_auth_date');
    // 如果存储的日期与今天相同，则认为授权有效
    return storedAuthDate === today;
}

async function initializeApp() {
  const authErrorEl = document.getElementById('auth-error');
  const verifyButton = document.getElementById('verify-btn');
  const accessCodeInput = document.getElementById('access-code');
  const modal = document.getElementById('auth-modal');

  try {
    const today = getBeijingDate();
    const EXPECTED_ACCESS_CODE = ACCESS_CODES[today]; // 从硬编码对象中获取

    // 如果今天没有配置访问码，应禁止访问或提示错误
    if (!EXPECTED_ACCESS_CODE) {
         console.error(`[Error] No access code configured for today: ${today}`);
         authErrorEl.textContent = `系统错误：未配置 ${today} 的访问码。`;
         verifyButton.disabled = true;
         modal.style.display = 'flex'; // 确保模态框显示
         return; // 阻止后续逻辑
    }

    console.log(`[Info] Today (${today}) Expected Access Code:`, EXPECTED_ACCESS_CODE);

    verifyButton.addEventListener('click', async () => {
      const userCode = accessCodeInput.value.trim().toLowerCase();
      if (userCode === EXPECTED_ACCESS_CODE) {
        // 授权成功时，同时存储授权标志和授权日期
        localStorage.setItem('yali_authorized', 'true');
        localStorage.setItem('yali_auth_date', today);
        modal.style.display = 'none';
        authErrorEl.textContent = '';
        await preloadDecryptedData();
      } else {
        authErrorEl.textContent = '访问码错误，请检查后重试。';
        accessCodeInput.value = '';
        accessCodeInput.focus();
      }
    });

    // 检查 localStorage 中是否有授权标志 *并且* 日期是今天
    if (localStorage.getItem('yali_authorized') === 'true' && isAuthorizationStillValid()) {
      modal.style.display = 'none';
      await preloadDecryptedData();
    } else {
      // 如果未授权，或授权已过期（日期不对），则显示模态框
      modal.style.display = 'flex';
      // 可选：清除过期的授权状态
      localStorage.removeItem('yali_authorized');
      localStorage.removeItem('yali_auth_date');
    }

  } catch (error) {
    console.error("[Error] App initialization failed:", error);
    authErrorEl.textContent = `初始化失败: ${error.message}`;
    verifyButton.disabled = true;
  }
}

// ✅✅✅ 关键修改：使用相对路径加载数据 ✅✅✅
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
  const encryptedBytes = atob(encryptedText); // Base64 解码为字符串（每字符代表一个字节）

  // === 关键修改：使用 Uint8Array 处理字节流 ===
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(SHARED_SECRET_KEY);
  const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
  const keyBytes = new Uint8Array(keyHash).slice(0, 16);

  // 将 Base64 解码后的字符串转换为 Uint8Array
  const encryptedUint8 = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    encryptedUint8[i] = encryptedBytes.charCodeAt(i);
  }

  // XOR 解密
  const decryptedUint8 = new Uint8Array(encryptedUint8.length);
  for (let i = 0; i < encryptedUint8.length; i++) {
    decryptedUint8[i] = encryptedUint8[i] ^ keyBytes[i % keyBytes.length];
  }

  // 使用 TextDecoder 解码为 UTF-8 字符串
  const decoder = new TextDecoder('utf-8');
  const decryptedJsonStr = decoder.decode(decryptedUint8);

  // 解析 JSON
  decryptedDataCache = JSON.parse(decryptedJsonStr);
  console.log("[Debug] Data preloaded and decrypted.");
  resultsEl.innerHTML = '<p>✅ 数据加载成功，请开始搜索。</p>';
} catch (err) {
  console.error("[Error] Failed to preload/decrypt data:", err);
  resultsEl.innerHTML = `<p style="color:red;">数据加载失败：${err.message}</p>`;
}
}


async function search() {
  const keyword = document.getElementById('keyword').value.trim();
  const resultsEl = document.getElementById('results');

  if (!keyword) {
    resultsEl.innerHTML = '<p>请输入关键词</p>';
    return;
  }

  // 搜索前也检查授权有效性
  if (localStorage.getItem('yali_authorized') !== 'true' || !isAuthorizationStillValid()) {
    alert('请先通过访问码验证！');
    // 可选：自动弹出模态框
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

    resultsEl.innerHTML = '';

    if (filteredResults.length === 0) {
      resultsEl.innerHTML = `
        <p>未找到相关资源</p>
        <p style="font-size: 14px; color: #666; margin-top: 10px;">
          🔄 <strong>提示</strong>: 结果可能已更新，请尝试 <strong><a href="#" onclick="location.reload(); return false;" style="color: #007bff;">刷新页面</a></strong> 后重试。<br>
          如果问题依旧，请到 <a href="https://web.wps.cn/wo/sl/v39HLe4?app_id=KeiwhRvKjT82N9D0HUUL6" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline;">许愿池</a> 反馈。
        </p>
      `;
      return;
    }

    filteredResults.forEach(item => {
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
  } catch (err) {
    console.error("[Error] Search processing failed:", err);
    resultsEl.innerHTML = `<p style="color:red;">搜索处理失败：${err.message}</p>`;
  }
}

document.getElementById('keyword').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    search();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}