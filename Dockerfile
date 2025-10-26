# Dockerfile para Abelinha-V2

# 1. Imagem Base: Usa uma versão LTS (Long Term Support) do Node.js, variante slim.
# Escolha a versão LTS mais recente que seu código suporta (ex: 20 ou 22).
# Usaremos 20-slim como um exemplo seguro.
FROM node:20-slim

# 2. Define o diretório de trabalho dentro do container
WORKDIR /app

# 3. Copia APENAS os arquivos de dependência primeiro
# Isso aproveita o cache do Docker. Se esses arquivos não mudarem,
# o passo 'npm ci' não precisará ser refeito em builds futuros.
COPY package.json package-lock.json* ./

# 4. Instala as dependências de produção
# 'npm ci' é mais rápido e seguro para builds, usando o package-lock.json.
# '--only=production' ignora devDependencies que não são necessárias no container final.
RUN npm ci --omit=dev

# 5. Copia o RESTANTE do código da aplicação para o diretório de trabalho (/app)
# Certifique-se de ter um arquivo .dockerignore bem configurado!
COPY . .

# 6. Cria os diretórios para os volumes persistentes DENTRO do container
# O Docker ou o Render irão "montar" os volumes nestes locais.
# Também garante que o usuário 'node' (criado pela imagem base) tenha permissão.
RUN mkdir -p /app/auth_info_baileys /app/data && chown node:node /app/auth_info_baileys /app/data

# 7. Muda para o usuário não-root 'node' (Boas práticas de segurança)
USER node

# 8. Define o comando padrão para iniciar o bot quando o container rodar
CMD ["node", "index.js"]