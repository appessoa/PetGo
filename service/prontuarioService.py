from config.db import db
from models.prontuarioModel import ProntuarioModel
from models.consultasModel import Consultation
from models.veterinarioModel import veterinarianModel
from models.petsModel import Pet
from models.agendamentoModel import Scheduling
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional

def _get_attr_names(model):
    # helper para lidar com nomes de coluna com acento/excentricidades
    attrs = set(dir(model))
    return attrs

def _set_field_safe(obj, candidate_names, value):
    for name in candidate_names:
        if hasattr(obj, name):
            setattr(obj, name, value)
            return True
    # falha ao achar campo
    return False

class ProntuarioService:

    # Substitua o método create_prontuario atual por este (em controllers/prontuarioService ou onde estiver)

    @staticmethod
    def create_prontuario(payload: dict, user_id: int = None) -> ProntuarioModel:
        """
        Cria um prontuário e, se informado agendamento_id, relaciona o agendamento
        ao prontuário e marca o agendamento como 'concluido' (status finalizado).
        """
        # validação básica
        pet_id = payload.get("pet_id") or payload.get("petId") or payload.get("pet")
        anamnese = payload.get("anamnese")
        diagnostico = payload.get("diagnostico")
        tratamento = payload.get("tratamento")

        missing = []
        if not pet_id: missing.append("pet_id")
        if not anamnese: missing.append("anamnese")
        if not diagnostico: missing.append("diagnostico")
        if not tratamento: missing.append("tratamento")
        if missing:
            raise ValueError(f"Campos obrigatórios ausentes: {', '.join(missing)}")

        # garante inteiros
        try:
            pet_id = int(pet_id)
        except Exception:
            raise ValueError("pet_id inválido")

        # verifica existência do pet
        pet = Pet.query.get(pet_id)
        if not pet:
            raise LookupError("Pet não encontrado")

        # atribuições opcionais
        agendamento_id = payload.get("agendamento_id") or payload.get("ag_id") or payload.get("agendamento")
        vet_id = payload.get("vet_id") or payload.get("vetId") or payload.get("vet_id")

        # se não vier vet_id, podemos assumir que o usuário logado (user_id) é o vet
        if not vet_id and user_id:
            try:
                vet_id = int(user_id)
            except Exception:
                vet_id = None

        pront = ProntuarioModel(
            pet_id=pet_id,
            vet_id=vet_id,
            anamnese=anamnese,
            diagnostico=diagnostico,
            tratamento=tratamento
        )

        # Inicia transação: adiciona o prontuário e, se aplicável, relaciona o agendamento e atualiza status.
        try:
            db.session.add(pront)
            # flush para garantir que o pront tenha id (sem commitar ainda)
            db.session.flush()

            # se veio agendamento_id, vincula o agendamento ao prontuário e atualiza status
            if agendamento_id:
                try:
                    ag_id_int = int(agendamento_id)
                except Exception:
                    raise ValueError("agendamento_id inválido")

                # busca o agendamento por id (use o nome da coluna que existir no seu modelo)
                sched = Scheduling.query.filter_by(id_agendamento=ag_id_int).first()
                if not sched:
                    raise LookupError("Agendamento não encontrado.")

                # valida: agendamento pertence ao mesmo pet (evita relacionar errôneo)
                if int(sched.pet_id) != int(pet_id):
                    raise ValueError("Agendamento não corresponde ao pet informado.")

                # vincula: define a FK no Scheduling apontando para o prontuário
                # ATENÇÃO: substitua 'prontuario_id' se sua coluna tiver outro nome
                try:
                    sched.prontuario_id = getattr(pront, "id_prontuario", None)
                except Exception:
                    # Se sua modelagem usar relacionamento invertido, pode ser sched.prontuario = pront
                    try:
                        sched.prontuario = pront
                    except Exception:
                        pass

                # atualiza status do agendamento para concluído (valor do seu ALLOWED_STATUS)
                sched.status = "concluido"
                sched.pront_id = pront.id_prontuario

                # adiciona sched ao session (caso necessário) — como sched veio do query, já está na session

            # commita tudo de uma vez (pront criado + sched atualizado)
            db.session.commit()

            # refresh para garantir relacionamentos carregados
            db.session.refresh(pront)
            return pront

        except Exception as e:
            db.session.rollback()
            # re-raise para o controller/log tratar (preserva stack trace)
            raise

    @staticmethod
    def get_prontuarios_por_pet(pet_id: int, limit: int = 100):
        """
        Retorna lista de prontuários do pet ordenados por created_at desc.
        Não faz autorização complexa aqui — delegue a checagem se necessário.
        Retorna lista de instâncias ProntuarioModel.
        """
        try:
            pet = Pet.query.get(int(pet_id))
            if not pet:
                raise LookupError("Pet não encontrado")

            # busca: se quiser, aplique filtros por vet_id/user_id
            q = ProntuarioModel.query.filter_by(pet_id=pet_id).order_by(ProntuarioModel.created_at.desc()).limit(limit)
            pronts = q.all()
            return pronts
        except ValueError:
            raise ValueError("pet_id inválido")
        except SQLAlchemyError:
            raise

    @staticmethod
    def get_prontuario_por_id(pront_id: int):
        p = ProntuarioModel.query.get(pront_id)
        if not p:
            raise LookupError("Prontuário não encontrado")
        return p

    @staticmethod
    def get_prontuarios_por_pet(pet_id: int):
        rows = ProntuarioModel.query.filter_by(pet_id=pet_id).order_by(ProntuarioModel.created_at.desc()).all()
        return [r.to_dict() for r in rows]

    @staticmethod
    def get_prontuario(pront_id: int):
        p = ProntuarioModel.query.filter_by(id_prontuario=pront_id).first()
        if not p:
            raise LookupError("Prontuário não encontrado.")
        return p.to_dict()
    
    @staticmethod
    def update_prontuario(pront_id: int, payload: dict, user_id: int = None) -> ProntuarioModel:
        """
        Atualiza campos permitidos de um prontuário.
        Campos permitidos por padrão: anamnese, diagnostico, tratamento, vet_id, pet_id, agendamento_id, consulta_id.
        Faz validações mínimas (ex.: prontuario existe). Pode lançar:
          - LookupError: prontuario inexistente
          - ValueError: dados inválidos
          - PermissionError: se desejar bloquear edição (opcional)
          - SQLAlchemyError: erro DB
        """
        # busca
        pront = ProntuarioModel.query.filter_by(id_prontuario=int(pront_id)).first()
        if not pront:
            raise LookupError("Prontuário não encontrado.")

        # Opcional: validação de permissão
        # Exemplo: se quiser garantir que apenas veterinários ou dono do pet editem, implemente a checagem aqui.
        # if user_id and not UserService.is_veterinarian(user_id) and pront.pet.owner_id != user_id:
        #     raise PermissionError("Sem permissão para editar este prontuário.")

        # Atualiza apenas campos permitidos
        allowed = {"anamnese", "diagnostico", "tratamento", "vet_id", "pet_id", "agendamento_id", "consulta_id"}
        changed = False

        for key in allowed:
            if key in payload:
                val = payload.get(key)
                # pequenas normalizações:
                if key in ("pet_id", "vet_id", "agendamento_id", "consulta_id") and val is not None and val != "":
                    try:
                        val = int(val)
                    except Exception:
                        raise ValueError(f"{key} inválido")
                # atribui
                # se a propriedade não existir no model (ex: se não tiver agendamento_id como coluna),
                # use setattr com cuidado; caso contrário, ignore.
                if hasattr(pront, key) or key in ("agendamento_id", "consulta_id"):
                    try:
                        setattr(pront, key, val)
                        changed = True
                    except Exception:
                        # se atributo realmente não existir, ignore silenciosamente ou trate
                        pass

        if not changed:
            raise ValueError("Nenhum campo válido para atualizar foi enviado.")

        try:
            db.session.add(pront)
            db.session.commit()
            db.session.refresh(pront)
            return pront
        except SQLAlchemyError:
            db.session.rollback()
            raise