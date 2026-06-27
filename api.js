// ─── API SOZLAMASI ───
const API_URL = 'http://localhost:5000/api';

// Token olish
function getToken() {
	const auth = localStorage.getItem('pinchuza_auth');
	if (!auth) return null;
	return JSON.parse(auth).token;
}

// Asosiy so'rov funksiyasi
async function apiRequest(method, endpoint, data = null) {
	const token = getToken();
	const options = {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: 'Bearer ' + token } : {}),
		},
	};
	if (data) options.body = JSON.stringify(data);

	try {
		const res = await fetch(API_URL + endpoint, options);
		const json = await res.json();
		if (!res.ok) throw new Error(json.error || 'Xato yuz berdi');
		return json;
	} catch (e) {
		console.error('API xato:', e.message);
		throw e;
	}
}

// ─── AUTH ───
const Auth = {
	async login(username, password) {
		const data = await apiRequest('POST', '/login', { username, password });
		// Token va ma'lumotlarni saqlash
		localStorage.setItem(
			'pinchuza_auth',
			JSON.stringify({
				token: data.token,
				user: data.username,
				name: data.username,
				korxona: data.korxona,
				loginTime: Date.now(),
			}),
		);
		return data;
	},

	logout() {
		localStorage.removeItem('pinchuza_auth');
		window.location.href = getBasePath() + 'index.html';
	},

	isLoggedIn() {
		return !!getToken();
	},

	check() {
		if (!this.isLoggedIn()) {
			window.location.href = getBasePath() + 'index.html';
		}
	},
};

// ─── ISHCHILAR ───
const Ishchilar = {
	async getAll() {
		return await apiRequest('GET', '/ishchilar');
	},
	async add(ishchi) {
		return await apiRequest('POST', '/ishchilar', ishchi);
	},
	async update(id, ishchi) {
		return await apiRequest('PUT', '/ishchilar/' + id, ishchi);
	},
	async delete(id) {
		return await apiRequest('DELETE', '/ishchilar/' + id);
	},
};

// ─── ISH HISOBI ───
const IshHisobi = {
	async getKunlik(sana) {
		return await apiRequest('GET', '/ish-hisobi/' + sana);
	},
	async getOylik(yil, oy) {
		return await apiRequest('GET', `/ish-hisobi/oy/${yil}/${oy}`);
	},
	async save(data) {
		return await apiRequest('POST', '/ish-hisobi', data);
	},
};

// ─── SAVDO ───
const Savdo = {
	async getOylik(yil, oy) {
		return await apiRequest('GET', `/savdo/${yil}/${oy}`);
	},
	async add(savdo) {
		return await apiRequest('POST', '/savdo', savdo);
	},
	async update(id, savdo) {
		return await apiRequest('PUT', '/savdo/' + id, savdo);
	},
	async delete(id) {
		return await apiRequest('DELETE', '/savdo/' + id);
	},
};

// ─── OMBOR ───
const Ombor = {
	async getOylik(yil, oy) {
		return await apiRequest('GET', `/ombor/${yil}/${oy}`);
	},
	async add(kirim) {
		return await apiRequest('POST', '/ombor', kirim);
	},
	async delete(id) {
		return await apiRequest('DELETE', '/ombor/' + id);
	},
};

// ─── NARXLAR (localStorage da saqlanadi) ───
const Narxlar = {
	get() {
		try {
			return (
				JSON.parse(localStorage.getItem('pinchuza_narxlar') || 'null') || {
					baylov_4000: 4000,
					baylov_5000: 5000,
					yuvuvchi: 500,
					hamir: 250,
					qurutuvchi: 200,
					chiqaruvchi: 200,
					qirquvchi: 200,
				}
			);
		} catch {
			return {};
		}
	},
	save(narxlar) {
		localStorage.setItem('pinchuza_narxlar', JSON.stringify(narxlar));
	},
};

// ─── YORDAMCHI FUNKSIYALAR ───
function genId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getBasePath() {
	// pages/ papkasida bo'lsa ../  bo'lmasa ''
	const path = window.location.pathname;
	return path.includes('/pages/') ? '../' : '';
}

// Sana formatlash
function formatSana(dateStr) {
	if (!dateStr) return '—';
	const d = new Date(dateStr + 'T00:00:00');
	const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyu', 'Iyu', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
	return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

function todayStr() {
	const d = new Date();
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
