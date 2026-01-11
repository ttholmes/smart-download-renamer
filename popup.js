console.log('🎨 Popup carregado');

// ========================================
// ELEMENTOS DO DOM
// ========================================

var ollamaStatusDot = document.getElementById('ollamaStatusDot');
var ollamaStatusText = document.getElementById('ollamaStatusText');
var ollamaUrlInput = document.getElementById('ollamaUrl');
var ollamaAlertEl = document.getElementById('ollamaAlert');
var historyListEl = document.getElementById('historyList');

// ========================================
// BOTÃO: CONFIGURAÇÕES
// ========================================

document.getElementById('settingsBtn').addEventListener('click', function() {
  chrome.tabs.create({ url: 'settings.html' });
});

// ========================================
// OLLAMA STATUS
// ========================================

function updateOllamaStatus(status, text) {
  ollamaStatusDot.className = 'status-dot ' + status;
  ollamaStatusText.className = 'status-text ' + status;
  ollamaStatusText.textContent = text;
}

function showOllamaAlert(message, type) {
  ollamaAlertEl.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
  setTimeout(function() {
    ollamaAlertEl.innerHTML = '';
  }, 5000);
}

function checkOllamaConnection() {
  var url = ollamaUrlInput.value.trim();
  
  chrome.runtime.sendMessage({
    action: 'testOllama',
    url: url
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao testar Ollama:', chrome.runtime.lastError);
      updateOllamaStatus('disconnected', '✗ Erro na comunicação');
      return;
    }
    
    if (response && response.success) {
      var modelCount = response.modelCount || 0;
      updateOllamaStatus('connected', '✓ Conectado (' + modelCount + ' modelos)');
    } else {
      updateOllamaStatus('disconnected', '✗ Não conectado');
    }
  });
}

// Botão: Testar Ollama
document.getElementById('testOllamaBtn').addEventListener('click', function() {
  var btn = this;
  var originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = '...';
  
  updateOllamaStatus('', 'Testando...');
  
  var url = ollamaUrlInput.value.trim();
  
  chrome.runtime.sendMessage({
    action: 'testOllama',
    url: url
  }, function(response) {
    btn.disabled = false;
    btn.textContent = originalText;
    
    if (chrome.runtime.lastError) {
      updateOllamaStatus('disconnected', '✗ Erro');
      showOllamaAlert('✗ Erro ao testar conexão', 'warning');
      return;
    }
    
    if (response && response.success) {
      var modelCount = response.modelCount || 0;
      updateOllamaStatus('connected', '✓ Conectado (' + modelCount + ' modelos)');
      showOllamaAlert('✓ Ollama conectado! ' + modelCount + ' modelo(s) disponível(is)', 'success');
      
      // Salvar URL
      chrome.storage.local.set({ ollamaUrl: url });
      
      if (response.models && response.models.length > 0) {
        console.log('📦 Modelos disponíveis:');
        response.models.forEach(function(model) {
          console.log('  -', model.name);
        });
      }
    } else {
      updateOllamaStatus('disconnected', '✗ Não conectado');
      var errorMsg = response && response.error ? response.error : 'Erro desconhecido';
      showOllamaAlert('✗ Não foi possível conectar: ' + errorMsg, 'warning');
    }
  });
});

// Salvar URL quando perder foco
ollamaUrlInput.addEventListener('blur', function() {
  var url = this.value.trim();
  if (url) {
    chrome.storage.local.set({ ollamaUrl: url });
  }
});

// ========================================
// HISTÓRICO
// ========================================

function loadHistory() {
  chrome.storage.local.get(['history'], function(result) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao carregar histórico:', chrome.runtime.lastError);
      return;
    }
    
    var history = result.history || [];
    
    if (history.length === 0) {
      historyListEl.innerHTML = '<li class="empty-history"><div class="empty-history-icon">📭</div><div>Nenhuma renomeação ainda</div></li>';
      return;
    }
    
    historyListEl.innerHTML = '';
    
    // Mostrar últimos 10
    history.slice(0, 10).forEach(function(item) {
      var li = document.createElement('li');
      li.className = 'history-item';
      
      var oldName = document.createElement('span');
      oldName.className = 'old-name';
      oldName.textContent = item.oldName || 'arquivo.pdf';
      
      var newName = document.createElement('span');
      newName.className = 'new-name';
      newName.textContent = '→ ' + (item.newName || 'renomeado.pdf');
      
      var timestamp = document.createElement('span');
      timestamp.className = 'timestamp';
      var date = new Date(item.timestamp || Date.now());
      timestamp.textContent = date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      li.appendChild(oldName);
      li.appendChild(newName);
      li.appendChild(timestamp);
      
      historyListEl.appendChild(li);
    });
  });
}

// Escutar mudanças no histórico
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.history) {
    loadHistory();
  }
});

// ========================================
// AÇÕES
// ========================================

// Botão: Limpar histórico
document.getElementById('clearHistoryBtn').addEventListener('click', function() {
  if (confirm('Deseja limpar todo o histórico de renomeações?')) {
    chrome.storage.local.set({ history: [] }, function() {
      if (chrome.runtime.lastError) {
        showOllamaAlert('✗ Erro ao limpar histórico', 'warning');
      } else {
        loadHistory();
        showOllamaAlert('✓ Histórico limpo!', 'info');
      }
    });
  }
});

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('📋 Inicializando popup...');
  
  // Carregar URL do Ollama salva
  chrome.storage.local.get(['ollamaUrl'], function(result) {
    if (result.ollamaUrl) {
      ollamaUrlInput.value = result.ollamaUrl;
    }
  });
  
  // Carregar dados
  loadHistory();
  checkOllamaConnection();
  
  console.log('✅ Popup inicializado');
});

// Atualização periódica
setInterval(function() {
  checkOllamaConnection();
}, 10000);

console.log('🎉 Popup script carregado!');
