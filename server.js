const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // ✅ BARU: npm install node-cron
const app = express();

app.use(express.json());
app.use(express.static('./'));
app.use('/img', express.static(path.join(__dirname, 'img')));

// ===== KONEKSI MONGODB =====
// Mengambil URL dari environment Docker, jika tidak ada pakai localhost
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/sija_pinjam_db';

mongoose.connect(mongoURI)
  .then(() => {
    console.log('Koneksi MongoDB SIJA Berhasil!');
    seedDatabase();
    startCronJob(); // ✅ BARU: jalankan cron setelah koneksi berhasil
  })
  .catch(err => console.error('Koneksi Gagal:', err));


// ============================================================
// ===== SCHEMA & MODEL
// ============================================================

const userSchema = new mongoose.Schema({
    username:  { type: String, unique: true, required: true },
    password:  { type: String, required: true },
    role:      { type: String, enum: ['user', 'admin'], default: 'user' },
    nama:      { type: String, default: '' },
    nis:       { type: String, default: '' },
    telepon:   { type: String, default: '' },
    email:     { type: String, default: '' },
    angkatan:  { type: String, default: '' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const itemSchema = new mongoose.Schema({
    name:        String,
    img:         String,
    description: String,
    quantity:    Number,
});
const Item = mongoose.model('Item', itemSchema);

// ✅ Ditambah status 'Pengajuan Kembali' + field deadlineAt (BARU)
const loanSchema = new mongoose.Schema({
    nama:       { type: String, required: true },
    kelas:      { type: String, required: true },
    barang:     { type: String, required: true },
    durasi:     { type: String, required: true },
    keperluan:  { type: String, required: true },
    status:     { type: String, enum: ['Diproses', 'Disetujui', 'Ditolak', 'Dikembalikan', 'Pengajuan Kembali'], default: 'Diproses' },
    username:   { type: String, default: '' },
    deadlineAt: { type: Date, default: null }, // ✅ BARU: batas waktu pengembalian
}, { timestamps: true });

const Loan = mongoose.model('Loan', loanSchema);


// ============================================================
// ===== SEEDING
// ============================================================

async function seedDatabase() {
    try {
        const itemCount = await Item.countDocuments();
        if (itemCount === 0) {
            if (fs.existsSync('./items.json')) {
                const data = fs.readFileSync('./items.json', 'utf-8');
                const items = JSON.parse(data);
                await Item.insertMany(items);
                console.log('Database Berhasil Diisi dari items.json!');
            }
        }

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
// ===== ✅ BARU: CRON JOB — Cek deadline setiap menit
// ============================================================

function startCronJob() {
    cron.schedule('* * * * *', async () => {
        try {
            const sekarang = new Date();

            // Cari peminjaman Disetujui yang sudah melewati deadline
            const kadaluarsa = await Loan.find({
                status:     'Disetujui',
                deadlineAt: { $lte: sekarang, $ne: null }
            });

            if (kadaluarsa.length === 0) return;

            console.log(`[CRON] ${kadaluarsa.length} peminjaman kadaluarsa, memproses...`);

            for (const loan of kadaluarsa) {
                // Ubah status jadi Dikembalikan
                await Loan.findByIdAndUpdate(loan._id, { status: 'Dikembalikan', deadlineAt: null });

                // Tambah stok barang otomatis
                await Item.updateOne(
                    { name: { $regex: new RegExp('^' + loan.barang.trim() + '$', 'i') } },
                    { $inc: { quantity: 1 } }
                );

                console.log(`[CRON] "${loan.barang}" oleh ${loan.nama} — otomatis dikembalikan, stok +1`);
            }
        } catch (err) {
            console.error('[CRON] Error:', err.message);
        }
    });

    console.log('✅ Cron job aktif — pengecekan deadline setiap menit');
}


// ============================================================
// ===== AUTH ENDPOINTS
// ============================================================

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

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usernameRegex = new RegExp('^' + username.trim() + '$', 'i');

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

app.get('/api/loans', async (req, res) => {
    try {
        const loans = await Loan.find().sort({ createdAt: -1 });
        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/loans/user/:username', async (req, res) => {
    try {
        const loans = await Loan.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ Ditambah 'Pengajuan Kembali' ke validStatus
// ✅ BARU: Set deadlineAt otomatis saat status diubah ke Disetujui
app.put('/api/loans/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatus = ['Diproses', 'Disetujui', 'Ditolak', 'Dikembalikan', 'Pengajuan Kembali'];

        if (!validStatus.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid!' });
        }

        let updateData = { status };

        // ✅ BARU: Set deadlineAt berdasarkan durasi (hari) saat disetujui
        if (status === 'Disetujui') {
            const loan = await Loan.findById(req.params.id);
            if (loan) {
                const durasiHari      = parseInt(loan.durasi) || 1;
                const deadline        = new Date();
                deadline.setDate(deadline.getDate() + durasiHari);
                updateData.deadlineAt = deadline;
            }
        }

        // ✅ BARU: Hapus deadline saat dikembalikan atau ditolak
        if (status === 'Dikembalikan' || status === 'Ditolak') {
            updateData.deadlineAt = null;
        }

        const loan = await Loan.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!loan) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

        res.json({ success: true, message: 'Status berhasil diupdate!', data: loan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

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

app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Kurangi stok saat peminjaman
app.post('/api/borrow', async (req, res) => {
    try {
        const { item, jumlah } = req.body;

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

        res.json({ success: true, message: 'Stok berhasil dikurangi!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ BARU: Tambah stok saat barang dikembalikan (dikonfirmasi admin)
app.post('/api/return', async (req, res) => {
    try {
        const { item, jumlah } = req.body;

        const dataBarang = await Item.findOne({
            name: { $regex: new RegExp('^' + item.trim() + '$', 'i') }
        });

        if (!dataBarang) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
        }

        await Item.updateOne({ _id: dataBarang._id }, { $inc: { quantity: jumlah } });

        res.json({ success: true, message: 'Stok berhasil ditambah!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ===== JALANKAN SERVER =====
app.listen(3000, () => console.log('✅ Server berjalan di http://localhost:3000'));
