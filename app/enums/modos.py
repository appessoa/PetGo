
from enum import Enum, unique


@unique  # garante que não há valores duplicados
class modos(Enum):
    INCLUIR = 'inc'
    SETAR = 'set'    
    REMOVER = 'REMOVER'
