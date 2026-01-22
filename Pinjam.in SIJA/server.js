const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('.'));

const loansFile = 'loans.json';

// Simple user data
const users = {
    admin: { password: 'admin123', role: 'admin' },
    user: { password: 'user123', role: 'user' }
};

app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    if (users[username] && users[username].password === password && users[username].role === role) {
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Invalid credentials' });
    }
});

app.post('/api/borrow', (req, res) => {
    const { item, nama, kelas, jumlah } = req.body;
    const loan = { item, nama, kelas, jumlah, date: new Date() };
    let loans = [];
    if (fs.existsSync(loansFile)) {
        loans = JSON.parse(fs.readFileSync(loansFile));
    }
    loans.push(loan);
    fs.writeFileSync(loansFile, JSON.stringify(loans, null, 2));
    res.json({ success: true });
});

app.get('/api/loans', (req, res) => {
    if (fs.existsSync(loansFile)) {
        const loans = JSON.parse(fs.readFileSync(loansFile));
        res.json(loans);
    } else {
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
