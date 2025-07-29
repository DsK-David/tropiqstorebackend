# Tropiq Store Backend

## Instalação

1. Instalar dependências:
```bash
cd backend
npm install
```

2. Configurar PostgreSQL:
- Instalar PostgreSQL
- Criar banco: `tropiq_store`
- Executar o arquivo `database.sql`

3. Configurar variáveis (.env):
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=tropiq_store
```

4. Executar:
```bash
npm run dev
```

A API estará disponível em http://localhost:3001