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
        # ajuste o nome do campo do dono do pet (owner_id / user_id / tutor_id)
        pet = Pet.query.filter_by(id_pet=pet_id, dono=user_id).first()
        if not pet:
            # tenta variação comum de campo
            pet = Pet.query.filter_by(id_pet=pet_id, tutor_id=user_id).first()
        if not pet:
            raise PermissionError("Pet não pertence ao usuário logado.")
        return pet

    @staticmethod
    def create(user_id: int, pet_id: int,vet_id: int ,service: str, date, time, notes: str | None):
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
        q = Scheduling.query.filter_by(user_id=user_id).join(vet, vet.id_veterinarian == Scheduling.vet_id).order_by(Scheduling.date.desc(), Scheduling.time.desc())
        if status:
            SchedulingService._assert_status(status)
            q = q.filter_by(status=status)
        return q.all()

    @staticmethod
    def get_for_user(user_id: int, ag_id: int):
        ag = Scheduling.query.filter_by(id_agendamento=ag_id, user_id=user_id).first()
        if not ag:
            raise LookupError("Agendamento não encontrado.")
        return ag

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
