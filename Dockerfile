# Menggunakan Node.js versi 20
FROM node:20-alpine

# Membuat direktori kerja di dalam container
WORKDIR /app

# Menyalin file package.json dan menginstall dependencies
COPY package*.json ./
RUN npm install

# Menyalin seluruh kode (termasuk folder HTML/CSS kamu)
COPY . .

# Mengekspos port (misal kodemu jalan di port 3000)
EXPOSE 3000

# Perintah untuk menjalankan aplikasi
CMD ["npm", "start"]