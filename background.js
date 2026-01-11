console.log('=================================');
console.log('SERVICE WORKER INICIADO');
console.log('=================================');

// ========================================
// CONTADORES GLOBAIS
// ========================================

var downloadCount = 0;
var renameCount = 0;

// ========================================
// CONFIGURAÇÃO PADRÃO
// ========================================

var config = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:3b',
  useAI: true
};

// Carregar configuração
chrome.storage.local.get(['ollamaUrl', 'ollamaModel', 'useAI'], function(result) {
  if (result.ollamaUrl) config.ollamaUrl = result.ollamaUrl;
  if (result.ollamaModel) config.ollamaModel = result.ollamaModel;
  if (result.useAI !== undefined) config.useAI = result.useAI;
  
  console.log('⚙️ Configuração carregada:', config);
});

// ========================================
// LISTENER PRINCIPAL - INTERCEPTAR DOWNLOADS
// ========================================

chrome.downloads.onDeterminingFilename.addListener(handleDownloadDetermining);

console.log('✅ Listener onDeterminingFilename REGISTRADO');

function handleDownloadDetermining(downloadItem, suggest) {
  console.log('═══════════════════════════════════════');
  console.log('🎯 [LISTENER DISPARADO!]');
  console.log('📥 Download:', {
    id: downloadItem.id,
    filename: downloadItem.filename,
    url: downloadItem.url,
    referrer: downloadItem.referrer,
    mime: downloadItem.mime,
    size: downloadItem.fileSize
  });
  console.log('═══════════════════════════════════════');
  
  downloadCount++;
  
  // Processar de forma assíncrona
  processDownload(downloadItem).then(function(newFilename) {
    var oldFilename = downloadItem.filename;
    
    console.log('✏️ RENOMEANDO:');
    console.log('  DE:', oldFilename);
    console.log('  PARA:', newFilename);
    
    // Salvar no histórico
    saveToHistory(oldFilename, newFilename);
    
    renameCount++;
    
    suggest({
      filename: newFilename,
      conflictAction: 'uniquify'
    });
    
    console.log('✅ Suggest() chamado!');
    console.log('');
    
  }).catch(function(error) {
    console.error('❌ Erro ao processar:', error);
    suggest(); // Mantém nome original
  });
  
  return true;
}

// ========================================
// PROCESSAMENTO INTELIGENTE DE DOWNLOAD
// ========================================

async function processDownload(downloadItem) {
  var context = extractContext(downloadItem);
  
  console.log('🔍 Contexto extraído:', context);
  
  // Se IA está habilitada e Ollama disponível, usar IA
  if (config.useAI) {
    try {
      var aiResult = await generateIntelligentName(context);
      if (aiResult.success) {
        return sanitizeFilename(aiResult.filename);
      }
      console.warn('⚠️ IA falhou, usando fallback');
    } catch (error) {
      console.error('❌ Erro na IA:', error);
    }
  }
  
  // Fallback: geração baseada em regras
  return generateRuleBasedName(context);
}

// ========================================
// EXTRAÇÃO DE CONTEXTO
// ========================================

function extractContext(downloadItem) {
  var url = downloadItem.url || '';
  var referrer = downloadItem.referrer || '';
  var filename = downloadItem.filename || '';
  var mime = downloadItem.mime || '';
  
  // Extrair domínio
  var domain = '';
  var siteName = '';
  try {
    var urlObj = new URL(url);
    domain = urlObj.hostname;
    siteName = domain.replace('www.', '').split('.')[0];
  } catch (e) {
    domain = 'unknown';
    siteName = 'unknown';
  }
  
  // Extrair extensão e basename
  var extension = '';
  var basename = filename;
  var lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    extension = filename.substring(lastDot);
    basename = filename.substring(0, lastDot);
  }
  
  // Extrair palavras significativas do nome original
  var originalKeywords = extractKeywordsFromFilename(basename);
  
  // Detectar tipo de conteúdo
  var contentType = detectContentType(domain, url, referrer, mime, extension, basename);
  
  // Extrair informações da URL
  var urlInfo = extractUrlInfo(url, basename);
  
  // Detectar padrões especiais
  var specialPattern = detectSpecialPattern(url, basename, domain);
  
  return {
    originalFilename: filename,
    basename: basename,
    extension: extension,
    url: url,
    domain: domain,
    siteName: siteName,
    referrer: referrer,
    mime: mime,
    contentType: contentType,
    urlInfo: urlInfo,
    originalKeywords: originalKeywords,
    specialPattern: specialPattern,
    fileSize: downloadItem.fileSize
  };
}

// ========================================
// EXTRAIR PALAVRAS-CHAVE DO NOME DO ARQUIVO
// ========================================

function extractKeywordsFromFilename(basename) {
  var stopWords = [
    'download', 'file', 'document', 'temp', 'tmp', 'new', 'untitled',
    'output', 'result', 'data', 'export', 'attachment', 'compressed',
    'v1', 'v2', 'v3', 'final', 'copy', 'backup', 'old', 'bin'
  ];
  
  var cleaned = basename.replace(/[a-f0-9]{16,}/gi, '');
  cleaned = cleaned.replace(/\d{10,}/g, '');
  
  var words = cleaned.split(/[\s\-_\.]+/);
  
  var keywords = words.filter(function(word) {
    var lower = word.toLowerCase();
    return word.length >= 3 &&
           !stopWords.includes(lower) &&
           !/^\d+$/.test(word) &&
           !/^[a-f0-9]{8,}$/i.test(word);
  });
  
  return keywords.slice(0, 5);
}

// ========================================
// DETECTAR TIPO DE CONTEÚDO
// ========================================

function detectContentType(domain, url, referrer, mime, extension, basename) {
  var urlLower = url.toLowerCase();
  var domainLower = domain.toLowerCase();
  
  if (domainLower.includes('arxiv') || 
      domainLower.includes('scholar') ||
      domainLower.includes('researchgate') ||
      domainLower.includes('ieee') ||
      domainLower.includes('acm.org')) {
    return 'academic';
  }
  
  if (domainLower.includes('sec.gov') ||
      domainLower.includes('investor')) {
    return 'financial';
  }
  
  if (domainLower.includes('github') ||
      domainLower.includes('docs.')) {
    return 'technical';
  }
  
  if (extension === '.epub' || extension === '.mobi') {
    return 'book';
  }
  
  if (urlLower.includes('manual') || urlLower.includes('guide')) {
    return 'manual';
  }
  
  if (extension === '.pdf') {
    return 'document';
  }
  
  return 'generic';
}

// ========================================
// DETECTAR PADRÕES ESPECIAIS
// ========================================

function detectSpecialPattern(url, basename, domain) {
  var urlLower = url.toLowerCase();
  var basenameLower = basename.toLowerCase();
  
  // GitHub Releases
  if (domain.includes('github') && urlLower.includes('/releases/')) {
    var repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (repoMatch) {
      return {
        type: 'github-release',
        owner: repoMatch[1],
        repo: repoMatch[2],
        version: extractVersion(url, basename)
      };
    }
  }
  
  // Aplicativos
  if (basenameLower.match(/\.(dmg|exe|appimage|deb|rpm)$/)) {
    return {
      type: 'application',
      appName: extractAppName(basename, url)
    };
  }
  
  // ROMs de jogos
  if (basenameLower.match(/\.(gba|gbc|gb|nes|snes|n64|nds|iso|rom|zip)$/) &&
      (basenameLower.includes('pokemon') || 
       basenameLower.includes('mario') ||
       basenameLower.includes('zelda') ||
       urlLower.includes('rom') ||
       urlLower.includes('game'))) {
    return {
      type: 'game-rom',
      game: extractGameName(basename)
    };
  }
  
  // Livros digitais
  if (basenameLower.match(/\.(epub|mobi|azw3?)$/)) {
    return {
      type: 'ebook',
      title: extractBookTitle(basename)
    };
  }
  
  return null;
}

function extractVersion(url, basename) {
  var versionPatterns = [
    /v?(\d+\.\d+\.\d+)/i,
    /version[_\-]?(\d+[\.\d]*)/i,
    /(\d+\.\d+)/
  ];
  
  for (var i = 0; i < versionPatterns.length; i++) {
    var match = url.match(versionPatterns[i]) || basename.match(versionPatterns[i]);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function extractAppName(basename, url) {
  var cleaned = basename
    .replace(/[\-_]?(macos|mac|osx|windows|win|linux|x64|x86|arm64|universal)[\-_]?/gi, '')
    .replace(/[\-_]?v?\d+\.\d+.*$/i, '')
    .replace(/[\-_]?(setup|installer|install)[\-_]?/gi, '');
  
  var words = cleaned.split(/[\s\-_]+/);
  return words.filter(function(w) { return w.length > 2; })[0] || basename;
}

function extractGameName(basename) {
  var cleaned = basename
    .replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ')
    .replace(/[\-_]+/g, ' ')
    .trim();
  
  return cleaned;
}

function extractBookTitle(basename) {
  var parts = basename.split(/[\-_]+/);
  return parts[0] || basename;
}

// ========================================
// EXTRAIR INFORMAÇÕES DA URL
// ========================================

function extractUrlInfo(url, basename) {
  var info = {
    pathParts: [],
    params: {},
    keywords: [],
    significantParts: []
  };
  
  try {
    var urlObj = new URL(url);
    
    info.pathParts = urlObj.pathname.split('/').filter(function(p) {
      return p && p.length > 0;
    });
    
    urlObj.searchParams.forEach(function(value, key) {
      info.params[key] = value;
    });
    
    var pathStr = urlObj.pathname;
    
    var githubMatch = pathStr.match(/\/([^\/]+)\/([^\/]+)\/(releases|download)/);
    if (githubMatch) {
      info.significantParts.push(githubMatch[1]);
      info.significantParts.push(githubMatch[2]);
    }
    
    var stopWords = ['download', 'files', 'get', 'fetch', 'api', 'v1', 'v2'];
    var pathWords = pathStr.split(/[\/\-_]+/).filter(function(word) {
      var lower = word.toLowerCase();
      return word.length > 3 && 
             !stopWords.includes(lower) &&
             !/^\d+$/.test(word);
    });
    
    info.keywords = pathWords;
    
  } catch (e) {
    console.error('Erro ao parsear URL:', e);
  }
  
  return info;
}

// ========================================
// GERAÇÃO INTELIGENTE COM IA
// ========================================

async function generateIntelligentName(context) {
  var prompt = buildPrompt(context);
  
  console.log('🤖 Enviando para IA...');
  
  try {
    var result = await generateWithOllama(config.ollamaUrl, config.ollamaModel, prompt);
    
    if (result.success) {
      var suggestedName = parseAIResponse(result.response, context.extension);
      console.log('✨ IA sugeriu:', suggestedName);
      
      return {
        success: true,
        filename: suggestedName
      };
    }
    
    return { success: false };
    
  } catch (error) {
    console.error('Erro na geração com IA:', error);
    return { success: false };
  }
}

// ========================================
// CONSTRUIR PROMPT PARA IA
// ========================================

function buildPrompt(context) {
  var date = new Date();
  var dateStr = date.getFullYear() + 
                String(date.getMonth() + 1).padStart(2, '0') + 
                String(date.getDate()).padStart(2, '0');
  
  var prompt = 'You are a file naming expert. Create a clear, descriptive filename.\n\n';
  
  prompt += 'CONTEXT:\n';
  prompt += '- Original: ' + context.originalFilename + '\n';
  prompt += '- Site: ' + context.domain + '\n';
  
  if (context.specialPattern) {
    var sp = context.specialPattern;
    
    if (sp.type === 'github-release') {
      prompt += '- Type: GitHub Release\n';
      prompt += '- Repository: ' + sp.owner + '/' + sp.repo + '\n';
      if (sp.version) prompt += '- Version: ' + sp.version + '\n';
    } else if (sp.type === 'application') {
      prompt += '- Type: Application\n';
      prompt += '- App: ' + sp.appName + '\n';
    } else if (sp.type === 'game-rom') {
      prompt += '- Type: Game ROM\n';
      prompt += '- Game: ' + sp.game + '\n';
    }
  }
  
  if (context.originalKeywords.length > 0) {
    prompt += '- Keywords: ' + context.originalKeywords.join(', ') + '\n';
  }
  
  prompt += '\nRULES:\n';
  prompt += '- Use hyphens only (no spaces)\n';
  prompt += '- Title case\n';
  prompt += '- Max 80 chars\n';
  prompt += '- Be descriptive and clear\n';
  prompt += '- NO file extension\n\n';
  
  prompt += 'Filename:';
  
  return prompt;
}

// ========================================
// PARSEAR RESPOSTA DA IA
// ========================================

function parseAIResponse(response, extension) {
  var filename = response.trim()
    .replace(/["'\n\r]/g, '')
    .split('\n')[0]
    .replace(/\.(pdf|docx?|txt|epub|png|jpg|jpeg|csv)$/i, '')
    .replace(/[^a-zA-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (filename.length > 80) {
    filename = filename.substring(0, 80);
  }
  
  if (!filename || filename.length < 3) {
    var date = new Date();
    filename = date.getFullYear() + 
               String(date.getMonth() + 1).padStart(2, '0') + 
               String(date.getDate()).padStart(2, '0') + 
               '-document';
  }
  
  return filename + extension;
}

// ========================================
// GERAÇÃO BASEADA EM REGRAS (FALLBACK)
// ========================================

function generateRuleBasedName(context) {
  var parts = [];
  
  if (context.specialPattern) {
    var sp = context.specialPattern;
    
    if (sp.type === 'github-release') {
      parts.push(sp.repo);
      if (sp.version) parts.push(sp.version);
      var platform = detectPlatform(context.basename);
      if (platform) parts.push(platform);
      
    } else if (sp.type === 'application') {
      parts.push(sp.appName);
      var version = extractVersion(context.url, context.basename);
      if (version) parts.push(version);
      var platform = detectPlatform(context.basename);
      if (platform) parts.push(platform);
      
    } else if (sp.type === 'game-rom') {
      parts.push(sp.game);
      var console = context.extension.replace('.', '').toUpperCase();
      if (console === 'ZIP') console = 'GBA'; // Assumir GBA para ZIPs de ROMs
      parts.push(console);
      
    } else if (sp.type === 'ebook') {
      parts.push(sp.title);
    }
    
  } else {
    var date = new Date();
    var dateStr = date.getFullYear() + 
                  String(date.getMonth() + 1).padStart(2, '0') + 
                  String(date.getDate()).padStart(2, '0');
    
    parts.push(dateStr);
    
    if (context.originalKeywords.length > 0) {
      parts = parts.concat(context.originalKeywords.slice(0, 3));
    } else if (context.urlInfo.significantParts.length > 0) {
      parts = parts.concat(context.urlInfo.significantParts.slice(0, 2));
    } else if (context.siteName && context.siteName !== 'unknown') {
      parts.push(context.siteName);
    }
  }
  
  var filename = parts
    .filter(function(p) { return p && p.length > 0; })
    .join('-')
    .replace(/[^a-zA-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (!filename || filename.length < 3) {
    filename = context.basename.substring(0, 50);
  }
  
  if (filename.length > 100) {
    filename = filename.substring(0, 100);
  }
  
  return filename + context.extension;
}

function detectPlatform(basename) {
  var lower = basename.toLowerCase();
  
  if (lower.includes('macos') || lower.includes('darwin') || lower.includes('.dmg')) {
    return 'MacOS';
  }
  if (lower.includes('windows') || lower.includes('win') || lower.includes('.exe')) {
    return 'Windows';
  }
  if (lower.includes('linux')) {
    return 'Linux';
  }
  if (lower.includes('universal')) {
    return 'Universal';
  }
  if (lower.includes('arm64')) {
    return 'ARM64';
  }
  if (lower.includes('x64') || lower.includes('x86_64')) {
    return 'x64';
  }
  
  return null;
}

// ========================================
// SANITIZAÇÃO
// ========================================

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\.\./g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

// ========================================
// HISTÓRICO
// ========================================

function saveToHistory(oldName, newName) {
  chrome.storage.local.get(['history'], function(result) {
    var history = result.history || [];
    
    history.unshift({
      oldName: oldName,
      newName: newName,
      timestamp: Date.now()
    });
    
    history = history.slice(0, 50);
    chrome.storage.local.set({ history: history });
    console.log('💾 Salvo no histórico');
  });
}

// ========================================
// OLLAMA CLIENT
// ========================================

async function testOllamaConnection(url) {
  console.log('🧪 Testando Ollama:', url);
  
  try {
    var response = await fetch(url + '/api/tags', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return { success: false, error: 'HTTP ' + response.status };
    }
    
    var data = await response.json();
    console.log('✅ Ollama OK:', data);
    
    return {
      success: true,
      models: data.models || [],
      modelCount: data.models ? data.models.length : 0
    };
    
  } catch (error) {
    console.error('❌ Erro Ollama:', error);
    return { success: false, error: error.message };
  }
}

async function generateWithOllama(url, model, prompt) {
  console.log('🤖 Gerando com Ollama...');
  
  try {
    var response = await fetch(url + '/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'qwen2.5:3b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100,
          stop: ['\n\n', 'Explanation:', 'Note:']
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    
    var data = await response.json();
    console.log('✅ Resposta:', data.response);
    
    return { success: true, response: data.response };
    
  } catch (error) {
    console.error('❌ Erro geração:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// MESSAGE HANDLER
// ========================================

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('📨 Mensagem:', message.action);
  
  if (message.action === 'getStatus') {
    sendResponse({
      downloadCount: downloadCount,
      renameCount: renameCount,
      active: true,
      useAI: config.useAI
    });
    return true;
  }
  
  if (message.action === 'testDownload') {
    chrome.downloads.download({
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      saveAs: false
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }
  
  if (message.action === 'checkConflicts') {
    chrome.management.getAll(function(extensions) {
      var conflicts = extensions.filter(function(ext) {
        return ext.enabled && 
               ext.id !== chrome.runtime.id &&
               ext.permissions &&
               ext.permissions.indexOf('downloads') > -1;
      });
      
      sendResponse({
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts.map(function(ext) {
          return { name: ext.name, id: ext.id };
        })
      });
    });
    return true;
  }
  
  if (message.action === 'testOllama') {
    testOllamaConnection(message.url).then(function(result) {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'updateConfig') {
    if (message.config) {
      Object.assign(config, message.config);
      chrome.storage.local.set(message.config);
      console.log('⚙️ Config atualizada:', config);
    }
    sendResponse({ success: true });
    return true;
  }
});

// ========================================
// INSTALAÇÃO
// ========================================

chrome.runtime.onInstalled.addListener(function(details) {
  console.log('🎉 Instalado:', details.reason);
  
  chrome.storage.local.set({
    enabled: true,
    installDate: Date.now(),
    version: '1.0.0',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:3b',
    useAI: true,
    patterns: {
      pdf: true,
      financial: false,
      doc: true,
      book: false
    }
  });
});

chrome.runtime.onStartup.addListener(function() {
  console.log('🔄 Browser iniciado');
});

console.log('🎉 SERVICE WORKER PRONTO!');
console.log('=================================');
