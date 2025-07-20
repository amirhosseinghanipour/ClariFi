document.addEventListener('DOMContentLoaded', () => {
    const batchUpload = document.getElementById('batch-upload');
    const batchPreview = document.getElementById('batch-preview');
    const batchOperation = document.getElementById('batch-operation');
    const batchParams = document.getElementById('batch-params');
    const applyBatchButton = document.getElementById('apply-batch');
    const downloadBatchButton = document.getElementById('download-batch');
    const batchProgress = document.getElementById('batch-progress');
    const batchStatus = document.getElementById('batch-status');

    let batchFiles = [];
    let processedImages = [];

    setupEventListeners();

    function setupEventListeners() {
        batchUpload.addEventListener('change', handleBatchUpload);
        batchOperation.addEventListener('change', updateBatchParams);
        applyBatchButton.addEventListener('click', processBatch);
        downloadBatchButton.addEventListener('click', downloadBatch);
    }

    function handleBatchUpload(e) {
        batchFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        displayBatchPreview();
        updateBatchStatus(`${batchFiles.length} images loaded`);
    }

    function displayBatchPreview() {
        batchPreview.innerHTML = '';
        batchFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'border-2 border-white p-2';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'w-full h-32 object-cover mb-2';
            img.onload = () => URL.revokeObjectURL(img.src);
            
            const name = document.createElement('p');
            name.textContent = file.name;
            name.className = 'text-xs font-mono uppercase truncate';
            
            container.appendChild(img);
            container.appendChild(name);
            batchPreview.appendChild(container);
        });
    }

    function updateBatchParams() {
        const operation = batchOperation.value;
        batchParams.innerHTML = '';

        switch (operation) {
            case 'resize':
                batchParams.innerHTML = `
                    <input type="number" id="batch-width" class="w-full p-1 mb-2" placeholder="WIDTH">
                    <input type="number" id="batch-height" class="w-full p-1 mb-2" placeholder="HEIGHT">
                    <label class="flex items-center">
                        <input type="checkbox" id="batch-aspect" checked class="mr-2">
                        <span class="text-xs font-mono uppercase">KEEP ASPECT</span>
                    </label>
                `;
                break;
            case 'brightness':
            case 'contrast':
            case 'saturation':
                batchParams.innerHTML = `
                    <label class="text-sm font-mono uppercase">FACTOR (0-2)</label>
                    <input type="range" id="batch-factor" min="0" max="2" step="0.1" value="1" class="w-full slider">
                    <span id="batch-factor-value" class="text-sm">1.0</span>
                `;
                document.getElementById('batch-factor').addEventListener('input', (e) => {
                    document.getElementById('batch-factor-value').textContent = e.target.value;
                });
                break;
            case 'blur':
                batchParams.innerHTML = `
                    <label class="text-sm font-mono uppercase">RADIUS (0-10)</label>
                    <input type="range" id="batch-radius" min="0" max="10" step="0.5" value="2" class="w-full slider">
                    <span id="batch-radius-value" class="text-sm">2.0</span>
                `;
                document.getElementById('batch-radius').addEventListener('input', (e) => {
                    document.getElementById('batch-radius-value').textContent = e.target.value;
                });
                break;
            case 'rotate':
                batchParams.innerHTML = `
                    <select id="batch-angle" class="w-full p-1">
                        <option value="90">90°</option>
                        <option value="180">180°</option>
                        <option value="270">270°</option>
                    </select>
                `;
                break;
            case 'flip':
                batchParams.innerHTML = `
                    <select id="batch-direction" class="w-full p-1">
                        <option value="horizontal">HORIZONTAL</option>
                        <option value="vertical">VERTICAL</option>
                    </select>
                `;
                break;
            case 'format':
                batchParams.innerHTML = `
                    <select id="batch-format" class="w-full p-1">
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                        <option value="webp">WEBP</option>
                    </select>
                `;
                break;
        }
    }

    async function processBatch() {
        if (batchFiles.length === 0) {
            updateBatchStatus('No images to process', true);
            return;
        }

        processedImages = [];
        applyBatchButton.disabled = true;
        updateBatchProgress(0);

        for (let i = 0; i < batchFiles.length; i++) {
            try {
                updateBatchStatus(`Processing ${i + 1}/${batchFiles.length}: ${batchFiles[i].name}`);
                const result = await processImage(batchFiles[i], i);
                processedImages.push(result);
                updateBatchProgress(((i + 1) / batchFiles.length) * 100);
            } catch (error) {
                console.error(`Error processing ${batchFiles[i].name}:`, error);
                updateBatchStatus(`Error processing ${batchFiles[i].name}: ${error.message}`, true);
            }
        }

        applyBatchButton.disabled = false;
        updateBatchStatus(`Batch processing complete: ${processedImages.length}/${batchFiles.length} images processed`);
        displayProcessedImages();
    }

    async function processImage(file, index) {
        const operation = batchOperation.value;
        const formData = new FormData();
        formData.append('image', file);

        let endpoint = '';
      
        
        switch (operation) {
            case 'grayscale':
            case 'sepia':
            case 'sharpen':
            case 'edge_detection':
            case 'hdr':
            case 'cartoon':
            case 'oil_painting':
            case 'watercolor':
            case 'sketch':
            case 'emboss':
                endpoint = `/filter/${operation}`;
                break;
            case 'brightness':
            case 'contrast':
            case 'saturation':
                endpoint = `/adjust/${operation}`;
                formData.append('factor', document.getElementById('batch-factor')?.value || 1);
                break;
            case 'blur':
                endpoint = '/filter/blur';
                formData.append('radius', document.getElementById('batch-radius')?.value || 2);
                break;
            case 'resize':
                endpoint = '/transform/apply-resize';
                formData.append('width', document.getElementById('batch-width')?.value || 0);
                formData.append('height', document.getElementById('batch-height')?.value || 0);
                break;
            case 'rotate':
                endpoint = '/transform/rotate';
                formData.append('angle', document.getElementById('batch-angle')?.value || 90);
                break;
            case 'flip':
                endpoint = '/transform/flip';
                formData.append('direction', document.getElementById('batch-direction')?.value || 'horizontal');
                break;
            case 'auto-enhance':
            case 'colorize':
            case 'super-resolution':
            case 'restore':
                endpoint = `/premium/${operation}`;
                break;
            case 'format':
                endpoint = '/format/convert-format';
                formData.append('format', document.getElementById('batch-format')?.value || 'jpeg');
                break;
            default:
                throw new Error('Unknown operation');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': getCookie('csrftoken') }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        return {
            blob,
            originalName: file.name,
      if (operationSelect.value === 'brightness' || operationSelect.value === 'contrast' || operationSelect.value === 'saturation') {
        formData.append('factor', document.getElementById('batch-factor')?.value || 1);
      }
      if (operationSelect.value === 'blur') {
        formData.append('radius', document.getElementById('batch-radius')?.value || 2);
      }
      if (operationSelect.value === 'rotate') {
        formData.append('angle', document.getElementById('batch-angle')?.value || 90);
      }
      if (operationSelect.value === 'flip') {
        formData.append('direction', document.getElementById('batch-direction')?.value || 'horizontal');
      }
      if (operationSelect.value === 'format') {
        formData.append('format', document.getElementById('batch-format')?.value || 'jpeg');
      }
      
      fetch('/batch-process', {
        };
    }

    function displayProcessedImages() {
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
            const container = document.createElement('div');
            container.className = 'border-2 border-white p-2';
          
          if (data.results) {
            data.results.forEach((result, index) => {
              if (result.success) {
                const container = document.createElement('div');
                container.className = 'border-2 border-white p-2';
                
            const img = document.createElement('img');
            img.src = URL.createObjectURL(result.blob);
            img.className = 'w-full h-32 object-cover mb-2';
            
            const name = document.createElement('p');
            name.textContent = `${result.originalName} (processed)`;
            name.className = 'text-xs font-mono uppercase truncate';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'DOWNLOAD';
            downloadBtn.className = 'button-style w-full text-xs py-1 mt-1';
            downloadBtn.onclick = () => downloadSingle(result);
            
                img.src = result.data;
            container.appendChild(name);
                
                const name = document.createElement('p');
                name.textContent = `Image ${index + 1} (processed)`;
                name.className = 'text-xs font-mono uppercase truncate mt-2';
                
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'DOWNLOAD';
                downloadBtn.className = 'button-style w-full text-xs py-1 mt-1';
                downloadBtn.onclick = () => downloadFromDataUrl(result.data, `batch_${index + 1}_${operationSelect.value}.png`);
                
                container.appendChild(img);
                container.appendChild(name);
                container.appendChild(downloadBtn);
                preview.appendChild(container);
              } else {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'border-2 border-red-500 p-2 text-red-500';
                errorDiv.textContent = `Image ${index + 1}: ${result.error || 'Processing failed'}`;
                preview.appendChild(errorDiv);
              }
            });
            
            updateBatchStatus(`Processed ${data.total_processed}/${data.total_requested} images successfully`);
          } else {
            updateBatchStatus('No results returned from server', true);
          }
        })
        .catch(error => {
          console.error('Batch processing error:', error);
          updateBatchStatus(`Error: ${error.message}`, true);
        });
    }

    function downloadSingle(result) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(result.blob);
        const nameWithoutExt = result.originalName.split('.').slice(0, -1).join('.');
        const operation = batchOperation.value;
        link.download = `${nameWithoutExt}_${operation}_clarifi.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function downloadBatch() {
        if (processedImages.length === 0) {
            updateBatchStatus('No processed images to download', true);
            return;
        }

        processedImages.forEach(result => downloadSingle(result));
        updateBatchStatus(`Downloaded ${processedImages.length} images`);
    }

    function updateBatchProgress(percent) {
        if (batchProgress) {
            batchProgress.style.width = `${percent}%`;
        }
    }

    function updateBatchStatus(message, isError = false) {
        if (batchStatus) {
            batchStatus.textContent = message;
            batchStatus.className = `text-sm font-mono uppercase ${isError ? 'text-red-500' : 'text-green-500'}`;
        }
    }

    function downloadFromDataUrl(dataUrl, filename) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});