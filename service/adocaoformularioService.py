# services/adoption_service.py
from datetime import datetime
from flask import session
from config.db import db
from models.adocaoformularioModel import AdoptionApplication

def _clamp(v, lo, hi):
    try:
        v = int(v)
    except Exception:
        return None
    return max(lo, min(hi, v))

class AdoptionService:

    @staticmethod
    def _validate_payload(data: dict) -> tuple[dict, dict]:
        """Normaliza e valida. Retorna (payload_normalizado, erros)."""
        errs = {}
        out  = {}

        # enums / strings
        tipo_pet = (data.get("tipo_pet") or "").strip() or None
        if tipo_pet and tipo_pet not in ("Gato", "Cachorro"):
            errs["tipo_pet"] = "Tipo de pet inválido."

        residencia_tipo = (data.get("residencia_tipo") or "").strip()
        if residencia_tipo not in ("Casa", "Apartamento"):
            errs["residencia_tipo"] = "Residência deve ser 'Casa' ou 'Apartamento'."

        # telas_protecao
        tp_raw = data.get("telas_protecao", None)
        if isinstance(tp_raw, str):
            tp_raw = tp_raw.lower() in ("sim", "true", "1")
        telas_protecao = bool(tp_raw) if tp_raw is not None else None

        # sliders
        sociabilidade = _clamp(data.get("sociabilidade"), 1, 3)
        brincadeira   = _clamp(data.get("brincadeira"),   1, 3)
        carinho       = _clamp(data.get("carinho"),       1, 5)

        if sociabilidade is None: errs["sociabilidade"] = "Valor inválido (1 a 3)."
        if brincadeira   is None: errs["brincadeira"]   = "Valor inválido (1 a 3)."
        if carinho       is None: errs["carinho"]       = "Valor inválido (1 a 5)."

        motivo = (data.get("motivo") or "").strip()
        if not motivo:
            errs["motivo"] = "Informe sua motivação para adoção."

        # regra condicional
        if residencia_tipo == "Apartamento" and telas_protecao is None:
            errs["telas_protecao"] = "Obrigatório informar se possui telas de proteção."

        pet_id = data.get("pet_id")
        try:
            pet_id = int(pet_id) if pet_id is not None else None
        except Exception:
            errs["pet_id"] = "pet_id inválido."

        out.update({
            "pet_id": pet_id,
            "tipo_pet": tipo_pet,
            "residencia_tipo": residencia_tipo,
            "telas_protecao": telas_protecao,
            "sociabilidade": sociabilidade,
            "brincadeira": brincadeira,
            "carinho": carinho,
            "motivo": motivo,
        })
        return out, errs

    @staticmethod
    def create_or_update_for_user(user_id: int, data: dict) -> AdoptionApplication:
        payload, errs = AdoptionService._validate_payload(data)
        if errs:
            from Helpers import api_error  # seu helper
            return api_error(400, "Falha de validação.", errs)

        # regra de negócio: mantém 1 aplicação "aberta" por usuário; se existir, atualiza
        app = (AdoptionApplication.query
               .filter(AdoptionApplication.user_id == user_id,
                       AdoptionApplication.status.in_(["aberta","em_avaliacao"]))
               .order_by(AdoptionApplication.created_at.desc())
               .first())

        if app:
            for k,v in payload.items():
                setattr(app, k, v)
            app.updated_at = datetime.utcnow()
        else:
            app = AdoptionApplication(user_id=user_id, **payload)
            db.session.add(app)

        db.session.commit()
        return app

    @staticmethod
    def list_my(user_id: int):
        return (AdoptionApplication.query
                .filter_by(user_id=user_id)
                .order_by(AdoptionApplication.created_at.desc())
                .all())

    @staticmethod
    def get_my(user_id: int, app_id: int) -> AdoptionApplication:
        app = AdoptionApplication.query.get_or_404(app_id)
        if app.user_id != user_id:
            from Helpers import api_error
            return api_error(403, "Acesso negado.")
        return app

    @staticmethod
    def set_status(user_id: int, app_id: int, status: str) -> AdoptionApplication:
        if status not in ("aberta","em_avaliacao","aprovada","rejeitada","cancelada"):
            from Helpers import api_error
            return api_error(400, "Status inválido.")
        app = AdoptionService.get_my(user_id, app_id)
        if isinstance(app, dict):  # api_error
            return app
        app.status = status
        app.updated_at = datetime.utcnow()
        db.session.commit()
        return app
    @staticmethod
    def delete(user_id: int, app_id: int) -> bool:
        app = AdoptionService.get_my(user_id, app_id)
        if isinstance(app, dict):  # api_error
            return app
        app.deleted = app.id_adoption_applications  # soft delete
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            from Helpers import api_error
            return api_error(500, "Erro ao deletar formulário", exc=e)
        return True