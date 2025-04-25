from PIL import Image, ImageDraw, ImageFont

img = Image.new("L", (100, 100), 0)  # Black background
draw = ImageDraw.Draw(img)
font = ImageFont.load_default()
draw.text((10, 40), "CLARIFI", fill=255)  # White text
img.save("placeholder.png")
