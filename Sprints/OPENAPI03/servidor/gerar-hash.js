import bcrypt from 'bcryptjs';

const palavraPasse = process.argv[2];

if (!palavraPasse) {
  console.error('Uso: node gerar-hash.js <palavra-passe>');
  process.exit(1);
}

if (palavraPasse.length < 8) {
  console.warn('Aviso: A palavra-passe tem menos de 8 caracteres (requisito mínimo: 8 caracteres).');
}

const hash = bcrypt.hashSync(palavraPasse, 10);
console.log(hash);