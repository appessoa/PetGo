# controllers/prontuarioController.py
from flask import request, jsonify
from routes.utils.auth import current_user_id
from service.Helpers import api_error
from service.prontuarioService import ProntuarioService
from sqlalchemy.exc import SQLAlchemyError

class prontuarioController:
    """
    Controller REST para Prontuários
    Rotas esperadas (exemplos):
      GET  /prontuarios            -> lista (opcional)
      POST /prontuarios            -> criar
      GET  /prontuarios/<id>       -> obter por id
      GET  /pets/<pet_id>/prontuarios -> listar por pet
      PUT  /prontuarios/<id>       -> atualizar (att_prontuario)
    """

    @staticmethod
    def create_prontuarios():  # mantive plural para evitar conflito com get_prontuario
        try:
            uid = current_user_id()
            data = request.get_json(silent=True) or {}
            pront = ProntuarioService.create_prontuario(data, user_id=uid)
            return jsonify(pront.to_dict()), 201
        except ValueError as e:
            return api_error(400, str(e), exc=e)
        except LookupError as e:
            return api_error(404, str(e), exc=e)
        except SQLAlchemyError as e:
            return api_error(500, "Erro de banco ao criar prontuário.", exc=e)
        except Exception as e:
            return api_error(500, "Erro ao criar prontuário.", exc=e)

    @staticmethod
    def list_prontuarios():  # GET /prontuarios  (opcional)
        try:
            # Se quiser paginação, adicione query params aqui.
            # Por enquanto retornamos mensagem orientativa ou lista vazia.
            return jsonify({"message": "Use /pets/<pet_id>/prontuarios para listar por pet ou POST /prontuarios para criar."}), 200
        except Exception as e:
            return api_error(500, "Erro ao listar prontuários.", exc=e)

    @staticmethod
    def get_prontuario_by_id(pront_id: int):
        try:
            # usa o service para obter (service pode retornar model ou dict)
            p = ProntuarioService.get_prontuario_por_id(int(pront_id))
            # p pode ser modelo ou dict; normalize
            if hasattr(p, "to_dict"):
                return jsonify(p.to_dict()), 200
            return jsonify(p), 200
        except LookupError as e:
            return api_error(404, str(e), exc=e)
        except Exception as e:
            return api_error(500, "Erro ao obter prontuário.", exc=e)

    @staticmethod
    def get_prontuarios_por_pet(pet_id: int):
        try:
            uid = current_user_id()
            pronts = ProntuarioService.get_prontuarios_por_pet(pet_id)
            # pronts é lista de modelos; converter para dicts se necessário
            out = []
            for p in pronts:
                if hasattr(p, "to_dict"):
                    out.append(p.to_dict())
                else:
                    out.append(p)
            return jsonify({"prontuarios": out}), 200
        except LookupError as e:
            return api_error(404, str(e), exc=e)
        except Exception as e:
            return api_error(500, "Erro ao listar prontuários.", exc=e)

    @staticmethod
    def update_prontuario(pront_id: int):
        try:
            uid = current_user_id()
            data = request.get_json(silent=True) or {}

            # Normaliza chaves esperadas
            payload = {}
            if "anamnese" in data: payload["anamnese"] = data.get("anamnese")
            if "diagnostico" in data: payload["diagnostico"] = data.get("diagnostico")
            if "tratamento" in data: payload["tratamento"] = data.get("tratamento")
            if "vet_id" in data: payload["vet_id"] = data.get("vet_id")
            if "pet_id" in data: payload["pet_id"] = data.get("pet_id")
            if "agendamento_id" in data: payload["agendamento_id"] = data.get("agendamento_id")
            if "consulta_id" in data: payload["consulta_id"] = data.get("consulta_id")

            pront = ProntuarioService.update_prontuario(pront_id, payload, user_id=uid)
            # pront é modelo; garantir retorno JSON
            if hasattr(pront, "to_dict"):
                return jsonify(pront.to_dict()), 200
            return jsonify(pront), 200
        except ValueError as e:
            return api_error(400, str(e), exc=e)
        except LookupError as e:
            return api_error(404, str(e), exc=e)
        except PermissionError as e:
            return api_error(403, str(e), exc=e)
        except SQLAlchemyError as e:
            return api_error(500, "Erro de banco ao atualizar prontuário.", exc=e)
        except Exception as e:
            return api_error(500, "Erro ao atualizar prontuário.", exc=e)
