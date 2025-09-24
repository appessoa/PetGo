# models/__init__.py
from .userModel import User
from .petsModel import Pet
from .vacinaModel import Vaccine
from .consultasModel import Consultation
from .produtoModel import produto
from .pedidoModel import Order
from .veterinarioModel import veterinarianModel
from .enderecoModel import Address
from .agendamentoModel import Scheduling
from .adocaoformularioModel import AdoptionApplication

__all__ = [
    "User", "Pet", "Vaccine", "Consultation", "produto", "Order","veterinarianModel","Address","Scheduling","AdoptionApplication"
]
