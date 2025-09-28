from django.urls import path

from . import api

app_name = 'core_products'

urlpatterns = [
    path('atributos/<str:product_id>', api.product_attributes, name='product_attributes'),
]
