const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('./')); 
app.use('/img', express.static(path.join(__dirname, 'img')));

// Koneksi ke Database Baru (Pastikan nama ini unik untuk proyek SIJA)
mongoose.connect('mongodb://localhost:27017/sija_pinjam_db')
  .then(() => {
    console.log('Koneksi MongoDB SIJA Berhasil!');
    seedDatabase(); 
  })
  .catch(err => console.error('Koneksi Gagal:', err));

// Perbarui Schema User agar bisa menampung NIS dan Email dari form
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    nis: String,   // Tambahkan NIS
    email: String, // Tambahkan Email
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

const User = mongoose.model('User', userSchema);

// Schema Barang
const itemSchema = new mongoose.Schema({
  name: String,
  img: String,
  description: String,
  quantity: Number,
});
const Item = mongoose.model('Item', itemSchema);

// Schema Peminjaman
const loanSchema = new mongoose.Schema({
    itemName: String,
    borrowerName: String,
    className: String,
    quantity: Number,
    date: { type: Date, default: Date.now }
});
const Loan = mongoose.model('Loan', loanSchema);

// Fungsi Seeding Otomatis
async function seedDatabase() {
  try {
    const count = await Item.countDocuments();
    if (count === 0) {
      const data = fs.readFileSync('./items.json', 'utf-8');
      const items = JSON.parse(data);
      await Item.insertMany(items);
      console.log('Database Berhasil Diisi dari items.json!');
    }
  } catch (err) {
    console.error('Gagal seeding:', err);
  }
}

// Fungsi Seeding Akun Admin Otomatis
async function seedDatabase() {
    // ... kode seeding barang yang sudah ada ...

    // Tambahkan Akun Admin Otomatis
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
        await User.create({
            username: 'adminlab',
            password: 'password123', // Silakan ganti sesuai keinginan
            role: 'admin'
        });
        console.log('Akun Admin berhasil dibuat: adminlab / password123');
    }
}

// ENDPOINT: Proses Peminjaman (Kunci Utama)
app.post('/api/borrow', async (req, res) => {
    try {
        const { item, nama, kelas, jumlah } = req.body;
        
        // Gunakan trim() untuk menghapus spasi tak sengaja dan regex untuk mengabaikan huruf besar/kecil
        const dataBarang = await Item.findOne({ 
            name: { $regex: new RegExp("^" + item.trim() + "$", "i") } 
        });

        if (!dataBarang) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan di database' });
        }

        if (dataBarang.quantity < jumlah) {
            return res.status(400).json({ success: false, message: 'Stok tidak mencukupi' });
        }

        // Simpan Loan & Update Stok
        const newLoan = new Loan({ itemName: dataBarang.name, borrowerName: nama, className: kelas, quantity: jumlah });
        await newLoan.save();
        await Item.updateOne({ _id: dataBarang._id }, { $inc: { quantity: -jumlah } });

        res.json({ success: true, message: 'Peminjaman Berhasil!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- FITUR REGISTER ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Username sudah terdaftar!" });
        }

        const newUser = new User({ username, password, role: role || 'user' });
        await newUser.save();
        res.json({ success: true, message: "Akun berhasil dibuat!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- FITUR LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Mencari user yang username-nya cocok ATAU email-nya cocok
        const user = await User.findOne({ 
            $or: [{ username: username }, { email: username }], 
            password: password 
        });

        if (user) {
            res.json({ success: true, role: user.role, username: user.username });
        } else {
            res.status(401).json({ success: false, message: "Akun tidak ditemukan!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Error Server" });
    }
});

// Endpoint untuk melihat profil (Membaca data dari DB)
app.get('/api/me/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
        
        // Mengirimkan data user (kecuali password demi keamanan)
        res.json({
            username: user.username,
            email: user.email,
            role: user.role,
            nis: user.nis
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));