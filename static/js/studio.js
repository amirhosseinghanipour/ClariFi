document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('preview-canvas'),
    ctx = canvas?.getContext('2d'),
    uploadPrompt = document.getElementById('upload-prompt-studio'),
    imageUpload = document.getElementById('image-upload'),
    uploadFeedback = document.getElementById('upload-feedback'),
    clearImageButton = document.getElementById('clear-image'),
    placeholder = document.getElementById('studio-placeholder'),
    dimensionsDisplay = document.getElementById('image-dimensions'),
    dragOverlay = document.getElementById('drag-overlay'),
    brightnessSlider = document.getElementById('brightness'),
    contrastSlider = document.getElementById('contrast'),
    saturationSlider = document.getElementById('saturation'),
    resetAdjustmentsButton = document.getElementById('reset-adjustments'),
    filterNoneButton = document.getElementById('filter-none'),
    grayscaleButton = document.getElementById('grayscale'),
    sepiaButton = document.getElementById('sepia'),
    blurButton = document.getElementById('blur'),
    sharpenButton = document.getElementById('sharpen'),
    invertButton = document.getElementById('invert'),
    cropLeftInput = document.getElementById('crop-left'),
    cropTopInput = document.getElementById('crop-top'),
    cropRightInput = document.getElementById('crop-right'),
    cropBottomInput = document.getElementById('crop-bottom'),
    applyCropButton = document.getElementById('apply-crop'),
    resizeWidthInput = document.getElementById('resize-width'),
    resizeHeightInput = document.getElementById('resize-height'),
    keepAspectCheckbox = document.getElementById('keep-aspect'),
    applyResizeButton = document.getElementById('apply-resize'),
    rotateLeftButton = document.getElementById('rotate-left'),
    rotateRightButton = document.getElementById('rotate-right'),
    flipHorizontalButton = document.getElementById('flip-horizontal'),
    flipVerticalButton = document.getElementById('flip-vertical'),
    exportFormatSelect = document.getElementById('export-format'),
    jpegQualitySection = document.getElementById('jpeg-quality-section'),
    jpegQualitySlider = document.getElementById('jpeg-quality'),
    downloadButton = document.getElementById('download'),
    undoButton = document.getElementById('undo'),
    redoButton = document.getElementById('redo');
  if (!canvas || !ctx || !uploadPrompt || !imageUpload || !uploadFeedback || !clearImageButton || !placeholder || !dimensionsDisplay || !dragOverlay) return;
  let currentImageFile = null,
    originalImageData = null,
    currentImageObject = null,
    history = [],
    historyIndex = -1,
    MAX_HISTORY = 10,
    originalWidth = 0,
    originalHeight = 0,
    isLoading = false,
    loadingInterval = null,
    lastClickTime = 0,
    state = { brightness: 1, contrast: 1, saturation: 1, filter: 'none' };
  init();
  function init() {
    updatePlaceholderVisibility();
    setupEventListeners();
    updateHistoryButtons();
    toggleJpegQualitySlider();
  }
  function setupEventListeners() {
    uploadPrompt.addEventListener('click', e => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClickTime < 300 || isLoading) return;
      lastClickTime = now;
      imageUpload.value = '';
      imageUpload.click();
    });
    uploadPrompt.addEventListener('dragover', handleDragOver);
    uploadPrompt.addEventListener('dragleave', handleDragLeave);
    uploadPrompt.addEventListener('drop', handleDrop);
    imageUpload.addEventListener('change', handleFileSelect);
    clearImageButton.addEventListener('click', clearCanvas);
    document.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      isLoading || dragOverlay.classList.remove('hidden');
    });
    document.addEventListener('dragleave', e => {
      e.preventDefault();
      e.stopPropagation();
      dragOverlay.classList.add('hidden');
    });
    document.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      dragOverlay.classList.add('hidden');
      isLoading || handleFiles(e.dataTransfer.files);
    });
    brightnessSlider.addEventListener('input', () => {
      state.brightness = brightnessSlider.value;
      applyAdjustments();
    });
    contrastSlider.addEventListener('input', () => {
      state.contrast = contrastSlider.value;
      applyAdjustments();
    });
    saturationSlider.addEventListener('input', () => {
      state.saturation = saturationSlider.value;
      applyAdjustments();
    });
    resetAdjustmentsButton.addEventListener('click', resetAdjustments);
    filterNoneButton.addEventListener('click', () => {
      state.filter = 'none';
      applyFilter();
    });
    grayscaleButton.addEventListener('click', () => {
      state.filter = 'grayscale(100%)';
      applyFilter();
    });
    sepiaButton.addEventListener('click', () => {
      state.filter = 'sepia(100%)';
      applyFilter();
    });
    invertButton.addEventListener('click', () => {
      state.filter = 'invert(100%)';
      applyFilter();
    });
    blurButton.addEventListener('click', () => {
      state.filter = 'blur(3px)';
      applyFilter();
    });
    sharpenButton.addEventListener('click', () => {
      state.filter = 'contrast(1.4) saturate(1.2)';
      applyFilter();
    });
    applyCropButton.addEventListener('click', applyCrop);
    applyResizeButton.addEventListener('click', applyResize);
    rotateLeftButton.addEventListener('click', () => applyRotation(-90));
    rotateRightButton.addEventListener('click', () => applyRotation(90));
    flipHorizontalButton.addEventListener('click', () => applyFlip('horizontal'));
    flipVerticalButton.addEventListener('click', () => applyFlip('vertical'));
    exportFormatSelect.addEventListener('change', toggleJpegQualitySlider);
    downloadButton.addEventListener('click', downloadImage);
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    ['brightness', 'contrast', 'saturation'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        clearTimeout(adjustmentTimeout);
        adjustmentTimeout = setTimeout(() => {
          currentImageObject && (applyAdjustments(), saveHistory());
        }, 250);
      });
    });
  }
  function startUploadAnimation() {
    isLoading = true;
    uploadFeedback.textContent = "UPLOADING";
    uploadFeedback.style.color = '#55ff55';
    uploadFeedback.style.display = 'block';
    let animationChars = ['.', '..', '...', ''], charIndex = 0;
    return loadingInterval = setInterval(() => {
      charIndex = (charIndex + 1) % animationChars.length;
      uploadFeedback.textContent = `UPLOADING${animationChars[charIndex]}`;
    }, 200), () => {
      clearInterval(loadingInterval);
      loadingInterval = null;
      isLoading = false;
    };
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    isLoading || (uploadPrompt.classList.add('border-dashed', 'border-green-500'), dragOverlay.classList.remove('hidden'));
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadPrompt.contains(e.relatedTarget) || (uploadPrompt.classList.remove('border-dashed', 'border-green-500'), dragOverlay.classList.add('hidden'));
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadPrompt.classList.remove('border-dashed', 'border-green-500');
    dragOverlay.classList.add('hidden');
    isLoading || handleFiles(e.dataTransfer.files);
  }
  function handleFileSelect(e) {
    if (isLoading) return;
    const files = e.target.files;
    if (files && files.length > 0) handleFiles(files);
    e.target.value = '';
  }
  function handleFiles(files) {
    if (!files || files.length === 0) return void showFeedback("NO IMAGE SELECTED", true);
    const file = files[0];
    if (!file.type.startsWith("image/")) return void showFeedback("INVALID IMAGE FORMAT", true);
    currentImageFile = file;
    const stopUploadAnimation = startUploadAnimation(), reader = new FileReader;
    reader.onload = e => {
      const img = new Image;
      img.onload = () => {
        originalWidth = img.width;
        originalHeight = img.height;
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        currentImageObject = img;
        resetUIControls();
        saveHistory(true);
        updatePlaceholderVisibility();
        updateDimensionsDisplay();
        stopUploadAnimation();
        showFeedback("IMAGE SUCCESSFULLY UPLOADED");
      };
      img.onerror = () => {
        stopUploadAnimation();
        showFeedback("ERROR LOADING IMAGE DATA", true);
        clearCanvas();
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      stopUploadAnimation();
      showFeedback("ERROR READING FILE", true);
      clearCanvas();
    };
    reader.readAsDataURL(file);
  }
  function loadImageDataToCanvas(imageData) {
    imageData && (canvas.width = imageData.width, canvas.height = imageData.height, ctx.putImageData(imageData, 0, 0), updateDimensionsDisplay());
  }
  function getCombinedFilter() {
    const { brightness, contrast, saturation, filter } = state,
      adjustments = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    return 'none' === filter ? adjustments : `${adjustments} ${filter}`;
  }
  function drawImageWithFilters(imgObj) {
    if (!imgObj) return;
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    ctx.filter = getCombinedFilter();
    ctx.drawImage(imgObj, 0, 0);
    ctx.filter = 'none';
    updateDimensionsDisplay();
  }
  function clearCanvas() {
    currentImageFile = null;
    originalImageData = null;
    currentImageObject = null;
    canvas.width = 0;
    canvas.height = 0;
    history = [];
    historyIndex = -1;
    state = { brightness: 1, contrast: 1, saturation: 1, filter: 'none' };
    updateHistoryButtons();
    updatePlaceholderVisibility();
    updateDimensionsDisplay();
    resetUIControls();
    showFeedback("IMAGE CLEARED");
  }
  function resetUIControls() {
    brightnessSlider.value = 1;
    contrastSlider.value = 1;
    saturationSlider.value = 1;
    cropLeftInput.value = '';
    cropTopInput.value = '';
    cropRightInput.value = '';
    cropBottomInput.value = '';
    resizeWidthInput.value = '';
    resizeHeightInput.value = '';
    keepAspectCheckbox.checked = true;
  }
  let adjustmentTimeout;
  function applyAdjustments() {
    currentImageObject && drawImageWithFilters(currentImageObject);
  }
  function resetAdjustments() {
    currentImageObject && (state.brightness = 1, state.contrast = 1, state.saturation = 1, brightnessSlider.value = 1, contrastSlider.value = 1, saturationSlider.value = 1, drawImageWithFilters(currentImageObject), saveHistory());
  }
  function applyFilter() {
    currentImageObject && (drawImageWithFilters(currentImageObject), saveHistory());
  }
  function applyCrop() {
    if (!currentImageObject) return;
    const left = parseInt(cropLeftInput.value || 0),
      top = parseInt(cropTopInput.value || 0),
      right = parseInt(cropRightInput.value || 0),
      bottom = parseInt(cropBottomInput.value || 0),
      currentWidth = canvas.width,
      currentHeight = canvas.height,
      cropWidth = currentWidth - left - right,
      cropHeight = currentHeight - top - bottom;
    if (cropWidth <= 0 || cropHeight <= 0 || left < 0 || top < 0 || right < 0 || bottom < 0) return void showFeedback("INVALID CROP VALUES", true);
    const tempCanvas = document.createElement('canvas'),
      tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    tempCtx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    ctx.drawImage(tempCanvas, 0, 0);
    updateCurrentImageObjectFromCanvas();
    ctx.filter = getCombinedFilter();
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    saveHistory();
    showFeedback("CROP APPLIED");
    cropLeftInput.value = '';
    cropTopInput.value = '';
    cropRightInput.value = '';
    cropBottomInput.value = '';
  }
  function applyResize() {
    if (!currentImageObject) return;
    const targetWidth = parseInt(resizeWidthInput.value),
      targetHeight = parseInt(resizeHeightInput.value),
      keepAspect = keepAspectCheckbox.checked;
    let newWidth = targetWidth,
      newHeight = targetHeight;
    if (!targetWidth && !targetHeight) return void showFeedback("ENTER WIDTH OR HEIGHT", true);
    const currentWidth = canvas.width,
      currentHeight = canvas.height,
      aspectRatio = currentWidth / currentHeight;
    if (keepAspect) {
      if (targetWidth && !targetHeight) newWidth = targetWidth, newHeight = Math.round(targetWidth / aspectRatio);
      else if (!targetWidth && targetHeight) newHeight = targetHeight, newWidth = Math.round(targetHeight * aspectRatio);
      else if (targetWidth && targetHeight) newWidth = targetWidth, newHeight = Math.round(targetWidth / aspectRatio);
    } else newWidth = targetWidth || currentWidth, newHeight = targetHeight || currentHeight;
    if (newWidth <= 0 || newHeight <= 0) return void showFeedback("INVALID RESIZE VALUES", true);
    const tempCanvas = document.createElement('canvas'),
      tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    tempCtx.drawImage(canvas, 0, 0, currentWidth, currentHeight, 0, 0, newWidth, newHeight);
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(tempCanvas, 0, 0);
    updateCurrentImageObjectFromCanvas();
    ctx.filter = getCombinedFilter();
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    saveHistory();
    showFeedback("RESIZE APPLIED");
    resizeWidthInput.value = '';
    resizeHeightInput.value = '';
  }
  function applyRotation(degrees) {
    if (!currentImageObject) return;
    const currentWidth = canvas.width,
      currentHeight = canvas.height,
      newWidth = degrees % 180 !== 0 ? currentHeight : currentWidth,
      newHeight = degrees % 180 !== 0 ? currentWidth : currentHeight,
      tempCanvas = document.createElement('canvas'),
      tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    tempCtx.translate(newWidth / 2, newHeight / 2);
    tempCtx.rotate(degrees * Math.PI / 180);
    tempCtx.drawImage(canvas, -currentWidth / 2, -currentHeight / 2);
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(tempCanvas, 0, 0);
    updateCurrentImageObjectFromCanvas();
    ctx.filter = getCombinedFilter();
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    saveHistory();
    showFeedback(`ROTATED ${degrees}°`);
  }
  function applyFlip(direction) {
    if (!currentImageObject) return;
    const currentWidth = canvas.width,
      currentHeight = canvas.height,
      tempCanvas = document.createElement('canvas'),
      tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = currentWidth;
    tempCanvas.height = currentHeight;
    "horizontal" === direction ? (tempCtx.translate(currentWidth, 0), tempCtx.scale(-1, 1)) : (tempCtx.translate(0, currentHeight), tempCtx.scale(1, -1));
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, currentWidth, currentHeight);
    ctx.drawImage(tempCanvas, 0, 0);
    updateCurrentImageObjectFromCanvas();
    ctx.filter = getCombinedFilter();
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    saveHistory();
    showFeedback(`FLIPPED ${direction.toUpperCase()}`);
  }
  function updateCurrentImageObjectFromCanvas() {
    const img = new Image;
    img.onload = () => { currentImageObject = img };
    img.onerror = () => { };
    img.src = canvas.toDataURL();
  }
  function saveHistory(isInitial = false) {
    if (!canvas.width || !canvas.height) return;
    if (!isInitial && historyIndex > -1 && canvas.toDataURL() === history[historyIndex]) return;
    const dataUrl = canvas.toDataURL();
    historyIndex < history.length - 1 ? history = history.slice(0, historyIndex + 1) : history.push(dataUrl);
    history.length > MAX_HISTORY && history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }
  function undo() {
    if (historyIndex <= 0) return void showFeedback("CANNOT UNDO FURTHER", true);
    historyIndex--;
    restoreHistoryState();
    showFeedback("UNDO COMPLETE");
  }
  function redo() {
    if (historyIndex >= history.length - 1) return void showFeedback("CANNOT REDO FURTHER", true);
    historyIndex++;
    restoreHistoryState();
    showFeedback("REDO COMPLETE");
  }
  function restoreHistoryState() {
    const dataUrl = history[historyIndex], img = new Image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      updateCurrentImageObjectFromCanvas();
      updateHistoryButtons();
      updateDimensionsDisplay();
    };
    img.onerror = () => showFeedback("ERROR RESTORING HISTORY", true);
    img.src = dataUrl;
  }
  function updateHistoryButtons() {
    undoButton.disabled = historyIndex <= 0;
    redoButton.disabled = historyIndex >= history.length - 1;
  }
  function toggleJpegQualitySlider() {
    jpegQualitySection.style.display = 'jpeg' === exportFormatSelect.value ? 'block' : 'none';
  }
  function downloadImage() {
    if (!canvas.width || !canvas.height) return void showFeedback("NO IMAGE TO DOWNLOAD", true);
    const format = exportFormatSelect.value,
      quality = parseFloat(jpegQualitySlider.value);
    let mimeType = `image/${format}`, filename = `clarifi_image.${format}`;
    'jpeg' === format && (mimeType = 'image/jpeg');
    let dataUrl;
    try {
      dataUrl = 'image/jpeg' === mimeType || 'image/webp' === mimeType ? canvas.toDataURL(mimeType, quality) : canvas.toDataURL(mimeType);
    } catch (e) {
      return void showFeedback(`ERROR EXPORTING AS ${format.toUpperCase()}`, true);
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback(`IMAGE DOWNLOADED AS ${format.toUpperCase()}`);
  }
  function updatePlaceholderVisibility() {
    const hasImage = canvas.width > 0 && canvas.height > 0;
    placeholder.classList.toggle('hidden', hasImage);
    canvas.classList.toggle('hidden', !hasImage);
  }
  function updateDimensionsDisplay() {
    dimensionsDisplay.textContent = `DIMENSIONS: ${canvas.width || '---'} x ${canvas.height || '---'}`;
  }
  function showFeedback(message, isError = false, keepOpen = false) {
    if (!uploadFeedback) return;
    uploadFeedback.textContent = message;
    uploadFeedback.style.color = isError ? '#ff5555' : '#55ff55';
    uploadFeedback.style.display = 'block';
    keepOpen || setTimeout(() => {
      uploadFeedback.textContent === message && (uploadFeedback.style.display = 'none');
    }, 3000);
  }
});
