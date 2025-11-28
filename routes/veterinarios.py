
from flask import Blueprint
from controllers.veterinarioController import veterinarioController as VC
from config.decorators import login_required, admin_required

vet_bp = Blueprint('veterinario', __name__)


vet_bp.get("/veterinarios")(admin_required(VC.get_all_veterinarios))
vet_bp.post("/veterinarios")(admin_required(VC.create_veterinario))
vet_bp.get("/veterinarios/<int:vet_id>")(admin_required(VC.get_veterinario_by_id))
vet_bp.put("/veterinarios/<int:vet_id>")(admin_required(VC.update_veterinario))
vet_bp.delete("/veterinarios/<int:vet_id>")(admin_required(VC.delete_veterinario))
vet_bp.get("/veterinariosDisponiveis")(login_required(VC.get_veterinarios_disponiveis))
vet_bp.get("/veterinarios/<int:vet_id>/agendamentos")(login_required(VC.get_agendamentos_por_veterinario))
vet_bp.get("/api/vets/me/agendamentos")(login_required(VC.get_agendamentos_por_veterinario_me))
vet_bp.get("/api/vets/me/pacientes")(login_required(VC.get_pacientes_por_veterinario_me))