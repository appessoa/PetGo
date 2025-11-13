from flask import Blueprint
from controllers.pedidoController import pedidoController as PC
from config.decorators import login_required,admin_required

bp_orders = Blueprint("orders", __name__, url_prefix="/api")

bp_orders.post("/checkout")(login_required(PC.checkout))

bp_orders.get("/orders")(login_required(PC.my_orders))

bp_orders.get("/orders/<int:order_id>")(login_required(PC.my_order_detail))

bp_orders.patch("/orders/<int:order_id>/status")(login_required(PC.patch_order_status))

bp_orders.get("/admin/orders/")(admin_required(PC.admin_list_orders))

bp_orders.get("/admin/orders/<int:order_id>")(admin_required(PC.admin_get_order_detail))

bp_orders.get("/admin/orders/<int:order_id>/recibo")(admin_required(PC.admin_generate_recibo))

