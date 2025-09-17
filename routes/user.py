# routes/user_api.py
from flask import Blueprint
from controllers.userController import UsersController as UC

user_api = Blueprint("user_api", __name__, url_prefix="/api")

user_api.get("/me")(UC.me)
user_api.put("/me")(UC.update_me)
user_api.put("/me/password")(UC.change_password)
user_api.get("/me/pets")(UC.my_pets)
user_api.get("/me/orders")(UC.my_orders)
user_api.post("/create_user")(UC.create_user)