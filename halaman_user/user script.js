// Pastikan DOM sudah loaded sebelum menjalankan script
document.addEventListener('DOMContentLoaded', function() {
    console.log('Script loaded successfully!'); // Untuk debugging
    
    // ========================================
    // 1. HANDLE FORM SUBMIT (TOMBOL SIMPAN)
    // ========================================
    const form = document.getElementById('userProfileForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Form submitted!'); // Debugging
            
            // Ambil data dari form
            const formData = {
                nama: document.getElementById('nama').value,
                nis: document.getElementById('nis').value,
                telepon: document.getElementById('telepon').value,
                email: document.getElementById('email').value,
                angkatan: document.getElementById('angkatan').value
            };
            
            console.log('Data yang disimpan:', formData); // Debugging
            
            // Simpan ke localStorage
            localStorage.setItem('userData', JSON.stringify(formData));
            
            // Tampilkan data di halaman informasi
            showUserInfo(formData);
            
            // Show success message
            alert('✓ Data profil berhasil disimpan!');
        });
    }
    
    // ========================================
    // 2. HANDLE TOMBOL BATAL
    // ========================================
    const batalBtn = document.getElementById('batalBtn');
    if (batalBtn) {
        batalBtn.addEventListener('click', function() {
            console.log('Tombol Batal diklik!'); // Debugging
            resetUserForm();
        });
    }
    
    // ========================================
    // 3. HANDLE TOMBOL EDIT PROFIL
    // ========================================
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            console.log('Tombol Edit diklik!'); // Debugging
            editProfile();
        });
    }
    
    // ========================================
    // 4. HANDLE MENU RIWAYAT
    // ========================================
    const riwayatMenu = document.getElementById('riwayatMenu');
    if (riwayatMenu) {
        riwayatMenu.addEventListener('click', function() {
            console.log('Menu Riwayat diklik!'); // Debugging
            showHistory();
        });
    }
    
    // ========================================
    // 5. LOAD DATA TERSIMPAN SAAT HALAMAN DIBUKA
    // ========================================
    loadSavedData();
});

// ========================================
// FUNCTION: Tampilkan Halaman Informasi
// ========================================
function showUserInfo(data) {
    // Update info values
    document.getElementById('infoNama').textContent = data.nama;
    document.getElementById('infoNis').textContent = data.nis;
    document.getElementById('infoTelepon').textContent = data.telepon;
    document.getElementById('infoEmail').textContent = data.email;
    document.getElementById('infoAngkatan').textContent = data.angkatan;
    
    // Update user profile header
    const headerName = document.getElementById('headerUserName');
    if (headerName) {
        headerName.textContent = data.nama;
    }
    
    // Update avatar dengan inisial
    const avatar = document.querySelector('.user-avatar');
    if (avatar) {
        const initials = data.nama.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatar.textContent = initials;
    }
    
    // Hide form, show info
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('infoSection').style.display = 'block';
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// FUNCTION: Kembali ke Form Edit
// ========================================
function editProfile() {
    document.getElementById('formSection').style.display = 'block';
    document.getElementById('infoSection').style.display = 'none';
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// FUNCTION: Reset Form
// ========================================
function resetUserForm() {
    if (confirm('Apakah Anda yakin ingin membatalkan perubahan?')) {
        // Reset ke data tersimpan atau data default
        const savedData = localStorage.getItem('userData');
        if (savedData) {
            const data = JSON.parse(savedData);
            document.getElementById('nama').value = data.nama;
            document.getElementById('nis').value = data.nis;
            document.getElementById('telepon').value = data.telepon;
            document.getElementById('email').value = data.email;
            document.getElementById('angkatan').value = data.angkatan;
        } else {
            document.getElementById('userProfileForm').reset();
        }
        alert('Perubahan dibatalkan!');
    }
}

// ========================================
// FUNCTION: Tampilkan Riwayat
// ========================================
function showHistory() {
    alert('Fitur Riwayat akan segera hadir!\n\nAnda akan diarahkan ke halaman riwayat.');
    // Uncomment jika sudah ada halaman riwayat:
    // window.location.href = 'riwayat.html';
}

// ========================================
// FUNCTION: Load Data Tersimpan
// ========================================
function loadSavedData() {
    const savedData = localStorage.getItem('userData');
    if (savedData) {
        const data = JSON.parse(savedData);
        console.log('Data tersimpan ditemukan:', data); // Debugging
        
        // Isi form dengan data tersimpan
        document.getElementById('nama').value = data.nama;
        document.getElementById('nis').value = data.nis;
        document.getElementById('telepon').value = data.telepon;
        document.getElementById('email').value = data.email;
        document.getElementById('angkatan').value = data.angkatan;
        
        // Update user profile header
        const headerName = document.getElementById('headerUserName');
        if (headerName) {
            headerName.textContent = data.nama;
        }
        
        // Update avatar
        const avatar = document.querySelector('.user-avatar');
        if (avatar) {
            const initials = data.nama.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatar.textContent = initials;
        }
    }
}