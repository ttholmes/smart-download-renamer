console.log('⚙️ Settings carregado');

// Carregar configurações ao abrir
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
});

// Botão voltar
document.getElementById('backBtn').addEventListener('click', function(e) {
  e.preventDefault();
  window.close();
});

// Carregar configurações
function loadSettings() {
  chrome.storage.local.get([
    'useAI',
    'ollamaModel',
    'patternAcademic',
    'patternFinancial',
    'patternTechnical',
    'patternBook',
    'patternRom',
    'patternApp'
  ], function(result) {
    // IA Settings
    document.getElementById('useAI').checked = result.useAI !== false;
    document.getElementById('ollamaModel').value = result.ollamaModel || 'qwen2.5:3b';
    
    // Patterns
    document.getElementById('patternAcademic').checked = result.patternAcademic !== false;
    document.getElementById('patternFinancial').checked = result.patternFinancial === true;
    document.getElementById('patternTechnical').checked = result.patternTechnical !== false;
    document.getElementById('patternBook').checked = result.patternBook === true;
    document.getElementById('patternRom').checked = result.patternRom !== false;
    document.getElementById('patternApp').checked = result.patternApp !== false;
    
    console.log('✅ Configurações carregadas');
  });
}

// Salvar configurações
document.getElementById('saveBtn').addEventListener('click', function() {
  var settings = {
    useAI: document.getElementById('useAI').checked,
    ollamaModel: document.getElementById('ollamaModel').value,
    patternAcademic: document.getElementById('patternAcademic').checked,
    patternFinancial: document.getElementById('patternFinancial').checked,
    patternTechnical: document.getElementById('patternTechnical').checked,
    patternBook: document.getElementById('patternBook').checked,
    patternRom: document.getElementById('patternRom').checked,
    patternApp: document.getElementById('patternApp').checked
  };
  
  chrome.storage.local.set(settings, function() {
    console.log('💾 Configurações salvas:', settings);
    
    // Atualizar config no background
    chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: settings
    });
    
    // Mostrar mensagem de sucesso
    var successMsg = document.getElementById('successMessage');
    successMsg.classList.add('show');
    
    setTimeout(function() {
      successMsg.classList.remove('show');
    }, 3000);
  });
});

console.log('✅ Settings script carregado');
