from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from asgiref.sync import sync_to_async
import asyncio
from .utils.image_processing import ImageProcessor
from .utils.async_image_processing import AsyncImageProcessor, BatchAsyncProcessor
import uuid
import os
import mimetypes
from django.conf import settings
import logging
from concurrent.futures import ThreadPoolExecutor
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global thread pool for async operations
thread_pool = ThreadPoolExecutor(max_workers=8)

def index(request):
    return render(request, "index.html")


@csrf_exempt
def upload_image(request):
    if request.method == "POST" and request.FILES.get("image"):
        image = request.FILES["image"]
        if not image.content_type.startswith("image/"):
            logger.error("Invalid image format: %s", image.content_type)
            return JsonResponse({"error": "Invalid image format"}, status=400)

        filename = f"{uuid.uuid4()}.{image.name.split('.')[-1]}"
        filepath = os.path.join(settings.MEDIA_ROOT, filename)
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        with open(filepath, "wb") as f:
            for chunk in image.chunks():
                f.write(chunk)

        request.session["studio_image"] = filename
        request.session.modified = True
        logger.info("Image uploaded: %s, session: %s",
                    filename, request.session.session_key)
        return JsonResponse({"status": "success"})

    logger.error("Invalid upload request")
    return JsonResponse({"error": "Invalid request"}, status=400)


def studio(request):
    return render(request, "studio.html")


def converter(request):
    return render(request, "converter.html")


def remove_background(request):
    return render(request, "remove.html")


def get_studio_image(request):
    if "studio_image" not in request.session:
        logger.error("No studio image in session")
        return HttpResponse(status=404)

    filename = request.session["studio_image"]
    filepath = os.path.join(settings.MEDIA_ROOT, filename)
    if not os.path.exists(filepath):
        logger.error("Image file not found: %s", filepath)
        return HttpResponse(status=404)

    content_type, _ = mimetypes.guess_type(filepath)
    content_type = content_type or "image/png"
    with open(filepath, "rb") as f:
        logger.info("Serving studio image: %s", filename)
        return HttpResponse(f.read(), content_type=content_type)


@csrf_exempt
@require_http_methods(["POST"])
def adjust_image(request, tool):
    async def process_adjustment():
        image = request.FILES["image"]
        factor = float(request.POST.get("factor", 1.0))
        if not 0 <= factor <= 2:
            logger.error("Invalid factor: %s", factor)
            return JsonResponse({"error": "Factor must be between 0 and 2"}, status=400)
        
        try:
            processor = AsyncImageProcessor(image)
            if tool == "brightness":
                await processor.adjust_brightness_async(factor)
            elif tool == "contrast":
                await processor.adjust_contrast_async(factor)
            elif tool == "saturation":
                await processor.adjust_saturation_async(factor)
            elif tool == "hue":
                await processor.adjust_hue_async(factor)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            
            processed = await processor.save_image_async()
            logger.info("Adjusted image: %s with factor %s", tool, factor)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Adjust image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    if request.FILES.get("image"):
        return asyncio.run(process_adjustment())
    else:
        logger.error("Invalid adjust request")
        return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def filter_image(request, tool):
    async def process_filter():
        image = request.FILES["image"]
        radius = float(request.POST.get("radius", 2.0)
                       ) if tool == "blur" else None
        intensity = float(request.POST.get("intensity", 0.5)) if tool in [
            "vignette", "noise"] else None
        
        if radius is not None and not 0 <= radius <= 10:
            logger.error("Invalid radius: %s", radius)
            return JsonResponse({"error": "Radius must be between 0 and 10"}, status=400)
        if intensity is not None and not 0 <= intensity <= 1:
            logger.error("Invalid intensity: %s", intensity)
            return JsonResponse({"error": "Intensity must be between 0 and 1"}, status=400)
        
        try:
            processor = AsyncImageProcessor(image)
            
            # Prepare parameters for the filter
            params = {}
            if radius is not None:
                params['radius'] = radius
            if intensity is not None:
                params['intensity'] = intensity
            
            # Apply filter asynchronously
            await processor.apply_filter_async(tool, **params)
            
            if tool not in ["grayscale", "sepia", "blur", "sharpen", "edge_detection", 
                           "vignette", "noise", "hdr", "cartoon", "oil_painting", 
                           "watercolor", "sketch", "emboss"]:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            
            processed = await processor.save_image_async()
            logger.info("Filtered image: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Filter image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    if request.FILES.get("image"):
        return asyncio.run(process_filter())
    else:
        logger.error("Invalid filter request")
        return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def transform_image(request, tool):
    async def process_transform():
        image = request.FILES["image"]
        try:
            processor = AsyncImageProcessor(image)
            if tool == "apply-crop":
                left = int(request.POST.get("left", 0))
                top = int(request.POST.get("top", 0))
                right = int(request.POST.get("right", 0))
                bottom = int(request.POST.get("bottom", 0))
                
                if any(v < 0 for v in [left, top, right, bottom]):
                    return JsonResponse({"error": "Crop values must be non-negative"}, status=400)
                
                await processor.crop_async(left, top, right, bottom)
            elif tool == "apply-resize":
                width = int(request.POST.get("width", 0))
                height = int(request.POST.get("height", 0))
                
                if width <= 0 or height <= 0:
                    return JsonResponse({"error": "Width and height must be positive"}, status=400)
                
                await processor.resize_async(width, height)
            elif tool == "rotate":
                angle = int(request.POST.get("angle", 0))
                if angle not in [90, 180, 270]:
                    return JsonResponse({"error": "Angle must be 90, 180, or 270"}, status=400)
                
                # For rotate and flip, we'll use the sync processor for now
                sync_processor = ImageProcessor(image)
                sync_processor.rotate(angle)
                processed = sync_processor.save_image()
                logger.info("Transformed image: %s", tool)
                return HttpResponse(processed, content_type="image/png")
            elif tool == "flip":
                direction = request.POST.get("direction", "horizontal")
                if direction not in ["horizontal", "vertical"]:
                    return JsonResponse({"error": "Direction must be horizontal or vertical"}, status=400)
                
                # For rotate and flip, we'll use the sync processor for now
                sync_processor = ImageProcessor(image)
                sync_processor.flip(direction)
                processed = sync_processor.save_image()
                logger.info("Transformed image: %s", tool)
                return HttpResponse(processed, content_type="image/png")
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            
            processed = await processor.save_image_async()
            logger.info("Transformed image: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Transform image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    if request.FILES.get("image"):
        return asyncio.run(process_transform())
    else:
        logger.error("Invalid transform request")
        return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def premium(request, tool):
    async def process_premium():
        try:
            image = request.FILES["image"]
            
            # For CPU-intensive operations, use async processor
            if tool in ["remove-background", "super-resolution", "auto-enhance", "colorize", "restore"]:
                processor = AsyncImageProcessor(image)
                
                if tool == "remove-background":
                    await processor.remove_background_async()
                elif tool == "super-resolution":
                    scale = int(request.POST.get("scale", 2))
                    # Use sync processor for complex operations that aren't async yet
                    sync_processor = ImageProcessor(image)
                    sync_processor.super_resolution(scale)
                    processed = sync_processor.save_image()
                    logger.info("Premium tool applied: %s", tool)
                    return HttpResponse(processed, content_type="image/png")
                elif tool == "auto-enhance":
                    # Use sync processor for complex operations that aren't async yet
                    sync_processor = ImageProcessor(image)
                    sync_processor.auto_enhance()
                    processed = sync_processor.save_image()
                    logger.info("Premium tool applied: %s", tool)
                    return HttpResponse(processed, content_type="image/png")
                elif tool == "colorize":
                    # Use sync processor for complex operations that aren't async yet
                    sync_processor = ImageProcessor(image)
                    sync_processor.colorize()
                    processed = sync_processor.save_image()
                    logger.info("Premium tool applied: %s", tool)
                    return HttpResponse(processed, content_type="image/png")
                elif tool == "restore":
                    # Use sync processor for complex operations that aren't async yet
                    sync_processor = ImageProcessor(image)
                    sync_processor.restore()
                    processed = sync_processor.save_image()
                    logger.info("Premium tool applied: %s", tool)
                    return HttpResponse(processed, content_type="image/png")
                
                processed = await processor.save_image_async()
                logger.info("Premium tool applied: %s", tool)
                return HttpResponse(processed, content_type="image/png")
            else:
                # Use sync processor for other operations
                processor = ImageProcessor(image)
                
            if tool == "super-resolution":
                scale = int(request.POST.get("scale", 2))
                processor.super_resolution(scale)
            elif tool == "auto-enhance":
                processor.auto_enhance()
            elif tool == "colorize":
                processor.colorize()
            elif tool == "remove-background":
                processor.remove_background()
            elif tool == "apply-inpaint":
                x = int(request.POST.get("x", 0))
                y = int(request.POST.get("y", 0))
                radius = int(request.POST.get("radius", 10))
                if radius <= 0:
                    return JsonResponse({"error": "Radius must be positive"}, status=400)
                processor.inpaint(x, y, radius)
            elif tool == "apply-face":
                action = request.POST.get("action", "crop")
                if action not in ["crop", "blur"]:
                    return JsonResponse({"error": "Invalid face action"}, status=400)
                processor.face_detection(action)
            elif tool == "restore":
                processor.restore()
            elif tool == "compress":
                target_size = int(request.POST.get("target_size", 100))
                format = request.POST.get("format", "JPEG")
                processor.compress_image(target_size, format)
            elif tool == "red-eye":
                processor.remove_red_eye()
            elif tool == "denoise":
                strength = int(request.POST.get("strength", 10))
                processor.denoise(strength)
            elif tool == "perspective":
                points = [
                    (int(request.POST.get("x1", 0)),
                     int(request.POST.get("y1", 0))),
                    (int(request.POST.get("x2", 0)),
                     int(request.POST.get("y2", 0))),
                    (int(request.POST.get("x3", 0)),
                     int(request.POST.get("y3", 0))),
                    (int(request.POST.get("x4", 0)),
                     int(request.POST.get("y4", 0))),
                ]
                processor.perspective_correction(points)
            elif tool == "color-pop":
                hue_range = (int(request.POST.get("hue_min", 0)),
                             int(request.POST.get("hue_max", 180)))
                tolerance = int(request.POST.get("tolerance", 30))
                processor.color_pop(hue_range, tolerance)
            elif tool == "add-border":
                width = int(request.POST.get("width", 10))
                color = request.POST.get("color", "#ffffff")
                processor.add_border(width, color)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
                
            processed = processor.save_image()
            logger.info("Premium tool applied: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Premium tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    if request.FILES.get("image"):
        return asyncio.run(process_premium())
    else:
        logger.error("Invalid premium request")
        return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def text(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
            if tool == "apply-text":
                content = request.POST.get("content", "")
                x = int(request.POST.get("x", 0))
                y = int(request.POST.get("y", 0))
                size = int(request.POST.get("size", 20))
                color = request.POST.get("color", "#ffffff")
                if not content:
                    return JsonResponse({"error": "Text content required"}, status=400)
                if size <= 0:
                    return JsonResponse({"error": "Size must be positive"}, status=400)
                processor.add_text(content, x, y, size, color)
            elif tool == "apply-watermark":
                text = request.POST.get("text", "")
                opacity = float(request.POST.get("opacity", 0.5))
                if not text:
                    return JsonResponse({"error": "Watermark text required"}, status=400)
                if not 0 <= opacity <= 1:
                    return JsonResponse({"error": "Opacity must be between 0 and 1"}, status=400)
                processor.watermark(text, opacity)
            elif tool == "extract-text":
                text = processor.extract_text()
                return HttpResponse(text, content_type="text/plain")
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Text tool applied: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Text tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid text request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def meme(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
            if tool == "apply-meme":
                top = request.POST.get("top", "")
                bottom = request.POST.get("bottom", "")
                if not top and not bottom:
                    return JsonResponse({"error": "At least one text required"}, status=400)
                processor.meme_generator(top, bottom)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Meme tool applied")
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Meme tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid meme request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def collage(request, tool):
    if request.method == "POST" and request.FILES.getlist("image"):
        try:
            images = request.FILES.getlist("image")
            if not images:
                return JsonResponse({"error": "At least one image required"}, status=400)
            processor = ImageProcessor(images[0])
            if tool == "apply-collage":
                layout = request.POST.get("layout", "2x2")
                if layout not in ["2x2", "3x1", "1x3", "1x2", "2x1"]:
                    return JsonResponse({"error": "Invalid layout"}, status=400)
                processor.collage(images, layout)
            elif tool == "stitch":
                processor.stitch_images(images)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Collage tool applied: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Collage tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid collage request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def layers(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
            if tool == "merge-layers":
                opacity = float(request.POST.get("opacity", 1.0))
                if not 0 <= opacity <= 1:
                    return JsonResponse({"error": "Opacity must be between 0 and 1"}, status=400)
                processor.merge_layers(opacity)
            elif tool == "add-layer":
                new_image = request.FILES.get("new_image")
                if not new_image:
                    return JsonResponse({"error": "New image required"}, status=400)
                processor.add_layer(new_image)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Layers tool applied")
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Layers tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid layers request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def palette(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
            if tool == "extract-palette":
                num_colors = int(request.POST.get("num_colors", 5))
                palette = processor.extract_palette(num_colors)
                logger.info("Palette extracted")
                return HttpResponse(str(palette), content_type="text/plain")
            return JsonResponse({"error": "Invalid tool"}, status=400)
        except Exception as e:
            logger.error("Palette tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid palette request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def format(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
            if tool == "convert-format":
                format = request.POST.get("format", "jpeg").lower()
                if format not in ["jpeg", "png", "webp", "bmp", "gif", "tiff"]:
                    return JsonResponse({"error": "Invalid format"}, status=400)
                quality = int(request.POST.get("quality", 90))
                if not 1 <= quality <= 100:
                    return JsonResponse({"error": "Quality must be between 1 and 100"}, status=400)
                compression = int(request.POST.get("compression", 6))
                if not 0 <= compression <= 9:
                    return JsonResponse({"error": "Compression must be between 0 and 9"}, status=400)
                width = int(request.POST.get("width", 0))
                height = int(request.POST.get("height", 0))
                aspect = request.POST.get("aspect", "true") == "true"
                strip = request.POST.get("strip", "false") == "true"
                color = request.POST.get("color", "RGB")
                if color not in ["RGB", "L", "CMYK"]:
                    return JsonResponse({"error": "Invalid color mode"}, status=400)
                dpi = int(request.POST.get("dpi", 72))
                if dpi not in [72, 150, 300]:
                    return JsonResponse({"error": "Invalid DPI"}, status=400)
                background = request.POST.get("background", "#ffffff")
                processed = processor.convert_format(
                    format, quality, compression, width, height, aspect, strip, color, dpi, background)
                logger.info("Format converted: %s", format)
                return HttpResponse(processed, content_type=f"image/{format}")
            elif tool == "remove-background":
                processor.remove_background()
                processed = processor.save_image(format="PNG")
                logger.info("Background removed")
                return HttpResponse(processed, content_type="image/png")
            return JsonResponse({"error": "Invalid tool"}, status=400)
        except Exception as e:
            logger.error("Format tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid format request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def compressor(request, tool):
    async def process_compression():
        try:
            image = request.FILES["image"]
            processor = AsyncImageProcessor(image)
            
            if tool == "compress-image":
                format = request.POST.get("format", "JPEG").upper()
                if format not in ["JPEG", "PNG", "WEBP"]:
                    return JsonResponse({"error": "Invalid format"}, status=400)
                
                quality = int(request.POST.get("quality", 80))
                compression = int(request.POST.get("compression", 6))
                target_size = int(request.POST.get("target_size", 100))
                lossless = request.POST.get("lossless", "false") == "true"
                progressive = request.POST.get(
                    "progressive", "false") == "true"
                strip_metadata = request.POST.get(
                    "strip_metadata", "false") == "true"
                quantization = request.POST.get("quantization", "standard")

                processed = await processor.compress_async(
                    target_size_kb=target_size,
                    format=format,
                    quality=quality,
                    compression=compression,
                    lossless=lossless,
                    progressive=progressive,
                    strip_metadata=strip_metadata,
                    quantization=quantization
                )
                logger.info("Image compressed: %s", format)
                return HttpResponse(processed, content_type=f"image/{format.lower()}")
            
            return JsonResponse({"error": "Invalid tool"}, status=400)
        except Exception as e:
            logger.error("Compressor tool error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    if request.FILES.get("image"):
        return asyncio.run(process_compression())
    else:
        logger.error("Invalid compressor request")
        return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def batch_process(request):
    """Handle batch processing of multiple images."""
    async def process_batch():
        try:
            images = request.FILES.getlist("image")
            if not images:
                return JsonResponse({"error": "No images provided"}, status=400)
            
            operation = request.POST.get("operation")
            if not operation:
                return JsonResponse({"error": "No operation specified"}, status=400)
            
            # Prepare parameters based on operation
            params = {}
            if operation == "resize":
                params["width"] = int(request.POST.get("width", 800))
                params["height"] = int(request.POST.get("height", 600))
            elif operation in ["brightness", "contrast", "saturation"]:
                params["factor"] = float(request.POST.get("factor", 1.0))
            elif operation == "blur":
                params["radius"] = float(request.POST.get("radius", 2.0))
            elif operation == "rotate":
                params["angle"] = int(request.POST.get("angle", 90))
            elif operation == "flip":
                params["direction"] = request.POST.get("direction", "horizontal")
            elif operation == "format":
                params["format"] = request.POST.get("format", "jpeg")
                params["quality"] = int(request.POST.get("quality", 90))
            
            # Process batch asynchronously
            batch_processor = BatchAsyncProcessor()
            results = await batch_processor.process_batch_async(images, operation, params)
            
            # Return results as base64 encoded images or URLs
            import base64
            response_data = []
            for i, result in enumerate(results):
                if result:
                    encoded_image = base64.b64encode(result).decode('utf-8')
                    response_data.append({
                        'index': i,
                        'data': f"data:image/png;base64,{encoded_image}",
                        'success': True
                    })
                else:
                    response_data.append({
                        'index': i,
                        'error': 'Processing failed',
                        'success': False
                    })
            
            logger.info(f"Batch processed {len(results)} images with operation: {operation}")
            return JsonResponse({
                'results': response_data,
                'total_processed': len(results),
                'total_requested': len(images)
            })
            
        except Exception as e:
            logger.error("Batch processing error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    
    return asyncio.run(process_batch())

def compressor_page(request):
    return render(request, "compressor.html")

def batch_editor(request):
    return render(request, "batch-editor.html")
