# routes/scheduling_api.py
from datetime import datetime
from flask import Blueprint, request, jsonify
from service.agendamentoService import SchedulingService
from werkzeug.exceptions import Unauthorized
from service.Helpers import api_error
from routes.utils.auth import current_user_id

sched_api = Blueprint("sched_api", __name__, url_prefix="/api/agendamentos")

def parse_date(dstr: str):
    # esperado: YYYY-MM-DD
    try:
        return datetime.strptime(dstr, "%Y-%m-%d").date()
    except Exception:
        raise ValueError("Data inválida. Use YYYY-MM-DD.")

def parse_time(tstr: str):
    # esperado: HH:MM
    try:
        return datetime.strptime(tstr, "%H:%M").time()
    except Exception:
        raise ValueError("Hora inválida. Use HH:MM.")

@sched_api.post("")
def create_agendamento():
    try:
        uid = current_user_id()
        data = request.get_json(silent=True) or {}

        pet_id  = data.get("pet_id")
        vet_id  = data.get("vet_id")
        service = (data.get("servico") or data.get("service") or "").strip().lower()
        date_str = data.get("data")
        time_str = data.get("hora")
        notes   = data.get("observacoes") or data.get("notes")

        missing = []
        if not pet_id: missing.append("pet_id")
        if not vet_id: missing.append("vet_id")
        if not service: missing.append("servico")
        if not date_str: missing.append("data")
        if not time_str: missing.append("hora")
        if missing:
            return api_error(400, "Campos obrigatórios ausentes.", details={"required": missing})

        ag_date = parse_date(date_str)
        ag_time = parse_time(time_str)

        ag = SchedulingService.create(
            user_id=uid,
            pet_id=int(pet_id),
            vet_id=int(vet_id),
            service=service,
            date=ag_date,
            time=ag_time,
            notes=notes
        )
        return jsonify(ag.to_dict()), 201

    except (ValueError, PermissionError) as e:
        return api_error(400, str(e), exc=e)
    except Unauthorized as e:
        return api_error(401, str(e))
    except Exception as e:
        return api_error(500, "Erro ao criar agendamento.", exc=e)

# GET /api/agendamentos  (listar do usuário)
@sched_api.get("")
def list_agendamentos():
    try:
        uid = current_user_id()
        status = request.args.get("status")
        items = SchedulingService.list_for_user(uid, status=status)
        return jsonify([i.to_dict() for i in items])
    except (ValueError,) as e:
        return api_error(400, str(e), exc=e)
    except Unauthorized as e:
        return api_error(401, str(e))
    except Exception as e:
        return api_error(500, "Erro ao listar agendamentos.", exc=e)

# GET /api/agendamentos/<id> (detalhe)
@sched_api.get("/<int:ag_id>")
def get_agendamento(ag_id: int):
    try:
        uid = current_user_id()
        ag = SchedulingService.get_for_user(uid, ag_id)
        return jsonify(ag.to_dict())
    except LookupError as e:
        return api_error(404, str(e), exc=e)
    except Unauthorized as e:
        return api_error(401, str(e))
    except Exception as e:
        return api_error(500, "Erro ao obter agendamento.", exc=e)

# PUT /api/agendamentos/<id> (atualizar campos permitidos)
@sched_api.put("/<int:ag_id>")
def update_agendamento(ag_id: int):
    try:
        uid = current_user_id()
        data = request.get_json(silent=True) or {}

        # normaliza chaves
        fields = {}
        if "servico" in data or "service" in data:
            fields["service"] = (data.get("servico") or data.get("service") or "").strip().lower()
        if "status" in data:
            fields["status"] = (data.get("status") or "").strip().lower()
        if "data" in data and data["data"]:
            fields["date"] = parse_date(data["data"])
        if "hora" in data and data["hora"]:
            fields["time"] = parse_time(data["hora"])
        if "observacoes" in data or "notes" in data:
            fields["notes"] = data.get("observacoes") or data.get("notes")
        if "pet_id" in data and data["pet_id"]:
            fields["pet_id"] = int(data["pet_id"])

        ag = SchedulingService.update_for_user(uid, ag_id, **fields)
        return jsonify(ag.to_dict())
    except (ValueError, PermissionError) as e:
        return api_error(400, str(e), exc=e)
    except LookupError as e:
        return api_error(404, str(e), exc=e)
    except Unauthorized as e:
        return api_error(401, str(e))
    except Exception as e:
        return api_error(500, "Erro ao atualizar agendamento.", exc=e)

# DELETE /api/agendamentos/<id> (excluir/cancelar)
@sched_api.delete("/<int:ag_id>")
def delete_agendamento(ag_id: int):
    try:
        uid = current_user_id()
        SchedulingService.delete_for_user(uid, ag_id)
        return jsonify({"ok": True}), 200
    except LookupError as e:
        return api_error(404, str(e), exc=e)
    except Unauthorized as e:
        return api_error(401, str(e))
    except Exception as e:
        return api_error(500, "Erro ao excluir agendamento.", exc=e)
