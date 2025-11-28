# routes/user_api.py (substitua ou ajuste)
from flask import Blueprint
from controllers.prontuarioController import prontuarioController as PC

pront_api = Blueprint("pront_api", __name__, url_prefix="")

# listar / info
pront_api.get("/prontuarios")(PC.list_prontuarios)             # GET /prontuarios
pront_api.post("/prontuarios")(PC.create_prontuarios)         # POST /prontuarios

# obter por id
pront_api.get("/prontuarios/<int:pront_id>")(PC.get_prontuario_by_id)  # GET /prontuarios/1

# listar por pet
pront_api.get("/pets/<int:pet_id>/prontuarios")(PC.get_prontuarios_por_pet)  # GET /pets/5/prontuarios

# atualizar prontuário (se quiser route alternativa)
pront_api.put("/prontuarios/<int:pront_id>")(PC.update_prontuario)
pront_api.patch("/prontuarios/<int:pront_id>")(PC.update_prontuario)
