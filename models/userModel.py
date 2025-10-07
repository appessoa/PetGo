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
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Boolean, default=False)  # soft delete
    

    # Relacionamento 1:N com Pet
    pets = db.relationship(
        "Pet",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin"  # carrega eficiente p/ listas
    )

    addresses = db.relationship(
        "Address",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    carts = db.relationship(
        "Cart",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # Índices úteis 
    __table_args__ = (
        db.Index("ix_users_username", "username"),
        db.Index("ix_users_email", "email"),
    )

    @property
    def primary_address(self):
        if not self.addresses:
            return None
        # prioriza o marcado como principal; senão, o mais recente
        prim = next((a for a in self.addresses if a.is_primary), None)
        return prim or sorted(self.addresses, key=lambda a: a.created_at or datetime.min, reverse=True)[0]


    def to_safe_dict(self):
        data = {
            "id": self.id_user,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.primary_address:
            data["address"] = self.primary_address.to_dict()
        else:
            data["address"] = None
        return data


    def __repr__(self) -> str:  # debug 
        return f"<User id={self.id_user} username={self.username!r}>"
