import asyncio
import io
import numpy as np
from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter
import cv2
from django.core.files.uploadedfile import InMemoryUploadedFile
import colorsys
import random
import pytesseract
from scipy.ndimage import label
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import multiprocessing
from functools import partial
import logging

logger = logging.getLogger(__name__)

class AsyncImageProcessor:
    def __init__(self, image_file):
        """Initialize with an uploaded image file."""
        self.image = Image.open(image_file).convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers = [self.image.copy()]
        self.executor = ThreadPoolExecutor(max_workers=multiprocessing.cpu_count())
        self.process_executor = ProcessPoolExecutor(max_workers=multiprocessing.cpu_count())

    async def save_image_async(self, format="JPEG"):
        """Save the processed image to a BytesIO buffer asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._save_image_sync, format)

    def _save_image_sync(self, format="JPEG"):
        """Synchronous image saving."""
        output = io.BytesIO()
        self.image.save(output, format=format.upper())
        output.seek(0)
        return output.getvalue()

    async def adjust_brightness_async(self, factor):
        """Adjust brightness asynchronously."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._adjust_brightness_sync, 
            factor
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _adjust_brightness_sync(self, factor):
        """Synchronous brightness adjustment."""
        enhancer = ImageEnhance.Brightness(self.image)
        new_image = enhancer.enhance(factor)
        new_cv_image = cv2.cvtColor(np.array(new_image), cv2.COLOR_RGB2BGR)
        return new_image, new_cv_image

    async def adjust_contrast_async(self, factor):
        """Adjust contrast asynchronously."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._adjust_contrast_sync, 
            factor
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _adjust_contrast_sync(self, factor):
        """Synchronous contrast adjustment."""
        enhancer = ImageEnhance.Contrast(self.image)
        new_image = enhancer.enhance(factor)
        new_cv_image = cv2.cvtColor(np.array(new_image), cv2.COLOR_RGB2BGR)
        return new_image, new_cv_image

    async def adjust_saturation_async(self, factor):
        """Adjust saturation asynchronously."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._adjust_saturation_sync, 
            factor
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _adjust_saturation_sync(self, factor):
        """Synchronous saturation adjustment."""
        enhancer = ImageEnhance.Color(self.image)
        new_image = enhancer.enhance(factor)
        new_cv_image = cv2.cvtColor(np.array(new_image), cv2.COLOR_RGB2BGR)
        return new_image, new_cv_image

    async def apply_filter_async(self, filter_name, **kwargs):
        """Apply filter asynchronously."""
        loop = asyncio.get_event_loop()
        
        if filter_name in ['grayscale', 'sepia', 'sharpen', 'edge_detection', 'hdr', 'cartoon', 'oil_painting', 'watercolor', 'sketch', 'emboss']:
            result = await loop.run_in_executor(
                self.process_executor, 
                self._apply_complex_filter_sync, 
                filter_name, 
                kwargs
            )
        else:
            result = await loop.run_in_executor(
                self.executor, 
                self._apply_simple_filter_sync, 
                filter_name, 
                kwargs
            )
        
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _apply_simple_filter_sync(self, filter_name, kwargs):
        """Apply simple filters synchronously."""
        cv_image = self.cv_image.copy()
        
        if filter_name == 'blur':
            radius = kwargs.get('radius', 2)
            cv_image = cv2.GaussianBlur(cv_image, (0, 0), sigmaX=radius)
        elif filter_name == 'vignette':
            intensity = kwargs.get('intensity', 0.5)
            height, width = cv_image.shape[:2]
            kernel_size = min(width, height) // 2
            kernel = cv2.getGaussianKernel(kernel_size * 2, kernel_size / 2)
            mask = kernel * kernel.T
            mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_LINEAR)
            mask = mask / mask.max() * intensity
            mask = 1 - mask
            cv_image = (cv_image.astype(np.float32) * mask[..., np.newaxis]).astype(np.uint8)
        elif filter_name == 'noise':
            intensity = kwargs.get('intensity', 0.3)
            noise = np.random.normal(0, intensity * 255, cv_image.shape)
            cv_image = np.clip(cv_image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        
        new_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
        return new_image, cv_image

    def _apply_complex_filter_sync(self, filter_name, kwargs):
        """Apply complex filters synchronously (CPU intensive)."""
        cv_image = self.cv_image.copy()
        
        if filter_name == 'grayscale':
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            cv_image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        elif filter_name == 'sepia':
            sepia_matrix = np.array([[0.272, 0.534, 0.131],
                                     [0.349, 0.686, 0.168],
                                     [0.393, 0.769, 0.189]])
            img_array = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
            sepia_img = np.clip(np.dot(img_array, sepia_matrix.T), 0, 255).astype(np.uint8)
            cv_image = cv2.cvtColor(sepia_img, cv2.COLOR_RGB2BGR)
        elif filter_name == 'sharpen':
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            cv_image = cv2.filter2D(cv_image, -1, kernel)
        elif filter_name == 'edge_detection':
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 100, 200)
            cv_image = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        elif filter_name == 'hdr':
            img_float = np.float32(cv_image) / 255.0
            cv_image = cv2.detailEnhance(img_float, sigma_s=12, sigma_r=0.15)
            cv_image = np.clip(cv_image * 255, 0, 255).astype(np.uint8)
        elif filter_name == 'cartoon':
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            gray = cv2.medianBlur(gray, 5)
            edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
            color = cv2.bilateralFilter(cv_image, 9, 250, 250)
            cv_image = cv2.bitwise_and(color, color, mask=edges)
        elif filter_name == 'oil_painting':
            try:
                cv_image = cv2.xphoto.oilPainting(cv_image, size=7, dynRatio=1)
            except:
                cv_image = cv2.stylization(cv_image, sigma_s=60, sigma_r=0.6)
        elif filter_name == 'watercolor':
            cv_image = cv2.stylization(cv_image, sigma_s=60, sigma_r=0.6)
        elif filter_name == 'sketch':
            gray, _ = cv2.pencilSketch(cv_image, sigma_s=60, sigma_r=0.07, shade_factor=0.05)
            cv_image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        elif filter_name == 'emboss':
            kernel = np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]])
            cv_image = cv2.filter2D(cv_image, -1, kernel)
        
        new_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
        return new_image, cv_image

    async def batch_process_async(self, operations):
        """Process multiple operations in parallel."""
        tasks = []
        for operation in operations:
            if operation['type'] == 'filter':
                task = self.apply_filter_async(operation['name'], **operation.get('params', {}))
            elif operation['type'] == 'adjustment':
                if operation['name'] == 'brightness':
                    task = self.adjust_brightness_async(operation['factor'])
                elif operation['name'] == 'contrast':
                    task = self.adjust_contrast_async(operation['factor'])
                elif operation['name'] == 'saturation':
                    task = self.adjust_saturation_async(operation['factor'])
            tasks.append(task)
        
        await asyncio.gather(*tasks)

    async def resize_async(self, width, height):
        """Resize image asynchronously."""
        if width <= 0 or height <= 0:
            raise ValueError("Width and height must be positive")
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._resize_sync, 
            width, 
            height
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _resize_sync(self, width, height):
        """Synchronous resize operation."""
        new_image = self.image.resize((width, height), Image.Resampling.LANCZOS)
        new_cv_image = cv2.cvtColor(np.array(new_image), cv2.COLOR_RGB2BGR)
        return new_image, new_cv_image

    async def crop_async(self, left, top, right, bottom):
        """Crop image asynchronously."""
        if any(v < 0 for v in [left, top, right, bottom]) or right <= left or bottom <= top:
            raise ValueError("Invalid crop dimensions")
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._crop_sync, 
            left, top, right, bottom
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _crop_sync(self, left, top, right, bottom):
        """Synchronous crop operation."""
        new_image = self.image.crop((left, top, right, bottom))
        new_cv_image = cv2.cvtColor(np.array(new_image), cv2.COLOR_RGB2BGR)
        return new_image, new_cv_image

    async def compress_async(self, target_size_kb, format="JPEG", **kwargs):
        """Compress image asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.process_executor, 
            self._compress_sync, 
            target_size_kb, 
            format, 
            kwargs
        )

    def _compress_sync(self, target_size_kb, format, kwargs):
        """Synchronous compression operation."""
        quality = kwargs.get('quality', 80)
        img = self.image
        output = io.BytesIO()
        
        current_quality = quality
        while current_quality >= 10:
            output.seek(0)
            output.truncate(0)
            try:
                img.save(output, format=format, quality=current_quality, optimize=True)
                size_kb = output.getbuffer().nbytes / 1024
                if size_kb <= target_size_kb:
                    break
                current_quality -= 5
            except Exception as e:
                raise ValueError(f"Compression failed: {str(e)}")
        
        output.seek(0)
        return output.getvalue()

    async def remove_background_async(self):
        """Remove background asynchronously."""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.process_executor, 
            self._remove_background_sync
        )
        self.image, self.cv_image = result
        self.layers[-1] = self.image.copy()

    def _remove_background_sync(self):
        """Synchronous background removal."""
        height, width = self.cv_image.shape[:2]
        mask = np.zeros((height, width), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        rect = (50, 50, width - 100, height - 100)
        
        cv2.grabCut(self.cv_image, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        
        result_cv = self.cv_image * mask2[:, :, np.newaxis]
        rgba = cv2.cvtColor(result_cv, cv2.COLOR_BGR2RGB)
        alpha = mask2 * 255
        rgba = np.dstack((rgba, alpha))
        
        new_image = Image.fromarray(rgba, 'RGBA')
        return new_image, result_cv

    def __del__(self):
        """Cleanup executors."""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)
        if hasattr(self, 'process_executor'):
            self.process_executor.shutdown(wait=False)


class BatchAsyncProcessor:
    """Handle batch processing of multiple images with parallel execution."""
    
    def __init__(self, max_workers=None):
        self.max_workers = max_workers or multiprocessing.cpu_count()
        self.executor = ProcessPoolExecutor(max_workers=self.max_workers)

    async def process_batch_async(self, image_files, operation, params=None):
        """Process multiple images in parallel."""
        if params is None:
            params = {}
        
        loop = asyncio.get_event_loop()
        
        # Create partial function for the operation
        process_func = partial(self._process_single_image, operation, params)
        
        # Process images in parallel
        tasks = [
            loop.run_in_executor(self.executor, process_func, image_file)
            for image_file in image_files
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and return successful results
        successful_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error processing image {i}: {result}")
            else:
                successful_results.append(result)
        
        return successful_results

    def _process_single_image(self, operation, params, image_file):
        """Process a single image (runs in separate process)."""
        try:
            from .image_processing import ImageProcessor
            
            processor = ImageProcessor(image_file)
            
            if operation == 'grayscale':
                processor.grayscale()
            elif operation == 'sepia':
                processor.sepia()
            elif operation == 'blur':
                processor.blur(params.get('radius', 2))
            elif operation == 'sharpen':
                processor.sharpen()
            elif operation == 'brightness':
                processor.adjust_brightness(params.get('factor', 1.0))
            elif operation == 'contrast':
                processor.adjust_contrast(params.get('factor', 1.0))
            elif operation == 'saturation':
                processor.adjust_saturation(params.get('factor', 1.0))
            elif operation == 'resize':
                processor.resize(params.get('width', 800), params.get('height', 600))
            elif operation == 'rotate':
                processor.rotate(params.get('angle', 90))
            elif operation == 'flip':
                processor.flip(params.get('direction', 'horizontal'))
            elif operation == 'auto-enhance':
                processor.auto_enhance()
            elif operation == 'colorize':
                processor.colorize()
            elif operation == 'super-resolution':
                processor.super_resolution(params.get('scale', 2))
            elif operation == 'restore':
                processor.restore()
            elif operation == 'format':
                return processor.convert_format(
                    params.get('format', 'jpeg'),
                    params.get('quality', 90)
                )
            
            return processor.save_image()
            
        except Exception as e:
            logger.error(f"Error in _process_single_image: {e}")
            raise

    def __del__(self):
        """Cleanup executor."""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)


# Utility functions for async operations
async def process_multiple_adjustments_async(processor, adjustments):
    """Apply multiple adjustments in parallel."""
    tasks = []
    
    for adjustment in adjustments:
        if adjustment['type'] == 'brightness':
            tasks.append(processor.adjust_brightness_async(adjustment['factor']))
        elif adjustment['type'] == 'contrast':
            tasks.append(processor.adjust_contrast_async(adjustment['factor']))
        elif adjustment['type'] == 'saturation':
            tasks.append(processor.adjust_saturation_async(adjustment['factor']))
    
    await asyncio.gather(*tasks)


async def apply_filter_pipeline_async(processor, filters):
    """Apply a pipeline of filters asynchronously."""
    for filter_config in filters:
        await processor.apply_filter_async(
            filter_config['name'], 
            **filter_config.get('params', {})
        )