from datetime import datetime
from config.db import db

class User(db.Model):
    """ Modelo para tabela de usuários
    
    id_user: int - PK
    username: str - Nome de usuário
    nome: str - Nome completo do usuário
    numero: str - Número de telefone do usuário
    cpf: str - CPF do usuário
    endereco: str - Endereço do usuário
    email: str - Email do usuário
    password: str - Hash da senha do usuário
    created_at: datetime - Timestamp de criação do registro
    updated_at: datetime - Timestamp da última atualização do registro
    is_active: bool - Indica se o usuário está ativo
    """
    __tablename__ = 'users'

    id_user = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    nome = db.Column(db.Text, nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    cpf = db.Column(db.String(14), nullable=True)
    endereco = db.Column(db.String(255), nullable=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Relacionamento 1:N com Pet
    pets = db.relationship(
        "Pet",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin"  # carrega eficiente p/ listas
    )

    # Índices úteis 
    __table_args__ = (
        db.Index("ix_users_username", "username"),
        db.Index("ix_users_email", "email"),
    )

    def to_safe_dict(self):
        """Representação segura do usuário (sem senha)."""
        return {
            "id": self.id_user,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:  # debug amigável
        return f"<User id={self.id_user} username={self.username!r}>"
