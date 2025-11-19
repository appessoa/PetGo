# services/address_service.py
from typing import List, Optional
from datetime import datetime
from config.db import db
from models.userModel import User
from models.enderecoModel import Address

class AddressService:

    @staticmethod
    def _compose_full_address(data: dict) -> str:
        """Monta o full_adress"""
        parts = []
        if data.get("logradouro"):
            log = data["logradouro"]
            if data.get("numero"):
                log += f", {data['numero']}"
            parts.append(log)
        if data.get("complemento"):
            parts.append(data["complemento"])
        if data.get("bairro"):
            parts.append(data["bairro"])
        if data.get("cidade"):
            parts.append(data["cidade"])
        if data.get("estado"):
            parts.append(data["estado"])
        if data.get("cep"):
            parts.append(f"CEP {data['cep']}")
        if data.get("pais"):
            parts.append(data["pais"])
            return " - ".join(parts)
    @staticmethod
    def list_by_user(user_id: int) -> List[Address]:
        return Address.query.filter_by(user_id=user_id).order_by(Address.is_primary.desc(), Address.created_at.desc()).all()

    @staticmethod
    def get(user_id: int, addr_id: int) -> Address:
        return Address.query.filter_by(id_address=addr_id, user_id=user_id).first_or_404()

    @staticmethod
    def create(user_id: int, data: dict) -> Address:
        user = User.query.get_or_404(user_id)
        addr = Address(
            user_id=user.id_user,
            cep=data.get("cep"),
            logradouro=data.get("logradouro"),
            numero=data.get("numero"),
            complemento=data.get("complemento"),
            bairro=data.get("bairro"),
            cidade=data.get("cidade"),
            estado=data.get("estado"),
            pontoRef = data.get("pontoRef"),
            pais=data.get("pais") or "BR",
            full_address= AddressService._compose_full_address(data),
            is_primary=bool(data.get("is_primary", True)),
        )

        if addr.is_primary:
            # desmarca os outros como principal
            for a in user.addresses:
                a.is_primary = False

        db.session.add(addr)
        db.session.commit()
        return addr

    @staticmethod
    def update(user_id: int, addr_id: int, data: dict) -> Address:
        addr = AddressService.get(user_id, addr_id)

        # atualiza apenas os campos enviados (exceto full_address)
        for field in ["cep", "logradouro", "numero", "complemento",
                    "bairro", "cidade", "estado", "pais"]:
            if field in data:
                setattr(addr, field, data[field])

        # tratar is_primary
        if "is_primary" in data:
            want_primary = bool(data["is_primary"])
            if want_primary and not addr.is_primary:
                # desmarca os demais do usuário
                Address.query.filter(
                    Address.user_id == user_id,
                    Address.id_address != addr.id_address
                ).update({"is_primary": False})
                addr.is_primary = True
            elif not want_primary and addr.is_primary:
                # impedir que usuário fique sem nenhum principal
                other = Address.query.filter(
                    Address.user_id == user_id,
                    Address.id_address != addr.id_address
                ).first()
                if other:
                    addr.is_primary = False
                    other.is_primary = True

        # sempre recalcula o full_address após update
        addr.full_address = AddressService._compose_full_address({
            "cep": addr.cep,
            "logradouro": addr.logradouro,
            "numero": addr.numero,
            "complemento": addr.complemento,
            "bairro": addr.bairro,
            "cidade": addr.cidade,
            "estado": addr.estado,
            "pais": addr.pais,
        })

        addr.updated_at = datetime.utcnow()
        db.session.commit()
        return addr

    @staticmethod
    def set_primary(user_id: int, addr_id: int) -> Address:
        addr = AddressService.get(user_id, addr_id)
        # desmarca os demais
        Address.query.filter(Address.user_id == user_id, Address.id_address != addr.id_address).update({"is_primary": False})
        addr.is_primary = True
        addr.updated_at = datetime.utcnow()
        db.session.commit()
        return addr

    @staticmethod
    def delete(user_id: int, addr_id: int) -> None:
        addr = AddressService.get(user_id, addr_id)
        # se for principal, tenta promover outro
        if addr.is_primary:
            other = Address.query.filter(Address.user_id == user_id, Address.id_address != addr.id_address).order_by(Address.created_at.desc()).first()
            if other:
                other.is_primary = True
        db.session.delete(addr)
        db.session.commit()
