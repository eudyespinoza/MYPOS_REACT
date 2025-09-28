from django.urls import path

from . import api

app_name = 'core_api'

urlpatterns = [
    path('productos/by_code', api.products_by_code, name='products_by_code'),
    path('stock/<str:codigo>/<str:store>', api.stock_by_store, name='stock_by_store'),
    path('get_user_cart', api.get_user_cart, name='get_user_cart'),
    path('save_user_cart', api.save_user_cart, name='save_user_cart'),
    path('update_last_store', api.update_last_store, name='update_last_store'),
    path('clientes/search', api.customers_search, name='customers_search'),
    path('clientes/create', api.customers_create, name='customers_create'),
    path('clientes/validate', api.customers_validate, name='customers_validate'),
]
