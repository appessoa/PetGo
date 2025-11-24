from datetime import datetime
from config.db import db

class Address(db.Model):
    __tablename__ = "addresses"

    id_address = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id_user", ondelete="CASCADE"), nullable=False)

    # Campos granulares (mantém compatível com o formulário por CEP)
    cep = db.Column(db.String(9), nullable=True)
    logradouro = db.Column(db.String(200), nullable=True)   # rua/avenida
    numero = db.Column(db.String(16), nullable=True)
    complemento = db.Column(db.String(120), nullable=True)
    pontoRef = db.Column(db.String(200), nullable= True)
    nomeEntrega = db.Column(db.String(200), nullable= True)
    bairro = db.Column(db.String(120), nullable=True)
    cidade = db.Column(db.String(120), nullable=True)
    estado = db.Column(db.String(2), nullable=True)         # UF
    pais = db.Column(db.String(2), nullable=False, default="BR")

    # Conveniência para casos onde você já tem uma string única
    full_address = db.Column(db.String(255), nullable=True)

    is_primary = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Integer, default= False)
    # Índices
    __table_args__ = (
        db.Index("ix_addresses_user_id", "user_id"),
        db.Index("ix_addresses_cep", "cep"),
    )

    user = db.relationship("User", back_populates="addresses")

    def to_dict(self):
        return {
            "id": self.id_address,
            "user_id": self.user_id,
            "cep": self.cep,
            "logradouro": self.logradouro,
            "numero": self.numero,
            "complemento": self.complemento,
            "bairro": self.bairro,
            "pontoRef": self.pontoRef,
            "nomeEntrega": self.nomeEntrega,
            "cidade": self.cidade,
            "estado": self.estado,
            "pais": self.pais,
            "full_address": self.full_address,
            "is_primary": self.is_primary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
