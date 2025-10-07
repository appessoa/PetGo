from flask import jsonify, session
from service.cartService import get_cart

class CartController:

    @staticmethod
    def get_cart():
        uid = session.get("user_id")
        cart = get_cart(uid)
        return cart
    
    