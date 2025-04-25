import io
import numpy as np
from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter
import cv2
from django.core.files.uploadedfile import InMemoryUploadedFile
import colorsys
import random
import pytesseract
from scipy.ndimage import label

class ImageProcessor:
    def __init__(self, image_file):
        """Initialize with an uploaded image file."""
        self.image = Image.open(image_file).convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers = [self.image.copy()]  

    def save_image(self, format="JPEG"):
        """Save the processed image to a BytesIO buffer."""
        output = io.BytesIO()
        self.image.save(output, format=format.upper())
        output.seek(0)
        return output.getvalue()

    def adjust_brightness(self, factor):
        """Adjust brightness (factor: 0.0 to 2.0, 1.0 is original)."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        enhancer = ImageEnhance.Brightness(self.image)
        self.image = enhancer.enhance(factor)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def adjust_contrast(self, factor):
        """Adjust contrast (factor: 0.0 to 2.0, 1.0 is original)."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        enhancer = ImageEnhance.Contrast(self.image)
        self.image = enhancer.enhance(factor)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def adjust_saturation(self, factor):
        """Adjust saturation (factor: 0.0 to 2.0, 1.0 is original)."""
        if not 0.0 <= factor <= 2.0:
            raise ValueError("Factor must be between 0.0 and 2.0")
        enhancer = ImageEnhance.Color(self.image)
        self.image = enhancer.enhance(factor)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def adjust_hue(self, factor):
        """Adjust hue (factor: -0.5 to 0.5)."""
        if not -0.5 <= factor <= 0.5:
            raise ValueError("Factor must be between -0.5 and 0.5")
        hsv = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2HSV)
        hsv[:, :, 0] = (hsv[:, :, 0] + int(factor * 180)) % 180
        self.cv_image = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def grayscale(self):
        """Convert to grayscale."""
        self.image = self.image.convert("L").convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def sepia(self):
        """Apply sepia filter."""
        sepia_matrix = np.array([[0.272, 0.534, 0.131],
                                 [0.349, 0.686, 0.168],
                                 [0.393, 0.769, 0.189]])
        img_array = np.array(self.image)
        sepia_img = np.clip(np.dot(img_array, sepia_matrix.T), 0, 255).astype(np.uint8)
        self.image = Image.fromarray(sepia_img)
        self.cv_image = cv2.cvtColor(sepia_img, cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def blur(self, radius):
        """Apply Gaussian blur."""
        if not 0 <= radius <= 10:
            raise ValueError("Radius must be between 0 and 10")
        self.cv_image = cv2.GaussianBlur(self.cv_image, (0, 0), sigmaX=radius)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def sharpen(self):
        """Apply sharpen filter."""
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        self.cv_image = cv2.filter2D(self.cv_image, -1, kernel)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def edge_detection(self):
        """Apply Canny edge detection."""
        gray = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        self.cv_image = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def crop(self, left, top, right, bottom):
        """Crop image to specified box."""
        if any(v < 0 for v in [left, top, right, bottom]) or right <= left or bottom <= top:
            raise ValueError("Invalid crop dimensions")
        self.image = self.image.crop((left, top, right, bottom))
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def resize(self, width, height):
        """Resize image to specified dimensions."""
        if width <= 0 or height <= 0:
            raise ValueError("Width and height must be positive")
        self.image = self.image.resize((width, height), Image.Resampling.LANCZOS)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def rotate(self, angle):
        """Rotate image by specified angle."""
        if angle not in [90, 180, 270]:
            raise ValueError("Angle must be 90, 180, or 270")
        self.image = self.image.rotate(angle, expand=True)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def flip(self, direction):
        """Flip image horizontally or vertically."""
        if direction not in ["horizontal", "vertical"]:
            raise ValueError("Direction must be 'horizontal' or 'vertical'")
        if direction == "horizontal":
            self.image = self.image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        else:
            self.image = self.image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def add_text(self, text, x, y, font_size, color):
        """Add text overlay."""
        if not text:
            raise ValueError("Text content required")
        if font_size <= 0:
            raise ValueError("Font size must be positive")
        try:
            r, g, b = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        except:
            raise ValueError("Invalid color format")
        draw = ImageDraw.Draw(self.image)
        font = ImageFont.load_default()  
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            pass
        draw.text((x, y), text, fill=(r, g, b), font=font)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def watermark(self, watermark_text, opacity):
        """Add watermark with specified opacity."""
        if not watermark_text:
            raise ValueError("Watermark text required")
        if not 0 <= opacity <= 1:
            raise ValueError("Opacity must be between 0 and 1")
        watermark = Image.new("RGBA", self.image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(watermark)
        font = ImageFont.load_default()
        try:
            font = ImageFont.truetype("arial.ttf", 50)
        except:
            pass
        draw.text((10, 10), watermark_text, fill=(255, 255, 255, int(255 * opacity)), font=font)
        self.image = Image.alpha_composite(self.image.convert("RGBA"), watermark).convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def vignette(self, intensity):
        """Apply vignette effect (optimized)."""
        if not 0 <= intensity <= 1:
            raise ValueError("Intensity must be between 0 and 1")
        height, width = self.cv_image.shape[:2]
        kernel_size = min(width, height) // 2
        kernel = cv2.getGaussianKernel(kernel_size * 2, kernel_size / 2)
        mask = kernel * kernel.T
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_LINEAR)
        mask = mask / mask.max() * intensity
        mask = 1 - mask
        self.cv_image = (self.cv_image.astype(np.float32) * mask[..., np.newaxis]).astype(np.uint8)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def noise(self, intensity):
        """Add noise effect (optimized)."""
        if not 0 <= intensity <= 1:
            raise ValueError("Intensity must be between 0 and 1")
        noise = np.random.normal(0, intensity * 255, self.cv_image.shape)
        self.cv_image = np.clip(self.cv_image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def hdr(self):
        """Apply HDR effect."""
        img_float = np.float32(self.cv_image) / 255.0
        img_hdr = cv2.detailEnhance(img_float, sigma_s=12, sigma_r=0.15)
        self.cv_image = np.clip(img_hdr * 255, 0, 255).astype(np.uint8)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def cartoon(self):
        """Apply cartoon effect."""
        gray = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 5)
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
        color = cv2.bilateralFilter(self.cv_image, 9, 250, 250)
        self.cv_image = cv2.bitwise_and(color, color, mask=edges)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def remove_background(self):
        """Remove background using GrabCut."""
        height, width = self.cv_image.shape[:2]
        mask = np.zeros((height, width), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        rect = (50, 50, width - 100, height - 100)  
        cv2.grabCut(self.cv_image, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        self.cv_image = self.cv_image * mask2[:, :, np.newaxis]
        rgba = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB)
        alpha = mask2 * 255
        rgba = np.dstack((rgba, alpha))
        self.image = Image.fromarray(rgba, 'RGBA')
        self.layers[-1] = self.image.copy()

    def super_resolution(self, scale=2):
        """Apply super-resolution (upscaling with sharpening)."""
        if scale not in [2, 3, 4]:
            raise ValueError("Scale must be 2, 3, or 4")
        height, width = self.image.size
        new_size = (width * scale, height * scale)
        self.image = self.image.resize(new_size, Image.Resampling.LANCZOS)
        self.image = self.image.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def auto_enhance(self):
        """Apply auto-enhance (contrast, brightness, sharpen)."""
        enhancer = ImageEnhance.Contrast(self.image)
        self.image = enhancer.enhance(1.2)
        enhancer = ImageEnhance.Brightness(self.image)
        self.image = enhancer.enhance(1.1)
        self.image = self.image.filter(ImageFilter.UnsharpMask(radius=1, percent=100, threshold=3))
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def colorize(self):
        """Colorize a grayscale image (simple hue mapping)."""
        if self.image.mode != "L":
            self.image = self.image.convert("L")
        img_array = np.array(self.image)
        hsv = np.zeros((img_array.shape[0], img_array.shape[1], 3), dtype=np.uint8)
        hsv[:, :, 0] = (img_array // 2) % 180
        hsv[:, :, 1] = 255
        hsv[:, :, 2] = img_array
        self.cv_image = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def oil_painting(self):
        """Apply oil painting effect."""
        try:
            self.cv_image = cv2.xphoto.oilPainting(self.cv_image, size=7, dynRatio=1)
        except:
            self.cv_image = cv2.stylization(self.cv_image, sigma_s=60, sigma_r=0.6)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def watercolor(self):
        """Apply watercolor effect."""
        self.cv_image = cv2.stylization(self.cv_image, sigma_s=60, sigma_r=0.6)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def sketch(self):
        """Apply pencil sketch effect."""
        gray, _ = cv2.pencilSketch(self.cv_image, sigma_s=60, sigma_r=0.07, shade_factor=0.05)
        self.cv_image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def emboss(self):
        """Apply emboss effect."""
        kernel = np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]])
        self.cv_image = cv2.filter2D(self.cv_image, -1, kernel)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def inpaint(self, x, y, radius):
        """Remove object at (x, y) with specified radius."""
        if radius <= 0:
            raise ValueError("Radius must be positive")
        mask = np.zeros(self.cv_image.shape[:2], dtype=np.uint8)
        cv2.circle(mask, (x, y), radius, 255, -1)
        self.cv_image = cv2.inpaint(self.cv_image, mask, 3, cv2.INPAINT_TELEA)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def face_detection(self, action="crop"):
        """Detect faces and crop or blur them."""
        if action not in ["crop", "blur"]:
            raise ValueError("Action must be 'crop' or 'blur'")
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        if action == "crop" and faces:
            x, y, w, h = faces[0]
            self.image = self.image.crop((x, y, x + w, y + h))
            self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        elif action == "blur":
            for (x, y, w, h) in faces:
                face = self.cv_image[y:y+h, x:x+w]
                face = cv2.GaussianBlur(face, (23, 23), 30)
                self.cv_image[y:y+h, x:x+w] = face
            self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def batch_process(self, images, operation, params):
        """Apply an operation to multiple images."""
        results = []
        for img_file in images:
            processor = ImageProcessor(img_file)
            getattr(processor, operation)(*params)
            results.append(processor.save_image())
        return results

    def add_layer(self, image_file):
        """Add a new layer from an uploaded image."""
        new_layer = Image.open(image_file).convert("RGB").resize(self.image.size)
        self.layers.append(new_layer)

    def merge_layers(self, opacity=1.0):
        """Merge all layers with specified opacity for top layers."""
        if not 0 <= opacity <= 1:
            raise ValueError("Opacity must be between 0 and 1")
        base = self.layers[0].convert("RGBA")
        for layer in self.layers[1:]:
            layer_rgba = layer.convert("RGBA")
            base = Image.blend(base, layer_rgba, opacity)
        self.image = base.convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers = [self.image.copy()]

    def meme_generator(self, top_text, bottom_text, font_size=50, color=(255, 255, 255)):
        """Create a meme with top and bottom text."""
        if not top_text and not bottom_text:
            raise ValueError("At least one text required")
        if font_size <= 0:
            raise ValueError("Font size must be positive")
        draw = ImageDraw.Draw(self.image)
        font = ImageFont.load_default()
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            pass
        width, height = self.image.size
        top_bbox = draw.textbbox((0, 0), top_text, font=font)
        bottom_bbox = draw.textbbox((0, 0), bottom_text, font=font)
        draw.text(((width - top_bbox[2]) / 2, 10), top_text, fill=color, font=font)
        draw.text(((width - bottom_bbox[2]) / 2, height - bottom_bbox[3] - 10), bottom_text, fill=color, font=font)
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()

    def collage(self, images, layout="2x2"):
        """Create a collage with specified layout."""
        if layout not in ["2x2", "3x1", "1x3", "1x2", "2x1"]:
            raise ValueError("Invalid layout")
        imgs = [Image.open(img).convert("RGB") for img in images]
        if layout == "2x2":
            rows, cols = 2, 2
        elif layout == "3x1":
            rows, cols = 3, 1
        elif layout == "1x3":
            rows, cols = 1, 3
        elif layout == "1x2":
            rows, cols = 1, 2
        else:
            rows, cols = 2, 1
        max_width = max(img.size[0] for img in imgs)
        max_height = max(img.size[1] for img in imgs)
        collage_width = max_width * cols
        collage_height = max_height * rows
        collage = Image.new("RGB", (collage_width, collage_height), (255, 255, 255))
        for i, img in enumerate(imgs[:rows * cols]):
            img = img.resize((max_width, max_height), Image.Resampling.LANCZOS)
            x = (i % cols) * max_width
            y = (i // cols) * max_height
            collage.paste(img, (x, y))
        self.image = collage
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers = [self.image.copy()]

    def extract_palette(self, num_colors=5):
        """Extract dominant colors from the image."""
        if num_colors < 1:
            raise ValueError("Number of colors must be positive")
        img = self.image.resize((150, 150))
        pixels = np.float32(img).reshape(-1, 3)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 200, 0.1)
        _, labels, centers = cv2.kmeans(pixels, num_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        palette = centers.astype(np.uint8).tolist()
        return palette

    def restore(self):
        """Restore image by reducing noise and scratches."""
        self.cv_image = cv2.fastNlMeansDenoisingColored(self.cv_image, None, 10, 10, 7, 21)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def convert_format(self, format, quality=90, compression=6, width=0, height=0, aspect=True, strip=False, color="RGB", dpi=72, background="#ffffff"):
        """Convert image format with customization."""
        if format not in ["jpeg", "png", "webp", "bmp", "gif", "tiff"]:
            raise ValueError("Invalid format")
        if not 1 <= quality <= 100:
            raise ValueError("Quality must be between 1 and 100")
        if not 0 <= compression <= 9:
            raise ValueError("Compression must be between 0 and 9")
        if color not in ["RGB", "L", "CMYK"]:
            raise ValueError("Invalid color mode")
        if dpi not in [72, 150, 300]:
            raise ValueError("Invalid DPI")
        img = self.image
        if width > 0 and height > 0:
            if aspect:
                img.thumbnail((width, height), Image.Resampling.LANCZOS)
            else:
                img = img.resize((width, height), Image.Resampling.LANCZOS)
        if color == "L":
            img = img.convert("L")
        elif color == "CMYK":
            img = img.convert("CMYK")
        else:
            img = img.convert("RGB")
        if strip:
            img.info = {}  
        output = io.BytesIO()
        save_params = {}
        if format in ["jpeg", "webp"]:
            save_params["quality"] = quality
        if format == "png":
            save_params["compress_level"] = compression
        if format in ["jpeg", "png", "tiff"]:
            save_params["dpi"] = (dpi, dpi)
        if format == "png" and img.mode == "RGBA":
            bg = Image.new("RGB", img.size, background)
            bg.paste(img, mask=img.split()[3])
            img = bg
        img.save(output, format=format.upper(), **save_params)
        output.seek(0)
        return output.getvalue()

    def compress_image(self, target_size_kb, format="JPEG", quality=80, compression=6, lossless=False, progressive=False, strip_metadata=False, quantization="standard"):
        """Compress image with advanced options."""
        if target_size_kb <= 0:
            raise ValueError("Target size must be positive")
        if format not in ["JPEG", "PNG", "WEBP"]:
            raise ValueError("Unsupported format for compression")
        if not 1 <= quality <= 100:
            raise ValueError("Quality must be between 1 and 100")
        if not 0 <= compression <= 9:
            raise ValueError("Compression must be between 0 and 9")
        if quantization not in ["standard", "high", "low"]:
            raise ValueError("Invalid quantization mode")

        img = self.image
        output = io.BytesIO()
        save_params = {}

        quality_adjust = {"standard": 0, "high": 10, "low": -10}
        adjusted_quality = min(max(quality + quality_adjust[quantization], 1), 100)

        if format == "JPEG":
            save_params["quality"] = adjusted_quality
            save_params["progressive"] = progressive
            save_params["optimize"] = True
        elif format == "PNG":
            save_params["compress_level"] = compression
            save_params["optimize"] = True
        elif format == "WEBP":
            save_params["quality"] = adjusted_quality if not lossless else 100
            save_params["lossless"] = lossless
            save_params["method"] = 6  

        if strip_metadata:
            img.info = {}

        current_quality = adjusted_quality
        while current_quality >= 10:
            output.seek(0)
            output.truncate(0)
            try:
                img.save(output, format=format, **save_params)
                size_kb = output.getbuffer().nbytes / 1024
                if size_kb <= target_size_kb or format == "PNG" or lossless:
                    break
                current_quality -= 5
                save_params["quality"] = current_quality
            except Exception as e:
                raise ValueError(f"Compression failed: {str(e)}")

        output.seek(0)
        self.image = Image.open(output).convert("RGB")
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()
        return output.getvalue()

    def get_compressed_size(self, format="JPEG", quality=80, compression=6, lossless=False, progressive=False, strip_metadata=False, quantization="standard"):
        """Estimate compressed file size without modifying the image."""
        img = self.image.copy()
        output = io.BytesIO()
        save_params = {}

        quality_adjust = {"standard": 0, "high": 10, "low": -10}
        adjusted_quality = min(max(quality + quality_adjust[quantization], 1), 100)

        if format == "JPEG":
            save_params["quality"] = adjusted_quality
            save_params["progressive"] = progressive
            save_params["optimize"] = True
        elif format == "PNG":
            save_params["compress_level"] = compression
            save_params["optimize"] = True
        elif format == "WEBP":
            save_params["quality"] = adjusted_quality if not lossless else 100
            save_params["lossless"] = lossless
            save_params["method"] = 6

        if strip_metadata:
            img.info = {}

        img.save(output, format=format, **save_params)
        size_kb = output.getbuffer().nbytes / 1024
        return size_kb

    def remove_red_eye(self):
        """Detect and remove red-eye effect."""
        gray = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        for (x, y, w, h) in faces:
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = self.cv_image[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray)
            for (ex, ey, ew, eh) in eyes:
                eye = roi_color[ey:ey+eh, ex:ex+ew]
                b, g, r = cv2.split(eye)
                red_mask = (r > 150) & (r > g + 20) & (r > b + 20)
                eye[red_mask] = [b[red_mask], g[red_mask], g[red_mask]]
                roi_color[ey:ey+eh, ex:ex+ew] = cv2.merge((b, g, r))
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def denoise(self, strength=10):
        """Advanced noise reduction."""
        if not 1 <= strength <= 30:
            raise ValueError("Strength must be between 1 and 30")
        self.cv_image = cv2.fastNlMeansDenoisingColored(self.cv_image, None, strength, strength, 7, 21)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def perspective_correction(self, points):
        """Correct perspective using four points."""
        if len(points) != 4:
            raise ValueError("Four points required")
        src_pts = np.float32(points)
        width = max(np.linalg.norm(src_pts[0] - src_pts[1]), np.linalg.norm(src_pts[2] - src_pts[3]))
        height = max(np.linalg.norm(src_pts[0] - src_pts[3]), np.linalg.norm(src_pts[1] - src_pts[2]))
        dst_pts = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
        matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
        self.cv_image = cv2.warpPerspective(self.cv_image, matrix, (int(width), int(height)))
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def stitch_images(self, images):
        """Stitch multiple images into a panorama."""
        imgs = [cv2.cvtColor(np.array(Image.open(img).convert("RGB")), cv2.COLOR_RGB2BGR) for img in images]
        stitcher = cv2.Stitcher_create()
        status, stitched = stitcher.stitch(imgs)
        if status != cv2.Stitcher_OK:
            raise ValueError("Stitching failed")
        self.cv_image = stitched
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def extract_text(self):
        """Extract text from image using Tesseract."""
        try:
            text = pytesseract.image_to_string(self.image)
            return text.strip()
        except:
            raise ValueError("Tesseract OCR failed")

    def color_pop(self, hue_range, tolerance=30):
        """Highlight colors within hue range, desaturate others."""
        if not 0 <= hue_range[0] <= 180 or not 0 <= hue_range[1] <= 180:
            raise ValueError("Hue range must be between 0 and 180")
        hsv = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (hue_range[0], 50, 50), (hue_range[1], 255, 255))
        gray = cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2GRAY)
        gray = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        gray_hsv = cv2.cvtColor(gray, cv2.COLOR_BGR2HSV)
        hsv[np.logical_not(mask)] = gray_hsv[np.logical_not(mask)]
        self.cv_image = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        self.image = Image.fromarray(cv2.cvtColor(self.cv_image, cv2.COLOR_BGR2RGB))
        self.layers[-1] = self.image.copy()

    def add_border(self, width, color="#ffffff"):
        """Add a border around the image."""
        if width < 0:
            raise ValueError("Border width must be non-negative")
        try:
            r, g, b = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        except:
            raise ValueError("Invalid color format")
        new_width = self.image.width + 2 * width
        new_height = self.image.height + 2 * width
        bordered = Image.new("RGB", (new_width, new_height), (r, g, b))
        bordered.paste(self.image, (width, width))
        self.image = bordered
        self.cv_image = cv2.cvtColor(np.array(self.image), cv2.COLOR_RGB2BGR)
        self.layers[-1] = self.image.copy()
