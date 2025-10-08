from flask import Blueprint
from controllers.cartController import cartController as CA
 

cart_bp = Blueprint("cart", __name__)


cart_bp.get('/api/carrinho')(CA.get_my_cart)
cart_bp.post('/api/carrinho/items')(CA.add_item)
cart_bp.delete('/api/carrinho/items/<int:id_cart_item>')(CA.deleted_product_cart)