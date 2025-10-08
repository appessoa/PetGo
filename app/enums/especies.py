from enum import Enum, unique


@unique  # garante que não há valores duplicados
class Especies(Enum):
    GATO = "Gato"
    CACHORRO = 'Cachorro',
    AVES = 'Aves',
    TODOS = 'Todos'