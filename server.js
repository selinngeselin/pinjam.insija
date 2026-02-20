const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('./'));
app.use('/img', express.static(path.join(__dirname, 'img')));

// ===== KONEKSI MONGODB =====
mongoose.connect('mongodb://localhost:27017/sija_pinjam_db')
  .then(() => {
    console.log('Koneksi MongoDB SIJA Berhasil!');
    seedDatabase();
  })
  .catch(err => console.error('Koneksi Gagal:', err));


// ============================================================
// ===== SCHEMA & MODEL
// ============================================================

// Schema User (ditambah field profil lengkap)
const userSchema = new mongoose.Schema({
    username:  { type: String, unique: true, required: true },
    password:  { type: String, required: true },
    role:      { type: String, enum: ['user', 'admin'], default: 'user' },
    // Data profil
    nama:      { type: String, default: '' },
    nis:       { type: String, default: '' },
    telepon:   { type: String, default: '' },
    email:     { type: String, default: '' },
    angkatan:  { type: String, default: '' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Schema Barang
const itemSchema = new mongoose.Schema({
    name:        String,
    img:         String,
    description: String,
    quantity:    Number,
});
const Item = mongoose.model('Item', itemSchema);

// Schema Peminjaman (dilengkapi field dari form)
const loanSchema = new mongoose.Schema({
    nama:       { type: String, required: true },
    kelas:      { type: String, required: true },
    barang:     { type: String, required: true },
    durasi:     { type: String, required: true },
    keperluan:  { type: String, required: true },
    status:     { type: String, enum: ['Diproses', 'Disetujui', 'Ditolak', 'Dikembalikan'], default: 'Diproses' },
    username:   { type: String, default: '' }, // untuk filter per user
}, { timestamps: true });

const Loan = mongoose.model('Loan', loanSchema);


// ============================================================
// ===== SEEDING
// ============================================================

async function seedDatabase() {
    try {
        // Seed barang dari items.json
        const itemCount = await Item.countDocuments();
        if (itemCount === 0) {
            if (fs.existsSync('./items.json')) {
                const data = fs.readFileSync('./items.json', 'utf-8');
                const items = JSON.parse(data);
                await Item.insertMany(items);
                console.log('Database Berhasil Diisi dari items.json!');
            }
        }

        // Seed akun admin otomatis
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'adminlab',
                password: 'password123',
                role: 'admin',
                nama: 'Petugas Lab'
            });
            console.log('Akun Admin dibuat: adminlab / password123');
        }
    } catch (err) {
        console.error('Gagal seeding:', err);
    }
}


// ============================================================
// ===== AUTH ENDPOINTS
// ============================================================

// REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar!' });
        }

        const newUser = new User({ username, password, role: role || 'user' });
        await newUser.save();
        res.json({ success: true, message: 'Akun berhasil dibuat!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usernameRegex = new RegExp('^' + username.trim() + '$', 'i');

        // Case-insensitive: cocokkan username atau email
        const user = await User.findOne({
            $or: [
                { username: { $regex: usernameRegex } },
                { email:    { $regex: usernameRegex } }
            ],
            password
        });

        if (user) {
            return res.json({
                success:  true,
                role:     user.role,
                username: user.username,
                nama:     user.nama || user.username
            });
        }

        // Cek apakah username ada tapi password salah
        const userExists = await User.findOne({
            $or: [
                { username: { $regex: usernameRegex } },
                { email:    { $regex: usernameRegex } }
            ]
        });

        if (userExists) {
            return res.status(401).json({ success: false, message: 'Password salah!' });
        } else {
            return res.status(401).json({ success: false, message: 'Akun tidak ditemukan! Silakan register terlebih dahulu.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error Server: ' + err.message });
    }
});


// ============================================================
// ===== PROFIL USER ENDPOINTS
// ============================================================

// GET profil user
app.get('/api/profil/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        res.json({
            success:  true,
            username: user.username,
            nama:     user.nama,
            nis:      user.nis,
            telepon:  user.telepon,
            email:    user.email,
            angkatan: user.angkatan,
            role:     user.role
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// UPDATE profil user
app.put('/api/profil/:username', async (req, res) => {
    try {
        const { nama, nis, telepon, email, angkatan } = req.body;

        const user = await User.findOneAndUpdate(
            { username: req.params.username },
            { nama, nis, telepon, email, angkatan },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        res.json({ success: true, message: 'Profil berhasil disimpan!', data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ============================================================
// ===== PEMINJAMAN ENDPOINTS
// ============================================================

// POST - Ajukan peminjaman baru (dari form peminjaman.html)
app.post('/api/loans', async (req, res) => {
    try {
        const { nama, kelas, barang, durasi, keperluan, username } = req.body;

        if (!nama || !kelas || !barang || !durasi || !keperluan) {
            return res.status(400).json({ success: false, message: 'Semua field wajib diisi!' });
        }

        const newLoan = new Loan({ nama, kelas, barang, durasi, keperluan, username: username || '' });
        await newLoan.save();

        res.json({ success: true, message: 'Peminjaman berhasil diajukan!', data: newLoan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET - Semua peminjaman (untuk admin.html)
app.get('/api/loans', async (req, res) => {
    try {
        const loans = await Loan.find().sort({ createdAt: -1 });
        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET - Peminjaman per user (untuk riwayat.html)
app.get('/api/loans/user/:username', async (req, res) => {
    try {
        const loans = await Loan.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT - Update status peminjaman (dari admin.html)
app.put('/api/loans/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatus = ['Diproses', 'Disetujui', 'Ditolak', 'Dikembalikan'];

        if (!validStatus.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid!' });
        }

        const loan = await Loan.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!loan) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

        res.json({ success: true, message: 'Status berhasil diupdate!', data: loan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE - Hapus data peminjaman
app.delete('/api/loans/:id', async (req, res) => {
    try {
        await Loan.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Data berhasil dihapus!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ============================================================
// ===== BARANG ENDPOINTS
// ============================================================

// GET semua barang
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST peminjaman barang (kurangi stok)
app.post('/api/borrow', async (req, res) => {
    try {
        const { item, nama, kelas, jumlah } = req.body;

        const dataBarang = await Item.findOne({
            name: { $regex: new RegExp('^' + item.trim() + '$', 'i') }
        });

        if (!dataBarang) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
        }

        if (dataBarang.quantity < jumlah) {
            return res.status(400).json({ success: false, message: 'Stok tidak mencukupi' });
        }

        await Item.updateOne({ _id: dataBarang._id }, { $inc: { quantity: -jumlah } });

        res.json({ success: true, message: 'Stok berhasil diupdate!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ===== JALANKAN SERVER =====
app.listen(3000, () => console.log('✅ Server berjalan di http://localhost:3000'));
