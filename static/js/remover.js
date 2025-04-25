document.addEventListener('DOMContentLoaded', () => {
    console.log("remover.js loaded");

    const originalCanvas = document.getElementById('original-canvas');
    const removedCanvas = document.getElementById('removed-canvas');
    const ctxOriginal = originalCanvas?.getContext('2d');
    const ctxRemoved = removedCanvas?.getContext('2d');
    const uploadPrompt = document.getElementById('upload-prompt');
    const imageUpload = document.getElementById('image-upload');
    const uploadFeedback = document.getElementById('upload-feedback');
    const clearImageButton = document.getElementById('clear-image');
    const removeBgButton = document.getElementById('remove-bg');
    const downloadButton = document.getElementById('download');
    const canvasArea = document.getElementById('canvas-area');
    const placeholder = document.getElementById('no-image-placeholder');
    const dragOverlay = document.getElementById('drag-overlay');

    if (!originalCanvas || !removedCanvas || !ctxOriginal || !ctxRemoved || !uploadPrompt || !imageUpload || !uploadFeedback || !clearImageButton || !removeBgButton || !downloadButton || !canvasArea || !placeholder) {
        console.error("One or more DOM elements not found:", {
            originalCanvas, removedCanvas, ctxOriginal, ctxRemoved, uploadPrompt, imageUpload, uploadFeedback, clearImageButton, removeBgButton, downloadButton, canvasArea, placeholder
        });
        return;
    }

    let currentImageFile = null;
    let processedImageBlob = null;
    let isLoading = false;
    let loadingInterval = null;

    init();

    function init() {
        console.log("Initializing remover.js");
        updateCanvasVisibility();
        setupEventListeners();
    }

    function setupEventListeners() {
        console.log("Setting up event listeners");
        uploadPrompt.addEventListener('click', (e) => {
            // e.preventDefault();
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
        clearImageButton.addEventListener('click', () => !isLoading && clearImages());
        removeBgButton.addEventListener('click', () => !isLoading && removeBackground());
        downloadButton.addEventListener('click', downloadRemovedImage);
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

    function startLoadingAnimation(button) {
        console.log("Starting loading animation");
        isLoading = true;
        button.disabled = true;
        const originalText = button.textContent;
        let animationChars = ['/', '|', '\\', '-'];
        let charIndex = 0;

        button.innerHTML = `REMOVING <span class="loading-anim">${animationChars[charIndex]}</span>`;

        loadingInterval = setInterval(() => {
            charIndex = (charIndex + 1) % animationChars.length;
            const animSpan = button.querySelector('.loading-anim');
            if (animSpan) {
                animSpan.textContent = animationChars[charIndex];
            }
        }, 200);

        return (restoreText = originalText) => {
            console.log("Stopping loading animation");
            clearInterval(loadingInterval);
            loadingInterval = null;
            button.innerHTML = restoreText;
            button.disabled = false;
            isLoading = false;
        };
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
        console.log("File selected:", e.target.files);
        if (isLoading) return;
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
        e.target.value = '';
    }

    function handleFiles(files) {
        console.log("Handling files:", files);
        clearImages();
        if (!files || files.length === 0) {
            showFeedback("NO IMAGE SELECTED", true);
            return;
        }
        const file = files[0];
        console.log("Selected file:", file.name, file.type);
        if (!file.type.startsWith("image/")) {
            showFeedback("INVALID IMAGE FORMAT", true);
            return;
        }
        currentImageFile = file;
        showFeedback("LOADING IMAGE...");
        loadImageToCanvas(file, originalCanvas, ctxOriginal, () => {
            showFeedback("IMAGE LOADED SUCCESSFULLY");
        }, () => {
            showFeedback("ERROR LOADING IMAGE", true);
            clearImages();
        });
    }

    function loadImageToCanvas(source, targetCanvas, targetCtx, successCallback, errorCallback) {
        const img = new Image();
        img.onload = () => {
            try {
                targetCanvas.width = img.naturalWidth;
                targetCanvas.height = img.naturalHeight;
                targetCtx.drawImage(img, 0, 0);
                URL.revokeObjectURL(img.src);
                if (successCallback) successCallback();
                updateCanvasVisibility();
            } catch (err) {
                console.error("Canvas draw error:", err);
                if (errorCallback) errorCallback();
                updateCanvasVisibility();
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            console.error("Image load error");
            if (errorCallback) errorCallback();
            updateCanvasVisibility();
        };
        if (source instanceof File || source instanceof Blob) {
            img.src = URL.createObjectURL(source);
        } else {
            img.src = source;
        }
    }

    function clearImages() {
        console.log("Clearing images");
        currentImageFile = null;
        processedImageBlob = null;
        originalCanvas.width = 0;
        originalCanvas.height = 0;
        removedCanvas.width = 0;
        removedCanvas.height = 0;
        updateCanvasVisibility();
        showFeedback("IMAGE CLEARED");
    }

    function removeBackground() {
        console.log("Attempting to remove background");
        if (!currentImageFile || originalCanvas.width === 0 || originalCanvas.height === 0) {
            showFeedback("PLEASE UPLOAD A VALID IMAGE FIRST", true);
            return;
        }

        const stopLoading = startLoadingAnimation(removeBgButton);

        const formData = new FormData();
        formData.append("image", currentImageFile);

        fetch("/format/remove-background", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            credentials: "same-origin",
        })
            .then((response) => {
                if (!response.ok) {
                    return response.text().then(text => {
                        let errorMsg = `HTTP error: ${response.status}`;
                        try {
                            const errJson = JSON.parse(text);
                            errorMsg += ` - ${errJson.error || 'Server error'}`;
                        } catch (e) {
                            if (text.includes('<title>Page not found')) {
                                errorMsg = `Endpoint not found (${response.status}). Check URL.`;
                            } else if (text.length < 200) {
                                errorMsg += ` - ${text}`;
                            } else {
                                errorMsg += ` - Server error (HTML response)`;
                            }
                        }
                        throw new Error(errorMsg);
                    });
                }
                return response.blob();
            })
            .then((blob) => {
                if (!blob || blob.size === 0 || !blob.type.startsWith('image/')) {
                    throw new Error("Invalid or empty image received.");
                }
                processedImageBlob = blob;
                loadImageToCanvas(blob, removedCanvas, ctxRemoved, () => {
                    showFeedback("BACKGROUND REMOVED SUCCESSFULLY");
                }, () => {
                    showFeedback("ERROR DISPLAYING REMOVED BACKGROUND", true);
                });
            })
            .catch((error) => {
                console.error("Remove background fetch error:", error);
                showFeedback(`ERROR: ${error.message}`, true);
                removedCanvas.width = 0;
                removedCanvas.height = 0;
                processedImageBlob = null;
            })
            .finally(() => {
                stopLoading();
            });
    }

    function downloadRemovedImage() {
        if (!processedImageBlob) {
            showFeedback("NO PROCESSED IMAGE TO DOWNLOAD", true);
            return;
        }
        const link = document.createElement('a');
        link.href = URL.createObjectURL(processedImageBlob);
        const originalName = currentImageFile?.name.split('.').slice(0, -1).join('.') || 'image';
        link.download = `${originalName}_clarifi_no_bg.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showFeedback("DOWNLOAD STARTED");
    }

    function updateCanvasVisibility() {
        console.log("Updating canvas visibility, canvas width:", originalCanvas.width);
        const hasOriginalImage = originalCanvas.width > 0 && originalCanvas.height > 0;
        placeholder.style.display = hasOriginalImage ? 'none' : 'block';
        canvasArea.style.display = hasOriginalImage ? 'grid' : 'none';
    }

    function showFeedback(message, isError = false, keepOpen = false) {
        console.log("Showing feedback:", message, isError);
        if (!uploadFeedback) {
            console.error("uploadFeedback element not found");
            return;
        }
        uploadFeedback.textContent = message;
        uploadFeedback.style.color = isError ? '#ff5555' : '#55ff55';
        uploadFeedback.style.display = 'block';
        if (!keepOpen) {
            setTimeout(() => {
                if (uploadFeedback.textContent === message) {
                    uploadFeedback.style.display = 'none';
                }
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

    const style = document.createElement('style');
    style.textContent = `
        .loading-anim {
            display: inline-block;
            width: 1ch;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
});
