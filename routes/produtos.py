from flask import Blueprint
from controllers.produtoController import produtoController as PC
from config.decorators import admin_required


produtos_bp = Blueprint("produtos_bp", __name__, url_prefix="/api")

produtos_bp.get("/produtos")(PC.get_all)
produtos_bp.get("/produtos/<int:produto_id>")(PC.get_one)
produtos_bp.post("/produtos")(admin_required(PC.create_one))
produtos_bp.add_url_rule(
    "/produtos/<int:produto_id>",
    view_func=admin_required(PC.update_one),
    methods=["PUT", "PATCH"],
)
produtos_bp.patch("/produtos/<int:produto_id>/estoque")(admin_required(PC.update_stock))
produtos_bp.get("/produtos/<int:produto_id>/imagem")(PC.get_imagem)
produtos_bp.delete("/produtos/<int:produto_id>")(admin_required(PC.deleted_product))
