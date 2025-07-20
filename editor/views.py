from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from .utils.image_processing import ImageProcessor
import uuid
import os
import mimetypes
from django.conf import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
def adjust_image(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        image = request.FILES["image"]
        factor = float(request.POST.get("factor", 1.0))
        if not 0 <= factor <= 2:
            logger.error("Invalid factor: %s", factor)
            return JsonResponse({"error": "Factor must be between 0 and 2"}, status=400)
        try:
            processor = ImageProcessor(image)
            if tool == "brightness":
                processor.adjust_brightness(factor)
            elif tool == "contrast":
                processor.adjust_contrast(factor)
            elif tool == "saturation":
                processor.adjust_saturation(factor)
            elif tool == "hue":
                processor.adjust_hue(factor)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Adjusted image: %s with factor %s", tool, factor)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Adjust image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid adjust request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def filter_image(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
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
            processor = ImageProcessor(image)
            if tool == "grayscale":
                processor.grayscale()
            elif tool == "sepia":
                processor.sepia()
            elif tool == "blur":
                processor.blur(radius)
            elif tool == "sharpen":
                processor.sharpen()
            elif tool == "edge_detection":
                processor.edge_detection()
            elif tool == "vignette":
                processor.vignette(intensity)
            elif tool == "noise":
                processor.noise(intensity)
            elif tool == "hdr":
                processor.hdr()
            elif tool == "cartoon":
                processor.cartoon()
            elif tool == "oil_painting":
                processor.oil_painting()
            elif tool == "watercolor":
                processor.watercolor()
            elif tool == "sketch":
                processor.sketch()
            elif tool == "emboss":
                processor.emboss()
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Filtered image: %s", tool)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Filter image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid filter request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def transform_image(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        image = request.FILES["image"]
        params = {}
        try:
            processor = ImageProcessor(image)
            if tool == "apply-crop":
                params = {
                    "left": int(request.POST.get("left", 0)),
                    "top": int(request.POST.get("top", 0)),
                    "right": int(request.POST.get("right", 0)),
                    "bottom": int(request.POST.get("bottom", 0)),
                }
                if any(v < 0 for v in params.values()):
                    return JsonResponse({"error": "Crop values must be non-negative"}, status=400)
                processor.crop(**params)
            elif tool == "apply-resize":
                params = {
                    "width": int(request.POST.get("width", 0)),
                    "height": int(request.POST.get("height", 0)),
                }
                if params["width"] <= 0 or params["height"] <= 0:
                    return JsonResponse({"error": "Width and height must be positive"}, status=400)
                processor.resize(**params)
            elif tool == "rotate":
                angle = int(request.POST.get("angle", 0))
                if angle not in [90, 180, 270]:
                    return JsonResponse({"error": "Angle must be 90, 180, or 270"}, status=400)
                processor.rotate(angle)
            elif tool == "flip":
                direction = request.POST.get("direction", "horizontal")
                if direction not in ["horizontal", "vertical"]:
                    return JsonResponse({"error": "Direction must be horizontal or vertical"}, status=400)
                processor.flip(direction)
            else:
                return JsonResponse({"error": "Invalid tool"}, status=400)
            processed = processor.save_image()
            logger.info("Transformed image: %s with params %s", tool, params)
            return HttpResponse(processed, content_type="image/png")
        except Exception as e:
            logger.error("Transform image error: %s", str(e))
            return JsonResponse({"error": str(e)}, status=500)
    logger.error("Invalid transform request")
    return JsonResponse({"error": "Invalid request"}, status=400)


@csrf_exempt
def premium(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
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
def compressor(request, tool):
    if request.method == "POST" and request.FILES.get("image"):
        try:
            processor = ImageProcessor(request.FILES["image"])
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

                processed = processor.compress_image(
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
    logger.error("Invalid compressor request")
    return JsonResponse({"error": "Invalid request"}, status=400)


def compressor_page(request):
    return render(request, "compressor.html")

def batch_editor(request):
    return render(request, "batch-editor.html")
