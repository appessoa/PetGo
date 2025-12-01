from datetime import date as date_cls
from config.db import db
from models.agendamentoModel import Scheduling
from models.petsModel import Pet  
from sqlalchemy.exc import SQLAlchemyError
from models.veterinarioModel import veterinarianModel as vet

ALLOWED_SERVICES = {"banho", "veterinario", "passeio", "hotel"}
ALLOWED_STATUS   = {"marcado", "confirmado", "concluido", "cancelado"}

class SchedulingService:

    @staticmethod
    def _assert_service(service: str):
        if service not in ALLOWED_SERVICES:
            raise ValueError(f"Serviço inválido. Use um de: {', '.join(sorted(ALLOWED_SERVICES))}")

    @staticmethod
    def _assert_status(status: str):
        if status not in ALLOWED_STATUS:
            raise ValueError(f"Status inválido. Use um de: {', '.join(sorted(ALLOWED_STATUS))}")

    @staticmethod
    def _assert_pet_ownership(user_id: int, pet_id: int):
        pet = Pet.query.filter_by(id_pet=pet_id, dono=user_id).first()
        if not pet:
            # tenta variação comum de campo
            pet = Pet.query.filter_by(id_pet=pet_id, tutor_id=user_id).first()
        if not pet:
            raise PermissionError("Pet não pertence ao usuário logado.")
        return pet

    @staticmethod
    def create(user_id: int, pet_id: int,vet_id: int | None ,service: str, date, time, notes: str | None):
        SchedulingService._assert_service(service)
        SchedulingService._assert_pet_ownership(user_id, pet_id)

        # opcional: impedir data no passado
        if hasattr(date, "isoformat"):
            ag_date = date
        else:
            ag_date = date  # já é date
        if ag_date < date_cls.today():
            raise ValueError("Não é permitido agendar para uma data no passado.")

        ag = Scheduling(
            user_id=user_id,
            pet_id=pet_id,
            vet_id=vet_id,  
            service=service,
            date=date,
            time=time,
            notes=notes,
            status="marcado",
        )
        try:
            db.session.add(ag)
            db.session.commit()
            return ag
        except SQLAlchemyError as e:
            db.session.rollback()
            raise RuntimeError(f"Erro ao criar agendamento: {e}") from e

    @staticmethod
    def list_for_user(user_id: int, status: str | None = None):
        # usa outerjoin para incluir agendamentos onde vet_id IS NULL
        q = (Scheduling.query
            .filter_by(user_id=user_id)
            .outerjoin(vet, vet.id_veterinarian == Scheduling.vet_id)
            .order_by(Scheduling.date.desc(), Scheduling.time.desc())
        )

        if status:
            SchedulingService._assert_status(status)
            q = q.filter_by(status=status)

        return q.all()

    @staticmethod
    def get_for_user(user_id: int, ag_id: int):
        """
        Retorna o agendamento se o user_id for:
         - o dono/usuario que criou o agendamento (Scheduling.user_id)
         - OU o veterinário atribuído a esse agendamento (Scheduling.vet_id)
        """
        ag = Scheduling.query.filter_by(id_agendamento=ag_id, user_id=user_id).first()
        if ag:
            return ag

        ag = Scheduling.query.filter_by(id_agendamento=ag_id, vet_id=user_id).first()
        if ag:
            return ag

        raise LookupError("Agendamento não encontrado.")

    @staticmethod
    def update_for_user(user_id: int, ag_id: int, **fields):
        # busca (agora permite dono OU vet)
        ag = SchedulingService.get_for_user(user_id, ag_id)

        # Normalização de status: aceita 'C', 'c', 'cancel', 'cancelado', etc.
        if "status" in fields and fields["status"] is not None:
            raw_status = str(fields["status"]).strip().lower()
            # mapeamento simples para valores canônicos do seu ALLOWED_STATUS
            if raw_status in ("c", "cancel", "cancelado", "canceled"):
                normalized = "cancelado"
            elif raw_status in ("concluido", "concluida", "f", "finalizado", "finalizada"):
                normalized = "concluido"
            elif raw_status in ("confirmado", "confirm"):
                normalized = "confirmado"
            elif raw_status in ("marcado", "m"):
                normalized = "marcado"
            else:
                normalized = raw_status  # tenta usar como veio; _assert_status validará
            # valida e aplica
            SchedulingService._assert_status(normalized)
            ag.status = normalized

        # atualizações permitidas (outros campos)
        if "service" in fields and fields["service"]:
            SchedulingService._assert_service(fields["service"])
            ag.service = fields["service"]
        if "date" in fields and fields["date"]:
            if fields["date"] < date_cls.today():
                raise ValueError("Data não pode ser no passado.")
            ag.date = fields["date"]
        if "time" in fields and fields["time"]:
            ag.time = fields["time"]
        if "notes" in fields:
            ag.notes = fields["notes"]

        # trocar pet exige conferir posse (mantido como estava)
        if "pet_id" in fields and fields["pet_id"]:
            SchedulingService._assert_pet_ownership(user_id, fields["pet_id"])
            ag.pet_id = fields["pet_id"]

        try:
            db.session.commit()
            return ag
        except SQLAlchemyError as e:
            db.session.rollback()
            raise RuntimeError(f"Erro ao atualizar agendamento: {e}") from e

    @staticmethod
    def update_for_user(user_id: int, ag_id: int, **fields):
        ag = SchedulingService.get_for_user(user_id, ag_id)

        # atualizações permitidas
        if "service" in fields and fields["service"]:
            SchedulingService._assert_service(fields["service"])
            ag.service = fields["service"]
        if "status" in fields and fields["status"]:
            SchedulingService._assert_status(fields["status"])
            ag.status = fields["status"]
        if "date" in fields and fields["date"]:
            if fields["date"] < date_cls.today():
                raise ValueError("Data não pode ser no passado.")
            ag.date = fields["date"]
        if "time" in fields and fields["time"]:
            ag.time = fields["time"]
        if "notes" in fields:
            ag.notes = fields["notes"]

        # trocar pet exige conferir posse
        if "pet_id" in fields and fields["pet_id"]:
            SchedulingService._assert_pet_ownership(user_id, fields["pet_id"])
            ag.pet_id = fields["pet_id"]

        try:
            db.session.commit()
            return ag
        except SQLAlchemyError as e:
            db.session.rollback()
            raise RuntimeError(f"Erro ao atualizar agendamento: {e}") from e

    @staticmethod
    def delete_for_user(user_id: int, ag_id: int):
        ag = SchedulingService.get_for_user(user_id, ag_id)
        try:
            db.session.delete(ag)
            db.session.commit()
            return True
        except SQLAlchemyError as e:
            db.session.rollback()
            raise RuntimeError(f"Erro ao excluir agendamento: {e}") from e
    @staticmethod
    def get_by_id(ag_id: int):
        """Busca agendamento por id sem checar dono (usa id_agendamento)."""
        ag = Scheduling.query.filter_by(id_agendamento=ag_id).first()
        if not ag:
            raise LookupError("Agendamento não encontrado.")
        return ag

    @staticmethod
    def update_for_vet(vet_id: int, ag_id: int, **fields):
        """
        Permite que o veterinário vinculado ao agendamento (vet_id) o atualize.
        Regra: ag.vet_id deve ser igual a vet_id.
        Campos permitidos: same as update_for_user (service, status, date, time, notes, pet_id).
        """
        ag = SchedulingService.get_by_id(ag_id)

        # garante que o vet que está tentando atualizar é o vet atribuído ao agendamento
        if ag.vet_id is None or int(ag.vet_id) != int(vet_id):
            raise PermissionError("Você não tem permissão para atualizar este agendamento como veterinário.")

        # aplicar validações/atualizações iguais às de update_for_user
        if "service" in fields and fields["service"]:
            SchedulingService._assert_service(fields["service"])
            ag.service = fields["service"]
        if "status" in fields and fields["status"]:
            SchedulingService._assert_status(fields["status"])
            ag.status = fields["status"]
        if "date" in fields and fields["date"]:
            if fields["date"] < date_cls.today():
                raise ValueError("Data não pode ser no passado.")
            ag.date = fields["date"]
        if "time" in fields and fields["time"]:
            ag.time = fields["time"]
        if "notes" in fields:
            ag.notes = fields["notes"]

        # trocar pet exige conferir posse do dono original? aqui vet não troca o dono do pet,
        # mas se quiser permitir trocar pet, poderia checar posse do novo pet com _assert_pet_ownership
        if "pet_id" in fields and fields["pet_id"]:
            # opção segura: não permitir vet trocar o pet; se quiser permitir, descomente próxima linha
            # SchedulingService._assert_pet_ownership(vet_id, fields["pet_id"])  # geralmente não faz sentido
            ag.pet_id = fields["pet_id"]

        try:
            db.session.commit()
            return ag
        except SQLAlchemyError as e:
            db.session.rollback()
            raise RuntimeError(f"Erro ao atualizar agendamento: {e}") from e