from datetime import datetime
from config.db import db

class AdoptionApplication(db.Model):
    """
    Representa a aplicação de adoção do usuário (preferências + motivação).
    Pode (opcionalmente) apontar para um pet específico.
    """
    __tablename__ = "adoption_applications"

    id_adoption_applications = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # relacionamento obrigatório
    id_user = db.Column(db.Integer, db.ForeignKey("users.id_user"), nullable=False, index=True)

    # opcional: quando a aplicação é para um pet específico
    id_pet = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=True, index=True)

    # preferências escolhidas no formulário
    tipo_pet = db.Column(db.String(20), nullable=True)            # "Gato" | "Cachorro"
    residencia_tipo = db.Column(db.String(20), nullable=False)    # "Casa" | "Apartamento"
    telas_protecao = db.Column(db.Boolean, nullable=True)         # required se residencia_tipo = "Apartamento"

    sociabilidade = db.Column(db.Integer, nullable=False)         # 1..3
    brincadeira   = db.Column(db.Integer, nullable=False)         # 1..3
    carinho       = db.Column(db.Integer, nullable=False)         # 1..3

    motivo = db.Column(db.Text, nullable=False)                   # textarea "motivo"

    status = db.Column(db.String(20), nullable=False, default="aberta")
    # aberta | em_avaliacao | aprovada | rejeitada | cancelada

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted = db.Column(db.Boolean, default=False, nullable=False)  # soft delete

    __table_args__ = (
        db.Index("ix_adopt_user_status", "id_user", "status"),
    )

    def to_dict(self):
        return {
            "id_adoption_applications": self.id_adoption_applications,
            "id_user": self.id_user,
            "id_pet": self.id_pet,
            "tipo_pet": self.tipo_pet,
            "residencia_tipo": self.residencia_tipo,
            "telas_protecao": self.telas_protecao,
            "sociabilidade": self.sociabilidade,
            "brincadeira": self.brincadeira,
            "carinho": self.carinho,
            "motivo": self.motivo,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
