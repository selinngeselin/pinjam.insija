const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs'); // <--- TAMBAHKAN INI
const app = express();
const path = require('path');

// Pastikan baris ini ada agar folder 'img' bisa diakses browser
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use(express.static(__dirname)); 

app.use(express.json());
app.use(express.static('./'));

// 1. KONEKSI KE MONGODB
mongoose.connect('mongodb://localhost:27017/pinjamin_db')
  .then(() => {
    console.log('Koneksi MongoDB Berhasil!');
    seedDatabase(); // <--- PANGGIL FUNGSI SEEDING DI SINI
  })
  .catch(err => console.error('Koneksi Gagal:', err));

// 2. SCHEMA
const itemSchema = new mongoose.Schema({
  name: String,      // Sesuaikan dengan kunci di items.json ("name")
  img: String,
  description: String,
  quantity: Number,
});

const Item = mongoose.model('Item', itemSchema);

// Schema untuk menyimpan data peminjaman
const loanSchema = new mongoose.Schema({
    itemName: String,
    borrowerName: String,
    className: String,
    quantity: Number,
    date: { type: Date, default: Date.now }
});

const Loan = mongoose.model('Loan', loanSchema);

// 1. Definisikan Schema untuk User
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

// 2. BUAT MODEL USER (Baris ini yang memperbaiki error "User is not defined")
const User = mongoose.model('User', userSchema);

// --- TAMBAHKAN FUNGSI OTOMATISASI DI SINI ---
async function seedDatabase() {
  try {
    const count = await Item.countDocuments();
    if (count === 0) {
      // Membaca file items.json yang ada di folder proyekmu
      const data = fs.readFileSync('./items.json', 'utf-8');
      const items = JSON.parse(data);
      
      await Item.insertMany(items);
      console.log('Data awal dari items.json berhasil dimasukkan ke MongoDB!');
    } else {
      console.log('Database sudah terisi, melewati proses seeding.');
    }
  } catch (err) {
    console.error('Gagal memasukkan data awal:', err);
  }
}
// --------------------------------------------

// 3. ROUTE UNTUK MENGAMBIL DATA
app.get('/api/items/:name', async (req, res) => {
    try {
        const item = await Item.findOne({ name: req.params.name });
        if (!item) return res.status(404).send('Item tidak ditemukan');
        res.json(item);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Endpoint tambahan untuk dashboard (mengambil semua barang)
app.get('/api/all-items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- FITUR ADMIN: MENGAMBIL SEMUA DAFTAR PEMINJAMAN ---
app.get('/api/loans', async (req, res) => {
    try {
        const loans = await Loan.find().sort({ date: -1 }); // Urutkan dari yang terbaru
        res.json(loans);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data peminjaman.' });
    }
});

// --- FITUR ADMIN: MENANDAI BARANG SUDAH DIKEMBALIKAN & TAMBAH STOK ---
app.put('/api/return-item/:loanId', async (req, res) => {
    try {
        const { itemName, quantity } = req.body; // Ambil itemName dan quantity dari body

        // 1. Update status peminjaman menjadi 'Sudah Dikembalikan'
        const updatedLoan = await Loan.findByIdAndUpdate(
            req.params.loanId,
            { status: 'Sudah Dikembalikan' },
            { new: true }
        );

        if (!updatedLoan) {
            return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan.' });
        }

        // 2. Tambahkan stok barang kembali ke koleksi 'items'
        // Mencari barang berdasarkan 'name' dan menambahkan 'quantity'
        await Item.findOneAndUpdate(
            { name: itemName }, 
            { $inc: { quantity: parseInt(quantity) } } // Menambah (+) stok
        );

        res.json({ success: true, message: 'Barang berhasil dikembalikan dan stok diperbarui.' });
    } catch (err) {
        console.error("Error returning item:", err);
        res.status(500).json({ success: false, message: 'Gagal memproses pengembalian barang.' });
    }
});

//FITUR: PROSES PEMINJAMAN BARANG (DENGAN VALIDASI STOK)

app.post('/api/borrow', async (req, res) => {
    try {
        const { item, nama, kelas, jumlah } = req.body;
        const jumlahPinjam = parseInt(jumlah);

        // 1. VALIDASI: JANGAN BOLEH PINJAM 0 ATAU NEGATIF
        if (jumlahPinjam <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Jumlah pinjaman minimal adalah 1 unit!' 
            });
        }

        // 2. CEK STOK TERLEBIH DAHULU
        const dataBarang = await Item.findOne({ name: item });
        if (!dataBarang) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
        }

        // 3. VALIDASI: JANGAN BOLEH PINJAM MELEBIHI STOK YANG ADA
        if (jumlahPinjam > dataBarang.quantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Stok tidak mencukupi! Hanya tersedia ${dataBarang.quantity} unit.` 
            });
        }

        // 4. SIMPAN RIWAYAT PEMINJAMAN
        const newLoan = new Loan({
            itemName: item,
            borrowerName: nama,
            className: kelas,
            quantity: jumlahPinjam
        });
        await newLoan.save();

        // 5. KURANGI STOK
        await Item.findOneAndUpdate(
            { name: item }, 
            { $inc: { quantity: -jumlahPinjam } }
        );

        res.json({ success: true, message: 'Peminjaman berhasil!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error server: ' + err.message });
    }
});

// --- FITUR REGISTER ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // Cek apakah username sudah ada
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Username sudah terdaftar!" });
        }

        const newUser = new User({ username, password, role });
        await newUser.save();
        res.json({ success: true, message: "Akun berhasil dibuat!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- FITUR LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // Cari user berdasarkan username, password, dan role
        const user = await User.findOne({ username, password, role });
        
        if (user) {
            res.json({ 
                success: true, 
                username: user.username, 
                role: user.role 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "Username, Password, atau Role salah!" 
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
app.listen(3000, () => console.log('Server running on port 3000'));