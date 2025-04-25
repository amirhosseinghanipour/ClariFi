from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("upload", views.upload_image, name="upload_image"),
    path("studio", views.studio, name="studio"),
    path("converter", views.converter, name="converter"),
    path("remove", views.remove_background, name="remove_background"),
    path("studio/get-image", views.get_studio_image, name="get_studio_image"),
    path("adjust/<str:tool>", views.adjust_image, name="adjust_image"),
    path("filter/<str:tool>", views.filter_image, name="filter_image"),
    path("transform/<str:tool>", views.transform_image, name="transform_image"),
    path("premium/<str:tool>", views.premium, name="premium"),
    path("text/<str:tool>", views.text, name="text"),
    path("meme/<str:tool>", views.meme, name="meme"),
    path("collage/<str:tool>", views.collage, name="collage"),
    path("layers/<str:tool>", views.layers, name="layers"),
    path("palette/<str:tool>", views.palette, name="palette"),
    path("format/<str:tool>", views.format, name="format"),
    path("compressor", views.compressor_page, name="compressor"),
    path("compressor/<str:tool>", views.compressor, name="compressor_tool"),
]
