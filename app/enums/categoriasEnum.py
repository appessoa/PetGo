from enum import Enum, unique


@unique  # garante que não há valores duplicados
class Categorias(Enum):
    RACAO = "Ração"
    BRINQUEDO = 'Brinquedo',
    ACESSORIOS = 'Acessório',
    HIGIENE = 'Higiene',
    MEDICAMENTOS = 'Medicamento',
    PETISCO = 'Petisco',
    SACHE = 'Sachê'
