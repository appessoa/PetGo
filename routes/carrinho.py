from flask import Blueprint
from controllers.cartController import CartController as CA
 

cart_bp = Blueprint("cart", __name__)


cart_bp.get('/cart')(CA.get_cart)