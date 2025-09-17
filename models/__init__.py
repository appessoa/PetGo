# models/__init__.py
from .userModel import User
from .petsModel import Pet
from .vacinaModel import Vaccine
from .consultasModel import Consultation
from .produtoModel import produto
from .pedidoModel import Order

__all__ = [
    "User", "Pet", "Vaccine", "Consultation", "produto", "Order"
]
