const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(
	cors({
		origin: '*',
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	}),
);
app.use(express.json());

// ─── DATABASE ULANISH ───
const db = mysql.createPool({
	host: process.env.MYSQLHOST || 'localhost',
	user: process.env.MYSQLUSER || 'root',
	password: process.env.MYSQLPASSWORD || '',
	database: process.env.MYSQLDATABASE || 'pinchuza',
	port: process.env.MYSQLPORT || 3306,
});

const JWT_SECRET = process.env.JWT_SECRET || 'pinchuza_secret';

// ─── AUTH MIDDLEWARE ───
function authMiddleware(req, res, next) {
	const token = req.headers.authorization?.split(' ')[1];
	if (!token) return res.status(401).json({ error: 'Token kerak' });
	try {
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch {
		return res.status(401).json({ error: 'Token yaroqsiz' });
	}
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════

// Login
app.post('/api/login', async (req, res) => {
	try {
		const { username, password } = req.body;
		const [rows] = await db.query('SELECT * FROM admin WHERE username = ?', [username]);
		if (rows.length === 0) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

		const admin = rows[0];
		const valid = password === admin.password; // oddiy tekshiruv
		if (!valid) return res.status(401).json({ error: "Parol noto'g'ri" });

		const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
		res.json({ token, username: admin.username, korxona: admin.korxona });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Parol o'zgartirish
app.put('/api/admin', authMiddleware, async (req, res) => {
	try {
		const { username, password, korxona } = req.body;
		await db.query('UPDATE admin SET username=?, password=?, korxona=? WHERE id=?', [username, password, korxona, req.user.id]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ══════════════════════════════════════════
//  ISHCHILAR
// ══════════════════════════════════════════

// Barcha ishchilar
app.get('/api/ishchilar', authMiddleware, async (req, res) => {
	try {
		const [rows] = await db.query('SELECT * FROM ishchilar ORDER BY qoshilgan DESC');
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ishchi qo'shish
app.post('/api/ishchilar', authMiddleware, async (req, res) => {
	try {
		const { id, ism, familiya, telefon, lavozim, baylov_narx } = req.body;
		await db.query('INSERT INTO ishchilar (id, ism, familiya, telefon, lavozim, baylov_narx) VALUES (?,?,?,?,?,?)', [
			id,
			ism,
			familiya || null,
			telefon || null,
			lavozim,
			baylov_narx || null,
		]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ishchi tahrirlash
app.put('/api/ishchilar/:id', authMiddleware, async (req, res) => {
	try {
		const { ism, familiya, telefon, lavozim, baylov_narx } = req.body;
		await db.query('UPDATE ishchilar SET ism=?, familiya=?, telefon=?, lavozim=?, baylov_narx=? WHERE id=?', [
			ism,
			familiya || null,
			telefon || null,
			lavozim,
			baylov_narx || null,
			req.params.id,
		]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ishchi o'chirish
app.delete('/api/ishchilar/:id', authMiddleware, async (req, res) => {
	try {
		await db.query('DELETE FROM ishchilar WHERE id=?', [req.params.id]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ══════════════════════════════════════════
//  ISH HISOBI
// ══════════════════════════════════════════

// Kunlik ish hisobi olish
app.get('/api/ish-hisobi/:sana', authMiddleware, async (req, res) => {
	try {
		const [rows] = await db.query('SELECT * FROM ish_hisobi WHERE sana=?', [req.params.sana]);
		// localStorage formatiga o'xshash object qaytaramiz
		const result = {};
		rows.forEach(r => {
			const key = r.lavozim === 'Baylovchi' ? r.ishchi_id + '_' + r.baylov_narx : r.ishchi_id;
			result[key] = { miqdor: r.miqdor, birlik: r.birlik, lavozim: r.lavozim };
		});
		res.json(result);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Oylik ish hisobi olish
app.get('/api/ish-hisobi/oy/:yil/:oy', authMiddleware, async (req, res) => {
	try {
		const { yil, oy } = req.params;
		const [rows] = await db.query('SELECT * FROM ish_hisobi WHERE YEAR(sana)=? AND MONTH(sana)=?', [yil, oy]);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ish hisobi saqlash
app.post('/api/ish-hisobi', authMiddleware, async (req, res) => {
	try {
		const { ishchi_id, sana, miqdor, birlik, lavozim, baylov_narx } = req.body;
		// Avval o'sha kun o'sha ishchi uchun ma'lumot bormi tekshiramiz
		await db.query(
			`INSERT INTO ish_hisobi (ishchi_id, sana, miqdor, birlik, lavozim, baylov_narx)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE miqdor=?, birlik=?`,
			[ishchi_id, sana, miqdor, birlik, lavozim, baylov_narx || null, miqdor, birlik],
		);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ══════════════════════════════════════════
//  SAVDO
// ══════════════════════════════════════════

// Oylik savdo
app.get('/api/savdo/:yil/:oy', authMiddleware, async (req, res) => {
	try {
		const { yil, oy } = req.params;
		const [rows] = await db.query('SELECT * FROM savdo WHERE YEAR(sana)=? AND MONTH(sana)=? ORDER BY sana DESC', [yil, oy]);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Savdo qo'shish
app.post('/api/savdo', authMiddleware, async (req, res) => {
	try {
		const { id, mijoz, qop, qop_hajm, sana, izoh } = req.body;
		await db.query('INSERT INTO savdo (id, mijoz, qop, qop_hajm, sana, izoh) VALUES (?,?,?,?,?,?)', [
			id,
			mijoz,
			qop,
			qop_hajm || null,
			sana,
			izoh || null,
		]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Savdo tahrirlash
app.put('/api/savdo/:id', authMiddleware, async (req, res) => {
	try {
		const { mijoz, qop, qop_hajm, sana, izoh } = req.body;
		await db.query('UPDATE savdo SET mijoz=?, qop=?, qop_hajm=?, sana=?, izoh=? WHERE id=?', [
			mijoz,
			qop,
			qop_hajm || null,
			sana,
			izoh || null,
			req.params.id,
		]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Savdo o'chirish
app.delete('/api/savdo/:id', authMiddleware, async (req, res) => {
	try {
		await db.query('DELETE FROM savdo WHERE id=?', [req.params.id]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ══════════════════════════════════════════
//  OMBOR
// ══════════════════════════════════════════

// Oylik ombor
app.get('/api/ombor/:yil/:oy', authMiddleware, async (req, res) => {
	try {
		const { yil, oy } = req.params;
		const [rows] = await db.query('SELECT * FROM ombor WHERE YEAR(sana)=? AND MONTH(sana)=? ORDER BY sana DESC', [yil, oy]);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ombor kirim qo'shish
app.post('/api/ombor', authMiddleware, async (req, res) => {
	try {
		const { id, miqdor, sana, izoh } = req.body;
		await db.query('INSERT INTO ombor (id, miqdor, sana, izoh) VALUES (?,?,?,?)', [id, miqdor, sana, izoh || null]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Ombor o'chirish
app.delete('/api/ombor/:id', authMiddleware, async (req, res) => {
	try {
		await db.query('DELETE FROM ombor WHERE id=?', [req.params.id]);
		res.json({ success: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ══════════════════════════════════════════
//  SERVER ISHGA TUSHIRISH
// ══════════════════════════════════════════
// Shu qatordan oldin qo'ying:
const path = require('path');
app.use(express.static(path.join(__dirname, '../')));
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../index.html'));
});

// Shu qator shu yerda qoladi:
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`✅ Server ishlamoqda: http://localhost:${PORT}`);
});
