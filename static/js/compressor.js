document.addEventListener('DOMContentLoaded', () => {
    const originalCanvas = document.getElementById('original-canvas');
    const compressedCanvas = document.getElementById('compressed-canvas');
    const ctxOriginal = originalCanvas.getContext('2d');
    const ctxCompressed = compressedCanvas.getContext('2d');
    const uploadPrompt = document.getElementById('upload-prompt');
    const imageUpload = document.getElementById('image-upload');
    const uploadFeedback = document.getElementById('upload-feedback');
    const clearImageButton = document.getElementById('clear-image');
    const compressButton = document.getElementById('compress-button');
    const downloadButton = document.getElementById('download-button');
    const formatSelect = document.getElementById('format-select');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const compressionSlider = document.getElementById('compression-slider');
    const compressionValue = document.getElementById('compression-value');
    const targetSizeInput = document.getElementById('target-size');
    const losslessCheckbox = document.getElementById('lossless');
    const progressiveCheckbox = document.getElementById('progressive');
    const stripMetadataCheckbox = document.getElementById('strip-metadata');
    const quantizationSelect = document.getElementById('quantization');
    const dragOverlay = document.getElementById('drag-overlay');
    const originalSizeText = document.getElementById('original-size');
    const compressedSizeText = document.getElementById('compressed-size');

    const canvasArea = document.getElementById('canvas-area');
    const placeholder = document.getElementById('no-image-placeholder');

    let currentImageFile = null;
    let compressedImageBlob = null;
    let isLoading = false;

    init();

    function init() {
        updateCanvasVisibility();
        setupEventListeners();
        updateSliderValues();
    }

    function setupEventListeners() {
        uploadPrompt.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isLoading) imageUpload.click();
        });
        uploadPrompt.addEventListener('dragover', handleDragOver);
        uploadPrompt.addEventListener('dragleave', handleDragLeave);
        uploadPrompt.addEventListener('drop', handleDrop);
        imageUpload.addEventListener('change', handleFileSelect);
        clearImageButton.addEventListener('click', clearImages);
        compressButton.addEventListener('click', compressImage);
        downloadButton.addEventListener('click', downloadCompressedImage);
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = `${qualitySlider.value}%`;
        });
        compressionSlider.addEventListener('input', () => {
            compressionValue.textContent = compressionSlider.value;
        });
        formatSelect.addEventListener('change', toggleCompressionOptions);

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isLoading) dragOverlay.classList.remove('hidden');
        });
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragOverlay.classList.add('hidden');
        });
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragOverlay.classList.add('hidden');
            if (!isLoading) handleFiles(e.dataTransfer.files);
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!isLoading) {
            uploadPrompt.classList.add('border-dashed', 'border-green-500');
            dragOverlay.classList.remove('hidden');
        }
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!uploadPrompt.contains(e.relatedTarget)) {
            uploadPrompt.classList.remove('border-dashed', 'border-green-500');
            dragOverlay.classList.add('hidden');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadPrompt.classList.remove('border-dashed', 'border-green-500');
        dragOverlay.classList.add('hidden');
        if (!isLoading) handleFiles(e.dataTransfer.files);
    }

    function handleFileSelect(e) {
        handleFiles(e.target.files);
        e.target.value = '';
    }

    function handleFiles(files) {
        clearImages();
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith("image/")) {
            showFeedback("INVALID IMAGE FORMAT", true);
            return;
        }
        currentImageFile = file;
        showFeedback("LOADING IMAGE...");
        originalSizeText.textContent = `SIZE: ${(file.size / 1024).toFixed(2)} KB`;
        loadImageToCanvas(file, originalCanvas, ctxOriginal, () => {
            showFeedback("IMAGE LOADED");
            updateCanvasVisibility();
        }, () => {
            showFeedback("That's an error. Clear the canvas and upload again.", true);
            clearImages();
        });
    }

    function loadImageToCanvas(source, targetCanvas, targetCtx, successCallback, errorCallback) {
        const img = new Image();
        img.onload = () => {
            targetCanvas.width = img.naturalWidth;
            targetCanvas.height = img.naturalHeight;
            targetCtx.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            if (successCallback) successCallback();
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            console.error("Image load error:", err);
            if (errorCallback) errorCallback();
        };
        if (source instanceof File || source instanceof Blob) {
            img.src = URL.createObjectURL(source);
        } else {
            img.src = source;
        }
    }

    function clearImages() {
        currentImageFile = null;
        compressedImageBlob = null;
        originalCanvas.width = 0;
        originalCanvas.height = 0;
        compressedCanvas.width = 0;
        compressedCanvas.height = 0;
        originalSizeText.textContent = "SIZE: -- KB";
        compressedSizeText.textContent = "SIZE: -- KB";
        updateCanvasVisibility();
        showFeedback("IMAGE CLEARED");
    }

    function toggleCompressionOptions() {
        const format = formatSelect.value.toLowerCase();
        qualitySlider.parentElement.style.display = format === 'png' ? 'none' : 'block';
        compressionSlider.parentElement.style.display = format === 'png' ? 'block' : 'none';
        losslessCheckbox.parentElement.style.display = format === 'jpeg' ? 'none' : 'block';
        progressiveCheckbox.parentElement.style.display = format === 'jpeg' ? 'block' : 'none';
    }

    function compressImage() {
        if (!currentImageFile) {
            showFeedback("UPLOAD AN IMAGE FIRST", true);
            return;
        }

        const targetFormat = formatSelect.value;
        const quality = parseInt(qualitySlider.value);
        const compression = parseInt(compressionSlider.value);
        const targetSize = parseInt(targetSizeInput.value) || 100;
        const lossless = losslessCheckbox.checked;
        const progressive = progressiveCheckbox.checked;
        const stripMetadata = stripMetadataCheckbox.checked;
        const quantization = quantizationSelect.value;

        showFeedback(`COMPRESSING TO ${targetFormat.toUpperCase()}...`, false, true);
        compressButton.disabled = true;

        const formData = new FormData();
        formData.append("image", currentImageFile);
        formData.append("format", targetFormat);
        formData.append("quality", quality);
        formData.append("compression", compression);
        formData.append("target_size", targetSize);
        formData.append("lossless", lossless);
        formData.append("progressive", progressive);
        formData.append("strip_metadata", stripMetadata);
        formData.append("quantization", quantization);

        fetch("/compressor/compress-image", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            credentials: "same-origin",
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `HTTP error: ${response.status}`);
                    });
                }
                return response.blob();
            })
            .then(blob => {
                if (!blob || blob.size === 0 || !blob.type.startsWith('image/')) {
                    throw new Error("Invalid or empty image blob received.");
                }
                compressedImageBlob = blob;
                compressedSizeText.textContent = `SIZE: ${(blob.size / 1024).toFixed(2)} KB`;
                loadImageToCanvas(blob, compressedCanvas, ctxCompressed, () => {
                    showFeedback(`COMPRESSED TO ${targetFormat.toUpperCase()} SUCCESSFULLY`);
                }, () => {
                    showFeedback("That's an error. Clear the canvas and upload again.", true);
                    clearImages();
                });
            })
            .catch(error => {
                console.error("Compression error:", error);
                let errorMessage = error.message || 'COMPRESSION FAILED';
                if (errorMessage.includes("cannot identify image file")) {
                    errorMessage = "That's an error. Clear the canvas and upload again.";
                    clearImages();
                }
                showFeedback(`ERROR: ${errorMessage}`, true);
                compressedCanvas.width = 0;
                compressedCanvas.height = 0;
                compressedImageBlob = null;
                compressedSizeText.textContent = "SIZE: -- KB";
            })
            .finally(() => {
                compressButton.disabled = false;
            });
    }

    function downloadCompressedImage() {
        if (!compressedImageBlob) {
            showFeedback("NO COMPRESSED IMAGE TO DOWNLOAD", true);
            return;
        }
        const targetFormat = formatSelect.value;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(compressedImageBlob);
        const originalName = currentImageFile?.name.split('.').slice(0, -1).join('.') || 'image';
        link.download = `${originalName}_clarifi_compressed.${targetFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showFeedback("DOWNLOAD STARTED");
    }

    function updateCanvasVisibility() {
        const hasOriginalImage = originalCanvas.width > 0 && originalCanvas.height > 0;
        placeholder.style.display = hasOriginalImage ? 'none' : 'block';
        canvasArea.style.display = hasOriginalImage ? 'grid' : 'none';
    }

    function updateSliderValues() {
        qualityValue.textContent = `${qualitySlider.value}%`;
        compressionValue.textContent = compressionSlider.value;
    }

    function showFeedback(message, isError = false, keepOpen = false) {
        if (!uploadFeedback) return;
        uploadFeedback.textContent = message;
        uploadFeedback.className = 'text-sm font-mono uppercase mt-2';
        uploadFeedback.classList.add(isError ? 'text-red-500' : 'text-green-500');
        uploadFeedback.classList.remove('hidden');
        if (!keepOpen) {
            setTimeout(() => {
                if (uploadFeedback.textContent === message) uploadFeedback.classList.add('hidden');
            }, 3000);
        }
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
