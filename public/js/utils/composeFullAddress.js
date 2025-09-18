export function composeFullAddress(addr){
  if(!addr) return '';
  const parts = [];
  if(addr.logradouro){
    parts.push(addr.numero ? `${addr.logradouro}, ${addr.numero}` : addr.logradouro);
  }
  if(addr.complemento) parts.push(addr.complemento);
  if(addr.bairro)      parts.push(addr.bairro);
  if(addr.cidade)      parts.push(addr.cidade);
  if(addr.estado)      parts.push(addr.estado);
  if(addr.cep)         parts.push(`CEP ${addr.cep}`);
  if(addr.pais)        parts.push(addr.pais);
  return parts.filter(Boolean).join(' - ');
}
