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
    hueSlider = document.getElementById('hue'),
    exposureSlider = document.getElementById('exposure'),
    vibranceSlider = document.getElementById('vibrance'),
    resetAdjustmentsButton = document.getElementById('reset-adjustments'),
    filterNoneButton = document.getElementById('filter-none'),
    grayscaleButton = document.getElementById('grayscale'),
    sepiaButton = document.getElementById('sepia'),
    blurButton = document.getElementById('blur'),
    sharpenButton = document.getElementById('sharpen'),
    invertButton = document.getElementById('invert'),
    vignetteButton = document.getElementById('vignette'),
    noiseButton = document.getElementById('noise'),
    hdrButton = document.getElementById('hdr'),
    cartoonButton = document.getElementById('cartoon'),
    oilPaintingButton = document.getElementById('oil-painting'),
    watercolorButton = document.getElementById('watercolor'),
    sketchButton = document.getElementById('sketch'),
    embossButton = document.getElementById('emboss'),
    edgeDetectionButton = document.getElementById('edge-detection'),
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
    perspectiveButton = document.getElementById('perspective'),
    textContentInput = document.getElementById('text-content'),
    textXInput = document.getElementById('text-x'),
    textYInput = document.getElementById('text-y'),
    textSizeInput = document.getElementById('text-size'),
    textColorInput = document.getElementById('text-color'),
    applyTextButton = document.getElementById('apply-text'),
    watermarkTextInput = document.getElementById('watermark-text'),
    watermarkOpacitySlider = document.getElementById('watermark-opacity'),
    applyWatermarkButton = document.getElementById('apply-watermark'),
    extractTextButton = document.getElementById('extract-text'),
    memeTopInput = document.getElementById('meme-top'),
    memeBottomInput = document.getElementById('meme-bottom'),
    applyMemeButton = document.getElementById('apply-meme'),
    superResolutionButton = document.getElementById('super-resolution'),
    autoEnhanceButton = document.getElementById('auto-enhance'),
    colorizeButton = document.getElementById('colorize'),
    removeBackgroundButton = document.getElementById('remove-background'),
    inpaintXInput = document.getElementById('inpaint-x'),
    inpaintYInput = document.getElementById('inpaint-y'),
    inpaintRadiusInput = document.getElementById('inpaint-radius'),
    applyInpaintButton = document.getElementById('apply-inpaint'),
    faceActionSelect = document.getElementById('face-action'),
    applyFaceButton = document.getElementById('apply-face'),
    restoreButton = document.getElementById('restore'),
    redEyeButton = document.getElementById('red-eye'),
    denoiseStrengthInput = document.getElementById('denoise-strength'),
    applyDenoiseButton = document.getElementById('apply-denoise'),
    colorPopHueMinInput = document.getElementById('color-pop-hue-min'),
    colorPopHueMaxInput = document.getElementById('color-pop-hue-max'),
    applyColorPopButton = document.getElementById('apply-color-pop'),
    borderWidthInput = document.getElementById('border-width'),
    borderColorInput = document.getElementById('border-color'),
    applyBorderButton = document.getElementById('apply-border'),
    extractPaletteButton = document.getElementById('extract-palette'),
    paletteColorsInput = document.getElementById('palette-colors'),
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
    lastClickTime = 0;

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

    // Adjustment controls
    brightnessSlider?.addEventListener('input', () => applyAdjustment('brightness', brightnessSlider.value));
    contrastSlider?.addEventListener('input', () => applyAdjustment('contrast', contrastSlider.value));
    saturationSlider?.addEventListener('input', () => applyAdjustment('saturation', saturationSlider.value));
    hueSlider?.addEventListener('input', () => applyAdjustment('hue', (hueSlider.value - 0.5)));
    resetAdjustmentsButton?.addEventListener('click', resetAdjustments);

    // Filter controls
    filterNoneButton?.addEventListener('click', () => resetFilters());
    grayscaleButton?.addEventListener('click', () => applyFilter('grayscale'));
    sepiaButton?.addEventListener('click', () => applyFilter('sepia'));
    blurButton?.addEventListener('click', () => applyFilterWithParam('blur', 'radius', 2));
    sharpenButton?.addEventListener('click', () => applyFilter('sharpen'));
    vignetteButton?.addEventListener('click', () => applyFilterWithParam('vignette', 'intensity', 0.5));
    noiseButton?.addEventListener('click', () => applyFilterWithParam('noise', 'intensity', 0.3));
    hdrButton?.addEventListener('click', () => applyFilter('hdr'));
    cartoonButton?.addEventListener('click', () => applyFilter('cartoon'));
    oilPaintingButton?.addEventListener('click', () => applyFilter('oil_painting'));
    watercolorButton?.addEventListener('click', () => applyFilter('watercolor'));
    sketchButton?.addEventListener('click', () => applyFilter('sketch'));
    embossButton?.addEventListener('click', () => applyFilter('emboss'));
    edgeDetectionButton?.addEventListener('click', () => applyFilter('edge_detection'));

    // Transform controls
    applyCropButton?.addEventListener('click', applyCrop);
    applyResizeButton?.addEventListener('click', applyResize);
    rotateLeftButton?.addEventListener('click', () => applyRotation(270));
    rotateRightButton?.addEventListener('click', () => applyRotation(90));
    flipHorizontalButton?.addEventListener('click', () => applyFlip('horizontal'));
    flipVerticalButton?.addEventListener('click', () => applyFlip('vertical'));

    // Text controls
    applyTextButton?.addEventListener('click', applyText);
    applyWatermarkButton?.addEventListener('click', applyWatermark);
    extractTextButton?.addEventListener('click', extractText);

    // Meme controls
    applyMemeButton?.addEventListener('click', applyMeme);

    // Premium controls
    superResolutionButton?.addEventListener('click', () => applyPremium('super-resolution', { scale: 2 }));
    autoEnhanceButton?.addEventListener('click', () => applyPremium('auto-enhance'));
    colorizeButton?.addEventListener('click', () => applyPremium('colorize'));
    removeBackgroundButton?.addEventListener('click', () => applyPremium('remove-background'));
    applyInpaintButton?.addEventListener('click', applyInpaint);
    applyFaceButton?.addEventListener('click', applyFace);
    restoreButton?.addEventListener('click', () => applyPremium('restore'));
    redEyeButton?.addEventListener('click', () => applyPremium('red-eye'));
    applyDenoiseButton?.addEventListener('click', applyDenoise);
    applyColorPopButton?.addEventListener('click', applyColorPop);
    applyBorderButton?.addEventListener('click', applyBorder);

    // Palette controls
    extractPaletteButton?.addEventListener('click', extractPalette);

    // Export controls
    exportFormatSelect?.addEventListener('change', toggleJpegQualitySlider);
    downloadButton?.addEventListener('click', downloadImage);
    undoButton?.addEventListener('click', undo);
    redoButton?.addEventListener('click', redo);
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
    showFeedback("LOADING IMAGE...");
    
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
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
        showFeedback("IMAGE SUCCESSFULLY UPLOADED");
      };
      img.onerror = () => {
        showFeedback("ERROR LOADING IMAGE DATA", true);
        clearCanvas();
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      showFeedback("ERROR READING FILE", true);
      clearCanvas();
    };
    reader.readAsDataURL(file);
  }

  function applyAdjustment(tool, factor) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('factor', factor);
    
    fetch(`/adjust/${tool}`, {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyFilter(tool) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    
    fetch(`/filter/${tool}`, {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyFilterWithParam(tool, paramName, paramValue) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append(paramName, paramValue);
    
    fetch(`/filter/${tool}`, {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyCrop() {
    if (!currentImageFile) return;
    
    const left = parseInt(cropLeftInput.value || 0);
    const top = parseInt(cropTopInput.value || 0);
    const right = parseInt(cropRightInput.value || 0);
    const bottom = parseInt(cropBottomInput.value || 0);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('left', left);
    formData.append('top', top);
    formData.append('right', right);
    formData.append('bottom', bottom);
    
    fetch('/transform/apply-crop', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("CROP APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyResize() {
    if (!currentImageFile) return;
    
    const width = parseInt(resizeWidthInput.value);
    const height = parseInt(resizeHeightInput.value);
    
    if (!width && !height) return showFeedback("ENTER WIDTH OR HEIGHT", true);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('width', width || 0);
    formData.append('height', height || 0);
    
    fetch('/transform/apply-resize', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("RESIZE APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyRotation(angle) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('angle', angle);
    
    fetch('/transform/rotate', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback(`ROTATED ${angle}°`);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyFlip(direction) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('direction', direction);
    
    fetch('/transform/flip', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback(`FLIPPED ${direction.toUpperCase()}`);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyText() {
    if (!currentImageFile || !textContentInput?.value) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('content', textContentInput.value);
    formData.append('x', parseInt(textXInput?.value || 10));
    formData.append('y', parseInt(textYInput?.value || 10));
    formData.append('size', parseInt(textSizeInput?.value || 20));
    formData.append('color', textColorInput?.value || '#ffffff');
    
    fetch('/text/apply-text', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("TEXT APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyWatermark() {
    if (!currentImageFile || !watermarkTextInput?.value) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('text', watermarkTextInput.value);
    formData.append('opacity', parseFloat(watermarkOpacitySlider?.value || 0.5));
    
    fetch('/text/apply-watermark', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("WATERMARK APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function extractText() {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    
    fetch('/text/extract-text', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.text())
    .then(text => {
      showFeedback(`EXTRACTED TEXT: ${text.substring(0, 50)}...`);
      console.log('Extracted text:', text);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyMeme() {
    if (!currentImageFile) return;
    
    const topText = memeTopInput?.value || '';
    const bottomText = memeBottomInput?.value || '';
    
    if (!topText && !bottomText) return showFeedback("ENTER TOP OR BOTTOM TEXT", true);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('top', topText);
    formData.append('bottom', bottomText);
    
    fetch('/meme/apply-meme', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("MEME CREATED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyPremium(tool, params = {}) {
    if (!currentImageFile) return;
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });
    
    fetch(`/premium/${tool}`, {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback(`${tool.toUpperCase().replace('-', ' ')} APPLIED`);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyInpaint() {
    if (!currentImageFile) return;
    
    const x = parseInt(inpaintXInput?.value || 0);
    const y = parseInt(inpaintYInput?.value || 0);
    const radius = parseInt(inpaintRadiusInput?.value || 10);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('x', x);
    formData.append('y', y);
    formData.append('radius', radius);
    
    fetch('/premium/apply-inpaint', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("INPAINT APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyFace() {
    if (!currentImageFile) return;
    
    const action = faceActionSelect?.value || 'crop';
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('action', action);
    
    fetch('/premium/apply-face', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback(`FACE ${action.toUpperCase()} APPLIED`);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyDenoise() {
    if (!currentImageFile) return;
    
    const strength = parseInt(denoiseStrengthInput?.value || 10);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('strength', strength);
    
    fetch('/premium/denoise', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("DENOISE APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyColorPop() {
    if (!currentImageFile) return;
    
    const hueMin = parseInt(colorPopHueMinInput?.value || 0);
    const hueMax = parseInt(colorPopHueMaxInput?.value || 180);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('hue_min', hueMin);
    formData.append('hue_max', hueMax);
    formData.append('tolerance', 30);
    
    fetch('/premium/color-pop', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("COLOR POP APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function applyBorder() {
    if (!currentImageFile) return;
    
    const width = parseInt(borderWidthInput?.value || 10);
    const color = borderColorInput?.value || '#ffffff';
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('width', width);
    formData.append('color', color);
    
    fetch('/premium/add-border', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.blob())
    .then(blob => {
      loadImageFromBlob(blob);
      saveHistory();
      showFeedback("BORDER APPLIED");
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function extractPalette() {
    if (!currentImageFile) return;
    
    const numColors = parseInt(paletteColorsInput?.value || 5);
    
    const formData = new FormData();
    formData.append('image', currentImageFile);
    formData.append('num_colors', numColors);
    
    fetch('/palette/extract-palette', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    })
    .then(response => response.text())
    .then(palette => {
      showFeedback(`PALETTE: ${palette}`);
      console.log('Extracted palette:', palette);
    })
    .catch(error => showFeedback(`ERROR: ${error.message}`, true));
  }

  function loadImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      updateDimensionsDisplay();
      URL.revokeObjectURL(url);
      
      // Update currentImageFile with the processed image
      blob.arrayBuffer().then(buffer => {
        const file = new File([buffer], 'processed.png', { type: 'image/png' });
        currentImageFile = file;
      });
    };
    img.src = url;
  }

  function resetAdjustments() {
    if (brightnessSlider) brightnessSlider.value = 1;
    if (contrastSlider) contrastSlider.value = 1;
    if (saturationSlider) saturationSlider.value = 1;
    if (hueSlider) hueSlider.value = 0.5;
    showFeedback("ADJUSTMENTS RESET");
  }

  function resetFilters() {
    if (!originalImageData) return;
    ctx.putImageData(originalImageData, 0, 0);
    saveHistory();
    showFeedback("FILTERS RESET");
  }

  function clearCanvas() {
    currentImageFile = null;
    originalImageData = null;
    currentImageObject = null;
    canvas.width = 0;
    canvas.height = 0;
    history = [];
    historyIndex = -1;
    updateHistoryButtons();
    updatePlaceholderVisibility();
    updateDimensionsDisplay();
    resetUIControls();
    showFeedback("IMAGE CLEARED");
  }

  function resetUIControls() {
    if (brightnessSlider) brightnessSlider.value = 1;
    if (contrastSlider) contrastSlider.value = 1;
    if (saturationSlider) saturationSlider.value = 1;
    if (hueSlider) hueSlider.value = 0.5;
    if (cropLeftInput) cropLeftInput.value = '';
    if (cropTopInput) cropTopInput.value = '';
    if (cropRightInput) cropRightInput.value = '';
    if (cropBottomInput) cropBottomInput.value = '';
    if (resizeWidthInput) resizeWidthInput.value = '';
    if (resizeHeightInput) resizeHeightInput.value = '';
    if (keepAspectCheckbox) keepAspectCheckbox.checked = true;
  }

  function saveHistory(isInitial = false) {
    if (!canvas.width || !canvas.height) return;
    
    const dataUrl = canvas.toDataURL();
    if (!isInitial && historyIndex > -1 && dataUrl === history[historyIndex]) return;
    
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    
    history.push(dataUrl);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function undo() {
    if (historyIndex <= 0) return showFeedback("CANNOT UNDO FURTHER", true);
    historyIndex--;
    restoreHistoryState();
    showFeedback("UNDO COMPLETE");
  }

  function redo() {
    if (historyIndex >= history.length - 1) return showFeedback("CANNOT REDO FURTHER", true);
    historyIndex++;
    restoreHistoryState();
    showFeedback("REDO COMPLETE");
  }

  function restoreHistoryState() {
    const dataUrl = history[historyIndex];
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      updateHistoryButtons();
      updateDimensionsDisplay();
    };
    img.onerror = () => showFeedback("ERROR RESTORING HISTORY", true);
    img.src = dataUrl;
  }

  function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = historyIndex <= 0;
    if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
  }

  function toggleJpegQualitySlider() {
    if (jpegQualitySection && exportFormatSelect) {
      jpegQualitySection.style.display = exportFormatSelect.value === 'jpeg' ? 'block' : 'none';
    }
  }

  function downloadImage() {
    if (!canvas.width || !canvas.height) return showFeedback("NO IMAGE TO DOWNLOAD", true);
    
    const format = exportFormatSelect?.value || 'png';
    const quality = parseFloat(jpegQualitySlider?.value || 0.9);
    
    let mimeType = `image/${format}`;
    let filename = `clarifi_image.${format}`;
    
    if (format === 'jpeg') mimeType = 'image/jpeg';
    
    let dataUrl;
    try {
      dataUrl = (mimeType === 'image/jpeg' || mimeType === 'image/webp') 
        ? canvas.toDataURL(mimeType, quality) 
        : canvas.toDataURL(mimeType);
    } catch (e) {
      return showFeedback(`ERROR EXPORTING AS ${format.toUpperCase()}`, true);
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
    if (placeholder) placeholder.classList.toggle('hidden', hasImage);
    canvas.classList.toggle('hidden', !hasImage);
  }

  function updateDimensionsDisplay() {
    if (dimensionsDisplay) {
      dimensionsDisplay.textContent = `DIMENSIONS: ${canvas.width || '---'} x ${canvas.height || '---'}`;
    }
  }

  function showFeedback(message, isError = false, keepOpen = false) {
    if (!uploadFeedback) return;
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
});