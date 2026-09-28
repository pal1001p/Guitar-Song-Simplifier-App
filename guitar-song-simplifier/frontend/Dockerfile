FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Install optional native packages for this Linux image.
# Lockfiles generated on macOS often omit linux lightningcss/SWC binaries
# (https://github.com/npm/cli/issues/4828), which breaks next/font.
RUN npm install --include=optional

COPY . .

EXPOSE 3000

# Reinstall on start so an old Docker volume cannot keep Darwin/Alpine binaries.
CMD ["sh", "-c", "npm install --include=optional && npm run dev"]
