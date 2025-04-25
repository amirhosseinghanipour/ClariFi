document.addEventListener('DOMContentLoaded', () => {
    const originalCanvas = document.getElementById('original-canvas');
    const convertedCanvas = document.getElementById('converted-canvas');
    const ctxOriginal = originalCanvas.getContext('2d');
    const ctxConverted = convertedCanvas.getContext('2d');
    const uploadPrompt = document.getElementById('upload-prompt');
    const imageUpload = document.getElementById('image-upload');
    const uploadFeedback = document.getElementById('upload-feedback');
    const clearImageButton = document.getElementById('clear-image');
    const convertButton = document.getElementById('convert-button');
    const downloadButton = document.getElementById('download-button');
    const formatSelect = document.getElementById('format-select');
    const qualitySlider = document.getElementById('quality-slider');
    const dragOverlay = document.getElementById('drag-overlay');

    const canvasArea = document.getElementById('canvas-area');
    const placeholder = document.getElementById('no-image-placeholder');

    let currentImageFile = null;
    let convertedImageBlob = null;
    let isLoading = false;

    init();

    function init() {
        updateCanvasVisibility();
        setupEventListeners();
        toggleQualitySlider();
    }

    function setupEventListeners() {
        uploadPrompt.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isLoading) {
                console.log("Triggering image upload");
                imageUpload.click();
            }
        });
        uploadPrompt.addEventListener('dragover', handleDragOver);
        uploadPrompt.addEventListener('dragleave', handleDragLeave);
        uploadPrompt.addEventListener('drop', handleDrop);
        imageUpload.addEventListener('change', handleFileSelect);
        clearImageButton.addEventListener('click', clearImages);

        convertButton.addEventListener('click', convertImage);
        downloadButton.addEventListener('click', downloadConvertedImage);
        formatSelect.addEventListener('change', toggleQualitySlider);

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isLoading) {
                dragOverlay.classList.remove('hidden');
            }
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
        if (!isLoading) {
            handleFiles(e.dataTransfer.files);
        }
    }

    function handleFileSelect(e) {
        handleFiles(e.target.files);
        e.target.value = '';
    }

    function handleFiles(files) {
        clearImages();
        if (!files || files.length === 0) { return; }
        const file = files[0];
        if (!file.type.startsWith("image/")) { return; }
        currentImageFile = file;
        showFeedback("LOADING IMAGE...");
        loadImageToCanvas(file, originalCanvas, ctxOriginal, () => {
            showFeedback("IMAGE LOADED");
            updateCanvasVisibility();
        }, () => {
            showFeedback("ERROR LOADING IMAGE", true); clearImages();
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
        } else { img.src = source; }
    }

    function clearImages() {
        currentImageFile = null;
        convertedImageBlob = null;
        originalCanvas.width = 0; originalCanvas.height = 0;
        convertedCanvas.width = 0; convertedCanvas.height = 0;
        updateCanvasVisibility();
        showFeedback("IMAGE CLEARED");
    }

    function toggleQualitySlider() {
        const selectedFormat = formatSelect.value.toLowerCase();
    }

    function convertImage() {
        if (!currentImageFile) {
            showFeedback("UPLOAD AN IMAGE FIRST", true);
            return;
        }

        const targetFormat = formatSelect.value;
        const quality = qualitySlider.value / 100;

        showFeedback(`CONVERTING TO ${targetFormat.toUpperCase()}...`, false, true);
        convertButton.disabled = true;

        const formData = new FormData();
        formData.append("image", currentImageFile);
        formData.append("format", targetFormat);

        fetch("/format/convert-format", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            credentials: "same-origin",
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP error: ${response.status} - ${text || 'Server error'}`);
                    });
                }
                return response.blob();
            })
            .then(blob => {
                if (!blob || blob.size === 0 || !blob.type.startsWith('image/')) {
                    throw new Error("Invalid or empty image blob received from server.");
                }
                convertedImageBlob = blob;
                loadImageToCanvas(blob, convertedCanvas, ctxConverted, () => {
                    showFeedback(`CONVERTED TO ${targetFormat.toUpperCase()} SUCCESSFULLY`);
                }, () => {
                    showFeedback("ERROR DISPLAYING CONVERTED IMAGE", true);
                });
            })
            .catch(error => {
                console.error("Conversion error:", error);
                showFeedback(`ERROR: ${error.message || 'CONVERSION FAILED'}`, true);
                convertedCanvas.width = 0; convertedCanvas.height = 0;
                convertedImageBlob = null;
            })
            .finally(() => {
                convertButton.disabled = false;
            });
    }

    function downloadConvertedImage() {
        if (!convertedImageBlob) {
            showFeedback("NO CONVERTED IMAGE TO DOWNLOAD", true);
            return;
        }
        const targetFormat = formatSelect.value;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(convertedImageBlob);
        const originalName = currentImageFile?.name.split('.').slice(0, -1).join('.') || 'image';
        link.download = `${originalName}_clarifi_converted.${targetFormat}`;
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
