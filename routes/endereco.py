# controllers/address_controller.py
from flask import Blueprint
from controllers.enderecoController import addressController as AD
 

addr_api = Blueprint("addr_api", __name__, url_prefix="/api")

addr_api.get("/users/addresses")(AD.list_addresses)


addr_api.get("/users/addresses/<int:addr_id>")(AD.get_address)


addr_api.post("/users/addresses")(AD.create_address)


addr_api.patch("/users/addresses/<int:addr_id>")(AD.update_address)


addr_api.delete("/users/addresses/<int:addr_id>")(AD.delete_address)


addr_api.post("/users/addresses/<int:addr_id>/primary")(AD.set_primary_address)

