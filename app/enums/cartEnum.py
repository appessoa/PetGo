from enum import Enum, unique


@unique  # garante que não há valores duplicados
class CartStatus(Enum):
    ABERTO = "aberto"
    FECHADO = "fechado"
    CONVERTIDO = "convertido"
    ABANDONADO = "abandonado"